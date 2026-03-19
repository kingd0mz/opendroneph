import json

from django.contrib.gis.geos import GEOSGeometry, MultiPolygon
from rest_framework import serializers

from datasets.models import (
    AOI,
    Dataset,
    DatasetAsset,
    DatasetAssetType,
    DownloadEvent,
    JobActivity,
)
from users.services import user_display_name


class MultiPolygonGeoJSONField(serializers.Field):
    default_error_messages = {
        "invalid": "Expected a GeoJSON MultiPolygon object.",
    }

    def to_representation(self, value: MultiPolygon) -> dict:
        return json.loads(value.geojson)

    def to_internal_value(self, data) -> MultiPolygon:
        if not isinstance(data, dict) or data.get("type") != "MultiPolygon":
            self.fail("invalid")

        try:
            geometry = GEOSGeometry(json.dumps(data), srid=4326)
        except (TypeError, ValueError) as exc:
            raise serializers.ValidationError("Invalid GeoJSON geometry.") from exc

        if not isinstance(geometry, MultiPolygon):
            self.fail("invalid")
        return geometry


class DatasetAssetSerializer(serializers.ModelSerializer):
    class Meta:
        model = DatasetAsset
        fields = [
            "id",
            "dataset",
            "asset_type",
            "object_key",
            "content_type",
            "size_bytes",
            "checksum_sha256",
            "is_downloadable",
            "is_renderable_rgb",
            "created_at",
        ]
        read_only_fields = ["id", "dataset", "created_at"]


class AOISummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = AOI
        fields = [
            "id",
            "title",
            "description",
            "purpose",
            "is_active",
            "created_at",
        ]
        read_only_fields = fields


class PublicUploaderSerializer(serializers.Serializer):
    id = serializers.UUIDField(read_only=True)
    username = serializers.SerializerMethodField()
    email = serializers.EmailField(read_only=True)

    def get_username(self, obj):
        return user_display_name(obj)


class PublicDatasetAssetSerializer(serializers.ModelSerializer):
    class Meta:
        model = DatasetAsset
        fields = [
            "id",
            "asset_type",
            "size_bytes",
            "is_downloadable",
            "created_at",
        ]
        read_only_fields = fields


class DatasetSummarySerializer(serializers.ModelSerializer):
    data_type = serializers.CharField(source="type", read_only=True)

    class Meta:
        model = Dataset
        fields = [
            "id",
            "title",
            "data_type",
            "created_at",
        ]
        read_only_fields = fields


class JobActivityUserSerializer(serializers.Serializer):
    id = serializers.UUIDField(read_only=True)
    username = serializers.SerializerMethodField()

    def get_username(self, obj):
        return user_display_name(obj)


class JobActivitySerializer(serializers.ModelSerializer):
    user = JobActivityUserSerializer(read_only=True)

    class Meta:
        model = JobActivity
        fields = [
            "id",
            "status",
            "user",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields


class JobListDatasetSerializer(serializers.ModelSerializer):
    uploader = PublicUploaderSerializer(read_only=True)
    aoi = AOISummarySerializer(read_only=True)
    data_type = serializers.CharField(source="type", read_only=True)
    active_user_count = serializers.SerializerMethodField()
    active_usernames = serializers.SerializerMethodField()

    class Meta:
        model = Dataset
        fields = [
            "id",
            "title",
            "description",
            "uploader",
            "aoi",
            "data_type",
            "status",
            "validation_status",
            "created_at",
            "active_user_count",
            "active_usernames",
        ]
        read_only_fields = fields

    def get_active_user_count(self, obj):
        active_activities = getattr(obj, "prefetched_active_job_activities", None)
        if active_activities is not None:
            return len(active_activities)
        return obj.job_activities.filter(status="active").count()

    def get_active_usernames(self, obj):
        active_activities = getattr(obj, "prefetched_active_job_activities", None)
        if active_activities is None:
            active_activities = obj.job_activities.filter(status="active").select_related("user").order_by("created_at")[:3]
        return [user_display_name(activity.user) for activity in active_activities[:3]]


class AOISerializer(serializers.ModelSerializer):
    geometry = MultiPolygonGeoJSONField()
    raw_count = serializers.IntegerField(read_only=True)
    orthophoto_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = AOI
        fields = [
            "id",
            "title",
            "description",
            "geometry",
            "purpose",
            "is_active",
            "created_at",
            "raw_count",
            "orthophoto_count",
        ]
        read_only_fields = fields


class DatasetAssetUploadSerializer(serializers.Serializer):
    asset_type = serializers.ChoiceField(choices=DatasetAssetType.choices)
    file = serializers.FileField()


class DatasetSerializer(serializers.ModelSerializer):
    footprint = MultiPolygonGeoJSONField()
    assets = DatasetAssetSerializer(many=True, read_only=True)
    aoi_id = serializers.PrimaryKeyRelatedField(
        queryset=AOI.objects.filter(is_active=True),
        source="aoi",
        allow_null=True,
        required=False,
        write_only=True,
    )
    aoi = AOISummarySerializer(read_only=True)
    source_dataset_id = serializers.PrimaryKeyRelatedField(
        queryset=Dataset.objects.all(),
        source="source_dataset",
        allow_null=True,
        required=False,
        write_only=True,
    )
    source_dataset = DatasetSummarySerializer(read_only=True)

    class Meta:
        model = Dataset
        fields = [
            "id",
            "title",
            "description",
            "uploader",
            "aoi",
            "aoi_id",
            "source_dataset",
            "source_dataset_id",
            "footprint",
            "type",
            "status",
            "validation_status",
            "capture_date",
            "platform_type",
            "camera_model",
            "license_type",
            "gsd_cm",
            "crs_epsg",
            "processing_software",
            "published_at",
            "created_at",
            "updated_at",
            "assets",
        ]
        read_only_fields = [
            "id",
            "uploader",
            "status",
            "validation_status",
            "published_at",
            "created_at",
            "updated_at",
            "assets",
        ]

    def create(self, validated_data):
        validated_data["uploader"] = self.context["request"].user
        return super().create(validated_data)


class DatasetDetailSerializer(serializers.ModelSerializer):
    uploader = PublicUploaderSerializer(read_only=True)
    footprint = MultiPolygonGeoJSONField()
    data_type = serializers.CharField(source="type", read_only=True)
    assets = PublicDatasetAssetSerializer(many=True, read_only=True)
    aoi = AOISummarySerializer(read_only=True)
    source_dataset = DatasetSummarySerializer(read_only=True)

    class Meta:
        model = Dataset
        fields = [
            "id",
            "title",
            "description",
            "uploader",
            "aoi",
            "source_dataset",
            "data_type",
            "status",
            "validation_status",
            "created_at",
            "footprint",
            "assets",
        ]
        read_only_fields = fields


class DownloadEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = DownloadEvent
        fields = ["id", "dataset", "asset", "actor", "created_at"]
        read_only_fields = fields
