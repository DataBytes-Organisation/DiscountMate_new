---
title: "Frontend Overview"
sidebar_label: "Overview"
sidebar_position: 1
---

# Frontend Overview

The DiscountMate frontend is an Expo/React Native app supporting web, iOS, and Android from a single codebase.

## Platform flow

Frontend (Expo/React Native)
-> Backend (Express API)
-> MongoDB and/or PostgreSQL (migration in progress)

The frontend also calls Backend/ml-service (via the backend as a proxy) for ML-backed features such as recommendations, price prediction, and the chatbot.

## Ownership boundaries

The frontend owns UI, navigation, and client-side state. It does not talk to MongoDB or PostgreSQL directly — all data access goes through the backend's API routes. New API needs should go through a backend route, not a new direct integration from the frontend.

## Common prerequisites

- Node.js 20+
- Expo CLI (via npx, no global install needed)
- EAS CLI >= 10.0.0 (for native builds only — not needed for day-to-day web/Expo Go development)

## Related pages

- [Frontend Tech Specs](./tech-specs.md)
- [Backend Overview](/docs/Web%20Development/Backend/overview)
- [GitHub Guidelines](/docs/Misc/github-guidelines)

**Owner:** [TBC ]
**Last reviewed:** 17 September 2026
