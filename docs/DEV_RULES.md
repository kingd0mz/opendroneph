# OpenDronePH Engineering Rules (Phase 1)

## 1. Source of Truth Order
When docs conflict, use this order:
1. `docs/DATA_MODEL.md` for entity fields, enums, and counting semantics
2. `docs/UAC.md` for role and access behavior
3. `docs/SRS.md` for functional requirements
4. `docs/CONCEPT_NOTE.md` for product principles

## 2. Locked Technology Stack
- Backend: Django 5 + DRF.
- Database: PostgreSQL + PostGIS.
- Object storage: MinIO via boto3.
- Raster validation: rasterio.
- Frontend: React + Vite + MapLibre GL JS + Axios.
- Auth: Django session auth only (no JWT).

## 3. Repo and Architecture Constraints
- Monorepo contains only:
  - `apps/backend`
  - `apps/web`
  - `docs`
- No mobile app.
- No SSR.
- No 3D stack.
- No proprietary dependencies.

## 4. Infrastructure Constraints
- Docker Compose is local-only.
- Required services:
  - backend
  - db
  - minio
  - titiler
  - web
- No nginx.
- No production deployment profile.
- No CI/CD in Phase 1.

## 5. Access and Workflow Rules
- Verified email is required for:
  - uploads
  - raw access requests
  - flagging
  - all downloads
- Raw access approval is performed by dataset uploader (owner).
- Moderator/admin can hide/reinstate and perform moderation overrides.

## 6. Data and Spatial Rules
- Domain models use UUID PKs.
- Geometry fields use EPSG:4326.
- Orthophoto publish requires:
  - PH boundary intersection pass
  - strict COG pass
- No server-side raster conversion.
- Multispectral assets are download-only, not rendered.

## 7. Contribution Rules
- Contribution logic must match `docs/DATA_MODEL.md`:
  - raw upload contributes if dataset is not delisted
  - orthophoto contributes if published
- Delisted items do not count.

## 8. Quality and Testing Rules
- pytest is mandatory for business logic.
- Minimum suites:
  - dataset lifecycle
  - validation
  - raw access flow
  - contribution counting
  - moderation

## 9. Documentation Rules
- Keep docs phase-scoped and implementation-ready.
- If ambiguity remains, choose minimal Phase 1 behavior and document a `TODO`.
- Do not add features outside Phase 1 requirements.
