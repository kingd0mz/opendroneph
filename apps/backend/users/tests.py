import pytest
from django.contrib.gis.geos import MultiPolygon, Polygon
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from datasets.models import AOI, AOIPurpose, Dataset, DatasetStatus, DatasetType, JobActivity, JobActivityStatus, LicenseType, PlatformType, ValidationStatus
from users.models import User


@pytest.fixture
def footprint():
    polygon = Polygon(
        (
            (120.8, 14.3),
            (121.2, 14.3),
            (121.2, 14.8),
            (120.8, 14.8),
            (120.8, 14.3),
        ),
        srid=4326,
    )
    return MultiPolygon(polygon, srid=4326)


def _create_dataset(*, user: User, footprint: MultiPolygon, dataset_type: str, status_value: str, validation_status: str):
    return Dataset.objects.create(
        title=f"{dataset_type}-{status_value}",
        description="Contribution test dataset",
        uploader=user,
        footprint=footprint,
        type=dataset_type,
        status=status_value,
        validation_status=validation_status,
        capture_date="2026-01-01",
        platform_type=PlatformType.DRONE,
        camera_model="Camera",
        license_type=LicenseType.CC_BY,
    )


def _create_aoi(*, footprint: MultiPolygon, title="AOI"):
    return AOI.objects.create(
        title=title,
        description="Priority area",
        geometry=footprint,
        purpose=AOIPurpose.DISASTER,
        is_active=True,
    )


@pytest.mark.django_db
def test_login_creates_session():
    user = User.objects.create_user(
        email="user@example.com",
        password="testpass123",
        is_email_verified=True,
    )
    client = APIClient(enforce_csrf_checks=False)

    response = client.post(
        reverse("auth-login"),
        {"email": user.email, "password": "testpass123"},
        format="json",
    )

    assert response.status_code == status.HTTP_200_OK
    assert response.json()["email"] == user.email


@pytest.mark.django_db
def test_me_requires_authenticated_session():
    client = APIClient()

    response = client.get(reverse("auth-me"))

    assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
def test_users_me_returns_contribution_count(footprint):
    user = User.objects.create_user(
        email="contributor@example.com",
        password="testpass123",
        is_email_verified=True,
    )
    aoi = _create_aoi(footprint=footprint, title="Flood Area")
    linked_dataset = _create_dataset(
        user=user,
        footprint=footprint,
        dataset_type=DatasetType.RAW,
        status_value=DatasetStatus.PUBLISHED,
        validation_status=ValidationStatus.VALID,
    )
    linked_dataset.aoi = aoi
    linked_dataset.save(update_fields=["aoi"])
    _create_dataset(
        user=user,
        footprint=footprint,
        dataset_type=DatasetType.ORTHOPHOTO,
        status_value=DatasetStatus.PUBLISHED,
        validation_status=ValidationStatus.VALID,
    )
    _create_dataset(
        user=user,
        footprint=footprint,
        dataset_type=DatasetType.RAW,
        status_value=DatasetStatus.PUBLISHED,
        validation_status=ValidationStatus.VALID,
    )
    _create_dataset(
        user=user,
        footprint=footprint,
        dataset_type=DatasetType.RAW,
        status_value=DatasetStatus.DRAFT,
        validation_status=ValidationStatus.PENDING,
    )
    expected_contributions = [
        {
            "id": str(dataset.id),
            "title": dataset.title,
            "type": dataset.type,
            "status": dataset.status,
            "validation_status": dataset.validation_status,
            "created_at": dataset.created_at.isoformat().replace("+00:00", "Z"),
        }
        for dataset in user.uploaded_datasets.filter(
            status=DatasetStatus.PUBLISHED,
            validation_status=ValidationStatus.VALID,
        ).order_by("-created_at")
    ]

    client = APIClient()
    client.force_login(user)
    response = client.get(reverse("user-me"))

    assert response.status_code == status.HTTP_200_OK
    assert response.json() == {
        "id": str(user.id),
        "username": "contributor",
        "contribution_count": 3,
        "dataset_count": 3,
        "contributions": expected_contributions,
        "uploaded_datasets": expected_contributions,
        "completed_jobs": [],
        "aois_contributed_to": [
            {
                "id": str(aoi.id),
                "title": aoi.title,
                "purpose": aoi.purpose,
                "is_active": aoi.is_active,
                "created_at": aoi.created_at.isoformat().replace("+00:00", "Z"),
            }
        ],
    }


@pytest.mark.django_db
def test_with_contributions_queryset_annotation_is_reusable(footprint):
    user = User.objects.create_user(email="alpha@example.com", password="testpass123")
    _create_dataset(
        user=user,
        footprint=footprint,
        dataset_type=DatasetType.RAW,
        status_value=DatasetStatus.PUBLISHED,
        validation_status=ValidationStatus.VALID,
    )
    _create_dataset(
        user=user,
        footprint=footprint,
        dataset_type=DatasetType.ORTHOPHOTO,
        status_value=DatasetStatus.PUBLISHED,
        validation_status=ValidationStatus.VALID,
    )
    _create_dataset(
        user=user,
        footprint=footprint,
        dataset_type=DatasetType.ORTHOPHOTO,
        status_value=DatasetStatus.PUBLISHED,
        validation_status=ValidationStatus.VALID,
    )

    annotated_user = User.objects.with_contributions().get(email="alpha@example.com")

    assert annotated_user.contribution_count == 3


@pytest.mark.django_db
def test_public_profile_returns_contribution_count(footprint):
    user = User.objects.create_user(email="public@example.com", password="testpass123")
    _create_dataset(
        user=user,
        footprint=footprint,
        dataset_type=DatasetType.RAW,
        status_value=DatasetStatus.DRAFT,
        validation_status=ValidationStatus.VALID,
    )

    response = APIClient().get(reverse("user-profile", args=[user.id]))

    assert response.status_code == status.HTTP_200_OK
    assert response.json()["username"] == "public"
    assert response.json()["contribution_count"] == 0
    assert response.json()["dataset_count"] == 0


@pytest.mark.django_db
def test_public_profile_returns_completed_jobs(footprint):
    user = User.objects.create_user(email="worker@example.com", password="testpass123")
    raw_job = _create_dataset(
        user=user,
        footprint=footprint,
        dataset_type=DatasetType.RAW,
        status_value=DatasetStatus.PUBLISHED,
        validation_status=ValidationStatus.VALID,
    )
    JobActivity.objects.create(dataset=raw_job, user=user, status=JobActivityStatus.COMPLETED)

    response = APIClient().get(reverse("user-profile", args=[user.id]))

    assert response.status_code == status.HTTP_200_OK
    assert response.json()["completed_jobs"] == [
        {
            "id": str(raw_job.id),
            "title": raw_job.title,
            "status": raw_job.status,
            "validation_status": raw_job.validation_status,
            "created_at": JobActivity.objects.get(dataset=raw_job, user=user).updated_at.isoformat().replace("+00:00", "Z"),
        }
    ]


@pytest.mark.django_db
def test_public_profile_returns_aois_contributed_to(footprint):
    user = User.objects.create_user(email="mapper@example.com", password="testpass123")
    aoi = _create_aoi(footprint=footprint, title="Coastal AOI")
    dataset = _create_dataset(
        user=user,
        footprint=footprint,
        dataset_type=DatasetType.ORTHOPHOTO,
        status_value=DatasetStatus.PUBLISHED,
        validation_status=ValidationStatus.VALID,
    )
    dataset.aoi = aoi
    dataset.save(update_fields=["aoi"])

    response = APIClient().get(reverse("user-profile", args=[user.id]))

    assert response.status_code == status.HTTP_200_OK
    assert response.json()["aois_contributed_to"] == [
        {
            "id": str(aoi.id),
            "title": aoi.title,
            "purpose": aoi.purpose,
            "is_active": aoi.is_active,
            "created_at": aoi.created_at.isoformat().replace("+00:00", "Z"),
        }
    ]


@pytest.mark.django_db
def test_leaderboard_returns_sorted_users(footprint):
    top_user = User.objects.create_user(email="top@example.com", password="testpass123")
    second_user = User.objects.create_user(email="second@example.com", password="testpass123")
    third_user = User.objects.create_user(email="third@example.com", password="testpass123")

    _create_dataset(
        user=top_user,
        footprint=footprint,
        dataset_type=DatasetType.RAW,
        status_value=DatasetStatus.PUBLISHED,
        validation_status=ValidationStatus.VALID,
    )
    _create_dataset(
        user=top_user,
        footprint=footprint,
        dataset_type=DatasetType.ORTHOPHOTO,
        status_value=DatasetStatus.PUBLISHED,
        validation_status=ValidationStatus.VALID,
    )
    _create_dataset(
        user=second_user,
        footprint=footprint,
        dataset_type=DatasetType.RAW,
        status_value=DatasetStatus.PUBLISHED,
        validation_status=ValidationStatus.VALID,
    )
    _create_dataset(
        user=third_user,
        footprint=footprint,
        dataset_type=DatasetType.ORTHOPHOTO,
        status_value=DatasetStatus.DELISTED,
        validation_status=ValidationStatus.VALID,
    )

    response = APIClient().get(reverse("leaderboard"))

    assert response.status_code == status.HTTP_200_OK
    payload = response.json()
    assert payload[0]["user_id"] == str(top_user.id)
    assert payload[0]["contribution_count"] == 2
    assert payload[1]["user_id"] == str(second_user.id)
    assert payload[1]["contribution_count"] == 1
    assert payload[2]["user_id"] == str(third_user.id)
    assert payload[2]["contribution_count"] == 0
