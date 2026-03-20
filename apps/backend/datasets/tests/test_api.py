import json
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
    DatasetFlag,
    DatasetFlagStatus,
    DatasetStatus,
    DatasetType,
    LicenseType,
    Mission,
    MissionStatus,
    PHBoundary,
    PlatformType,
    ValidationStatus,
)
from users.models import User


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def moderator(db):
    return User.objects.create_user(
        email="moderator@example.com",
        password="testpass123",
        is_email_verified=True,
        is_staff=True,
        organization_name="PhilSA",
    )


@pytest.fixture
def uploader(db):
    return User.objects.create_user(
        email="uploader@example.com",
        password="testpass123",
        is_email_verified=True,
        organization_name="Map Action",
    )


@pytest.fixture
def worker(db):
    return User.objects.create_user(
        email="worker@example.com",
        password="testpass123",
        is_email_verified=True,
        organization_name="Map Action",
    )


@pytest.fixture
def reporter(db):
    return User.objects.create_user(
        email="reporter@example.com",
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


def _make_aoi(*, geometry: MultiPolygon, purpose=AOIPurpose.DISASTER, title="AOI"):
    return AOI.objects.create(
        title=title,
        description="Priority area",
        geometry=geometry,
        purpose=purpose,
        is_active=True,
    )


def _make_dataset(
    *,
    owner: User,
    footprint: MultiPolygon,
    dataset_type=DatasetType.RAW,
    status=DatasetStatus.PUBLISHED,
    validation_status=ValidationStatus.VALID,
    aoi=None,
    job=None,
    mission=None,
    title="Dataset",
):
    return Dataset.objects.create(
        title=title,
        description="Dataset description",
        uploader=owner,
        aoi=aoi,
        job=job,
        mission=mission,
        footprint=footprint,
        type=dataset_type,
        status=status,
        validation_status=validation_status,
        capture_date="2026-01-01",
        platform_type=PlatformType.DRONE,
        camera_model="Camera",
        license_type=LicenseType.CC_BY,
    )


@pytest.mark.django_db
def test_moderator_can_create_mission(api_client, moderator, inside_ph_footprint):
    aoi = _make_aoi(geometry=inside_ph_footprint, title="Flood AOI")
    api_client.force_login(moderator)

    response = api_client.post(
        reverse("mission-list"),
        {
            "title": "Metro Manila Flood Mapping",
            "description": "Collect orthos for flood impact.",
            "aoi_id": str(aoi.id),
            "event_type": "flood",
            "status": MissionStatus.ACTIVE,
        },
        format="json",
    )

    assert response.status_code == status.HTTP_201_CREATED
    assert response.json()["created_by"]["id"] == str(moderator.id)
    assert Mission.objects.get().status == MissionStatus.ACTIVE


@pytest.mark.django_db
def test_non_moderator_cannot_create_mission(api_client, uploader, inside_ph_footprint):
    aoi = _make_aoi(geometry=inside_ph_footprint)
    api_client.force_login(uploader)

    response = api_client.post(
        reverse("mission-list"),
        {
            "title": "Blocked",
            "description": "",
            "aoi_id": str(aoi.id),
            "event_type": "flood",
            "status": MissionStatus.ACTIVE,
        },
        format="json",
    )

    assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
def test_create_orthophoto_accepts_optional_job_and_mission_links(api_client, uploader, moderator, inside_ph_footprint):
    aoi = _make_aoi(geometry=inside_ph_footprint, title="Flood AOI")
    mission = Mission.objects.create(
        title="Mission",
        description="Mission description",
        aoi=aoi,
        event_type="flood",
        status=MissionStatus.ACTIVE,
        created_by=moderator,
    )
    raw_job = _make_dataset(owner=uploader, footprint=inside_ph_footprint, dataset_type=DatasetType.RAW, aoi=aoi, title="RAW job")
    api_client.force_login(uploader)

    response = api_client.post(
        reverse("dataset-list"),
        {
            "title": "Linked ortho",
            "description": "Derived from RAW job",
            "type": DatasetType.ORTHOPHOTO,
            "job_id": str(raw_job.id),
            "mission_id": str(mission.id),
            "footprint": json.loads(inside_ph_footprint.geojson),
            "capture_date": "2026-01-01",
            "platform_type": PlatformType.DRONE,
            "camera_model": "Camera",
            "license_type": LicenseType.CC_BY,
        },
        format="json",
    )

    assert response.status_code == status.HTTP_201_CREATED
    assert response.json()["job"]["id"] == str(raw_job.id)
    assert response.json()["mission"]["id"] == str(mission.id)


@pytest.mark.django_db
def test_create_raw_dataset_rejects_job_and_mission_links(api_client, uploader, moderator, inside_ph_footprint):
    aoi = _make_aoi(geometry=inside_ph_footprint)
    mission = Mission.objects.create(
        title="Mission",
        description="Mission description",
        aoi=aoi,
        event_type="flood",
        status=MissionStatus.ACTIVE,
        created_by=moderator,
    )
    raw_job = _make_dataset(owner=uploader, footprint=inside_ph_footprint, dataset_type=DatasetType.RAW)
    api_client.force_login(uploader)

    response = api_client.post(
        reverse("dataset-list"),
        {
            "title": "Invalid raw",
            "description": "",
            "type": DatasetType.RAW,
            "job_id": str(raw_job.id),
            "mission_id": str(mission.id),
            "footprint": json.loads(inside_ph_footprint.geojson),
            "capture_date": "2026-01-01",
            "platform_type": PlatformType.DRONE,
            "camera_model": "Camera",
            "license_type": LicenseType.CC_BY,
        },
        format="json",
    )

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert "job_id" in response.json()


@pytest.mark.django_db
def test_jobs_list_derives_participants_outputs_and_completed_status(api_client, uploader, worker, inside_ph_footprint):
    raw_job = _make_dataset(owner=uploader, footprint=inside_ph_footprint, dataset_type=DatasetType.RAW, title="RAW job")
    _make_dataset(
        owner=worker,
        footprint=inside_ph_footprint,
        dataset_type=DatasetType.ORTHOPHOTO,
        job=raw_job,
        title="Output 1",
    )

    response = api_client.get(reverse("job-list"))

    assert response.status_code == status.HTTP_200_OK
    payload = response.json()
    assert payload[0]["id"] == str(raw_job.id)
    assert payload[0]["participants_count"] == 1
    assert payload[0]["outputs_count"] == 1
    assert payload[0]["job_status"] == "completed"
    assert payload[0]["participants"][0]["username"] == "worker"


@pytest.mark.django_db
def test_user_can_flag_dataset(api_client, reporter, uploader, inside_ph_footprint):
    dataset = _make_dataset(owner=uploader, footprint=inside_ph_footprint, dataset_type=DatasetType.RAW)
    api_client.force_login(reporter)

    response = api_client.post(
        reverse("dataset-create-flag", args=[dataset.id]),
        {"reason": "Archive appears corrupted."},
        format="json",
    )

    assert response.status_code == status.HTTP_201_CREATED
    flag = DatasetFlag.objects.get()
    assert flag.reason == "Archive appears corrupted."
    assert flag.created_by == reporter
    assert flag.status == DatasetFlagStatus.PENDING


@pytest.mark.django_db
def test_moderator_can_list_and_ignore_flags(api_client, moderator, reporter, uploader, inside_ph_footprint):
    dataset = _make_dataset(owner=uploader, footprint=inside_ph_footprint, dataset_type=DatasetType.RAW)
    flag = DatasetFlag.objects.create(dataset=dataset, reason="Broken archive", created_by=reporter)
    api_client.force_login(moderator)

    list_response = api_client.get(reverse("flag-list"))
    ignore_response = api_client.post(reverse("flag-ignore", args=[flag.id]))

    flag.refresh_from_db()
    assert list_response.status_code == status.HTTP_200_OK
    assert list_response.json()[0]["id"] == str(flag.id)
    assert ignore_response.status_code == status.HTTP_200_OK
    assert flag.status == DatasetFlagStatus.IGNORED


@pytest.mark.django_db
def test_moderator_can_delete_flagged_dataset(api_client, moderator, reporter, uploader, inside_ph_footprint):
    dataset = _make_dataset(owner=uploader, footprint=inside_ph_footprint, dataset_type=DatasetType.RAW)
    DatasetFlag.objects.create(dataset=dataset, reason="Bad data", created_by=reporter)
    api_client.force_login(moderator)

    response = api_client.delete(reverse("dataset-detail", args=[dataset.id]))

    assert response.status_code == status.HTTP_204_NO_CONTENT
    assert Dataset.objects.count() == 0


@pytest.mark.django_db
def test_upload_raw_archive_requires_zip_file(api_client, uploader, inside_ph_footprint):
    dataset = _make_dataset(
        owner=uploader,
        footprint=inside_ph_footprint,
        dataset_type=DatasetType.RAW,
        status=DatasetStatus.DRAFT,
        validation_status=ValidationStatus.PENDING,
    )
    api_client.force_login(uploader)

    response = api_client.post(
        reverse("dataset-upload-asset", args=[dataset.id]),
        {
            "asset_type": DatasetAssetType.RAW_ARCHIVE,
            "file": SimpleUploadedFile("raw.tif", b"not-a-zip", content_type="image/tiff"),
        },
        format="multipart",
    )

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert response.json()["detail"] == "RAW uploads must be .zip files."
    assert DatasetAsset.objects.count() == 0


@pytest.mark.django_db
def test_upload_valid_raw_archive_stores_zip_as_is(api_client, uploader, inside_ph_footprint, monkeypatch):
    dataset = _make_dataset(
        owner=uploader,
        footprint=inside_ph_footprint,
        dataset_type=DatasetType.RAW,
        status=DatasetStatus.DRAFT,
        validation_status=ValidationStatus.PENDING,
    )
    uploaded = {}

    def fake_upload_dataset_asset(*, file_obj, object_key, content_type):
        uploaded["bytes"] = file_obj.read()
        uploaded["object_key"] = object_key
        uploaded["content_type"] = content_type

    monkeypatch.setattr("datasets.views.upload_dataset_asset", fake_upload_dataset_asset)
    api_client.force_login(uploader)

    response = api_client.post(
        reverse("dataset-upload-asset", args=[dataset.id]),
        {
            "asset_type": DatasetAssetType.RAW_ARCHIVE,
            "file": SimpleUploadedFile("raw.zip", b"zip-bytes", content_type="application/zip"),
        },
        format="multipart",
    )

    assert response.status_code == status.HTTP_201_CREATED
    assert uploaded["bytes"] == b"zip-bytes"
    assert uploaded["content_type"] == "application/zip"
    assert uploaded["object_key"].endswith(".zip")


@pytest.mark.django_db
def test_publish_and_download_still_work_for_public_job(api_client, uploader, worker, inside_ph_footprint, monkeypatch):
    dataset = _make_dataset(
        owner=uploader,
        footprint=inside_ph_footprint,
        dataset_type=DatasetType.RAW,
        status=DatasetStatus.PUBLISHED,
        validation_status=ValidationStatus.VALID,
    )
    DatasetAsset.objects.create(
        dataset=dataset,
        asset_type=DatasetAssetType.RAW_ARCHIVE,
        object_key="datasets/raw.zip",
        content_type="application/zip",
        size_bytes=100,
        checksum_sha256="a" * 64,
        is_downloadable=True,
        is_renderable_rgb=False,
    )
    api_client.force_login(worker)
    monkeypatch.setattr("datasets.views.generate_dataset_asset_download_url", lambda **kwargs: "http://example.com/raw.zip")

    response = api_client.get(reverse("dataset-download", args=[dataset.id]))

    assert response.status_code == status.HTTP_200_OK
    assert response.json()["asset"]["asset_type"] == DatasetAssetType.RAW_ARCHIVE
    assert response.json()["download_url"] == "http://example.com/raw.zip"


@pytest.mark.django_db
def test_upload_valid_orthophoto_keeps_linked_job_in_detail(api_client, uploader, worker, inside_ph_footprint):
    raw_job = _make_dataset(owner=uploader, footprint=inside_ph_footprint, dataset_type=DatasetType.RAW, title="RAW job")
    ortho = _make_dataset(owner=worker, footprint=inside_ph_footprint, dataset_type=DatasetType.ORTHOPHOTO, job=raw_job, title="Ortho")

    response = api_client.get(reverse("dataset-detail", args=[ortho.id]))

    assert response.status_code == status.HTTP_200_OK
    assert response.json()["job"]["id"] == str(raw_job.id)


@pytest.mark.django_db
def test_grid_aggregations_return_low_zoom_cells(api_client, uploader, inside_ph_footprint):
    _make_dataset(owner=uploader, footprint=inside_ph_footprint, dataset_type=DatasetType.RAW, title="RAW job")
    _make_dataset(owner=uploader, footprint=inside_ph_footprint, dataset_type=DatasetType.ORTHOPHOTO, title="Ortho")

    response = api_client.get(
        reverse("grid-aggregations"),
        {
            "zoom": "5",
            "bbox": "120,14,122,15",
        },
    )

    assert response.status_code == status.HTTP_200_OK
    payload = response.json()
    assert payload["zoom_band"] == "low"
    assert payload["cell_size_degrees"] == 1.0
    assert payload["grid_cells"]["type"] == "FeatureCollection"
    assert payload["grid_cells"]["features"][0]["geometry"]["type"] == "Polygon"
    assert payload["grid_cells"]["features"][0]["properties"]["count"] == 2


@pytest.mark.django_db
def test_grid_aggregations_return_empty_feature_collection_at_high_zoom(api_client):
    response = api_client.get(
        reverse("grid-aggregations"),
        {
            "zoom": "12",
            "bbox": "120,14,122,15",
        },
    )

    assert response.status_code == status.HTTP_200_OK
    assert response.json()["zoom_band"] == "high"
    assert response.json()["grid_cells"]["features"] == []
