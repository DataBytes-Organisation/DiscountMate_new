---
title: "Frontend Tech Specs"
sidebar_label: "Tech Specs"
sidebar_position: 2
---

# Frontend Tech Specs

## Local setup

From `Frontend/`:

npm install
cp .env.example .env
npm run web

Opens the app in your browser via Expo's web target, typically at `http://localhost:8081`.

**Never commit a real `.env` file or paste real secrets into a PR, issue, or documentation.**

## Platform-specific commands

| Command             | Purpose                                           |
| ------------------- | ------------------------------------------------- |
| `npm run web`       | Run in browser via Expo web                       |
| `npm run android`   | Run on Android emulator/device via Expo           |
| `npm run ios`       | Run on iOS simulator/device via Expo (macOS only) |
| `npm run build:web` | Build a static web export                         |

## Mobile setup

The app uses Expo + EAS (Expo Application Services) for native mobile builds.

- Bundle identifiers: iOS `com.discountmate.app`, Android `com.discountmate.app`
- EAS CLI requirement: version >= 10.0.0
- Development builds are configured for internal distribution, with Android producing an APK directly (see `Frontend/eas.json`)

For day-to-day development, a full native build is usually not needed — `npm run android` / `npm run ios` through Expo Go or a development client is sufficient. A full EAS build is only needed when testing native modules Expo Go doesn't support, or preparing an internal distribution build. If you need to run an EAS build, ask in the Teams group chat first — this requires access to the project's EAS account.

**Known limitation:** native build steps beyond the above have not yet been fully documented. If you hit an EAS-specific issue, flag it in the Teams group chat so this section can be expanded.

## Tests and quality checks

| Command            | Purpose                                          |
| ------------------ | ------------------------------------------------ |
| `npm test`         | Jest, watch mode                                 |
| `npm run test:ci`  | Jest, CI mode (no watch)                         |
| `npm run test:e2e` | Playwright end-to-end tests                      |
| `npm run lint`     | ESLint over app/components/constants/hooks/types |

Run these locally before opening a PR.

## Common troubleshooting

**Frontend loads but shows "We couldn't load products"**
Usually means the backend isn't reachable. Check the backend is running and that `EXPO_PUBLIC_API_URL` in `.env` points to the correct backend URL.

**`git push` to your fork fails with an authentication error**
Cached Git credentials may be stale. On Windows, check `cmdkey /list` for old GitHub entries and remove with `cmdkey /delete:<target-name>`, then push again to trigger a fresh login.

## Where to ask for help

Post in the **App Development Teams group chat**.
