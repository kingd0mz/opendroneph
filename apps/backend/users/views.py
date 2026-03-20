from django.contrib.auth import login, logout
from django.db.models import Count, F, IntegerField, Prefetch, Q, Value
from django.db.models.functions import Coalesce
from django.shortcuts import get_object_or_404
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import ensure_csrf_cookie
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from datasets.models import Dataset, DatasetStatus, DatasetType, ValidationStatus
from users.models import User
from users.serializers import (
    LeaderboardEntrySerializer,
    LoginSerializer,
    OrganizationLeaderboardEntrySerializer,
    UserProfileSerializer,
)


def _user_payload(user):
    return {
        "id": str(user.id),
        "email": user.email,
        "is_email_verified": user.is_email_verified,
        "is_staff": user.is_staff,
        "is_superuser": user.is_superuser,
        "organization_name": user.organization_name,
    }


def _profile_queryset():
    return User.objects.with_contributions().prefetch_related(
        Prefetch(
            "uploaded_datasets",
            queryset=Dataset.objects.filter(
                status=DatasetStatus.PUBLISHED,
                validation_status=ValidationStatus.VALID,
            ).order_by("-created_at"),
            to_attr="public_contributions",
        ),
        Prefetch(
            "uploaded_datasets",
            queryset=Dataset.objects.filter(
                type=DatasetType.ORTHOPHOTO,
                status=DatasetStatus.PUBLISHED,
                validation_status=ValidationStatus.VALID,
                job__isnull=False,
            )
            .select_related("job")
            .order_by("-created_at"),
            to_attr="public_completed_job_outputs",
        ),
    )


class LoginView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        serializer = LoginSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        login(request, serializer.validated_data["user"])
        return Response(_user_payload(request.user), status=status.HTTP_200_OK)


@method_decorator(ensure_csrf_cookie, name="dispatch")
class CsrfView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        return Response(status=status.HTTP_204_NO_CONTENT)


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        logout(request)
        return Response(status=status.HTTP_204_NO_CONTENT)


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(_user_payload(request.user), status=status.HTTP_200_OK)


class UserMeProfileView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = _profile_queryset().get(pk=request.user.pk)
        serializer = UserProfileSerializer(user)
        return Response(serializer.data, status=status.HTTP_200_OK)


class UserProfileView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, user_id):
        user = get_object_or_404(_profile_queryset(), pk=user_id)
        serializer = UserProfileSerializer(user)
        return Response(serializer.data, status=status.HTTP_200_OK)


class LeaderboardView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        users = User.objects.with_contributions().order_by("-contribution_count", "-jobs_completed_count", "email")[:50]
        published_valid = Q(
            uploaded_datasets__status=DatasetStatus.PUBLISHED,
            uploaded_datasets__validation_status=ValidationStatus.VALID,
        )
        organizations = (
            User.objects.exclude(organization_name="")
            .values("organization_name")
            .annotate(
                raw_uploads_count=Coalesce(
                    Count(
                        "uploaded_datasets",
                        filter=published_valid & Q(uploaded_datasets__type=DatasetType.RAW),
                        distinct=True,
                    ),
                    Value(0),
                    output_field=IntegerField(),
                ),
                ortho_uploads_count=Coalesce(
                    Count(
                        "uploaded_datasets",
                        filter=published_valid & Q(uploaded_datasets__type=DatasetType.ORTHOPHOTO),
                        distinct=True,
                    ),
                    Value(0),
                    output_field=IntegerField(),
                ),
                jobs_completed_count=Coalesce(
                    Count(
                        "uploaded_datasets__job",
                        filter=published_valid
                        & Q(uploaded_datasets__type=DatasetType.ORTHOPHOTO)
                        & Q(uploaded_datasets__job__isnull=False)
                        & Q(uploaded_datasets__job__type=DatasetType.RAW)
                        & Q(uploaded_datasets__job__status=DatasetStatus.PUBLISHED)
                        & Q(uploaded_datasets__job__validation_status=ValidationStatus.VALID),
                        distinct=True,
                    ),
                    Value(0),
                    output_field=IntegerField(),
                ),
            )
            .annotate(contribution_count=F("raw_uploads_count") + F("ortho_uploads_count") + F("jobs_completed_count"))
            .order_by("-contribution_count", "-jobs_completed_count", "organization_name")[:50]
        )
        organization_payload = [
            {
                "organization_name": row["organization_name"],
                "raw_uploads_count": row["raw_uploads_count"],
                "ortho_uploads_count": row["ortho_uploads_count"],
                "jobs_completed_count": row["jobs_completed_count"],
                "contribution_count": row["contribution_count"],
            }
            for row in organizations
        ]
        return Response(
            {
                "users": LeaderboardEntrySerializer(users, many=True).data,
                "organizations": OrganizationLeaderboardEntrySerializer(organization_payload, many=True).data,
            },
            status=status.HTTP_200_OK,
        )
