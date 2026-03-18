from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import rasterio
from rasterio.errors import RasterioError
from rasterio.windows import Window

from datasets.models import (
    Dataset,
    DatasetType,
    PHBoundary,
    ValidationRecord,
    ValidationResultStatus,
    ValidationStatus,
    ValidationType,
)


@dataclass(frozen=True)
class ValidationResult:
    passed: bool
    details: dict


def inspect_strict_cog(file_path: str | Path) -> ValidationResult:
    path = str(file_path)
    details: dict = {"check": "cog_strict", "path": path}
    passed = True

    try:
        with rasterio.open(path) as src:
            details["driver"] = src.driver
            details["is_geotiff"] = src.driver == "GTiff"
            details["is_tiled"] = bool(src.profile.get("tiled", False))
            details["has_overviews"] = bool(src.count > 0 and src.overviews(1))
            details["has_crs"] = src.crs is not None

            # Ensure at least one read succeeds (no read errors).
            src.read(1, window=Window(0, 0, 1, 1))
            details["read_ok"] = True

            passed = all(
                [
                    details["is_geotiff"],
                    details["is_tiled"],
                    details["has_overviews"],
                    details["has_crs"],
                    details["read_ok"],
                ]
            )
    except (RasterioError, OSError, ValueError) as exc:
        details["error"] = str(exc)
        details["read_ok"] = False
        passed = False

    return ValidationResult(passed, details)


def _create_validation_record(dataset: Dataset, validation_type: str, passed: bool, details: dict) -> ValidationRecord:
    status = ValidationResultStatus.PASS if passed else ValidationResultStatus.FAIL
    return ValidationRecord.objects.create(
        dataset=dataset,
        validation_type=validation_type,
        status=status,
        details_json=details,
    )


def validate_ph_boundary_intersection(dataset: Dataset) -> ValidationResult:
    details: dict = {"check": "ph_boundary_intersection"}
    boundary = PHBoundary.objects.filter(name="philippines").first()
    if boundary is None:
        details["error"] = "missing_ph_boundary"
        _create_validation_record(dataset, ValidationType.PH_BOUNDARY_INTERSECTION, False, details)
        dataset.validation_status = ValidationStatus.INVALID
        dataset.save(update_fields=["validation_status", "updated_at"])
        return ValidationResult(False, details)

    intersects = dataset.footprint.intersects(boundary.geometry)
    details["boundary"] = boundary.name
    details["intersects"] = bool(intersects)

    _create_validation_record(dataset, ValidationType.PH_BOUNDARY_INTERSECTION, intersects, details)
    dataset.validation_status = ValidationStatus.VALID if intersects else ValidationStatus.INVALID
    dataset.save(update_fields=["validation_status", "updated_at"])
    return ValidationResult(intersects, details)


def validate_strict_cog(dataset: Dataset, file_path: str | Path) -> ValidationResult:
    result = inspect_strict_cog(file_path)
    _create_validation_record(dataset, ValidationType.COG_STRICT, result.passed, result.details)
    dataset.validation_status = ValidationStatus.VALID if result.passed else ValidationStatus.INVALID
    dataset.save(update_fields=["validation_status", "updated_at"])
    return result


def run_dataset_validations(dataset: Dataset, file_path: str | Path | None = None) -> ValidationResult:
    boundary_result = validate_ph_boundary_intersection(dataset)
    if not boundary_result.passed:
        return boundary_result

    if dataset.type == DatasetType.ORTHOPHOTO:
        if not file_path:
            details = {"check": "cog_strict", "error": "missing_file_path"}
            _create_validation_record(dataset, ValidationType.COG_STRICT, False, details)
            dataset.validation_status = ValidationStatus.INVALID
            dataset.save(update_fields=["validation_status", "updated_at"])
            return ValidationResult(False, details)
        return validate_strict_cog(dataset, file_path)

    dataset.validation_status = ValidationStatus.VALID
    dataset.save(update_fields=["validation_status", "updated_at"])
    return ValidationResult(True, {"check": "dataset_validation", "message": "raw dataset boundary validation passed"})
