import json
import hashlib
from pathlib import Path

import pytest
from django.contrib.gis.geos import MultiPolygon, Polygon
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from datasets.models import (
    AOI,
    AOIPurpose,
    Dataset,
    DatasetAsset,
    DatasetAssetType,
    DatasetStatus,
    DatasetType,
    DownloadEvent,
    JobActivity,
    JobActivityStatus,
    LicenseType,
    PHBoundary,
    PlatformType,
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


def _make_dataset(
    *,
    owner: User,
    footprint: MultiPolygon,
    status=DatasetStatus.DRAFT,
    validation_status=ValidationStatus.PENDING,
    dataset_type="orthophoto",
    aoi=None,
):
    return Dataset.objects.create(
        title="Dataset",
        description="Dataset description",
        uploader=owner,
        aoi=aoi,
        footprint=footprint,
        type=dataset_type,
        status=status,
        validation_status=validation_status,
        capture_date="2026-01-01",
        platform_type=PlatformType.DRONE,
        camera_model="Camera",
        license_type=LicenseType.CC_BY,
    )


def _add_asset(dataset: Dataset, path: Path, asset_type=DatasetAssetType.ORTHOPHOTO_COG):
    return DatasetAsset.objects.create(
        dataset=dataset,
        asset_type=asset_type,
        object_key=str(path),
        content_type="image/tiff",
        size_bytes=1024,
        checksum_sha256="a" * 64,
        is_downloadable=True,
        is_renderable_rgb=asset_type == DatasetAssetType.ORTHOPHOTO_COG,
    )


def _uploaded_file(name: str, source_path: Path, content_type: str) -> SimpleUploadedFile:
    return SimpleUploadedFile(name, source_path.read_bytes(), content_type=content_type)


def _make_aoi(*, geometry: MultiPolygon, purpose=AOIPurpose.DISASTER, title="AOI"):
    return AOI.objects.create(
        title=title,
        description="Priority area",
        geometry=geometry,
        purpose=purpose,
        is_active=True,
    )


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
    public_raw_dataset = _make_dataset(
        owner=uploader,
        footprint=inside_ph_footprint,
        status=DatasetStatus.PUBLISHED,
        validation_status=ValidationStatus.VALID,
        dataset_type="raw",
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
    returned_ids = {item["id"] for item in payload}
    assert returned_ids == {
        str(public_dataset.id),
        str(public_raw_dataset.id),
    }


@pytest.mark.django_db
def test_public_detail_returns_raw_dataset(api_client, uploader, inside_ph_footprint):
    dataset = _make_dataset(
        owner=uploader,
        footprint=inside_ph_footprint,
        status=DatasetStatus.PUBLISHED,
        validation_status=ValidationStatus.VALID,
        dataset_type="raw",
    )

    response = api_client.get(reverse("dataset-detail", args=[dataset.id]))

    assert response.status_code == status.HTTP_200_OK
    assert response.json()["id"] == str(dataset.id)


@pytest.mark.django_db
@pytest.mark.parametrize(
    ("dataset_status", "validation_status"),
    [
        (DatasetStatus.DRAFT, ValidationStatus.VALID),
        (DatasetStatus.PUBLISHED, ValidationStatus.INVALID),
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
def test_uploader_can_access_own_draft_dataset_via_detail_endpoint(api_client, uploader, inside_ph_footprint):
    dataset = _make_dataset(
        owner=uploader,
        footprint=inside_ph_footprint,
        status=DatasetStatus.DRAFT,
        validation_status=ValidationStatus.VALID,
    )
    api_client.force_login(uploader)

    response = api_client.get(reverse("dataset-detail", args=[dataset.id]))

    assert response.status_code == status.HTTP_200_OK
    assert response.json()["id"] == str(dataset.id)


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
def test_authenticated_owner_list_includes_own_non_public_datasets(api_client, uploader, another_verified_user, inside_ph_footprint):
    own_draft = _make_dataset(
        owner=uploader,
        footprint=inside_ph_footprint,
        status=DatasetStatus.DRAFT,
        validation_status=ValidationStatus.PENDING,
    )
    own_delisted = _make_dataset(
        owner=uploader,
        footprint=inside_ph_footprint,
        status=DatasetStatus.DELISTED,
        validation_status=ValidationStatus.INVALID,
    )
    public_dataset = _make_dataset(
        owner=another_verified_user,
        footprint=inside_ph_footprint,
        status=DatasetStatus.PUBLISHED,
        validation_status=ValidationStatus.VALID,
    )
    _make_dataset(
        owner=another_verified_user,
        footprint=inside_ph_footprint,
        status=DatasetStatus.DRAFT,
        validation_status=ValidationStatus.VALID,
    )
    api_client.force_login(uploader)

    response = api_client.get(reverse("dataset-list"))

    assert response.status_code == status.HTTP_200_OK
    returned_ids = {item["id"] for item in response.json()}
    assert returned_ids == {
        str(own_draft.id),
        str(own_delisted.id),
        str(public_dataset.id),
    }


@pytest.mark.django_db
def test_authenticated_user_cannot_download_invalid_dataset(api_client, verified_user, uploader, inside_ph_footprint):
    dataset = _make_dataset(
        owner=uploader,
        footprint=inside_ph_footprint,
        status=DatasetStatus.PUBLISHED,
        validation_status=ValidationStatus.INVALID,
    )
    _add_asset(dataset, Path(__file__).resolve().parents[2] / "test_data" / "valid_cog.tif")
    api_client.force_login(verified_user)

    response = api_client.get(reverse("dataset-download", args=[dataset.id]))

    assert response.status_code == status.HTTP_404_NOT_FOUND
    assert DownloadEvent.objects.count() == 0


@pytest.mark.django_db
def test_authenticated_owner_cannot_download_own_draft_dataset(api_client, uploader, inside_ph_footprint):
    dataset = _make_dataset(
        owner=uploader,
        footprint=inside_ph_footprint,
        status=DatasetStatus.DRAFT,
        validation_status=ValidationStatus.VALID,
    )
    _add_asset(dataset, Path(__file__).resolve().parents[2] / "test_data" / "valid_cog.tif")
    api_client.force_login(uploader)

    response = api_client.get(reverse("dataset-download", args=[dataset.id]))

    assert response.status_code == status.HTTP_404_NOT_FOUND
    assert DownloadEvent.objects.count() == 0


@pytest.mark.django_db
def test_authenticated_user_can_download_published_valid_raw_dataset(
    api_client,
    uploader,
    verified_user,
    inside_ph_footprint,
    monkeypatch,
):
    dataset = _make_dataset(
        owner=uploader,
        footprint=inside_ph_footprint,
        status=DatasetStatus.PUBLISHED,
        validation_status=ValidationStatus.VALID,
        dataset_type="raw",
    )
    asset = _add_asset(
        dataset,
        Path(__file__).resolve().parents[2] / "test_data" / "valid_cog.tif",
        asset_type=DatasetAssetType.RAW_ARCHIVE,
    )
    api_client.force_login(verified_user)
    presigned_url = "http://localhost:9000/datasets/raw.zip"
    monkeypatch.setattr("datasets.views.generate_dataset_asset_download_url", lambda **kwargs: presigned_url)

    response = api_client.get(reverse("dataset-download", args=[dataset.id]))

    assert response.status_code == status.HTTP_200_OK
    assert response.json()["asset"]["id"] == str(asset.id)
    assert response.json()["download_url"] == presigned_url
    assert response.json()["asset"]["is_renderable_rgb"] is False


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
def test_upload_valid_raw_archive_uses_zip_extension_and_skips_cog_validation(api_client, uploader, inside_ph_footprint, monkeypatch):
    dataset = _make_dataset(owner=uploader, footprint=inside_ph_footprint, dataset_type="raw")
    uploaded = {}

    def fake_upload_dataset_asset(*, file_obj, object_key, content_type):
        uploaded["bytes"] = file_obj.read()
        uploaded["object_key"] = object_key
        uploaded["content_type"] = content_type

    def fail_if_called(*args, **kwargs):
        raise AssertionError("RAW uploads must not trigger strict COG validation.")

    monkeypatch.setattr("datasets.views.upload_dataset_asset", fake_upload_dataset_asset)
    monkeypatch.setattr("datasets.views.validate_strict_cog", fail_if_called)
    api_client.force_login(uploader)
    raw_upload = SimpleUploadedFile("raw.zip", b"raw-bytes", content_type="application/zip")

    response = api_client.post(
        reverse("dataset-upload-asset", args=[dataset.id]),
        {
            "asset_type": DatasetAssetType.RAW_ARCHIVE,
            "file": raw_upload,
        },
        format="multipart",
    )

    assert response.status_code == status.HTTP_201_CREATED
    asset = DatasetAsset.objects.get(dataset=dataset)
    assert asset.object_key == uploaded["object_key"]
    assert asset.object_key.startswith(f"datasets/{dataset.id}/")
    assert asset.object_key.endswith(".zip")
    assert asset.content_type == "application/zip"
    assert asset.size_bytes == len(uploaded["bytes"])
    assert asset.checksum_sha256 == hashlib.sha256(uploaded["bytes"]).hexdigest()
    assert asset.is_renderable_rgb is False
    dataset.refresh_from_db()
    assert dataset.validation_status == ValidationStatus.VALID
    assert ValidationRecord.objects.filter(dataset=dataset, validation_type=ValidationType.PH_BOUNDARY_INTERSECTION).count() == 1
    assert ValidationRecord.objects.filter(dataset=dataset, validation_type=ValidationType.COG_STRICT).count() == 0


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


@pytest.mark.django_db
def test_create_orthophoto_dataset_without_source_dataset_succeeds(api_client, uploader, inside_ph_footprint):
    api_client.force_login(uploader)

    response = api_client.post(
        reverse("dataset-list"),
        {
            "title": "Ortho without source",
            "description": "No raw link",
            "type": DatasetType.ORTHOPHOTO,
            "footprint": json.loads(inside_ph_footprint.geojson),
            "capture_date": "2026-01-01",
            "platform_type": PlatformType.DRONE,
            "camera_model": "Camera",
            "license_type": LicenseType.CC_BY,
        },
        format="json",
    )

    assert response.status_code == status.HTTP_201_CREATED
    assert response.json()["source_dataset"] is None


@pytest.mark.django_db
def test_create_orthophoto_dataset_accepts_optional_source_dataset_id(api_client, uploader, inside_ph_footprint):
    source_dataset = _make_dataset(
        owner=uploader,
        footprint=inside_ph_footprint,
        status=DatasetStatus.PUBLISHED,
        validation_status=ValidationStatus.VALID,
        dataset_type=DatasetType.RAW,
    )
    api_client.force_login(uploader)

    response = api_client.post(
        reverse("dataset-list"),
        {
            "title": "Ortho with source",
            "description": "Linked for reference",
            "type": DatasetType.ORTHOPHOTO,
            "source_dataset_id": str(source_dataset.id),
            "footprint": json.loads(inside_ph_footprint.geojson),
            "capture_date": "2026-01-01",
            "platform_type": PlatformType.DRONE,
            "camera_model": "Camera",
            "license_type": LicenseType.CC_BY,
        },
        format="json",
    )

    assert response.status_code == status.HTTP_201_CREATED
    assert response.json()["source_dataset"]["id"] == str(source_dataset.id)
    assert response.json()["source_dataset"]["title"] == source_dataset.title


@pytest.mark.django_db
def test_create_dataset_accepts_optional_aoi_id(api_client, uploader, inside_ph_footprint):
    aoi = _make_aoi(geometry=inside_ph_footprint, title="Flood AOI")
    api_client.force_login(uploader)

    response = api_client.post(
        reverse("dataset-list"),
        {
            "title": "Raw with AOI",
            "description": "Linked to active area",
            "type": DatasetType.RAW,
            "aoi_id": str(aoi.id),
            "footprint": json.loads(inside_ph_footprint.geojson),
            "capture_date": "2026-01-01",
            "platform_type": PlatformType.DRONE,
            "camera_model": "Camera",
            "license_type": LicenseType.CC_BY,
        },
        format="json",
    )

    assert response.status_code == status.HTTP_201_CREATED
    assert response.json()["aoi"]["id"] == str(aoi.id)
    assert response.json()["aoi"]["title"] == aoi.title


@pytest.mark.django_db
def test_aoi_list_returns_progress_counts_for_public_datasets(api_client, uploader, inside_ph_footprint):
    aoi = _make_aoi(geometry=inside_ph_footprint, title="Disaster AOI")
    _make_dataset(
        owner=uploader,
        footprint=inside_ph_footprint,
        status=DatasetStatus.PUBLISHED,
        validation_status=ValidationStatus.VALID,
        dataset_type=DatasetType.RAW,
        aoi=aoi,
    )
    _make_dataset(
        owner=uploader,
        footprint=inside_ph_footprint,
        status=DatasetStatus.PUBLISHED,
        validation_status=ValidationStatus.VALID,
        dataset_type=DatasetType.ORTHOPHOTO,
        aoi=aoi,
    )
    _make_dataset(
        owner=uploader,
        footprint=inside_ph_footprint,
        status=DatasetStatus.DRAFT,
        validation_status=ValidationStatus.VALID,
        dataset_type=DatasetType.RAW,
        aoi=aoi,
    )

    response = api_client.get(reverse("aoi-list"))

    assert response.status_code == status.HTTP_200_OK
    assert response.json()[0]["id"] == str(aoi.id)
    assert response.json()[0]["raw_count"] == 1
    assert response.json()[0]["orthophoto_count"] == 1


@pytest.mark.django_db
def test_aoi_datasets_returns_public_raw_and_orthophotos(api_client, uploader, inside_ph_footprint):
    aoi = _make_aoi(geometry=inside_ph_footprint, title="Mapping Need")
    raw_dataset = _make_dataset(
        owner=uploader,
        footprint=inside_ph_footprint,
        status=DatasetStatus.PUBLISHED,
        validation_status=ValidationStatus.VALID,
        dataset_type=DatasetType.RAW,
        aoi=aoi,
    )
    orthophoto = _make_dataset(
        owner=uploader,
        footprint=inside_ph_footprint,
        status=DatasetStatus.PUBLISHED,
        validation_status=ValidationStatus.VALID,
        dataset_type=DatasetType.ORTHOPHOTO,
        aoi=aoi,
    )
    _make_dataset(
        owner=uploader,
        footprint=inside_ph_footprint,
        status=DatasetStatus.DRAFT,
        validation_status=ValidationStatus.VALID,
        dataset_type=DatasetType.RAW,
        aoi=aoi,
    )

    response = api_client.get(reverse("aoi-datasets", args=[aoi.id]))

    assert response.status_code == status.HTTP_200_OK
    assert response.json()["aoi"]["id"] == str(aoi.id)
    assert [item["id"] for item in response.json()["raw_datasets"]] == [str(raw_dataset.id)]
    assert [item["id"] for item in response.json()["orthophotos"]] == [str(orthophoto.id)]


@pytest.mark.django_db
def test_jobs_list_returns_published_raw_datasets_with_active_summary(api_client, uploader, verified_user, inside_ph_footprint):
    raw_job = _make_dataset(
        owner=uploader,
        footprint=inside_ph_footprint,
        status=DatasetStatus.PUBLISHED,
        validation_status=ValidationStatus.VALID,
        dataset_type=DatasetType.RAW,
    )
    _make_dataset(
        owner=uploader,
        footprint=inside_ph_footprint,
        status=DatasetStatus.PUBLISHED,
        validation_status=ValidationStatus.VALID,
        dataset_type=DatasetType.ORTHOPHOTO,
    )
    JobActivity.objects.create(dataset=raw_job, user=verified_user, status=JobActivityStatus.ACTIVE)

    response = api_client.get(reverse("job-list"))

    assert response.status_code == status.HTTP_200_OK
    assert len(response.json()) == 1
    assert response.json()[0]["id"] == str(raw_job.id)
    assert response.json()[0]["active_user_count"] == 1
    assert response.json()[0]["active_usernames"] == ["verified"]


@pytest.mark.django_db
def test_multiple_users_can_start_same_job_and_activity_lists_all(
    api_client,
    uploader,
    verified_user,
    another_verified_user,
    inside_ph_footprint,
):
    raw_job = _make_dataset(
        owner=uploader,
        footprint=inside_ph_footprint,
        status=DatasetStatus.PUBLISHED,
        validation_status=ValidationStatus.VALID,
        dataset_type=DatasetType.RAW,
    )

    api_client.force_login(verified_user)
    start_response = api_client.post(reverse("job-start", args=[raw_job.id]))
    assert start_response.status_code == status.HTTP_201_CREATED

    api_client.force_login(another_verified_user)
    second_start_response = api_client.post(reverse("job-start", args=[raw_job.id]))
    assert second_start_response.status_code == status.HTTP_201_CREATED

    activity_response = api_client.get(reverse("job-activity", args=[raw_job.id]))

    assert activity_response.status_code == status.HTTP_200_OK
    usernames = {entry["user"]["username"] for entry in activity_response.json()["active_users"]}
    assert usernames == {"verified", "another"}
    assert activity_response.json()["completed_users"] == []


@pytest.mark.django_db
def test_job_complete_moves_user_to_completed_list(api_client, uploader, verified_user, inside_ph_footprint):
    raw_job = _make_dataset(
        owner=uploader,
        footprint=inside_ph_footprint,
        status=DatasetStatus.PUBLISHED,
        validation_status=ValidationStatus.VALID,
        dataset_type=DatasetType.RAW,
    )
    JobActivity.objects.create(dataset=raw_job, user=verified_user, status=JobActivityStatus.ACTIVE)
    api_client.force_login(verified_user)

    complete_response = api_client.post(reverse("job-complete", args=[raw_job.id]))
    activity_response = api_client.get(reverse("job-activity", args=[raw_job.id]))

    assert complete_response.status_code == status.HTTP_200_OK
    assert activity_response.status_code == status.HTTP_200_OK
    assert activity_response.json()["active_users"] == []
    assert [entry["user"]["username"] for entry in activity_response.json()["completed_users"]] == ["verified"]
