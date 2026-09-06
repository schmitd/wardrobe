# TestFlight release setup

The native app is linked to the `@schmitd/wardrobe` EAS project. Production builds use the `production` EAS environment, remote iOS build numbers, and automatic build-number increments.

## Already configured

- App name: `Wardrobe`
- Bundle identifier: `com.wardrobe.app`
- EAS project: `9b4470c6-c65f-493d-9cfd-c309f304e63c`
- URL scheme: `wardrobe://`
- Camera and photo-library purpose strings
- Non-exempt encryption declaration set to `false`
- Production Clerk publishable key and API URL in EAS
- Manual build-and-submit workflow at `.eas/workflows/testflight.yml`

## Required before the first upload

1. Add the final opaque 1024x1024 PNG icon and set `expo.icon` in `app.json`. Do not use rounded corners or transparency; iOS applies the mask.
2. Confirm that `com.wardrobe.app` is the permanent bundle identifier. Changing it after creating the App Store Connect record creates a different app identity.
3. Confirm access to the Apple Developer team and let EAS create or reuse the distribution certificate and provisioning profile during the first production build.
4. Create the Wardrobe app record in App Store Connect if EAS does not find one automatically.
5. Complete App Store Connect agreements, tax/banking items that apply, age rating, app privacy answers, and export-compliance questions.
6. Add a privacy-policy URL, support URL, beta description, review contact, and a working reviewer account or fully featured demo path.
7. Test sign-in, sign-out/account deletion, camera capture, photo selection, upload, garment save, and fit checks on a physical iPhone.

## Validate locally

Run the preflight with the same public variables that EAS injects into production builds:

```bash
bun run preflight:testflight:eas
```

This downloads the production variables for the lifetime of the command without writing them to the repository. To validate with local values instead, run `bun run preflight:testflight` after exporting both variables.

Run the regular mobile checks too:

```bash
bun run test
```

## First release

Use the manual `Build and submit iOS to TestFlight` workflow in the EAS dashboard. For the first signing and App Store connection, running locally is often easier because EAS can prompt for Apple credentials:

```bash
bun run testflight:build
```

After processing finishes in App Store Connect, add the build to an internal testing group. Check its state with:

```bash
bun run testflight:status
```

Production submission is deliberately manual. The push workflow continues to create simulator previews only.
