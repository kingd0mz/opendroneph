# OpenDronePH Phase 1 Validation Rules

## 1. Scope
Validation in Phase 1 covers:
- orthophoto strict COG compliance
- Philippine boundary intersection
- clear user-facing error responses

No server-side raster conversion is allowed.

## 2. Orthophoto COG Validation (rasterio)
Orthophoto uploads are validated with `rasterio` and rejected on first failed rule.

## 2.1 Required COG Rules
- file must open as GeoTIFF
- internal tiling must be present
- overviews must exist
- CRS must exist

## 2.2 Result Handling
- On failure:
  - return HTTP `400`
  - include field-specific error details
  - persist `ValidationRecord(status=fail, validation_type=cog_strict, details_json=...)`
  - do not publish dataset
- On success:
  - persist `ValidationRecord(status=pass, validation_type=cog_strict, details_json=...)`

## 3. PH Boundary Intersection Validation

## 3.1 Geometry Input Rules
- input footprint must be Polygon or MultiPolygon GeoJSON
- footprint is normalized to SRID 4326
- invalid geometry is rejected (no silent repair in Phase 1)

## 3.2 Spatial Rule
- footprint must intersect the official PH boundary geometry
- non-intersection returns HTTP `400`
- persist `ValidationRecord` for pass/fail

## 4. Validation Sequence
1. parse payload and geometry type
2. validate geometry and SRID normalization
3. run PH boundary intersection
4. run COG strict checks for orthophoto file
5. write validation audit records

## 5. User-Facing Error Contract
Error payload fields:
- `code`
- `message`
- `details`

Required clarity:
- explicitly state which COG check failed
- provide conversion guidance link/document reference

## 6. Test Requirements (pytest)
- rejects non-GeoTIFF input
- rejects non-tiled GeoTIFF
- rejects missing overviews
- rejects missing CRS
- rejects footprint outside PH boundary
- accepts valid PH footprint + valid strict COG
- stores validation audit records for pass and fail

## 7. Boundary Dataset Governance
- PH boundary geometry source and version must be pinned and documented.
- Any future boundary data update requires test rerun for intersection behavior.
