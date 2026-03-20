import pytest
from django.contrib.gis.geos import MultiPolygon, Polygon
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from datasets.models import AOI, AOIPurpose, Dataset, DatasetAsset, DatasetAssetType, DatasetStatus, DatasetType, LicenseType, PlatformType, ValidationStatus
from users.models import Organization, User


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


def _create_dataset(
    *,
    user: User,
    footprint: MultiPolygon,
    dataset_type: str,
    status_value: str,
    validation_status: str,
    job=None,
):
    return Dataset.objects.create(
        title=f"{dataset_type}-{status_value}",
        description="Contribution test dataset",
        uploader=user,
        footprint=footprint,
        type=dataset_type,
        job=job,
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
def test_login_returns_organization_name():
    user = User.objects.create_user(
        email="user@example.com",
        password="testpass123",
        is_email_verified=True,
        organization_name="PhilSA",
    )
    client = APIClient(enforce_csrf_checks=False)

    response = client.post(
        reverse("auth-login"),
        {"email": user.email, "password": "testpass123"},
        format="json",
    )

    assert response.status_code == status.HTTP_200_OK
    assert response.json()["organization_name"] == "PhilSA"


@pytest.mark.django_db
def test_me_requires_authenticated_session():
    client = APIClient()

    response = client.get(reverse("auth-me"))

    assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
def test_user_profile_returns_phase1_stats(footprint):
    user = User.objects.create_user(
        email="contributor@example.com",
        password="testpass123",
        is_email_verified=True,
        organization_name="Map Action",
    )
    aoi = _create_aoi(footprint=footprint, title="Flood Area")
    raw_job = _create_dataset(
        user=user,
        footprint=footprint,
        dataset_type=DatasetType.RAW,
        status_value=DatasetStatus.PUBLISHED,
        validation_status=ValidationStatus.VALID,
    )
    raw_job.aoi = aoi
    raw_job.save(update_fields=["aoi"])
    ortho = _create_dataset(
        user=user,
        footprint=footprint,
        dataset_type=DatasetType.ORTHOPHOTO,
        status_value=DatasetStatus.PUBLISHED,
        validation_status=ValidationStatus.VALID,
        job=raw_job,
    )

    client = APIClient()
    client.force_login(user)
    response = client.get(reverse("user-me"))

    assert response.status_code == status.HTTP_200_OK
    assert response.json()["organization_name"] == "Map Action"
    assert response.json()["contribution_count"] == 3
    assert response.json()["points"] == 3
    assert response.json()["stats"] == {
        "raw_uploads_count": 1,
        "ortho_uploads_count": 1,
        "jobs_completed_count": 1,
    }
    assert response.json()["current_jobs"] == []
    assert response.json()["completed_jobs"][0]["id"] == str(raw_job.id)
    assert {entry["id"] for entry in response.json()["contributions"]} == {str(raw_job.id), str(ortho.id)}


@pytest.mark.django_db
def test_user_profile_returns_jobs_currently_working_on_from_downloads(footprint, monkeypatch):
    user = User.objects.create_user(email="worker@example.com", password="testpass123")
    owner = User.objects.create_user(email="owner@example.com", password="testpass123")
    raw_job = _create_dataset(
        user=owner,
        footprint=footprint,
        dataset_type=DatasetType.RAW,
        status_value=DatasetStatus.PUBLISHED,
        validation_status=ValidationStatus.VALID,
    )
    DatasetAsset.objects.create(
        dataset=raw_job,
        asset_type=DatasetAssetType.RAW_ARCHIVE,
        object_key="datasets/raw.zip",
        content_type="application/zip",
        size_bytes=100,
        checksum_sha256="a" * 64,
        is_downloadable=True,
        is_renderable_rgb=False,
    )
    monkeypatch.setattr("datasets.views.generate_dataset_asset_download_url", lambda **kwargs: "http://example.com/raw.zip")

    client = APIClient()
    client.force_login(user)
    download_response = client.get(reverse("dataset-download", args=[raw_job.id]))
    profile_response = client.get(reverse("user-me"))

    assert download_response.status_code == status.HTTP_200_OK
    assert profile_response.status_code == status.HTTP_200_OK
    assert profile_response.json()["current_jobs"][0]["id"] == str(raw_job.id)


@pytest.mark.django_db
def test_with_contributions_queryset_annotation_is_reusable(footprint):
    user = User.objects.create_user(email="alpha@example.com", password="testpass123")
    raw_job = _create_dataset(
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
        job=raw_job,
    )

    annotated_user = User.objects.with_contributions().get(email="alpha@example.com")

    assert annotated_user.raw_uploads_count == 1
    assert annotated_user.ortho_uploads_count == 1
    assert annotated_user.jobs_completed_count == 1
    assert annotated_user.contribution_count == 3


@pytest.mark.django_db
def test_public_profile_returns_zero_counts_for_non_public_datasets(footprint):
    user = User.objects.create_user(email="public@example.com", password="testpass123")
    _create_dataset(
        user=user,
        footprint=footprint,
        dataset_type=DatasetType.RAW,
        status_value=DatasetStatus.DRAFT,
        validation_status=ValidationStatus.PENDING,
    )

    response = APIClient().get(reverse("user-profile", args=[user.id]))

    assert response.status_code == status.HTTP_200_OK
    assert response.json()["stats"] == {
        "raw_uploads_count": 0,
        "ortho_uploads_count": 0,
        "jobs_completed_count": 0,
    }


@pytest.mark.django_db
def test_leaderboard_returns_user_and_organization_stats(footprint):
    top_user = User.objects.create_user(email="top@example.com", password="testpass123", organization_name="PhilSA")
    second_user = User.objects.create_user(email="second@example.com", password="testpass123", organization_name="PhilSA")
    independent_user = User.objects.create_user(email="independent@example.com", password="testpass123")

    top_raw = _create_dataset(
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
        job=top_raw,
    )
    _create_dataset(
        user=second_user,
        footprint=footprint,
        dataset_type=DatasetType.RAW,
        status_value=DatasetStatus.PUBLISHED,
        validation_status=ValidationStatus.VALID,
    )
    _create_dataset(
        user=independent_user,
        footprint=footprint,
        dataset_type=DatasetType.RAW,
        status_value=DatasetStatus.PUBLISHED,
        validation_status=ValidationStatus.VALID,
    )

    response = APIClient().get(reverse("leaderboard"))

    assert response.status_code == status.HTTP_200_OK
    assert response.json()["users"][0]["user_id"] == str(top_user.id)
    assert response.json()["users"][0]["jobs_completed_count"] == 1
    assert response.json()["users"][0]["contribution_count"] == 3
    assert response.json()["users"][0]["points"] == 3
    assert any(entry["user_id"] == str(independent_user.id) and entry["organization_name"] == "" for entry in response.json()["users"])
    assert [entry["organization_name"] for entry in response.json()["organizations"]] == ["PhilSA"]
    assert response.json()["organizations"][0]["contribution_count"] == 4
    assert response.json()["organizations"][0]["points"] == 4


@pytest.mark.django_db
def test_leaderboard_is_public(footprint):
    user = User.objects.create_user(email="publicleader@example.com", password="testpass123", organization_name="PhilSA")
    _create_dataset(
        user=user,
        footprint=footprint,
        dataset_type=DatasetType.RAW,
        status_value=DatasetStatus.PUBLISHED,
        validation_status=ValidationStatus.VALID,
    )

    response = APIClient().get(reverse("leaderboard"))

    assert response.status_code == status.HTTP_200_OK
    assert response.json()["users"][0]["user_id"] == str(user.id)


@pytest.mark.django_db
def test_organization_list_excludes_blank_affiliations():
    User.objects.create_user(email="blank@example.com", password="testpass123")
    User.objects.create_user(email="ph1@example.com", password="testpass123", organization_name="PhilSA")
    User.objects.create_user(email="ph2@example.com", password="testpass123", organization_name="PhilSA")
    User.objects.create_user(email="map@example.com", password="testpass123", organization_name="Map Action")

    response = APIClient().get(reverse("organization-list"))

    assert response.status_code == status.HTTP_200_OK
    assert response.json() == [
        {"organization_name": "Map Action", "member_count": 1, "is_full": False},
        {"organization_name": "PhilSA", "member_count": 2, "is_full": False},
    ]


@pytest.mark.django_db
def test_creating_an_organization_auto_assigns_creator_as_member():
    user = User.objects.create_user(email="member@example.com", password="testpass123")
    client = APIClient()
    client.force_login(user)

    response = client.patch(reverse("user-me"), {"organization_name": "Map Action"}, format="json")

    user.refresh_from_db()
    organization = Organization.objects.get(name="Map Action")
    assert response.status_code == status.HTTP_200_OK
    assert response.json()["organization_name"] == "Map Action"
    assert organization.created_by == user
    assert organization.members.count() == 1
    assert user.organization == organization


@pytest.mark.django_db
def test_user_can_switch_organizations_when_current_one_keeps_a_member():
    organization = Organization.objects.create(name="Map Action")
    user = User.objects.create_user(email="member@example.com", password="testpass123", organization_name="Map Action")
    User.objects.create_user(email="teammate@example.com", password="testpass123", organization_name="Map Action")
    User.objects.create_user(email="existing@example.com", password="testpass123", organization_name="PhilSA")
    client = APIClient()
    client.force_login(user)

    response = client.patch(reverse("user-me"), {"organization_name": "PhilSA"}, format="json")

    user.refresh_from_db()
    organization.refresh_from_db()
    assert response.status_code == status.HTTP_200_OK
    assert response.json()["organization_name"] == "PhilSA"
    assert user.organization_name == "PhilSA"
    assert organization.members.count() == 1


@pytest.mark.django_db
def test_sole_member_cannot_leave_organization():
    user = User.objects.create_user(email="member@example.com", password="testpass123", organization_name="Map Action")
    client = APIClient()
    client.force_login(user)

    response = client.patch(reverse("user-me"), {"organization_name": "PhilSA"}, format="json")

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert response.json()["organization_name"][0] == "You cannot leave an organization that would become empty."


@pytest.mark.django_db
def test_user_cannot_switch_into_full_organization():
    user = User.objects.create_user(email="newmember@example.com", password="testpass123", organization_name="Map Action")
    User.objects.create_user(email="teammate@example.com", password="testpass123", organization_name="Map Action")
    for index in range(50):
        User.objects.create_user(
            email=f"member{index}@example.com",
            password="testpass123",
            organization_name="PhilSA",
        )

    client = APIClient()
    client.force_login(user)
    response = client.patch(reverse("user-me"), {"organization_name": "PhilSA"}, format="json")

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert response.json()["organization_name"][0] == "This organization already has 50 members."
