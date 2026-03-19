from django.contrib.auth import authenticate
from rest_framework import serializers

from datasets.models import AOI, Dataset, JobActivity
from users.services import user_display_name


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, trim_whitespace=False)

    def validate(self, attrs):
        request = self.context.get("request")
        user = authenticate(request=request, email=attrs["email"], password=attrs["password"])
        if user is None:
            raise serializers.ValidationError("Invalid email or password.")
        attrs["user"] = user
        return attrs


class UserContributionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Dataset
        fields = [
            "id",
            "title",
            "type",
            "status",
            "validation_status",
            "created_at",
        ]
        read_only_fields = fields


class CompletedJobSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source="dataset.id", read_only=True)
    title = serializers.CharField(source="dataset.title", read_only=True)
    status = serializers.CharField(source="dataset.status", read_only=True)
    validation_status = serializers.CharField(source="dataset.validation_status", read_only=True)
    created_at = serializers.DateTimeField(source="updated_at", read_only=True)

    class Meta:
        model = JobActivity
        fields = [
            "id",
            "title",
            "status",
            "validation_status",
            "created_at",
        ]
        read_only_fields = fields


class UserAOISerializer(serializers.ModelSerializer):
    class Meta:
        model = AOI
        fields = [
            "id",
            "title",
            "purpose",
            "is_active",
            "created_at",
        ]
        read_only_fields = fields


class UserProfileSerializer(serializers.Serializer):
    id = serializers.UUIDField(read_only=True)
    username = serializers.SerializerMethodField()
    contribution_count = serializers.IntegerField(read_only=True)
    dataset_count = serializers.SerializerMethodField()
    contributions = serializers.SerializerMethodField()
    uploaded_datasets = serializers.SerializerMethodField()
    completed_jobs = serializers.SerializerMethodField()
    aois_contributed_to = serializers.SerializerMethodField()

    def get_username(self, obj):
        return user_display_name(obj)

    def get_contributions(self, obj):
        contributions = getattr(obj, "public_contributions", None)
        if contributions is None:
            contributions = obj.uploaded_datasets.filter(
                status="published",
                validation_status="valid",
            ).order_by("-created_at")
        return UserContributionSerializer(contributions, many=True).data

    def get_dataset_count(self, obj):
        contributions = getattr(obj, "public_contributions", None)
        if contributions is None:
            contributions = obj.uploaded_datasets.filter(
                status="published",
                validation_status="valid",
            )
        return len(contributions)

    def get_uploaded_datasets(self, obj):
        return self.get_contributions(obj)

    def get_completed_jobs(self, obj):
        completed_jobs = getattr(obj, "public_completed_jobs", None)
        if completed_jobs is None:
            completed_jobs = obj.job_activities.filter(
                status="completed",
                dataset__type="raw",
                dataset__status="published",
            ).select_related("dataset").order_by("-updated_at")
        return CompletedJobSerializer(completed_jobs, many=True).data

    def get_aois_contributed_to(self, obj):
        aois = getattr(obj, "public_aois", None)
        if aois is None:
            aois = AOI.objects.filter(
                datasets__uploader=obj,
                datasets__status="published",
                datasets__validation_status="valid",
            ).distinct().order_by("title")
        return UserAOISerializer(aois, many=True).data


class LeaderboardEntrySerializer(serializers.Serializer):
    user_id = serializers.UUIDField(source="id", read_only=True)
    username = serializers.SerializerMethodField()
    contribution_count = serializers.IntegerField(read_only=True)

    def get_username(self, obj):
        return user_display_name(obj)
