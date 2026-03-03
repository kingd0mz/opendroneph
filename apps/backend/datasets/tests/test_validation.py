from pathlib import Path

import numpy as np
import pytest
import rasterio
from django.contrib.gis.geos import MultiPolygon, Polygon
from rasterio.enums import Resampling
from rasterio.transform import from_origin

from datasets.models import (
    Dataset,
    DatasetType,
    LicenseType,
    PHBoundary,
    PlatformType,
    ValidationResultStatus,
    ValidationStatus,
    ValidationType,
)
from datasets.services.validation import run_dataset_validations, validate_ph_boundary_intersection, validate_strict_cog
from users.models import User


@pytest.fixture
def user(db):
    return User.objects.create_user(email="validator@example.com", password="testpass123")


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


def _make_dataset(user: User, footprint: MultiPolygon) -> Dataset:
    return Dataset.objects.create(
        title="Test Dataset",
        description="Validation test dataset",
        uploader=user,
        processor=user,
        footprint=footprint,
        type=DatasetType.ORTHOPHOTO,
        capture_date="2026-01-01",
        platform_type=PlatformType.DRONE,
        camera_model="TestCam",
        license_type=LicenseType.CC_BY,
    )


def _create_geotiff(path: Path, tiled: bool, add_overviews: bool) -> None:
    data = np.arange(512 * 512, dtype=np.uint16).reshape((512, 512))
    transform = from_origin(120.0, 15.0, 0.0001, 0.0001)

    with rasterio.open(
        path,
        "w",
        driver="GTiff",
        height=512,
        width=512,
        count=1,
        dtype=data.dtype,
        crs="EPSG:4326",
        transform=transform,
        tiled=tiled,
        blockxsize=256,
        blockysize=256,
    ) as dst:
        dst.write(data, 1)
        if add_overviews:
            dst.build_overviews([2, 4], Resampling.nearest)
            dst.update_tags(ns="rio_overview", resampling="nearest")


@pytest.mark.django_db
def test_valid_cog_creates_pass_record_and_sets_dataset_valid(user, inside_ph_footprint, tmp_path):
    dataset = _make_dataset(user, inside_ph_footprint)
    cog_path = tmp_path / "valid_cog.tif"
    _create_geotiff(cog_path, tiled=True, add_overviews=True)

    result = validate_strict_cog(dataset, cog_path)

    dataset.refresh_from_db()
    record = dataset.validation_records.filter(validation_type=ValidationType.COG_STRICT).latest("created_at")
    assert result.passed is True
    assert dataset.validation_status == ValidationStatus.VALID
    assert record.status == ValidationResultStatus.PASS
    assert record.details_json["is_geotiff"] is True
    assert record.details_json["is_tiled"] is True
    assert record.details_json["has_overviews"] is True
    assert record.details_json["has_crs"] is True
    assert record.details_json["read_ok"] is True


@pytest.mark.django_db
def test_invalid_cog_creates_fail_record_and_sets_dataset_invalid(user, inside_ph_footprint, tmp_path):
    dataset = _make_dataset(user, inside_ph_footprint)
    invalid_path = tmp_path / "invalid_cog.tif"
    _create_geotiff(invalid_path, tiled=True, add_overviews=False)

    result = validate_strict_cog(dataset, invalid_path)

    dataset.refresh_from_db()
    record = dataset.validation_records.filter(validation_type=ValidationType.COG_STRICT).latest("created_at")
    assert result.passed is False
    assert dataset.validation_status == ValidationStatus.INVALID
    assert record.status == ValidationResultStatus.FAIL
    assert record.details_json["is_geotiff"] is True
    assert record.details_json["has_overviews"] is False


@pytest.mark.django_db
def test_ph_boundary_validation_fail(user, outside_ph_footprint):
    dataset = _make_dataset(user, outside_ph_footprint)

    result = validate_ph_boundary_intersection(dataset)

    dataset.refresh_from_db()
    record = dataset.validation_records.filter(validation_type=ValidationType.PH_BOUNDARY_INTERSECTION).latest("created_at")
    assert result.passed is False
    assert dataset.validation_status == ValidationStatus.INVALID
    assert record.status == ValidationResultStatus.FAIL
    assert record.details_json["intersects"] is False


@pytest.mark.django_db
def test_ph_boundary_validation_pass(user, inside_ph_footprint):
    # Ensure the static boundary exists even when tests run without migrations.
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

    dataset = _make_dataset(user, inside_ph_footprint)

    result = validate_ph_boundary_intersection(dataset)

    dataset.refresh_from_db()
    record = dataset.validation_records.filter(validation_type=ValidationType.PH_BOUNDARY_INTERSECTION).latest("created_at")
    assert result.passed is True
    assert dataset.validation_status == ValidationStatus.VALID
    assert record.status == ValidationResultStatus.PASS
    assert record.details_json["intersects"] is True


@pytest.mark.django_db
def test_run_dataset_validations_stops_on_boundary_failure(user, outside_ph_footprint, tmp_path):
    dataset = _make_dataset(user, outside_ph_footprint)
    cog_path = tmp_path / "valid_cog.tif"
    _create_geotiff(cog_path, tiled=True, add_overviews=True)

    result = run_dataset_validations(dataset, cog_path)

    dataset.refresh_from_db()
    assert result.passed is False
    assert dataset.validation_status == ValidationStatus.INVALID
    assert dataset.validation_records.filter(validation_type=ValidationType.PH_BOUNDARY_INTERSECTION).count() == 1
    assert dataset.validation_records.filter(validation_type=ValidationType.COG_STRICT).count() == 0
