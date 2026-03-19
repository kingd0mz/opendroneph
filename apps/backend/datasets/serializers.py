import json

from django.contrib.gis.geos import GEOSGeometry, MultiPolygon
from rest_framework import serializers

from datasets.models import Dataset, DatasetAsset, DatasetAssetType, DownloadEvent, RawAccessRequest
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


class DatasetAssetUploadSerializer(serializers.Serializer):
    asset_type = serializers.ChoiceField(choices=DatasetAssetType.choices)
    file = serializers.FileField()


class DatasetSerializer(serializers.ModelSerializer):
    footprint = MultiPolygonGeoJSONField()
    assets = DatasetAssetSerializer(many=True, read_only=True)

    class Meta:
        model = Dataset
        fields = [
            "id",
            "title",
            "description",
            "uploader",
            "processor",
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
            "hidden_at",
            "created_at",
            "updated_at",
            "assets",
        ]
        read_only_fields = [
            "id",
            "uploader",
            "processor",
            "status",
            "validation_status",
            "published_at",
            "hidden_at",
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

    class Meta:
        model = Dataset
        fields = [
            "id",
            "title",
            "description",
            "uploader",
            "data_type",
            "status",
            "validation_status",
            "created_at",
            "footprint",
            "assets",
        ]
        read_only_fields = fields


class RawAccessRequestSerializer(serializers.ModelSerializer):
    class Meta:
        model = RawAccessRequest
        fields = [
            "id",
            "dataset",
            "requester",
            "reason",
            "status",
            "reviewed_by",
            "reviewed_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "requester",
            "status",
            "reviewed_by",
            "reviewed_at",
            "created_at",
            "updated_at",
        ]

    def create(self, validated_data):
        validated_data["requester"] = self.context["request"].user
        return super().create(validated_data)


class DownloadEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = DownloadEvent
        fields = ["id", "dataset", "asset", "actor", "created_at"]
        read_only_fields = fields
