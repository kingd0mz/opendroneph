import json
import hashlib
import mimetypes
import os
import tempfile
from uuid import uuid4

from django.db import connection
from django.db.models import Count, Prefetch, Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, BasePermission, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from datasets.models import (
    AOI,
    Dataset,
    DatasetAsset,
    DatasetFlag,
    DatasetFlagStatus,
    DatasetStatus,
    DatasetType,
    DownloadEvent,
    Mission,
    ValidationStatus,
)
from datasets.serializers import (
    AOISerializer,
    DatasetAssetSerializer,
    DatasetAssetUploadSerializer,
    DatasetDetailSerializer,
    DatasetFlagCreateSerializer,
    DatasetSerializer,
    FlagSummarySerializer,
    JobListDatasetSerializer,
    MissionSerializer,
)
from datasets.services.storage import generate_dataset_asset_download_url, upload_dataset_asset
from datasets.services.validation import validate_ph_boundary_intersection, validate_strict_cog


DEFAULT_GRID_BBOX = (116.0, 4.0, 127.0, 21.5)


class IsModerator(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.is_staff)


def _public_dataset_filter():
    return Q(
        status=DatasetStatus.PUBLISHED,
        validation_status=ValidationStatus.VALID,
    )


def _public_aoi_dataset_filter():
    return Q(
        datasets__status=DatasetStatus.PUBLISHED,
        datasets__validation_status=ValidationStatus.VALID,
    )


def _visible_dataset_filter(user):
    public_filter = _public_dataset_filter()
    if user and user.is_authenticated:
        return public_filter | Q(uploader=user)
    return public_filter


def _public_aoi_dataset_queryset():
    return Dataset.objects.filter(_public_dataset_filter()).select_related("uploader", "aoi", "job", "mission").prefetch_related("assets")


def _job_dataset_queryset():
    orthophoto_outputs = Dataset.objects.filter(
        type=DatasetType.ORTHOPHOTO,
        status=DatasetStatus.PUBLISHED,
        validation_status=ValidationStatus.VALID,
    ).select_related("uploader").order_by("-created_at")
    participant_users = (
        Dataset.objects.filter(
            type=DatasetType.ORTHOPHOTO,
            status=DatasetStatus.PUBLISHED,
            validation_status=ValidationStatus.VALID,
            job__isnull=False,
        )
        .select_related("uploader")
        .order_by("uploader__email")
    )

    return (
        Dataset.objects.filter(
            type=DatasetType.RAW,
            status=DatasetStatus.PUBLISHED,
            validation_status=ValidationStatus.VALID,
        )
        .select_related("uploader", "aoi", "mission")
        .annotate(
            participants_count=Count(
                "outputs__uploader",
                filter=Q(
                    outputs__type=DatasetType.ORTHOPHOTO,
                    outputs__status=DatasetStatus.PUBLISHED,
                    outputs__validation_status=ValidationStatus.VALID,
                ),
                distinct=True,
            ),
            outputs_count=Count(
                "outputs",
                filter=Q(
                    outputs__type=DatasetType.ORTHOPHOTO,
                    outputs__status=DatasetStatus.PUBLISHED,
                    outputs__validation_status=ValidationStatus.VALID,
                ),
                distinct=True,
            ),
        )
        .prefetch_related(
            Prefetch(
                "outputs",
                queryset=orthophoto_outputs,
                to_attr="prefetched_outputs",
            ),
            Prefetch(
                "outputs",
                queryset=participant_users,
                to_attr="prefetched_participant_datasets",
            ),
        )
        .order_by("-created_at")
    )


def _aoi_queryset():
    public_filter = _public_aoi_dataset_filter()
    return AOI.objects.annotate(
        raw_count=Count(
            "datasets",
            filter=Q(datasets__type=DatasetType.RAW) & public_filter,
            distinct=True,
        ),
        orthophoto_count=Count(
            "datasets",
            filter=Q(datasets__type=DatasetType.ORTHOPHOTO) & public_filter,
            distinct=True,
        ),
    ).order_by("-is_active", "title")


def _grid_cell_size_for_zoom(zoom: float) -> float | None:
    if zoom <= 6:
        return 1.0
    if zoom <= 10:
        return 0.2
    return None


def _parse_bbox_param(raw_bbox: str | None):
    if not raw_bbox:
        return DEFAULT_GRID_BBOX

    try:
        west, south, east, north = [float(value) for value in raw_bbox.split(",")]
    except (TypeError, ValueError):
        return None

    if west >= east or south >= north:
        return None

    return west, south, east, north


def _grid_aggregation_feature_collection(*, bbox: tuple[float, float, float, float], zoom: float):
    cell_size = _grid_cell_size_for_zoom(zoom)
    if cell_size is None:
        return {
            "zoom_band": "high",
            "cell_size_degrees": None,
            "grid_cells": {
                "type": "FeatureCollection",
                "features": [],
            },
        }

    zoom_band = "low" if zoom <= 6 else "mid"
    west, south, east, north = bbox
    dataset_table = Dataset._meta.db_table

    query = f"""
        WITH visible AS (
            SELECT
                ST_Centroid(footprint) AS centroid
            FROM {dataset_table}
            WHERE status = %s
              AND validation_status = %s
              AND type = %s
              AND ST_Intersects(footprint, ST_MakeEnvelope(%s, %s, %s, %s, 4326))
        ),
        bucketed AS (
            SELECT
                floor((ST_X(centroid) - %s) / %s) * %s + %s AS grid_x,
                floor((ST_Y(centroid) - %s) / %s) * %s + %s AS grid_y,
                COUNT(*)::integer AS dataset_count
            FROM visible
            GROUP BY 1, 2
        )
        SELECT
            ST_AsGeoJSON(
                ST_MakeEnvelope(grid_x, grid_y, grid_x + %s, grid_y + %s, 4326)
            ) AS geometry,
            dataset_count
        FROM bucketed
        ORDER BY dataset_count DESC, grid_y DESC, grid_x ASC
    """

    params = [
        DatasetStatus.PUBLISHED,
        ValidationStatus.VALID,
        DatasetType.ORTHOPHOTO,
        west,
        south,
        east,
        north,
        west,
        cell_size,
        cell_size,
        west,
        south,
        cell_size,
        cell_size,
        south,
        cell_size,
        cell_size,
    ]

    with connection.cursor() as cursor:
        cursor.execute(query, params)
        rows = cursor.fetchall()

    features = []
    for index, (geometry_json, dataset_count) in enumerate(rows):
        features.append(
            {
                "type": "Feature",
                "geometry": json.loads(geometry_json),
                "properties": {
                    "id": f"{zoom_band}-{index}",
                    "count": dataset_count,
                },
            }
        )

    return {
        "zoom_band": zoom_band,
        "cell_size_degrees": cell_size,
        "grid_cells": {
            "type": "FeatureCollection",
            "features": features,
        },
    }


class DatasetViewSet(viewsets.ModelViewSet):
    serializer_class = DatasetSerializer
    queryset = Dataset.objects.select_related("uploader", "aoi", "job", "mission").prefetch_related("assets", "flags")
    http_method_names = ["get", "post", "delete"]

    def get_serializer_class(self):
        if self.action == "retrieve":
            return DatasetDetailSerializer
        return super().get_serializer_class()

    def get_queryset(self):
        if self.action in {"list", "retrieve"}:
            return self.queryset.filter(_visible_dataset_filter(self.request.user)).distinct()
        return self.queryset

    def get_permissions(self):
        if self.action in {"list", "retrieve"}:
            permission_classes = [AllowAny]
        elif self.action == "destroy":
            permission_classes = [IsModerator]
        else:
            permission_classes = [IsAuthenticated]
        return [permission() for permission in permission_classes]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        dataset = serializer.save()
        response_serializer = self.get_serializer(dataset)
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)

    def destroy(self, request, *args, **kwargs):
        dataset = self.get_object()
        dataset.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["post"], url_path="upload-asset")
    def upload_asset(self, request, pk=None):
        dataset = self.get_object()
        if request.user != dataset.uploader:
            return Response({"detail": "Only the uploader can upload assets."}, status=status.HTTP_403_FORBIDDEN)

        serializer = DatasetAssetUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        uploaded_file = serializer.validated_data["file"]
        asset_type = serializer.validated_data["asset_type"]
        checksum = hashlib.sha256()
        size_bytes = 0
        suffix = os.path.splitext(uploaded_file.name or "")[1].lower()

        if dataset.type == DatasetType.RAW:
            if asset_type != "raw_archive":
                return Response({"detail": "RAW datasets only accept raw_archive assets."}, status=status.HTTP_400_BAD_REQUEST)
            if suffix != ".zip":
                return Response({"detail": "RAW uploads must be .zip files."}, status=status.HTTP_400_BAD_REQUEST)
        elif asset_type != "orthophoto_cog":
            return Response({"detail": "Orthophoto datasets only accept orthophoto_cog assets."}, status=status.HTTP_400_BAD_REQUEST)

        with tempfile.NamedTemporaryFile(suffix=suffix or ".bin", delete=False) as temp_file:
            temp_path = temp_file.name
            for chunk in uploaded_file.chunks():
                checksum.update(chunk)
                size_bytes += len(chunk)
                temp_file.write(chunk)

        try:
            boundary_result = validate_ph_boundary_intersection(dataset)
            if not boundary_result.passed:
                return Response(
                    {
                        "detail": "Dataset failed PH boundary validation.",
                        "validation_status": dataset.validation_status,
                        "validation_details": boundary_result.details,
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if dataset.type == DatasetType.ORTHOPHOTO:
                cog_result = validate_strict_cog(dataset, temp_path)
                if not cog_result.passed:
                    return Response(
                        {
                            "detail": "Uploaded orthophoto_cog failed strict COG validation.",
                            "validation_status": dataset.validation_status,
                            "validation_details": cog_result.details,
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )

            content_type = uploaded_file.content_type or mimetypes.guess_type(uploaded_file.name or "")[0] or "application/octet-stream"
            object_key = f"datasets/{dataset.id}/{uuid4()}{suffix or '.bin'}"

            with open(temp_path, "rb") as stored_file:
                upload_dataset_asset(
                    file_obj=stored_file,
                    object_key=object_key,
                    content_type=content_type,
                )
        finally:
            if os.path.exists(temp_path):
                os.unlink(temp_path)

        asset = DatasetAsset.objects.create(
            dataset=dataset,
            asset_type=asset_type,
            object_key=object_key,
            content_type=content_type,
            size_bytes=size_bytes,
            checksum_sha256=checksum.hexdigest(),
            is_downloadable=True,
            is_renderable_rgb=dataset.type == DatasetType.ORTHOPHOTO,
        )
        return Response(DatasetAssetSerializer(asset).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def publish(self, request, pk=None):
        dataset = self.get_object()
        if request.user != dataset.uploader:
            return Response({"detail": "Only the uploader can publish."}, status=status.HTTP_403_FORBIDDEN)

        if dataset.validation_status != ValidationStatus.VALID:
            return Response(
                {
                    "detail": "Dataset validation must pass before publishing.",
                    "validation_status": dataset.validation_status,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        dataset.status = DatasetStatus.PUBLISHED
        dataset.published_at = timezone.now()
        dataset.save(update_fields=["status", "published_at", "updated_at"])
        return Response(self.get_serializer(dataset).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["get"])
    def download(self, request, pk=None):
        dataset = self.queryset.filter(
            pk=pk,
            status=DatasetStatus.PUBLISHED,
            validation_status=ValidationStatus.VALID,
        ).first()
        if dataset is None:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        asset = dataset.assets.filter(is_downloadable=True).order_by("created_at").first()
        if asset is None:
            return Response({"detail": "No downloadable asset is available for this dataset."}, status=status.HTTP_404_NOT_FOUND)

        event = DownloadEvent.objects.create(dataset=dataset, asset=asset, actor=request.user)
        return Response(
            {
                "dataset": str(dataset.id),
                "asset": DatasetAssetSerializer(asset).data,
                "download_url": generate_dataset_asset_download_url(object_key=asset.object_key),
                "download_event_id": str(event.id),
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=["post"], url_path="flags")
    def create_flag(self, request, pk=None):
        dataset = get_object_or_404(
            self.queryset.filter(_visible_dataset_filter(request.user)).distinct(),
            pk=pk,
        )
        serializer = DatasetFlagCreateSerializer(data=request.data, context={"request": request, "dataset": dataset})
        serializer.is_valid(raise_exception=True)
        flag = serializer.save()
        return Response(FlagSummarySerializer(flag).data, status=status.HTTP_201_CREATED)


class MissionViewSet(viewsets.ModelViewSet):
    serializer_class = MissionSerializer
    queryset = Mission.objects.select_related("aoi", "created_by").order_by("-created_at")
    http_method_names = ["get", "post", "patch", "put"]

    def get_permissions(self):
        if self.action in {"list", "retrieve"}:
            permission_classes = [AllowAny]
        else:
            permission_classes = [IsModerator]
        return [permission() for permission in permission_classes]


class FlaggedDatasetListView(APIView):
    permission_classes = [IsModerator]

    def get(self, request):
        flags = DatasetFlag.objects.filter(status=DatasetFlagStatus.PENDING).select_related("dataset", "created_by").order_by("-created_at")
        return Response(FlagSummarySerializer(flags, many=True).data, status=status.HTTP_200_OK)


class DatasetFlagIgnoreView(APIView):
    permission_classes = [IsModerator]

    def post(self, request, flag_id):
        flag = get_object_or_404(DatasetFlag, pk=flag_id)
        flag.status = DatasetFlagStatus.IGNORED
        flag.save(update_fields=["status", "updated_at"])
        return Response(FlagSummarySerializer(flag).data, status=status.HTTP_200_OK)


class JobListView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        jobs = list(_job_dataset_queryset())
        for job in jobs:
            participant_datasets = getattr(job, "prefetched_participant_datasets", [])
            unique_users = []
            seen_user_ids = set()
            for output in participant_datasets:
                if output.uploader_id in seen_user_ids:
                    continue
                seen_user_ids.add(output.uploader_id)
                unique_users.append(output.uploader)
            job.prefetched_participants = unique_users

        serializer = JobListDatasetSerializer(jobs, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


class GridAggregationView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        try:
            zoom = float(request.query_params.get("zoom", "5"))
        except ValueError:
            return Response({"detail": "Invalid zoom parameter."}, status=status.HTTP_400_BAD_REQUEST)

        bbox = _parse_bbox_param(request.query_params.get("bbox"))
        if bbox is None:
            return Response({"detail": "Invalid bbox parameter."}, status=status.HTTP_400_BAD_REQUEST)

        return Response(_grid_aggregation_feature_collection(bbox=bbox, zoom=zoom), status=status.HTTP_200_OK)


class AOIListView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        serializer = AOISerializer(_aoi_queryset(), many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


class AOIDatasetsView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, aoi_id):
        aoi = get_object_or_404(_aoi_queryset(), pk=aoi_id)
        datasets = _public_aoi_dataset_queryset().filter(aoi=aoi).order_by("-created_at")
        raw_datasets = datasets.filter(type=DatasetType.RAW)
        orthophotos = datasets.filter(type=DatasetType.ORTHOPHOTO)

        return Response(
            {
                "aoi": AOISerializer(aoi).data,
                "raw_datasets": DatasetDetailSerializer(raw_datasets, many=True).data,
                "orthophotos": DatasetDetailSerializer(orthophotos, many=True).data,
            },
            status=status.HTTP_200_OK,
        )
