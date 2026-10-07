---
title: "Backend Overview"
sidebar_label: "Overview"
sidebar_position: 1
---

# Backend Overview

The DiscountMate backend is a Node.js/Express API serving the frontend and coordinating data from MongoDB and, increasingly, PostgreSQL as part of an in-progress migration.

## Platform flow

Frontend (Expo/React Native)
-> Backend (Express API, port 3000)
-> MongoDB (current default) and/or PostgreSQL (migration in progress)
-> Backend/ml-service (Flask sidecar for ML-backed features)

## Ownership boundaries

The backend owns application-facing routes, authentication, and the App Dev side of the MongoDB-to-PostgreSQL migration (`Backend/src/migration/`). It consumes Data Engineering's `silver` schema tables as read-only reference data — App Dev does not own or duplicate DE's canonical product/pricing tables. See the [Data Engineering Overview](/docs/Data%20Engineering/overview) for the DE side of this boundary.

## Common prerequisites

- Node.js 20+
- Python 3.10 or 3.11 (for `Backend/ml-service` only — 3.12+ breaks pinned dependencies)
- PostgreSQL (only if working on migration tasks)

## Related pages

- [Backend Tech Specs](./tech-specs.md)
- [Data Engineering Overview](/docs/Data%20Engineering/overview)
- [GitHub Guidelines](/docs/Misc/github-guidelines)

**Owner:** [TBC ]
**Last reviewed:** 17 September 2026
