import hashlib
from pathlib import Path

import pytest
from django.contrib.gis.geos import MultiPolygon, Polygon
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from datasets.models import (
    Dataset,
    DatasetAsset,
    DatasetAssetType,
    DatasetStatus,
    DownloadEvent,
    LicenseType,
    PHBoundary,
    PlatformType,
    RawAccessRequestStatus,
    ValidationRecord,
    ValidationStatus,
    ValidationType,
)
from users.models import User


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def verified_user(db):
    return User.objects.create_user(
        email="verified@example.com",
        password="testpass123",
        is_email_verified=True,
    )


@pytest.fixture
def uploader(db):
    return User.objects.create_user(
        email="uploader@example.com",
        password="testpass123",
        is_email_verified=True,
    )


@pytest.fixture
def another_verified_user(db):
    return User.objects.create_user(
        email="another@example.com",
        password="testpass123",
        is_email_verified=True,
    )


@pytest.fixture
def inside_ph_footprint():
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


@pytest.fixture
def outside_ph_footprint():
    polygon = Polygon(
        (
            (-10.0, -10.0),
            (-9.0, -10.0),
            (-9.0, -9.0),
            (-10.0, -9.0),
            (-10.0, -10.0),
        ),
        srid=4326,
    )
    return MultiPolygon(polygon, srid=4326)


@pytest.fixture(autouse=True)
def ensure_ph_boundary(db):
    if not PHBoundary.objects.filter(name="philippines").exists():
        PHBoundary.objects.create(
            name="philippines",
            geometry=MultiPolygon(
                Polygon(
                    (
                        (116.0, 4.0),
                        (127.0, 4.0),
                        (127.0, 21.5),
                        (116.0, 21.5),
                        (116.0, 4.0),
                    ),
                    srid=4326,
                ),
                srid=4326,
            ),
        )


def _make_dataset(*, owner: User, footprint: MultiPolygon, status=DatasetStatus.DRAFT, validation_status=ValidationStatus.PENDING):
    return Dataset.objects.create(
        title="Dataset",
        description="Dataset description",
        uploader=owner,
        processor=owner,
        footprint=footprint,
        type="orthophoto",
        status=status,
        validation_status=validation_status,
        capture_date="2026-01-01",
        platform_type=PlatformType.DRONE,
        camera_model="Camera",
        license_type=LicenseType.CC_BY,
    )


def _add_asset(dataset: Dataset, path: Path):
    return DatasetAsset.objects.create(
        dataset=dataset,
        asset_type=DatasetAssetType.ORTHOPHOTO_COG,
        object_key=str(path),
        content_type="image/tiff",
        size_bytes=1024,
        checksum_sha256="a" * 64,
        is_downloadable=True,
        is_renderable_rgb=True,
    )


def _uploaded_file(name: str, source_path: Path, content_type: str) -> SimpleUploadedFile:
    return SimpleUploadedFile(name, source_path.read_bytes(), content_type=content_type)


@pytest.mark.django_db
def test_publish_succeeds_for_valid_dataset(api_client, uploader, inside_ph_footprint):
    dataset = _make_dataset(
        owner=uploader,
        footprint=inside_ph_footprint,
        validation_status=ValidationStatus.VALID,
    )
    api_client.force_login(uploader)

    response = api_client.post(reverse("dataset-publish", args=[dataset.id]))

    dataset.refresh_from_db()
    assert response.status_code == status.HTTP_200_OK
    assert dataset.status == DatasetStatus.PUBLISHED
    assert dataset.published_at is not None


@pytest.mark.django_db
def test_publish_fails_for_invalid_dataset(api_client, uploader, inside_ph_footprint):
    dataset = _make_dataset(
        owner=uploader,
        footprint=inside_ph_footprint,
        validation_status=ValidationStatus.INVALID,
    )
    api_client.force_login(uploader)

    response = api_client.post(reverse("dataset-publish", args=[dataset.id]))

    dataset.refresh_from_db()
    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert response.json()["validation_status"] == ValidationStatus.INVALID
    assert dataset.status == DatasetStatus.DRAFT
    assert dataset.validation_status == ValidationStatus.INVALID


@pytest.mark.django_db
def test_anonymous_user_cannot_download(api_client, uploader, inside_ph_footprint):
    dataset = _make_dataset(
        owner=uploader,
        footprint=inside_ph_footprint,
        status=DatasetStatus.PUBLISHED,
        validation_status=ValidationStatus.VALID,
    )
    cog_path = Path(__file__).resolve().parents[2] / "test_data" / "valid_cog.tif"
    _add_asset(dataset, cog_path)

    response = api_client.get(reverse("dataset-download", args=[dataset.id]))

    assert response.status_code == status.HTTP_403_FORBIDDEN
    assert DownloadEvent.objects.count() == 0


@pytest.mark.django_db
def test_verified_user_can_download(api_client, verified_user, uploader, inside_ph_footprint, monkeypatch):
    dataset = _make_dataset(
        owner=uploader,
        footprint=inside_ph_footprint,
        status=DatasetStatus.PUBLISHED,
        validation_status=ValidationStatus.VALID,
    )
    asset = _add_asset(dataset, Path(__file__).resolve().parents[2] / "test_data" / "valid_cog.tif")
    api_client.force_login(verified_user)
    presigned_url = "http://minio.local/download/dataset.tif"

    monkeypatch.setattr("datasets.views.generate_dataset_asset_download_url", lambda **kwargs: presigned_url)

    response = api_client.get(reverse("dataset-download", args=[dataset.id]))

    assert response.status_code == status.HTTP_200_OK
    assert response.json()["asset"]["id"] == str(asset.id)
    assert response.json()["download_url"] == presigned_url
    event = DownloadEvent.objects.get()
    assert event.dataset == dataset
    assert event.asset == asset
    assert event.actor == verified_user


@pytest.mark.django_db
def test_retrieve_returns_public_dataset_detail(api_client, uploader, inside_ph_footprint):
    dataset = _make_dataset(
        owner=uploader,
        footprint=inside_ph_footprint,
        status=DatasetStatus.PUBLISHED,
        validation_status=ValidationStatus.VALID,
    )
    asset = _add_asset(dataset, Path(__file__).resolve().parents[2] / "test_data" / "valid_cog.tif")

    response = api_client.get(reverse("dataset-detail", args=[dataset.id]))

    assert response.status_code == status.HTTP_200_OK
    payload = response.json()
    assert payload["id"] == str(dataset.id)
    assert payload["data_type"] == dataset.type
    assert payload["uploader"]["id"] == str(uploader.id)
    assert payload["uploader"]["username"] == "uploader"
    assert payload["uploader"]["email"] == uploader.email
    assert payload["validation_status"] == ValidationStatus.VALID
    assert payload["assets"][0]["id"] == str(asset.id)
    assert payload["assets"][0]["asset_type"] == asset.asset_type


@pytest.mark.django_db
def test_list_returns_only_public_valid_datasets(api_client, uploader, inside_ph_footprint):
    public_dataset = _make_dataset(
        owner=uploader,
        footprint=inside_ph_footprint,
        status=DatasetStatus.PUBLISHED,
        validation_status=ValidationStatus.VALID,
    )
    _make_dataset(
        owner=uploader,
        footprint=inside_ph_footprint,
        status=DatasetStatus.DRAFT,
        validation_status=ValidationStatus.VALID,
    )
    _make_dataset(
        owner=uploader,
        footprint=inside_ph_footprint,
        status=DatasetStatus.PUBLISHED,
        validation_status=ValidationStatus.INVALID,
    )

    response = api_client.get(reverse("dataset-list"))

    assert response.status_code == status.HTTP_200_OK
    payload = response.json()
    assert len(payload) == 1
    assert payload[0]["id"] == str(public_dataset.id)


@pytest.mark.django_db
def test_my_datasets_returns_all_owned_datasets(api_client, uploader, another_verified_user, inside_ph_footprint):
    owned_draft = _make_dataset(
        owner=uploader,
        footprint=inside_ph_footprint,
        status=DatasetStatus.DRAFT,
        validation_status=ValidationStatus.PENDING,
    )
    owned_published = _make_dataset(
        owner=uploader,
        footprint=inside_ph_footprint,
        status=DatasetStatus.PUBLISHED,
        validation_status=ValidationStatus.VALID,
    )
    owned_hidden = _make_dataset(
        owner=uploader,
        footprint=inside_ph_footprint,
        status=DatasetStatus.HIDDEN,
        validation_status=ValidationStatus.VALID,
    )
    owned_delisted = _make_dataset(
        owner=uploader,
        footprint=inside_ph_footprint,
        status=DatasetStatus.DELISTED,
        validation_status=ValidationStatus.INVALID,
    )
    _make_dataset(
        owner=another_verified_user,
        footprint=inside_ph_footprint,
        status=DatasetStatus.PUBLISHED,
        validation_status=ValidationStatus.VALID,
    )
    api_client.force_login(uploader)

    response = api_client.get(reverse("my-dataset-list"))

    assert response.status_code == status.HTTP_200_OK
    payload = response.json()
    returned_ids = {item["id"] for item in payload}
    assert returned_ids == {
        str(owned_draft.id),
        str(owned_published.id),
        str(owned_hidden.id),
        str(owned_delisted.id),
    }


@pytest.mark.django_db
def test_my_datasets_requires_authentication(api_client):
    response = api_client.get(reverse("my-dataset-list"))

    assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
@pytest.mark.parametrize(
    ("dataset_status", "validation_status"),
    [
        (DatasetStatus.DRAFT, ValidationStatus.VALID),
        (DatasetStatus.PUBLISHED, ValidationStatus.INVALID),
        (DatasetStatus.HIDDEN, ValidationStatus.VALID),
        (DatasetStatus.DELISTED, ValidationStatus.VALID),
    ],
)
def test_non_public_dataset_detail_returns_not_found(
    api_client,
    uploader,
    inside_ph_footprint,
    dataset_status,
    validation_status,
):
    dataset = _make_dataset(
        owner=uploader,
        footprint=inside_ph_footprint,
        status=dataset_status,
        validation_status=validation_status,
    )

    response = api_client.get(reverse("dataset-detail", args=[dataset.id]))

    assert response.status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.django_db
def test_uploader_cannot_access_own_draft_dataset_via_public_detail_endpoint(api_client, uploader, inside_ph_footprint):
    dataset = _make_dataset(
        owner=uploader,
        footprint=inside_ph_footprint,
        status=DatasetStatus.DRAFT,
        validation_status=ValidationStatus.VALID,
    )
    api_client.force_login(uploader)

    response = api_client.get(reverse("dataset-detail", args=[dataset.id]))

    assert response.status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.django_db
def test_authenticated_non_owner_cannot_access_draft_dataset(api_client, uploader, another_verified_user, inside_ph_footprint):
    dataset = _make_dataset(
        owner=uploader,
        footprint=inside_ph_footprint,
        status=DatasetStatus.DRAFT,
        validation_status=ValidationStatus.VALID,
    )
    api_client.force_login(another_verified_user)

    response = api_client.get(reverse("dataset-detail", args=[dataset.id]))

    assert response.status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.django_db
def test_raw_access_workflow(api_client, uploader, verified_user, another_verified_user, inside_ph_footprint):
    dataset = _make_dataset(
        owner=uploader,
        footprint=inside_ph_footprint,
        status=DatasetStatus.PUBLISHED,
        validation_status=ValidationStatus.VALID,
    )

    api_client.force_login(verified_user)
    create_response = api_client.post(
        reverse("raw-access-request-list"),
        {"dataset": str(dataset.id), "reason": "Need original inputs for analysis."},
        format="json",
    )
    request_id = create_response.json()["id"]

    api_client.force_login(another_verified_user)
    unauthorized_approve = api_client.post(reverse("raw-access-request-approve", args=[request_id]))

    api_client.force_login(uploader)
    approve_response = api_client.post(reverse("raw-access-request-approve", args=[request_id]))

    api_client.force_login(another_verified_user)
    second_create_response = api_client.post(
        reverse("raw-access-request-list"),
        {"dataset": str(dataset.id), "reason": "Need a second review."},
        format="json",
    )
    second_request_id = second_create_response.json()["id"]

    api_client.force_login(uploader)
    deny_response = api_client.post(reverse("raw-access-request-deny", args=[second_request_id]))

    assert create_response.status_code == status.HTTP_201_CREATED
    assert unauthorized_approve.status_code == status.HTTP_403_FORBIDDEN
    assert approve_response.status_code == status.HTTP_200_OK
    assert approve_response.json()["status"] == RawAccessRequestStatus.APPROVED
    assert deny_response.status_code == status.HTTP_200_OK
    assert deny_response.json()["status"] == RawAccessRequestStatus.DENIED


@pytest.mark.django_db
def test_upload_valid_cog_succeeds_and_autofills_metadata(api_client, uploader, inside_ph_footprint, monkeypatch):
    dataset = _make_dataset(owner=uploader, footprint=inside_ph_footprint)
    uploaded = {}

    def fake_upload_dataset_asset(*, file_obj, object_key, content_type):
        uploaded["bytes"] = file_obj.read()
        uploaded["object_key"] = object_key
        uploaded["content_type"] = content_type

    monkeypatch.setattr("datasets.views.upload_dataset_asset", fake_upload_dataset_asset)
    api_client.force_login(uploader)
    cog_path = Path(__file__).resolve().parents[2] / "test_data" / "valid_cog.tif"

    response = api_client.post(
        reverse("dataset-upload-asset", args=[dataset.id]),
        {
            "asset_type": DatasetAssetType.ORTHOPHOTO_COG,
            "file": _uploaded_file("valid_cog.tif", cog_path, "image/tiff"),
        },
        format="multipart",
    )

    assert response.status_code == status.HTTP_201_CREATED
    asset = DatasetAsset.objects.get(dataset=dataset)
    assert asset.object_key == uploaded["object_key"]
    assert asset.object_key.startswith(f"datasets/{dataset.id}/")
    assert asset.object_key.endswith(".tif")
    assert asset.content_type == "image/tiff"
    assert asset.size_bytes == len(uploaded["bytes"])
    assert asset.checksum_sha256 == hashlib.sha256(uploaded["bytes"]).hexdigest()
    assert asset.is_renderable_rgb is True
    dataset.refresh_from_db()
    assert dataset.validation_status == ValidationStatus.VALID
    assert ValidationRecord.objects.filter(dataset=dataset, validation_type=ValidationType.PH_BOUNDARY_INTERSECTION).count() == 1
    assert ValidationRecord.objects.filter(dataset=dataset, validation_type=ValidationType.COG_STRICT).count() == 1


@pytest.mark.django_db
def test_upload_invalid_cog_is_rejected(api_client, uploader, inside_ph_footprint, monkeypatch):
    called = {"upload": False}

    def fake_upload_dataset_asset(*, file_obj, object_key, content_type):
        called["upload"] = True

    monkeypatch.setattr("datasets.views.upload_dataset_asset", fake_upload_dataset_asset)
    dataset = _make_dataset(owner=uploader, footprint=inside_ph_footprint)
    api_client.force_login(uploader)
    invalid_path = Path(__file__).resolve().parents[2] / "test_data" / "invalid.tif"

    response = api_client.post(
        reverse("dataset-upload-asset", args=[dataset.id]),
        {
            "asset_type": DatasetAssetType.ORTHOPHOTO_COG,
            "file": _uploaded_file("invalid.tif", invalid_path, "image/tiff"),
        },
        format="multipart",
    )

    dataset.refresh_from_db()
    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert DatasetAsset.objects.count() == 0
    assert called["upload"] is False
    assert dataset.validation_status == ValidationStatus.INVALID
    assert ValidationRecord.objects.filter(dataset=dataset, validation_type=ValidationType.PH_BOUNDARY_INTERSECTION).count() == 1
    assert ValidationRecord.objects.filter(dataset=dataset, validation_type=ValidationType.COG_STRICT).count() == 1


@pytest.mark.django_db
def test_upload_metadata_fields_are_not_required_in_request(api_client, uploader, inside_ph_footprint, monkeypatch):
    monkeypatch.setattr("datasets.views.upload_dataset_asset", lambda **kwargs: None)
    dataset = _make_dataset(owner=uploader, footprint=inside_ph_footprint)
    api_client.force_login(uploader)
    cog_path = Path(__file__).resolve().parents[2] / "test_data" / "valid_cog.tif"

    response = api_client.post(
        reverse("dataset-upload-asset", args=[dataset.id]),
        {
            "asset_type": DatasetAssetType.ORTHOPHOTO_COG,
            "file": _uploaded_file("valid_cog.tif", cog_path, "image/tiff"),
        },
        format="multipart",
    )

    assert response.status_code == status.HTTP_201_CREATED
