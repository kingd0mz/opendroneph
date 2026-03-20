from django.contrib.auth import authenticate
from rest_framework import serializers

from datasets.models import AOI, Dataset, DatasetStatus, DatasetType, ValidationStatus
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
    created_at = serializers.DateTimeField(read_only=True)

    class Meta:
        model = Dataset
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


class UserStatsSerializer(serializers.Serializer):
    raw_uploads_count = serializers.IntegerField(read_only=True)
    ortho_uploads_count = serializers.IntegerField(read_only=True)
    jobs_completed_count = serializers.IntegerField(read_only=True)


class UserProfileSerializer(serializers.Serializer):
    id = serializers.UUIDField(read_only=True)
    username = serializers.SerializerMethodField()
    organization_name = serializers.CharField(read_only=True)
    contribution_count = serializers.IntegerField(read_only=True)
    dataset_count = serializers.SerializerMethodField()
    stats = UserStatsSerializer(source="*", read_only=True)
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
                status=DatasetStatus.PUBLISHED,
                validation_status=ValidationStatus.VALID,
            ).order_by("-created_at")
        return UserContributionSerializer(contributions, many=True).data

    def get_dataset_count(self, obj):
        contributions = getattr(obj, "public_contributions", None)
        if contributions is None:
            contributions = obj.uploaded_datasets.filter(
                status=DatasetStatus.PUBLISHED,
                validation_status=ValidationStatus.VALID,
            )
        return len(contributions)

    def get_uploaded_datasets(self, obj):
        return self.get_contributions(obj)

    def get_completed_jobs(self, obj):
        completed_job_outputs = getattr(obj, "public_completed_job_outputs", None)
        if completed_job_outputs is not None:
            seen_job_ids = set()
            completed_jobs = []
            for output in completed_job_outputs:
                if output.job_id in seen_job_ids or output.job is None:
                    continue
                seen_job_ids.add(output.job_id)
                completed_jobs.append(output.job)
            return CompletedJobSerializer(completed_jobs, many=True).data

        completed_jobs = Dataset.objects.filter(
                type=DatasetType.RAW,
                status=DatasetStatus.PUBLISHED,
                validation_status=ValidationStatus.VALID,
                outputs__uploader=obj,
                outputs__type=DatasetType.ORTHOPHOTO,
                outputs__status=DatasetStatus.PUBLISHED,
                outputs__validation_status=ValidationStatus.VALID,
            ).distinct().order_by("-created_at")
        return CompletedJobSerializer(completed_jobs, many=True).data

    def get_aois_contributed_to(self, obj):
        aois = getattr(obj, "public_aois", None)
        if aois is None:
            aois = AOI.objects.filter(
                datasets__uploader=obj,
                datasets__status=DatasetStatus.PUBLISHED,
                datasets__validation_status=ValidationStatus.VALID,
            ).distinct().order_by("title")
        return UserAOISerializer(aois, many=True).data


class LeaderboardEntrySerializer(serializers.Serializer):
    user_id = serializers.UUIDField(source="id", read_only=True)
    username = serializers.SerializerMethodField()
    organization_name = serializers.CharField(read_only=True)
    raw_uploads_count = serializers.IntegerField(read_only=True)
    ortho_uploads_count = serializers.IntegerField(read_only=True)
    jobs_completed_count = serializers.IntegerField(read_only=True)
    contribution_count = serializers.IntegerField(read_only=True)

    def get_username(self, obj):
        return user_display_name(obj)


class OrganizationLeaderboardEntrySerializer(serializers.Serializer):
    organization_name = serializers.CharField(read_only=True)
    raw_uploads_count = serializers.IntegerField(read_only=True)
    ortho_uploads_count = serializers.IntegerField(read_only=True)
    jobs_completed_count = serializers.IntegerField(read_only=True)
    contribution_count = serializers.IntegerField(read_only=True)
