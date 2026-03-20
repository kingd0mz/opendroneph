import json

from django.contrib.gis.geos import GEOSGeometry, MultiPolygon
from rest_framework import serializers

from datasets.models import (
    AOI,
    Dataset,
    DatasetAsset,
    DatasetAssetType,
    DatasetFlag,
    DatasetType,
    DownloadEvent,
    Mission,
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


class MissionSummarySerializer(serializers.ModelSerializer):
    aoi = AOISummarySerializer(read_only=True)

    class Meta:
        model = Mission
        fields = [
            "id",
            "title",
            "description",
            "aoi",
            "event_type",
            "status",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields


class MissionSerializer(serializers.ModelSerializer):
    aoi = AOISummarySerializer(read_only=True)
    aoi_id = serializers.PrimaryKeyRelatedField(queryset=AOI.objects.all(), source="aoi", write_only=True)
    created_by = serializers.SerializerMethodField()

    class Meta:
        model = Mission
        fields = [
            "id",
            "title",
            "description",
            "aoi",
            "aoi_id",
            "event_type",
            "status",
            "created_by",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_by", "created_at", "updated_at", "aoi"]

    def get_created_by(self, obj):
        return {
            "id": str(obj.created_by_id),
            "username": user_display_name(obj.created_by),
            "email": obj.created_by.email,
        }

    def create(self, validated_data):
        validated_data["created_by"] = self.context["request"].user
        return super().create(validated_data)


class PublicUploaderSerializer(serializers.Serializer):
    id = serializers.UUIDField(read_only=True)
    username = serializers.SerializerMethodField()
    email = serializers.EmailField(read_only=True)
    organization_name = serializers.CharField(read_only=True)

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


class FlagSummarySerializer(serializers.ModelSerializer):
    created_by = PublicUploaderSerializer(read_only=True)
    dataset = DatasetSummarySerializer(read_only=True)

    class Meta:
        model = DatasetFlag
        fields = [
            "id",
            "dataset",
            "reason",
            "status",
            "created_by",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields


class JobListDatasetSerializer(serializers.ModelSerializer):
    uploader = PublicUploaderSerializer(read_only=True)
    aoi = AOISummarySerializer(read_only=True)
    mission = MissionSummarySerializer(read_only=True)
    data_type = serializers.CharField(source="type", read_only=True)
    participants_count = serializers.IntegerField(read_only=True)
    outputs_count = serializers.IntegerField(read_only=True)
    participants = serializers.SerializerMethodField()
    outputs = serializers.SerializerMethodField()
    job_status = serializers.SerializerMethodField()

    class Meta:
        model = Dataset
        fields = [
            "id",
            "title",
            "description",
            "uploader",
            "aoi",
            "mission",
            "data_type",
            "status",
            "validation_status",
            "created_at",
            "participants_count",
            "outputs_count",
            "participants",
            "outputs",
            "job_status",
        ]
        read_only_fields = fields

    def get_participants(self, obj):
        users = getattr(obj, "prefetched_participants", None)
        if users is None:
            users = []
        return [
            {
                "id": str(user.id),
                "username": user_display_name(user),
                "organization_name": user.organization_name,
            }
            for user in users[:5]
        ]

    def get_outputs(self, obj):
        outputs = getattr(obj, "prefetched_outputs", None)
        if outputs is None:
            outputs = obj.outputs.filter(type=DatasetType.ORTHOPHOTO)
        return DatasetSummarySerializer(outputs[:5], many=True).data

    def get_job_status(self, obj):
        outputs_count = getattr(obj, "outputs_count", None)
        if outputs_count is None:
            outputs_count = obj.outputs.filter(type=DatasetType.ORTHOPHOTO).count()
        return "completed" if outputs_count >= 1 else "active"


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
    job_id = serializers.PrimaryKeyRelatedField(
        queryset=Dataset.objects.filter(type="raw"),
        source="job",
        allow_null=True,
        required=False,
        write_only=True,
    )
    job = DatasetSummarySerializer(read_only=True)
    mission_id = serializers.PrimaryKeyRelatedField(
        queryset=Mission.objects.all(),
        source="mission",
        allow_null=True,
        required=False,
        write_only=True,
    )
    mission = MissionSummarySerializer(read_only=True)

    class Meta:
        model = Dataset
        fields = [
            "id",
            "title",
            "description",
            "uploader",
            "aoi",
            "aoi_id",
            "job",
            "job_id",
            "mission",
            "mission_id",
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
            "aoi",
            "job",
            "mission",
        ]

    def validate(self, attrs):
        dataset_type = attrs.get("type")
        job = attrs.get("job")
        mission = attrs.get("mission")

        if dataset_type == "raw" and job is not None:
            raise serializers.ValidationError({"job_id": "RAW datasets cannot link to another job."})

        if dataset_type == "raw" and mission is not None:
            raise serializers.ValidationError({"mission_id": "RAW datasets cannot link to a mission in Phase 1."})

        if dataset_type == "orthophoto" and job is not None and job.type != "raw":
            raise serializers.ValidationError({"job_id": "Orthophotos can only link to RAW dataset jobs."})

        return attrs

    def create(self, validated_data):
        validated_data["uploader"] = self.context["request"].user
        return super().create(validated_data)


class DatasetDetailSerializer(serializers.ModelSerializer):
    uploader = PublicUploaderSerializer(read_only=True)
    footprint = MultiPolygonGeoJSONField()
    data_type = serializers.CharField(source="type", read_only=True)
    assets = PublicDatasetAssetSerializer(many=True, read_only=True)
    aoi = AOISummarySerializer(read_only=True)
    job = DatasetSummarySerializer(read_only=True)
    mission = MissionSummarySerializer(read_only=True)
    flags = FlagSummarySerializer(many=True, read_only=True)

    class Meta:
        model = Dataset
        fields = [
            "id",
            "title",
            "description",
            "uploader",
            "aoi",
            "job",
            "mission",
            "data_type",
            "status",
            "validation_status",
            "created_at",
            "footprint",
            "assets",
            "flags",
        ]
        read_only_fields = fields


class DatasetFlagCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = DatasetFlag
        fields = ["id", "dataset", "reason", "created_by", "status", "created_at", "updated_at"]
        read_only_fields = ["id", "dataset", "created_by", "status", "created_at", "updated_at"]

    def create(self, validated_data):
        validated_data["dataset"] = self.context["dataset"]
        validated_data["created_by"] = self.context["request"].user
        return super().create(validated_data)


class DownloadEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = DownloadEvent
        fields = ["id", "dataset", "asset", "actor", "created_at"]
        read_only_fields = fields
