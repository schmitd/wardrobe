# Native builds and OTA updates

Version 0.1.3 introduces expo-updates. Testers on 0.1.2 must first install the new TestFlight binary; the old binary cannot receive OTA updates.

Production builds use the `production` channel, previews use `preview`. The `fingerprint` runtime policy prevents bundles targeting different native dependencies/configuration from being delivered to incompatible binaries. Native changes still require a new build.

Updates check on launch without blocking startup. A downloaded compatible update normally applies on the next cold launch; do not force a reload during capture or form entry.

From `apps/mobile`, after testing and release approval:

```sh
bunx eas-cli@latest update --channel production --environment production --platform ios --message "Describe verified fix"
```

Always use the production EAS environment so Clerk, API, and analytics configuration match the binary. Check the resolved runtime against the target build before publishing. Do not automatically publish OTA updates on every merge. Monitor existing PostHog workflow events and Axiom errors after release; preserve analytics opt-out and never include form contents in telemetry.

## Plan form regression checklist

- Open Fits → Plans → New plan: form and back navigation are visible, keyboard initially closed.
- Focus Name and type, dismiss with Done, then enter a multiline note.
- Scroll with keyboard open and tap Create plan once; confirm navigation to the saved plan.
- Repeat with only a name, large text, and a small iPhone screen.
- Verify a failed request displays an error and permits retry.
- Verify successful creation is not held pending by bootstrap refresh.
- Confirm the legacy `/collection/new` route uses the same full-screen form.

The September 8 fix replaces the native partial-height sheet with standard stack navigation and removes nested keyboard avoidance/autofocus. Simulator verification was blocked by insufficient disk space; do not mark the device regression fixed until this checklist passes on a device or simulator.
