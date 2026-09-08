# Wardrobe native app

The Expo app uses the same Clerk identity, Convex data, capture router, garment recognition, and Zep sync path as the production web app.

## Local development

1. Copy `.env.example` to `.env.local` and use the Clerk publishable key for the environment you want to test.
2. From this directory, run `bunx expo start`. The JavaScript auth flow works in Expo Go and uses the `wardrobe://continue` callback for Google SSO.
3. Use `bunx expo run:ios` or `bunx expo run:android` when validating camera behavior in a development build.

The on-screen camera works in Expo Go. Physical volume-button shutter support requires a native development or store build because it uses `react-native-volume-manager`. The dependency is pinned to the immutable commit `db5674c1efec5d271a303a32f68d41f4cdb08fb1`, which is the upstream `v2.1.0` release tag and contains the Android focus-interception fix missing from the latest npm-published `2.0.8`. The commit is used because `v2.1.0` has not been published to npm; pinning the commit also avoids relying on a mutable Git tag. The JavaScript and dependency checks pass on Expo SDK 57 / React Native 0.86, but the native integration still requires the physical-device checks below.

Supply-chain tradeoff: clean installs fetch source from GitHub rather than an npm release artifact, and Bun intentionally does not run the dependency's build postinstall. Metro consumes its declared React Native TypeScript source, native autolinking consumes its checked-in iOS/Android projects, and the app carries the narrow API declaration used by TypeScript. Before changing the pin, review the upstream commit diff and re-run physical-device camera checks. Expo Go safely falls back to the visible shutter.

Authentication deliberately uses Clerk's JavaScript SSO and email-code hooks instead of the beta native `AuthView`. This keeps sign-in behavior consistent across Android and iOS and gives the app control over loading, cancellation, and error states.

The API URL defaults to production. Override `EXPO_PUBLIC_WARDROBE_API_URL` to test a preview deployment that includes `/api/mobile/*`.

## Build profiles

- `development`: internal development client
- `preview`: internal iOS build and installable Android APK
- `preview-simulator`: installable iOS Simulator build without Apple signing credentials
- `production`: store build; submission remains a separate explicit action

Set `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` and `EXPO_PUBLIC_WARDROBE_API_URL` in the corresponding EAS environments before building.

## TestFlight

See [TESTFLIGHT.md](./TESTFLIGHT.md) for the release checklist. A production build and submission can be started manually from the EAS dashboard with `.eas/workflows/testflight.yml`, or locally after the preflight passes:

```bash
bun run preflight:testflight:eas
bun run testflight:build
```

The build command creates a signed App Store build and submits it to App Store Connect. It is intentionally separate from the push-triggered simulator workflow.
