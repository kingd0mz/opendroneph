# OpenDronePH Phase 1 Data Model (Validated Version)

---

## 1. Modeling Standards

* All domain entities use UUID primary keys.
* All spatial fields use SRID 4326 (EPSG:4326).
* All timestamps are timezone-aware UTC.
* Moderation uses soft-state via explicit `status` field (no hard delete).
* All foreign keys use `on_delete=PROTECT` unless otherwise justified.

---

## 2. Core Entities

---

## 2.1 User (Custom Django User with UUID PK)

* `id`: UUID primary key.
* `email`: unique, required.
* `password_hash`: managed by Django auth.
* `is_email_verified`: boolean, default false.
* `is_staff`: boolean.
* `created_at`
* `updated_at`

---

## 2.2 Dataset

Represents a logical drone survey contribution.

### Core Fields

* `id`: UUID PK.
* `title`: string.
* `description`: text.
* `uploader_id`: FK → User (required).
* `processor_id`: FK → User (nullable).
* `footprint`: MultiPolygon geometry (SRID 4326).
* `type`: enum [`raw`, `orthophoto`]
* `status`: enum [`draft`, `published`, `hidden`, `delisted`]
* `validation_status`: enum [`pending`, `valid`, `invalid`]

### Required Metadata Fields

* `capture_date`: date.
* `platform_type`: enum [`drone`, `fixed_wing`, `other`]
* `camera_model`: string.
* `license_type`: enum [`cc_by`, `cc_by_nc`]

### Orthophoto-Specific Metadata (nullable for raw)

* `gsd_cm`: float nullable.
* `crs_epsg`: integer nullable.
* `processing_software`: string nullable.

### Timestamps

* `created_at`
* `updated_at`
* `published_at` (nullable)
* `hidden_at` (nullable)

---

## 2.3 DatasetAsset

Represents a file stored in MinIO.

* `id`: UUID PK.
* `dataset_id`: FK → Dataset.
* `asset_type`: enum

  * `raw_archive`
  * `orthophoto_cog`
  * `multispectral_archive`
* `object_key`: string (MinIO key).
* `content_type`: string.
* `size_bytes`: bigint.
* `checksum_sha256`: string.
* `is_downloadable`: boolean.
* `is_renderable_rgb`: boolean.
* `created_at`

### Rules

* `orthophoto_cog` requires strict COG validation.
* `multispectral_archive` must have `is_renderable_rgb = false`.
* Only `orthophoto_cog` assets are rendered on map.

---

## 2.4 RawAccessRequest

* `id`: UUID PK.
* `dataset_id`: FK → Dataset (must reference `type = raw`)
* `requester_id`: FK → User.
* `reason`: text.
* `status`: enum [`pending`, `approved`, `denied`, `revoked`]
* `reviewed_by_id`: FK → User nullable.
* `reviewed_at`: datetime nullable.
* `created_at`
* `updated_at`

Constraint:

* Unique active request per (`dataset_id`, `requester_id`) where status = `pending`.

---

## 2.5 ModerationAction

* `id`: UUID PK.
* `dataset_id`: FK → Dataset.
* `actor_id`: FK → User.
* `action_type`: enum [`flag`, `hide`, `reinstate`]
* `reason`: text nullable.
* `created_at`

---

## 2.6 ValidationRecord

Audit trail for validation operations.

* `id`: UUID PK.
* `dataset_id`: FK → Dataset.
* `validation_type`: enum [`cog_strict`, `ph_boundary_intersection`]
* `status`: enum [`pass`, `fail`]
* `details_json`: JSON.
* `created_at`

---

# 3. Derived Logic

---

## 3.1 Contribution Count (Per User)

Contribution rules:

* +1 for each RAW dataset uploaded by user where status != `delisted`
* +1 for each ORTHOPHOTO dataset uploaded by user where status = `published`

Hidden datasets still count unless delisted.

Implementation:

* Computed via query in Phase 1.
* Materialized counters optional in later phases.

---

## 3.2 Visibility Rules

Anonymous queries must include only datasets where:

* `status = published`
* `validation_status = valid`

Hidden or delisted datasets must not appear in public queries.

---

# 4. Indexing Guidance

* GIST index on `Dataset.footprint`
* Index on `Dataset.status`
* Index on `Dataset.validation_status`
* Composite index on `RawAccessRequest(dataset_id, requester_id, status)`
* Index on `DatasetAsset(dataset_id, asset_type)`

---

# 5. Phase 1 Clarifications

* `processor_id` may differ from `uploader_id`.
* A dataset of type `orthophoto` must contain at least one `orthophoto_cog` asset before publish.
* A dataset of type `raw` must contain at least one `raw_archive` asset before it is considered valid.

---

