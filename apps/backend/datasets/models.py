import uuid

from django.conf import settings
from django.contrib.gis.db import models
from django.contrib.postgres.indexes import GistIndex
from django.db.models import Q


class DatasetType(models.TextChoices):
    RAW = "raw", "Raw"
    ORTHOPHOTO = "orthophoto", "Orthophoto"


class DatasetStatus(models.TextChoices):
    DRAFT = "draft", "Draft"
    PUBLISHED = "published", "Published"
    HIDDEN = "hidden", "Hidden"
    DELISTED = "delisted", "Delisted"


class ValidationStatus(models.TextChoices):
    PENDING = "pending", "Pending"
    VALID = "valid", "Valid"
    INVALID = "invalid", "Invalid"


class PlatformType(models.TextChoices):
    DRONE = "drone", "Drone"
    FIXED_WING = "fixed_wing", "Fixed Wing"
    OTHER = "other", "Other"


class LicenseType(models.TextChoices):
    CC_BY = "cc_by", "CC BY 4.0"
    CC_BY_NC = "cc_by_nc", "CC BY-NC 4.0"


class DatasetAssetType(models.TextChoices):
    RAW_ARCHIVE = "raw_archive", "Raw Archive"
    ORTHOPHOTO_COG = "orthophoto_cog", "Orthophoto COG"
    MULTISPECTRAL_ARCHIVE = "multispectral_archive", "Multispectral Archive"


class RawAccessRequestStatus(models.TextChoices):
    PENDING = "pending", "Pending"
    APPROVED = "approved", "Approved"
    DENIED = "denied", "Denied"
    REVOKED = "revoked", "Revoked"


class ModerationActionType(models.TextChoices):
    FLAG = "flag", "Flag"
    HIDE = "hide", "Hide"
    REINSTATE = "reinstate", "Reinstate"


class ValidationType(models.TextChoices):
    COG_STRICT = "cog_strict", "COG Strict"
    PH_BOUNDARY_INTERSECTION = "ph_boundary_intersection", "PH Boundary Intersection"


class ValidationResultStatus(models.TextChoices):
    PASS = "pass", "Pass"
    FAIL = "fail", "Fail"


class Dataset(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    uploader = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="uploaded_datasets",
    )
    processor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="processed_datasets",
        null=True,
        blank=True,
    )
    footprint = models.MultiPolygonField(srid=4326, spatial_index=True)
    type = models.CharField(max_length=20, choices=DatasetType.choices)
    status = models.CharField(
        max_length=20,
        choices=DatasetStatus.choices,
        default=DatasetStatus.DRAFT,
    )
    validation_status = models.CharField(
        max_length=20,
        choices=ValidationStatus.choices,
        default=ValidationStatus.PENDING,
    )
    capture_date = models.DateField()
    platform_type = models.CharField(max_length=20, choices=PlatformType.choices)
    camera_model = models.CharField(max_length=255)
    license_type = models.CharField(max_length=20, choices=LicenseType.choices)
    gsd_cm = models.FloatField(null=True, blank=True)
    crs_epsg = models.IntegerField(null=True, blank=True)
    processing_software = models.CharField(max_length=255, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    published_at = models.DateTimeField(null=True, blank=True)
    hidden_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        indexes = [
            GistIndex(fields=["footprint"], name="dataset_footprint_gix"),
            models.Index(fields=["status"], name="dataset_status_idx"),
            models.Index(fields=["validation_status"], name="dataset_valid_status_idx"),
        ]

    def __str__(self):
        return self.title


class DatasetAsset(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    dataset = models.ForeignKey(
        Dataset,
        on_delete=models.PROTECT,
        related_name="assets",
    )
    asset_type = models.CharField(max_length=30, choices=DatasetAssetType.choices)
    object_key = models.CharField(max_length=512)
    content_type = models.CharField(max_length=255)
    size_bytes = models.BigIntegerField()
    checksum_sha256 = models.CharField(max_length=64)
    is_downloadable = models.BooleanField(default=True)
    is_renderable_rgb = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=["dataset", "asset_type"], name="dataset_asset_type_idx"),
        ]

    def __str__(self):
        return f"{self.dataset_id}:{self.asset_type}"


class RawAccessRequest(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    dataset = models.ForeignKey(
        Dataset,
        on_delete=models.PROTECT,
        related_name="raw_access_requests",
    )
    requester = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="raw_access_requests",
    )
    reason = models.TextField()
    status = models.CharField(
        max_length=20,
        choices=RawAccessRequestStatus.choices,
        default=RawAccessRequestStatus.PENDING,
    )
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="reviewed_raw_access_requests",
        null=True,
        blank=True,
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["dataset", "requester"],
                condition=Q(status=RawAccessRequestStatus.PENDING),
                name="uniq_pending_raw_access_request",
            ),
        ]

    def __str__(self):
        return f"{self.dataset_id}:{self.requester_id}:{self.status}"


class ModerationAction(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    dataset = models.ForeignKey(
        Dataset,
        on_delete=models.PROTECT,
        related_name="moderation_actions",
    )
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="moderation_actions",
    )
    action_type = models.CharField(max_length=20, choices=ModerationActionType.choices)
    reason = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.dataset_id}:{self.action_type}"


class ValidationRecord(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    dataset = models.ForeignKey(
        Dataset,
        on_delete=models.PROTECT,
        related_name="validation_records",
    )
    validation_type = models.CharField(max_length=30, choices=ValidationType.choices)
    status = models.CharField(max_length=10, choices=ValidationResultStatus.choices)
    details_json = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.dataset_id}:{self.validation_type}:{self.status}"
