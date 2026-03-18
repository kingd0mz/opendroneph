import hashlib
import mimetypes
import os
import tempfile
from uuid import uuid4

from django.db import IntegrityError
from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from datasets.models import (
    Dataset,
    DatasetAsset,
    DatasetAssetType,
    DatasetStatus,
    DatasetType,
    DownloadEvent,
    ModerationAction,
    ModerationActionType,
    RawAccessRequest,
    RawAccessRequestStatus,
    ValidationStatus,
)
from datasets.permissions import IsModerator, IsVerifiedUser
from datasets.serializers import (
    DatasetAssetSerializer,
    DatasetAssetUploadSerializer,
    DatasetSerializer,
    RawAccessRequestSerializer,
)
from datasets.services.storage import upload_dataset_asset
from datasets.services.validation import validate_ph_boundary_intersection, validate_strict_cog


class DatasetViewSet(viewsets.ModelViewSet):
    serializer_class = DatasetSerializer
    queryset = Dataset.objects.select_related("uploader", "processor").prefetch_related("assets")
    http_method_names = ["get", "post"]

    def get_queryset(self):
        if self.action in {"list", "retrieve"}:
            return self.queryset.filter(
                status=DatasetStatus.PUBLISHED,
                validation_status=ValidationStatus.VALID,
            )
        return self.queryset

    def get_permissions(self):
        if self.action in {"list", "retrieve"}:
            permission_classes = [AllowAny]
        elif self.action in {"create", "upload_asset", "download"}:
            permission_classes = [IsVerifiedUser]
        elif self.action in {"hide", "reinstate"}:
            permission_classes = [IsModerator]
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

    @action(detail=True, methods=["post"], url_path="upload-asset")
    def upload_asset(self, request, pk=None):
        dataset = self.get_object()
        if request.user != dataset.uploader and request.user != dataset.processor:
            return Response({"detail": "Only the uploader or processor can upload assets."}, status=status.HTTP_403_FORBIDDEN)

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
            object_key = f"datasets/{dataset.id}/{uuid4()}.tif"

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
            is_renderable_rgb=asset_type == DatasetAssetType.ORTHOPHOTO_COG,
        )
        return Response(DatasetAssetSerializer(asset).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def publish(self, request, pk=None):
        dataset = self.get_object()
        if request.user != dataset.uploader and request.user != dataset.processor:
            return Response({"detail": "Only the uploader or processor can publish."}, status=status.HTTP_403_FORBIDDEN)

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

    @action(detail=True, methods=["post"])
    def hide(self, request, pk=None):
        dataset = self.get_object()
        dataset.status = DatasetStatus.HIDDEN
        dataset.hidden_at = timezone.now()
        dataset.save(update_fields=["status", "hidden_at", "updated_at"])
        ModerationAction.objects.create(
            dataset=dataset,
            actor=request.user,
            action_type=ModerationActionType.HIDE,
            reason=request.data.get("reason"),
        )
        return Response(self.get_serializer(dataset).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"])
    def reinstate(self, request, pk=None):
        dataset = self.get_object()
        dataset.status = DatasetStatus.PUBLISHED
        dataset.hidden_at = None
        dataset.save(update_fields=["status", "hidden_at", "updated_at"])
        ModerationAction.objects.create(
            dataset=dataset,
            actor=request.user,
            action_type=ModerationActionType.REINSTATE,
            reason=request.data.get("reason"),
        )
        return Response(self.get_serializer(dataset).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["get"])
    def download(self, request, pk=None):
        dataset = get_object_or_404(
            self.queryset,
            pk=pk,
            status=DatasetStatus.PUBLISHED,
            validation_status=ValidationStatus.VALID,
        )
        asset = dataset.assets.filter(is_downloadable=True).order_by("created_at").first()
        if asset is None:
            return Response({"detail": "No downloadable asset is available for this dataset."}, status=status.HTTP_404_NOT_FOUND)

        event = DownloadEvent.objects.create(dataset=dataset, asset=asset, actor=request.user)
        return Response(
            {
                "dataset": str(dataset.id),
                "asset": DatasetAssetSerializer(asset).data,
                "download_event_id": str(event.id),
            },
            status=status.HTTP_200_OK,
        )


class RawAccessRequestViewSet(viewsets.ModelViewSet):
    serializer_class = RawAccessRequestSerializer
    queryset = RawAccessRequest.objects.select_related("dataset", "requester", "reviewed_by")
    http_method_names = ["get", "post"]

    def get_permissions(self):
        if self.action == "create":
            permission_classes = [IsVerifiedUser]
        elif self.action in {"approve", "deny"}:
            permission_classes = [IsAuthenticated]
        else:
            permission_classes = [IsAuthenticated]
        return [permission() for permission in permission_classes]

    def get_queryset(self):
        user = self.request.user
        if not user or not user.is_authenticated:
            return RawAccessRequest.objects.none()
        if self.action in {"approve", "deny"}:
            return self.queryset
        return self.queryset.filter(Q(dataset__uploader=user) | Q(requester=user)).distinct()

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        dataset = serializer.validated_data["dataset"]
        if dataset.status != DatasetStatus.PUBLISHED or dataset.validation_status != ValidationStatus.VALID:
            return Response({"detail": "Raw access can only be requested for published, valid datasets."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            raw_access_request = serializer.save()
        except IntegrityError:
            return Response({"detail": "A pending raw access request already exists for this dataset."}, status=status.HTTP_400_BAD_REQUEST)

        return Response(self.get_serializer(raw_access_request).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        raw_request = self.get_object()
        if request.user != raw_request.dataset.uploader:
            return Response({"detail": "Only the uploader can approve raw access requests."}, status=status.HTTP_403_FORBIDDEN)

        raw_request.status = RawAccessRequestStatus.APPROVED
        raw_request.reviewed_by = request.user
        raw_request.reviewed_at = timezone.now()
        raw_request.save(update_fields=["status", "reviewed_by", "reviewed_at", "updated_at"])
        return Response(self.get_serializer(raw_request).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"])
    def deny(self, request, pk=None):
        raw_request = self.get_object()
        if request.user != raw_request.dataset.uploader:
            return Response({"detail": "Only the uploader can deny raw access requests."}, status=status.HTTP_403_FORBIDDEN)

        raw_request.status = RawAccessRequestStatus.DENIED
        raw_request.reviewed_by = request.user
        raw_request.reviewed_at = timezone.now()
        raw_request.save(update_fields=["status", "reviewed_by", "reviewed_at", "updated_at"])
        return Response(self.get_serializer(raw_request).data, status=status.HTTP_200_OK)
