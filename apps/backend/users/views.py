from django.contrib.auth import login, logout
from django.db.models import Prefetch
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import ensure_csrf_cookie
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from datasets.models import Dataset, DatasetStatus, ValidationStatus
from users.models import User
from users.serializers import LeaderboardEntrySerializer, LoginSerializer, UserProfileSerializer


def _user_payload(user):
    return {
        "id": str(user.id),
        "email": user.email,
        "is_email_verified": user.is_email_verified,
        "is_staff": user.is_staff,
        "is_superuser": user.is_superuser,
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
        )
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
        leaderboard = User.objects.with_contributions().order_by("-contribution_count", "email")[:50]
        serializer = LeaderboardEntrySerializer(leaderboard, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)
