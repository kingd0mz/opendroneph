import hashlib
import mimetypes
import os
import tempfile
from uuid import uuid4

from django.db.models import Prefetch, Q
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from datasets.models import (
    Dataset,
    DatasetAsset,
    DatasetStatus,
    DatasetType,
    DownloadEvent,
    JobActivity,
    JobActivityStatus,
    ValidationStatus,
)
from datasets.serializers import (
    DatasetDetailSerializer,
    DatasetAssetSerializer,
    DatasetAssetUploadSerializer,
    DatasetSerializer,
    JobActivitySerializer,
    JobListDatasetSerializer,
)
from datasets.services.storage import generate_dataset_asset_download_url, upload_dataset_asset
from datasets.services.validation import validate_ph_boundary_intersection, validate_strict_cog


def _job_dataset_queryset():
    return Dataset.objects.filter(
        type=DatasetType.RAW,
        status=DatasetStatus.PUBLISHED,
    ).select_related("uploader").prefetch_related(
        Prefetch(
            "job_activities",
            queryset=JobActivity.objects.filter(status=JobActivityStatus.ACTIVE).select_related("user").order_by("created_at"),
            to_attr="prefetched_active_job_activities",
        )
    )


def _get_job_dataset(dataset_id):
    return Dataset.objects.filter(
        pk=dataset_id,
        type=DatasetType.RAW,
        status=DatasetStatus.PUBLISHED,
    ).select_related("uploader").first()


class DatasetViewSet(viewsets.ModelViewSet):
    serializer_class = DatasetSerializer
    queryset = Dataset.objects.select_related("uploader", "source_dataset").prefetch_related("assets")
    http_method_names = ["get", "post"]

    def get_serializer_class(self):
        if self.action == "retrieve":
            return DatasetDetailSerializer
        return super().get_serializer_class()

    def _visible_dataset_filter(self):
        public_filter = Q(
            status=DatasetStatus.PUBLISHED,
            validation_status=ValidationStatus.VALID,
        )
        user = self.request.user
        if user and user.is_authenticated:
            return public_filter | Q(uploader=user)
        return public_filter

    def get_queryset(self):
        if self.action in {"list", "retrieve"}:
            return self.queryset.filter(self._visible_dataset_filter()).distinct()
        return self.queryset

    def get_permissions(self):
        if self.action in {"list", "retrieve"}:
            permission_classes = [AllowAny]
        elif self.action in {"create", "upload_asset", "download"}:
            permission_classes = [IsAuthenticated]
        elif self.action == "publish":
            permission_classes = [IsAuthenticated]
        else:
            permission_classes = [IsAuthenticated]
        return [permission() for permission in permission_classes]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        dataset = serializer.save()
        response_serializer = self.get_serializer(dataset)
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)

    def retrieve(self, request, *args, **kwargs):
        dataset = self.get_object()
        serializer = self.get_serializer(dataset)
        return Response(serializer.data)

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
        suffix = os.path.splitext(uploaded_file.name or "")[1] or ".tif"

        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as temp_file:
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
            object_key = f"datasets/{dataset.id}/{uuid4()}{suffix.lower()}"

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


class JobListView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        serializer = JobListDatasetSerializer(_job_dataset_queryset().order_by("-created_at"), many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


class JobStartView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, dataset_id):
        dataset = _get_job_dataset(dataset_id)
        if dataset is None:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        activity, created = JobActivity.objects.update_or_create(
            dataset=dataset,
            user=request.user,
            defaults={"status": JobActivityStatus.ACTIVE},
        )
        serializer = JobActivitySerializer(activity)
        return Response(serializer.data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)


class JobCompleteView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, dataset_id):
        dataset = _get_job_dataset(dataset_id)
        if dataset is None:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        activity, created = JobActivity.objects.update_or_create(
            dataset=dataset,
            user=request.user,
            defaults={"status": JobActivityStatus.COMPLETED},
        )
        serializer = JobActivitySerializer(activity)
        return Response(serializer.data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)


class JobActivityView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, dataset_id):
        dataset = _get_job_dataset(dataset_id)
        if dataset is None:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        activities = dataset.job_activities.select_related("user").order_by("updated_at", "created_at")
        active_activities = [activity for activity in activities if activity.status == JobActivityStatus.ACTIVE]
        completed_activities = [activity for activity in activities if activity.status == JobActivityStatus.COMPLETED]

        return Response(
            {
                "dataset": {
                    "id": str(dataset.id),
                    "title": dataset.title,
                },
                "active_users": JobActivitySerializer(active_activities, many=True).data,
                "completed_users": JobActivitySerializer(completed_activities, many=True).data,
            },
            status=status.HTTP_200_OK,
        )
