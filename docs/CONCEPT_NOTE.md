# OpenDronePH

**An Open, Community-Driven Platform for Drone Orthophotos of the Philippines**

---

## 1. Conceptual Overview

### 1.1 What is OpenDronePH?

**OpenDronePH** is an open-source, community-driven platform for sharing, discovering, and reusing **drone-derived orthophotos** of the Philippines.

It enables individuals and organizations to:

* upload **raw drone imagery** (flight outputs),
* collaboratively process these into **orthophotos**, and
* publish validated, georeferenced outputs for **public viewing and reuse**.

The platform is inspired by the principles of **OpenStreetMap** (community contribution, attribution, openness) and platforms such as **OpenAerialMap**, but is **purpose-built for the Philippine context**, drone data, and open science.

---

### 1.2 The Core Problem

Despite the widespread use of drones in the Philippines:

* Drone imagery is **fragmented** across private drives, agencies, and projects
* The same areas are **flown repeatedly** by different groups
* Valuable datasets are lost after project completion
* There is **no national, open repository** for drone orthophotos

As a result:

* Mapping and disaster response are slower than necessary
* Research reproducibility is limited
* Public funds and volunteer effort are inefficiently used

---

### 1.3 The OpenDronePH Idea

OpenDronePH treats **drone orthophotos as shared spatial infrastructure**, not disposable project artifacts.

The platform enables:

* **Open contribution** (anyone can upload)
* **Collaborative processing** (others can help turn raw data into orthos)
* **Transparent attribution** (credit to uploader and processor)
* **Public access** (viewable by anyone, downloadable by registered users)
* **Open standards** (COG, GeoTIFF, EPSG CRS)

The goal is simple:

> *Map the Philippines faster by working together.*

---

## 2. Guiding Principles

### 2.1 Open by Default

* Platform code is fully open source
* Data is openly licensed by default
* All formats follow open geospatial standards

### 2.2 Community-Driven, Not Centralized

* No single agency “owns” the map
* Contributions come from citizens, academe, LGUs, NGOs, and professionals
* Moderation is lightweight and community-assisted

### 2.3 Attribution Is First-Class

Every published orthophoto clearly shows:

* Who **captured/uploaded** the data
* Who **processed** the orthophoto
* When and how it was created

### 2.4 Processing Is Decoupled

* OpenDronePH **does not process imagery**
* Processing is done externally using any software (e.g. OpenDroneMap, Metashape)
* This keeps the platform lightweight, scalable, and neutral

---

## 3. Data Model & Lifecycle

### 3.1 Dataset Concept

A **dataset** represents a single drone survey over a place and time.

A dataset may exist in two forms:

1. **Raw dataset** – original drone images (flight output)
2. **Processed dataset** – an orthophoto derived from raw imagery

---

### 3.2 Dataset States

| State              | Description                               | Visibility     |
| ------------------ | ----------------------------------------- | -------------- |
| RAW_UPLOADED       | Raw images uploaded                       | Hidden         |
| RAW_AVAILABLE      | Raw data available to approved processors | Logged-in only |
| ORTHO_PUBLISHED    | Orthophoto published                      | Public         |
| FLAGGED / DELISTED | Under review                              | Hidden         |

---

### 3.3 Collaboration Model

* A user uploads raw imagery
* Another user may process it externally
* The processed orthophoto is uploaded and linked to the original raw dataset
* Both contributors are permanently attributed

This allows **collaborative value creation** without central coordination.

---

## 4. Access & Permissions

### 4.1 Anonymous Users

* Browse the map
* View orthophotos and metadata
* No downloads

### 4.2 Registered Users (Email Verified)

* Upload raw datasets
* Upload and publish orthophotos
* Download published orthophotos
* Request access to raw data for processing

### 4.3 Moderators

* Review flagged datasets
* Hide or reinstate content
* Enforce community rules

---

## 5. Licensing Strategy

### 5.1 Platform Code

* Open source (GPL-3.0 or AGPL-3.0)

### 5.2 Data Licensing

* **Default:** Creative Commons Attribution (CC BY 4.0)
* **Optional:** Creative Commons Attribution–NonCommercial (CC BY-NC 4.0)

Why:

* CC BY ensures compatibility with research, mapping, and public reuse
* CC BY-NC remains available for contributors with restrictions
* License is explicit and visible per dataset

---

## 6. Metadata (Minimal but Sufficient)

### 6.1 Required for Raw Upload

* Capture date
* Approximate footprint (polygon or bounding box)
* Platform type (drone/fixed/other)
* Camera model (free text)
* License choice
* Uploader attribution

### 6.2 Required for Orthophoto Publication

* Ground sampling distance (GSD)
* Coordinate reference system (EPSG)
* Processing software used
* Cloud Optimized GeoTIFF (COG) format

---

## 7. Technical Architecture (Open Source Only)

### 7.1 High-Level Architecture

```
User Browser
   ↓
React + MapLibre
   ↓
Django REST API
   ↓
PostGIS + MinIO
   ↓
TiTiler (COG tile service)
```

---

### 7.2 Core Components

#### Frontend

* React (Vite)
* MapLibre GL JS
* Displays footprints and raster tiles

#### Backend

* Django + Django REST Framework
* Authentication, permissions, metadata, moderation

#### Spatial Database

* PostgreSQL + PostGIS
* Stores dataset footprints and attributes

#### Object Storage

* MinIO (S3-compatible)
* Stores raw image archives and orthophotos

#### Raster Tile Service

* TiTiler (rio-tiler based)
* Serves XYZ tiles directly from COG GeoTIFFs

---

### 7.3 Open Standards Enforced

* Cloud Optimized GeoTIFF (COG)
* EPSG coordinate systems
* WGS84 footprints
* HTTP XYZ tiles
* Explicit license metadata

---

## 8. Scalability & Sustainability

### 8.1 Nationwide from Day One

* Coverage limited to Philippine territory
* Footprint validation ensures relevance

### 8.2 Storage Control

* Raw uploads capped per user
* Raw data archived if unused
* Orthophotos optimized via COG (no pre-tiling)

### 8.3 Sustainability Model

* Free forever for public use
* Institutions can self-host or mirror
* Platform can be federated or forked

---

## 9. Governance Model

* Benevolent maintainer model
* Open roadmap and issue tracking
* Public pull requests and community review
* Clear code of conduct

---

## 10. Intended Impact

### 10.1 Technical

* Faster national base mapping
* Reduced duplication of drone surveys
* Standardized access to drone orthophotos

### 10.2 Scientific

* Reproducible research
* Open datasets for remote sensing, GIS, and AI
* Long-term archival of drone data

### 10.3 Societal

* Support for disaster response
* Increased transparency in mapping
* Empowered local communities and LGUs

---

## 11. Phase 1 Scope (Explicit)

**Included**

* Upload raw datasets
* Publish orthophotos
* Public map view
* Download gating
* Flagging and moderation

**Excluded**

* On-platform processing
* Gamification
* Organization dashboards
* Mobile applications
* AI analysis

---

## 12. Positioning Statement (use this verbatim)

> **OpenDronePH is an open, community-driven platform that treats drone orthophotos as shared national spatial infrastructure—built on open standards, open source software, and collaborative contribution.**

---