# OpenDronePH

# Phase 1 — User Acceptance & Access Control Specification

---

# 1. Phase 1 User Acceptance Criteria (Consolidated)

---

## UAC-01 — Anonymous Map Viewing & Restrictions

**Given** an anonymous user
**When** the user opens the platform
**Then** published orthophotos shall be visible on the map
**And** dataset metadata shall be viewable
**And** download actions shall be restricted

---

## UAC-02 — Measurement Tools

**Given** any user (including anonymous)
**When** the user uses the distance or area measurement tools
**Then** metric measurements shall be displayed
**And** no measurement data shall be stored or persisted
**And** no backend calls shall be triggered

---

## UAC-03 — RAW Dataset Upload

**Given** a verified authenticated user
**When** a RAW dataset is uploaded with all required metadata
**Then** the dataset shall be stored
**And** it shall be hidden from public view
**And** it shall be attributed to the uploader
**And** the uploader’s contribution count shall increase by one

---

## UAC-04 — RAW Access Request Workflow

**Given** a verified user
**When** the user requests access to a RAW dataset
**And** the dataset owner approves the request
**Then** the requester shall be permitted to download the RAW dataset
**And** the action shall be logged

---

## UAC-05 — ORTHO Publication (Valid COG)

**Given** a verified user
**When** a valid Cloud Optimized GeoTIFF (COG) is uploaded
**And** all validation checks pass
**Then** the orthophoto shall be published
**And** it shall be visible on the public map
**And** it shall be attributed to both uploader and processor
**And** the processor’s contribution count shall increase by one

---

## UAC-06 — ORTHO Upload Rejection (Invalid COG)

**Given** a verified user
**When** a non-COG or invalid GeoTIFF is uploaded
**Then** the upload shall be rejected
**And** the system shall return clear validation errors
**And** no contribution shall be recorded

---

## UAC-07 — Contribution Accounting Integrity

**Given** a RAW upload or ORTHO publication
**When** the dataset is successfully stored and validated
**Then** the corresponding contribution count shall increase

**And Given** a dataset is delisted
**When** moderation occurs
**Then** the dataset shall be hidden
**And** its contribution shall no longer count

---

## UAC-08 — Moderation Controls

**Given** a dataset is flagged
**When** a moderator reviews the flag
**Then** the moderator may hide or reinstate the dataset
**And** all actions shall be logged with actor and timestamp

---

# 2. Phase 1 Role Model

---

## 2.1 Defined Roles

* `anonymous`
* `user_unverified`
* `user_verified`
* `moderator` (Django staff/admin)

---

# 3. Phase 1 Permission Matrix (Normalized)

| Capability                    | anonymous | user_unverified | user_verified    | moderator |
| ----------------------------- | --------- | --------------- | ---------------- | --------- |
| View published map            | ✅         | ✅               | ✅                | ✅         |
| View dataset details          | ✅         | ✅               | ✅                | ✅         |
| Register/Login                | ❌         | ✅               | ✅                | ✅         |
| Upload RAW dataset            | ❌         | ❌               | ✅                | ✅         |
| Upload ORTHO                  | ❌         | ❌               | ✅                | ✅         |
| Download published orthophoto | ❌         | ❌               | ✅                | ✅         |
| Download multispectral asset  | ❌         | ❌               | ✅                | ✅         |
| Request RAW access            | ❌         | ❌               | ✅                | ✅         |
| Download RAW                  | ❌         | ❌               | Only if approved | ✅         |
| Flag dataset                  | ❌         | ❌ (recommended) | ✅                | ✅         |
| Approve/deny RAW access       | ❌         | ❌               | ❌                | ✅         |
| Hide/reinstate dataset        | ❌         | ❌               | ❌                | ✅         |

---

## Important Clarification

For Phase 1:

* Only **verified users** may flag datasets
  (Prevents anonymous abuse and spam)
* All upload and download actions require verified session auth

---

# 4. Enforcement Rules (Authoritative)

1. Email verification is mandatory for:

   * Uploading RAW
   * Uploading ORTHO
   * Requesting RAW access
   * Downloading any asset

2. All download endpoints must enforce session authentication.

3. Moderator actions must require Django staff/admin permission.

4. Delisted datasets:

   * Must not appear in public queries
   * Must not be counted toward contributions
   * Must remain visible to moderators

---

# 5. Audit & Logging Requirements

The system shall log:

* RAW uploads
* ORTHO uploads
* RAW access requests
* RAW approvals/denials
* Dataset flagging
* Dataset delisting/reinstatement
* Download events

Each log entry shall contain:

* Actor
* Action
* Target dataset
* Timestamp

---

# 6. Architectural Decisions (Phase 1 Locked)

| Decision                | Value                       |
| ----------------------- | --------------------------- |
| Auto-convert to COG     | ❌ No                        |
| Strict COG validation   | ✅ Yes                       |
| Raster processing       | ❌ External only             |
| 3D visualization        | ❌ None                      |
| Multispectral rendering | ❌ No                        |
| Contribution metric     | Count RAW + Published ORTHO |
| Org support             | ❌ Phase 2 only              |

---

# 7. Definition of Phase 1 Completion

Phase 1 is complete when:

* All UAC-01 through UAC-08 pass
* Permission matrix is enforced
* Contribution logic behaves correctly
* COG validation is strict and test-covered
* docker-compose environment runs end-to-end
* pytest suite passes

---
