# OpenDronePH Phase 1 Definition of Done

## 1. Documentation
- `ARCHITECTURE`, `API_SPEC`, `VALIDATION`, `DEV_RULES`, and `PHASES`, `CONCEPT_NOTE`, `SRS`, `UAC`, and `DATA_MODEL` are complete and consistent.
- Conflicts are resolved and documented without introducing out-of-scope features.

## 2. Backend Implementation
- Models and migrations are implemented per `docs/DATA_MODEL.md`.
- UUID domain PKs and SRID 4326 geometry fields are enforced.
- DRF endpoints match `docs/API_SPEC.md`.
- Session auth with CSRF is active; JWT is not used.
- Email verification is enforced for uploads, raw access requests, flagging, and downloads.
- MinIO integration uses boto3.
- Orthophoto validation enforces strict COG and PH boundary intersection.

## 3. Business Rules
- Raw access request lifecycle works end-to-end with dataset owner decision flow.
- Moderator/admin override is available for moderation and access control operations.
- License acceptance is required before download.
- Attribution (uploader and processor) is present in dataset details.
- Contribution counting matches `DATA_MODEL`:
  - raw contributes when not delisted
  - orthophoto contributes when published
- Delisted datasets are excluded from public listing and contribution totals.
- Flag/hide/reinstate behavior matches `UAC`.

## 4. Frontend Implementation
- React + Vite + MapLibre map is functional in 2D.
- Only RGB orthophotos are rendered on map.
- Anonymous can browse published datasets.
- Verified users can upload, request raw access, flag, and download.
- Measurement tools are frontend-only and do not persist.
- API communication uses Axios only.

## 5. Infrastructure
- `docker-compose up` starts backend, db, minio, titiler, and web.
- No nginx container is introduced.
- No production deployment configuration is added.

## 6. Testing
- pytest covers:
  - dataset lifecycle
  - strict COG and PH boundary validation
  - raw access request and owner approval flow
  - contribution counting
  - moderation flows
- Tests pass locally in Phase 1 dev environment.

## 7. Scope Compliance
- No mobile app, SSR, 3D stack, JWT, Celery, or org model is implemented.
- No server-side raster conversion or processing pipeline exists.
- Only Phase 1 features are delivered.
