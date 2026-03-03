# OpenDronePH Delivery Phases

## Phase 1 (Current)
### Goal
Deliver an open, community-driven orthophoto platform baseline for the Philippines with validated publication and controlled raw-data sharing.

### Included
- user registration/login with email verification gate
- anonymous public map viewing of published orthophotos
- frontend-only measurement tools (distance and area)
- raw dataset upload and owner-managed raw access request workflow
- orthophoto upload with strict COG validation and PH boundary intersection
- attribution for uploader and processor
- moderation by flag, hide, and reinstate
- contribution accounting per `DATA_MODEL`
- local Docker Compose runtime (backend, db, minio, titiler, web)

### Explicitly Excluded
- on-platform photogrammetry or raster processing pipelines
- server-side conversion to COG
- mobile app
- SSR
- 3D rendering
- organization model
- JWT and Celery
- production deployment and CI/CD

## Phase 2 (Planned, Not Committed)
- dataset relationship enhancements and provenance UX
- trust/reputation improvements
- organization support
- read-only public metadata API expansion

## Phase 3 (Planned, Not Committed)
- federation support for externally hosted orthophotos
- advanced access controls and policy variants
- sustainability controls (tiering and archival lifecycle)
