# Clerk and privacy presentation candidate

Base: preserved frozen snapshot supplied as deployed `123107280fda5dba3afe65f5aef73986106d80f8`. Original repository read-only `git archive` failed with `mmap failed: Operation canceled`; this local repo has an independent snapshot baseline. Integrate the final patch semantically against that deployed base, rather than assuming its local commit ancestry matches the source repo. No push/deploy, secrets/environment reads, auth configuration/session changes, or real account operations.

## Changes and shared files

- `apps/web/src/app/layout.tsx`: consume shared appearance; public signed-out footer only.
- `apps/web/src/components/Navbar.tsx`: Clerk-supported Privacy menu link; explicitly pass shared appearance to the account-management modal.
- `apps/web/src/app/privacy/page.tsx`: concise Lint notice with verified existing operator/contact; preserve public route.
- New `apps/web/src/lib/clerk-appearance.ts`, `apps/web/src/components/PrivacyNavigation.test.tsx`, `apps/web/scripts/probe-clerk-contrast.ts` and this audit.
- No globals.css or planner edits. Coordinate Navbar/layout hunks with camera owner. Obsolete inline appearance was removed after references moved to the shared module; no public/native route removed.

## Contrast findings and measurements

Existing palette used `colorNeutral: #56345C` and only a parent menu text class. Clerk neutral scales can blend controls, while nested labels/icons retain their own styling. The candidate sets dark neutral ink and explicit nested label/icon colors, replaces deprecated color variable names supported by the installed type declarations, and covers error/success/warning colors, white input backgrounds, lime primary buttons, readable disabled fields/buttons, and 2px keyboard focus outlines.

Browser evidence: `output/playwright/clerk-contrast.json` and `.png`; produced with installed Chrome in a fresh temporary profile and all external requests blocked. **This is a synthetic rendering of the shared appearance rules, not the actual pinned Clerk component DOM.** 41 computed foreground/background pairs: all normal text >=4.5:1, menu icons >=3:1.

| Pair/state | Measured ratio |
| --- | ---: |
| Account menu text/icon #241426 on #D8C9DC | 11.06:1 |
| Secondary #56345C on #D8C9DC | 6.52:1 |
| Error #8A1738 on #D8C9DC | 5.89:1 |
| Primary ink on #DCE66E | 12.96:1 |
| Disabled secondary on #F4EFF6 | 9.07:1 |

Hover resolves to #241426 on #F4EFF6; focus resolves to solid #241426 2px with 3px offset. Disabled controls are ordinarily exempt, but this candidate keeps their labels readable. Synthetic checks cover account menu, account-profile navigation, sign-in/sign-up, errors, placeholders, disabled inputs/buttons, hover and keyboard focus. This does **not** establish live Clerk, real-device, or end-to-end authentication acceptance. The public pinned Clerk JS was downloaded for investigation but was not mounted into a real account/session.

## Data-flow audit and privacy copy

- `PlanningCalendarService.ts`: read-only calendar list; event fields restricted to summary/start/end/location/status for planning, summary/start/status for week display. Clerk retrieves Google tokens server-side.
- `server/planning.ts`, `server/inference/planning.ts`, `confect/planningAuto.impl.ts`: requested AND automatic plans include Calendar context in OpenAI inference. Calendar titles can inform internal collection recall; Zep queries use user descriptions/preferences rather than raw events. Raw Calendar responses are not persisted; generated explanations can reflect Calendar data.
- `confect/legacy/planning.ts`: disconnect disables further Calendar reads and deletes saved `calendarDerived` outfit suggestions. It does not erase unrelated closet data or separately revoke Google permission.
- `InferenceService.ts`: OpenAI generation/transcription; Gemini embeddings; Zep style-memory operations remain distinct providers. No no-training guarantee added.
- `PostHogIdentify.tsx` sends web account ID/email/name. `instrumentation-client.ts` enables activity/exceptions and masked replay. `replay-privacy.ts` masks text/inputs and blocks private media. Mobile Account has an opt-out; no web opt-out control found. Rewritten copy explicitly distinguishes mobile control and web identification.
- Clerk/Convex/Vercel provide auth/storage/hosting; Axiom operational logs. Account deletion webhook schedules app cleanup and Zep deletion. No immediate erasure/backups guarantee added. Existing contact retained; no new personal details.
- Weather notice avoids manual dropdown instructions and describes optional planning-context location with approximate city forecast requests. Planner owner must verify that device-coordinate-local statement still matches final implementation and graceful decline.

Parent legal research supports public homepage/sign-in access and easy account access, without a repeated authenticated footer. `/privacy` remains public under unchanged proxy routing. No Limited Use compliance assertion or broad legal-compliance claim added.

**Cross-owner acceptance item:** existing `GoogleCalendarConnect.tsx` pre-consent text/details omit OpenAI onward sharing. Planner owner should visibly disclose, before consent: “Read-only Calendar titles, times, and locations go to OpenAI for requested or automatic outfit planning. We do not read attendees or descriptions, or change your events.” Keep Calendar optional with graceful decline; do not bury this only in Settings/privacy. This worker intentionally did not edit that shared planner file.

## Validation and remaining acceptance

- Task-local frozen Bun 1.3.8 install succeeded with a task-local copy-on-write cache and hardlink install. Preserved frozen source/cache untouched. Node 22.23.3 was placed first on PATH. No further installs/builds after disk warning.
- `bun run test`: all 8 Turbo tasks passed outside sandbox; sandbox attempt failed because an existing cancellation test could not bind its loopback server.
- New `bun test ./apps/web/src/components/PrivacyNavigation.test.tsx`: 3 passed, 12 assertions. Tests render actual layout/navbar/privacy code with synthetic Clerk wrappers: signed-out public entry and sign-in link config; authenticated footer absence/account-menu location and shared profile appearance; remount persistence; public route contact/return access. React warns about rendering `<html>` within the test container; production markup is unchanged.
- Web typecheck passed after new probe/tests. Lint: 0 errors, one pre-existing unused `_revision` warning in `confect/legacy/planning.ts`.
- Production build blocked by fetches of Oswald and Space Grotesk from Google Fonts. No source error was reported before that failure.
- `git diff --check` passed.

Before rollout, integration owner should test the actual pinned Clerk 5.127.0 DOM at desktop and mobile viewport, plus real device separately: open account menu, inspect computed nested label/icon contrast; Manage account opens styled modal; close/cancel returns to unchanged app; sign-in/sign-up error/retry/disabled/focus states; public privacy navigation; authenticated menu privacy and reload persistence; contextual Calendar/location decline and disclosed provider use. Avoid real profile edits, sign-out, provider grants, or personal-data changes. Authentication cancellation/retry/session persistence was not fabricated by these fixtures and remains a combined acceptance item.
