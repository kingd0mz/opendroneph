# OpenDronePH Phase 1 API Specification

Base path: `/api/v1`
Transport: JSON and multipart form-data.
Auth: Django session cookie authentication with CSRF for write operations.

This API is aligned to `CONCEPT_NOTE`, `SRS`, `UAC`, and `DATA_MODEL`.

## 1. Common Rules
- Upload, raw-access request, flagging, and all download actions require verified email.
- Anonymous users can browse published orthophotos and metadata only.
- Raw access approval is owned by the raw dataset uploader; moderator/admin can override.
- No JWT. No async job endpoints. No raster conversion endpoints.

## 2. Authentication

## 2.1 Register
- `POST /auth/register`
- Body: `email`, `password`, `password_confirm`
- Response: user created, `is_email_verified=false`, verification initiated.

## 2.2 Verify Email
- `POST /auth/verify-email`
- Body: `token`
- Response: `is_email_verified=true`.

## 2.3 Login
- `POST /auth/login`
- Body: `email`, `password`
- Response: session established.

## 2.4 Logout
- `POST /auth/logout`
- Response: session invalidated.

## 2.5 Me
- `GET /auth/me`
- Response: role and verification state.

## 3. Dataset Read APIs

## 3.1 List Public Datasets
- `GET /datasets`
- Query: `bbox`, `type`, `page`, `page_size`
- Visibility filter:
  - `status=published`
  - `validation_status=valid`
  - orthophoto datasets only for map display

## 3.2 Dataset Detail
- `GET /datasets/{dataset_id}`
- Public for visible published datasets.
- Hidden/delisted datasets are restricted to authorized users.

## 3.3 Tile Metadata
- `GET /datasets/{dataset_id}/tiles`
- Returns tilejson endpoint for TiTiler when dataset is published valid orthophoto.

## 4. Dataset Write APIs

## 4.1 Create Raw Dataset
- `POST /datasets/raw`
- Auth: verified user required.
- Multipart fields:
  - `title`, `description`
  - `capture_date`, `platform_type`, `camera_model`, `license_type`
  - `footprint` (GeoJSON)
  - `raw_archive_file`
- Result: raw dataset created, hidden from public listing.

## 4.2 Create Orthophoto Dataset
- `POST /datasets/orthophotos`
- Auth: verified user required.
- Multipart fields:
  - `title`, `description`
  - `capture_date`, `platform_type`, `camera_model`, `license_type`
  - `footprint` (GeoJSON)
  - `gsd_cm`, `crs_epsg`, `processing_software`
  - `processor_id` (optional, defaults to uploader)
  - `orthophoto_file`
- Validation:
  - PH boundary intersection required.
  - strict COG required (GeoTIFF, tiled, overviews, CRS).

## 4.3 Attach Multispectral Asset (Download-Only)
- `POST /datasets/{dataset_id}/assets/multispectral`
- Auth: verified dataset owner or moderator.
- Multipart field: `multispectral_archive_file`
- Rule: asset is downloadable only, never rendered on map.

## 5. Raw Access Workflow

## 5.1 Create Raw Access Request
- `POST /raw-access-requests`
- Auth: verified user required.
- Body: `dataset_id`, `reason`

## 5.2 My Requests
- `GET /raw-access-requests/me`
- Auth: required.

## 5.3 Incoming Requests for Owned Dataset
- `GET /datasets/{dataset_id}/raw-access-requests`
- Auth: dataset uploader (owner) or moderator/admin.

## 5.4 Decide Request
- `POST /raw-access-requests/{request_id}/decision`
- Auth: dataset uploader (owner) or moderator/admin.
- Body: `decision` (`approved` or `denied`), `note` (optional).

## 6. Downloads and License Acceptance

## 6.1 Accept License
- `POST /datasets/{dataset_id}/license-acceptance`
- Auth: verified user required.
- Body: `accepted=true`
- Rule: must be accepted before download.

## 6.2 Download Asset
- `GET /datasets/{dataset_id}/download`
- Auth: verified user required.
- Access rules:
  - orthophoto or multispectral asset: verified user + accepted license.
  - raw asset: approved raw access request + accepted license.

## 7. Moderation

## 7.1 Flag Dataset
- `POST /datasets/{dataset_id}/flag`
- Auth: verified user required.
- Body: `reason`

## 7.2 Hide Dataset
- `POST /moderation/datasets/{dataset_id}/hide`
- Auth: moderator/admin.

## 7.3 Reinstate Dataset
- `POST /moderation/datasets/{dataset_id}/reinstate`
- Auth: moderator/admin.

## 8. Error Contract
- `400`: payload/validation failure.
- `401`: not authenticated.
- `403`: not verified or forbidden role.
- `404`: resource not found or not visible.
- `409`: workflow conflict (duplicate pending request, invalid state transition).

Error JSON:
- `code`: stable machine code.
- `message`: readable explanation.
- `details`: structured field-level details when available.
