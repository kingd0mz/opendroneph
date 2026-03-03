
# SOFTWARE REQUIREMENTS SPECIFICATION

## OpenDronePH

### (All Phases – Authoritative Version)

---

# 1. INTRODUCTION

## 1.1 Purpose

This document defines the complete functional and non-functional requirements for **OpenDronePH**, an open-source, community-driven platform for hosting and sharing drone-derived orthophotos of the Philippines.

This SRS serves as the contractual technical reference for:

* System implementation
* Testing and validation
* Phase planning
* Acceptance criteria

---

## 1.2 System Overview

OpenDronePH is a:

* Hosting platform
* Metadata registry
* Visualization portal
* Collaboration facilitator

OpenDronePH is not:

* A photogrammetry engine
* A raster processing pipeline
* A 3D visualization platform
* A proprietary marketplace

---

# 2. SYSTEM CONSTRAINTS (ALL PHASES)

The following constraints apply to all phases and are non-negotiable:

1. All software components must be open source.
2. Visualization is strictly 2D.
3. RGB imagery only shall be rendered on the map.
4. Multispectral imagery shall be downloadable but not rendered beyond RGB.
5. Imagery processing shall occur externally.
6. Dataset coverage must intersect Philippine territory.
7. Published orthophotos must be valid Cloud Optimized GeoTIFF (COG).
8. The system shall not perform automatic raster conversion.

---

# 3. DATA MODEL PRINCIPLES

## 3.1 Dataset Concept

A Dataset represents a single drone survey over a defined area and time.

Datasets may be of two types:

* RAW (original flight imagery)
* ORTHO (processed orthophoto)

## 3.2 Dataset Lifecycle States

| State           | Description                      | Visibility     |
| --------------- | -------------------------------- | -------------- |
| RAW_UPLOADED    | Raw imagery uploaded             | Hidden         |
| RAW_AVAILABLE   | Raw accessible to approved users | Logged-in only |
| ORTHO_PUBLISHED | Orthophoto published             | Public         |
| DELISTED        | Hidden by moderation             | Hidden         |

---

# 4. PHASE 1 — CORE PLATFORM (MVP)

---

## 4.1 Authentication & Access

### Functional Requirements

FR-1: The system shall allow users to register using email and password.
FR-2: The system shall require email verification prior to upload or download actions.
FR-3: Anonymous users shall be allowed to browse published datasets.
FR-4: Downloads shall require authenticated login.

---

## 4.2 Public Map (Anonymous)

FR-5: The system shall display footprints of published orthophotos.
FR-6: The system shall render RGB raster tiles for published orthophotos.
FR-7: The system shall display dataset metadata.
FR-8: The system shall provide a distance measurement tool (line/polyline).
FR-9: The system shall provide an area measurement tool (polygon).
FR-10: Measurements shall be displayed in metric units.
FR-11: Measurements shall not persist.
FR-12: No 3D visualization shall be available.

---

## 4.3 Raw Dataset Handling

FR-13: The system shall allow authenticated users to upload RAW datasets as archive files.
FR-14: RAW datasets shall be hidden from public view.
FR-15: RAW uploads shall require required metadata.
FR-16: The system shall log RAW upload events.

---

## 4.4 Raw Access Request Workflow

FR-17: The system shall allow authenticated users to request access to RAW datasets.
FR-18: The dataset uploader shall approve or deny access requests.
FR-19: Approved users shall be permitted to download RAW datasets.
FR-20: All request and approval actions shall be logged.

---

## 4.5 Orthophoto Publication

FR-21: The system shall allow upload of processed orthophotos.
FR-22: Orthophotos must be GeoTIFF files.
FR-23: Orthophotos must pass strict COG validation.
FR-24: The system shall reject non-COG files.
FR-25: The system shall not perform raster conversion.
FR-26: The system shall validate dataset footprint intersects Philippine boundary.
FR-27: Only RGB bands shall be rendered.
FR-28: Multispectral data shall be downloadable only.

---

## 4.6 COG Validation Rules

FR-29: The system shall validate internal tiling.
FR-30: The system shall validate presence of overviews.
FR-31: The system shall validate CRS presence.
FR-32: The system shall provide clear error messages for invalid uploads.
FR-33: The system shall provide documented conversion guidance.

---

## 4.7 Attribution & Licensing

FR-34: Each dataset shall display uploader attribution.
FR-35: Each ORTHO dataset shall display processor attribution.
FR-36: Each dataset shall display license information.
FR-37: License must be accepted prior to download.

---

## 4.8 Moderation

FR-38: Users shall be able to flag datasets.
FR-39: Moderators shall review flagged datasets.
FR-40: Moderators shall delist or reinstate datasets.
FR-41: Delisted datasets shall not appear publicly.

---

# 5. CONTRIBUTION ACCOUNTING

---

## 5.1 Contribution Definition

A contribution is defined as:

* A RAW dataset upload
* A PUBLISHED ORTHO dataset

Downloads, flagging, and metadata edits do not count as contributions.

---

## 5.2 User Contribution Requirements

FR-C1: The system shall track total contributions per user.
FR-C2: Contributions shall be classified by type (RAW, ORTHO).
FR-C3: User profiles shall display total contribution count.
FR-C4: Delisted datasets shall not count toward contributions.

---

## 5.3 Anti-Gaming Controls

FR-C5: Duplicate datasets shall not increment contributions.
FR-C6: Moderators may revoke contributions tied to policy violations.

---

# 6. PHASE 2 — COLLABORATION & QUALITY

---

## 6.1 Dataset Relationship Enhancements

FR-42: The system shall support multiple ORTHO datasets linked to one RAW dataset.
FR-43: The system shall display provenance relationships.

---

## 6.2 Trust & Reputation

FR-44: The system shall support a trusted contributor designation.
FR-45: Trusted contributors may receive increased upload quotas.

---

## 6.3 Organization Support

FR-46: Users may optionally belong to one organization.
FR-47: Organization contribution counts shall aggregate member contributions.
FR-48: Organization profiles shall display aggregate contribution totals.

---

## 6.4 Public API

FR-49: The system shall provide a read-only public metadata API.

---

# 7. PHASE 3 — MATURITY & FEDERATION

---

## 7.1 Federation

FR-50: The system shall support referencing externally hosted orthophotos.
FR-51: The system shall maintain dataset provenance chains.

---

## 7.2 Advanced Access Controls

FR-52: The system shall support embargoed datasets.
FR-53: The system shall support restricted RAW sharing policies.

---

## 7.3 Sustainability Controls

FR-54: The system shall support storage tiering policies.
FR-55: The system shall support archival lifecycle rules.

---

# 8. NON-FUNCTIONAL REQUIREMENTS

---

## 8.1 Performance

NFR-1: The system shall serve COG-based tiles efficiently.
NFR-2: The system shall not perform server-side raster processing.

---

## 8.2 Security

NFR-3: Authentication data shall be securely stored.
NFR-4: Users must accept liability for illegal captures.
NFR-5: Anonymous uploads shall not be permitted.

---

## 8.3 Maintainability

NFR-6: The system shall be modular and self-hostable.
NFR-7: Documentation shall be complete and public.

---
