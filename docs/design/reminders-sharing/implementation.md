# Reminder and image-sharing implementation

Updated 2026-09-26. Implemented in draft PR #110, stacked on the canonical evidence model in draft PR #109. Delivery remains disabled unless the global and transport gates are explicitly enabled. No real device tokens, provider credentials, production data migrations, or push sends were created during this work.

## Implemented behavior

- Web `/reminders` and native Account expose separate daily/planned opt-ins, a one- or two-per-day cap, current timezone, and one selected device. Defaults are noon, a three-hour gap, and quiet hours 21:00–09:00. Time controls beyond these defaults are represented in the backend contract but are not exposed as additional UI settings in this first version.
- Permission requests happen only after choosing this phone/browser. Resume checks refresh an existing registration without selecting another device or reopening permission prompts. The selected device can update the observed timezone; another device cannot. Revoked registrations require an explicit selection to reactivate. Native sign-out attempts server revocation and local push unregistration; browser sign-out unsubscribes locally.
- Accepted plans can use a manually confirmed time or an explicitly chosen, timed Calendar event. Date-only plans use noon. The Calendar event instance ID is retained; titles, descriptions, attendees and locations are absent from the background request. Background refresh uses only selected calendars and the current consent revision, checks at a bounded cadence, and suppresses a send if the last successful check is more than 15 minutes old. A move to another date requires plan review. Disconnect deletes provider links in bounded pages while retaining accepted outfit history.
- Convex stores preferences, installations, logical reminder intents, attempts and an account budget. Reconciliation creates at most an eight-date horizon (today plus seven days). Claim and final submission checks use owned plan/wear records, never Zep or an inference result. Unknown coverage suppresses sends. Simultaneous opportunities choose a stable eligible winner. A morning outfit cannot resolve an evening plan; a saved partial photo of that plan can answer its capture reminder.
- Camera/capture activity renews a ten-minute lease. Native camera-to-processing navigation carries the plan revision into the same fit-recording pipeline as the FAB. A stale date/revision or contradictory existing confirmation preserves the new photo independently. Planned garments never become actual garments merely because a reminder was opened.
- Expo and Web Push use a generic payload with an opaque reminder identifier and expiry. A final check runs before external I/O. Expo tickets and bounded receipt checks distinguish acceptance from provider handoff. A crashed or ambiguous attempt consumes its reservation and is not resubmitted. This first version also treats definitive rejection as terminal; the proposed bounded retry/backoff for 429 responses is deliberately not enabled. A missed reminder is preferable to an uncertain duplicate.
- Authenticated tap handlers resolve the current owned record. They offer capture or plan/diary review; opening or dismissing a reminder does not mutate wear evidence. Expired or resolved prompts cannot silently start a stale capture. An already queued OS banner cannot be recalled reliably.
- An account deletion removes reminder state. The periodic sweep removes expired intent/attempt audit data after 30 days, revoked registrations after 30 days, and inactive registrations after 90 days.

## Private image export

`GET /api/fits/[id]/image` authenticates both cookie and native bearer callers, checks fit and storage ownership, bounds download bytes/pixel count, applies image orientation, reduces the longest edge to at most 2048 pixels without upscaling, and strips metadata. A second ownership/revision check precedes the response. Responses are private/no-store image attachments; original files are unchanged.

Web sharing prepares a local PNG `File`, then uses a fresh user gesture for file sharing or image clipboard export. Copy never writes a URL. Download is always available after preparation. Temporary previews are revoked; preparation is aborted on close/account change; prepared files expire after 60 seconds. The share dialog keeps earlier capture feedback beneath its overlay.

Native uses a private JPEG file, `expo-sharing`, image MIME/UTI and the system sheet. Each request prepares a new authorized derivative, checks identity again before handoff, and leaves successful files available for delayed recipient reads. Cache cleanup runs at startup/next share for files older than 24 hours and on session teardown/sign-out. Native clipboard behavior is provided by the system sheet where supported, with no clipboard-reading code in the app. Native sheet cancellation, iPad presentation and downstream file-read timing still require device verification.

## Verification evidence

- Web/backend unit and integration suite: 156 tests passed (861 assertions). Native suite: 27 tests passed (61 assertions).
- Reminder transaction tests cover duplicate jobs, ambiguous completion, capture deferral, shared cap, stable ordering, cross-device partial evidence, calendar reschedule/disconnect, stale revisions, foreign taps, account deletion, receipts and shadow mode.
- Image tests verify rotated pixels, metadata removal, unchanged original bytes, byte/pixel limits, and a valid positive owner alongside foreign/poisoned storage rejection.
- The three existing browser journeys passed. A 390px Chrome probe exercised the real reminder settings, a reminder-to-normal-capture flow carrying plan ID/revision, PNG clipboard write/readback of the probe's own synthetic image, and an actual PNG download. No browser errors were observed. Local screenshots, trace and result are under ignored `output/reminders-sharing/`; no private user media was used.
- All workspace type checks and lint pass (eight existing nonblocking warnings). Production Next build and iOS/Android JavaScript exports pass using the CI placeholder Clerk public key. Signed native binaries remain a release gate.

## Release gates

1. Review both draft PRs, including the evidence model and its separate Zep migration gates. Neither draft is marked ready or merged by this task.
2. Verify a compatible installed native build with Expo notifications/sharing included. APNs/FCM setup, permission revoke/regrant, logout, account switch, cold-start taps, foreground/background behavior, actual image handoff and iPad sheet presentation require real-device evidence. JavaScript export is not a signed binary or a delivery test. Existing EAS preview jobs report exhausted monthly free-build quota; no upgrade was purchased.
3. Configure a reviewed background Calendar credential path in Convex (`CLERK_SECRET_KEY`) and verify actual cancellation/recurring-exception/token-refresh behavior. No new secret was configured here. Calendar-backed reminders fail closed without fresh data.
4. Configure Web Push VAPID values (`WEB_PUSH_PUBLIC_KEY`, `WEB_PUSH_PRIVATE_KEY`, `WEB_PUSH_SUBJECT`) and optionally Expo push access-token security. Verify HTTPS service-worker delivery with a tab closed, browser subscription expiry, actual supported file share, and iOS Home Screen support. Local tests did not send pushes.
5. Inspect shadow intents first, then explicitly enable `WARDROBE_NOTIFICATIONS_MODE=live` and the intended `WARDROBE_EXPO_PUSH_ENABLED` / `WARDROBE_WEB_PUSH_ENABLED` transport. Recheck the current candidate, account preferences and real receipt/open evidence before increasing exposure. Clearing the global live mode prevents further provider submissions; it does not retract a banner already queued.

## Provider references checked

[Expo send/receipt semantics](https://docs.expo.dev/push-notifications/sending-notifications/), [Clerk OAuth token retrieval](https://clerk.com/docs/reference/backend/user/get-user-oauth-access-token), and [Google Calendar event lookup](https://developers.google.com/workspace/calendar/api/v3/reference/events/get). Installed SDK declarations are the authority for the exact Expo methods used by this branch.
