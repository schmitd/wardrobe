# Wardrobe native app

The Expo app uses the same Clerk identity, Convex data, capture router, garment recognition, and Zep sync path as the production web app.

## Local development

1. Copy `.env.example` to `.env.local` and use the Clerk publishable key for the environment you want to test.
2. From this directory, run `bunx expo start`. The JavaScript auth flow works in Expo Go and uses the `wardrobe://continue` callback for Google SSO.
3. Use `bunx expo run:ios` or `bunx expo run:android` when validating camera behavior in a development build.

Authentication deliberately uses Clerk's JavaScript SSO and email-code hooks instead of the beta native `AuthView`. This keeps sign-in behavior consistent across Android and iOS and gives the app control over loading, cancellation, and error states.

The API URL defaults to production. Override `EXPO_PUBLIC_WARDROBE_API_URL` to test a preview deployment that includes `/api/mobile/*`.

## Build profiles

- `development`: internal development client
- `preview`: internal iOS build and installable Android APK
- `preview-simulator`: installable iOS Simulator build without Apple signing credentials
- `production`: store build; submission remains a separate explicit action

Set `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` and `EXPO_PUBLIC_WARDROBE_API_URL` in the corresponding EAS environments before building.
