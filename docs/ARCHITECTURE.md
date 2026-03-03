# OpenDronePH Phase 1 Architecture

## 1. Document Scope
This architecture is aligned to:
- `docs/CONCEPT_NOTE.md`
- `docs/SRS.md`
- `docs/UAC.md`
- `docs/DATA_MODEL.md`

If conflicts appear, implementation follows `DATA_MODEL` for schema behavior and `UAC/SRS` for access and workflow rules.

## 2. Monorepo and Runtime Topology
- `apps/backend`: Django 5 + DRF API.
- `apps/web`: React + Vite + MapLibre client.
- `docs`: product and engineering specs.
- `docker-compose.yml`: local orchestration only.

Docker services:
- `db`: PostgreSQL + PostGIS.
- `minio`: S3-compatible object storage.
- `titiler`: COG tile service.
- `backend`: Django API service.
- `web`: Vite development server.

No nginx, no production stack, no CI/CD pipeline in Phase 1.

## 3. Backend Architecture
- Framework: Django 5.
- API: Django REST Framework.
- Authentication: Django session auth + CSRF.
- Authorization gates:
  - upload, raw-access request, flagging, and all downloads require verified email.
  - raw-access decision is made by dataset uploader (owner); moderator/admin may override.
  - hide/reinstate is moderator/admin only.
- Storage: MinIO via boto3.
- Spatial DB: PostGIS with SRID 4326 geometry fields.
- Validation pipeline:
  - PH boundary intersection validation.
  - strict COG validation via rasterio for orthophotos.

## 4. Frontend Architecture
- React + Vite single-page app.
- MapLibre GL JS in 2D only.
- RGB rendering only for published, valid orthophoto COG assets.
- Measurement tools (distance and area) are frontend-only and non-persistent.
- Axios is the only HTTP client for API calls.

No mobile app bundle, no SSR, no 3D rendering.

## 5. Core Workflows

## 5.1 Raw Upload
1. Verified user uploads raw archive with required metadata.
2. Backend writes metadata to PostGIS and file to MinIO.
3. Raw dataset is not publicly visible.

## 5.2 Raw Access Request
1. Verified user submits request for a raw dataset.
2. Dataset uploader approves or denies request.
3. Approved requester can download raw asset.
4. Action is logged for audit.

## 5.3 Orthophoto Publish
1. Verified user uploads orthophoto GeoTIFF and metadata.
2. Backend enforces PH boundary intersection and strict COG checks.
3. On pass, dataset becomes publishable; on fail, publish is blocked with clear errors.
4. Published valid orthophotos become visible on public map via TiTiler.

## 5.4 Moderation
1. Verified user flags a dataset.
2. Moderator/admin hides or reinstates dataset.
3. Hidden/delisted datasets are excluded from public listing.

## 6. Data Rules in Architecture
- Domain entities use UUID primary keys.
- `Dataset.footprint` is `MultiPolygon` in EPSG:4326.
- Contribution logic follows `docs/DATA_MODEL.md`:
  - raw contributions count when not delisted.
  - orthophoto contributions count when published.

## 7. Non-Goals (Phase 1)
- No server-side raster conversion.
- No processing pipelines.
- No Celery/background jobs.
- No organization model.
- No JWT.
- No 3D stack (including Cesium).
