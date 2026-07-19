# Wardrobe native app

The Expo app uses the same Clerk identity, Convex data, capture router, garment recognition, and Zep sync path as the production web app.

## Local development

1. Copy `.env.example` to `.env.local` and use the Clerk publishable key for the environment you want to test.
2. Enable Clerk Native API and register `com.wardrobe.app` as the iOS bundle identifier and Android package.
3. From this directory, run `bunx expo run:ios` or `bunx expo run:android`. Clerk's native `AuthView` requires a development build rather than Expo Go.

The API URL defaults to production. Override `EXPO_PUBLIC_WARDROBE_API_URL` to test a preview deployment that includes `/api/mobile/*`.

## Build profiles

- `development`: internal development client
- `preview`: internal iOS build and installable Android APK
- `preview-simulator`: installable iOS Simulator build without Apple signing credentials
- `production`: store build; submission remains a separate explicit action

Set `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` and `EXPO_PUBLIC_WARDROBE_API_URL` in the corresponding EAS environments before building.
