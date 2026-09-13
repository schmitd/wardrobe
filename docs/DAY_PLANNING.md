# Day planning release — issue #65

## Implemented

- Fits → Plans contains a day planner on web, iOS and Android; no new top-level destination.
- Today plus the next 13 days are directly selectable. Explicit dates up to one year ahead are supported. Google reads only the requested day, using the user's timezone and DST-aware boundaries.
- Gemini recommendations use bounded owned inventory, recent fits, the style profile, a selected existing Plan and its owned-piece anchors, Zep preference retrieval, and previous suggestion outcomes/dismissal reasons.
- Model output is validated before persistence. Invented/foreign IDs are rejected; an empty or incomplete wardrobe gets an honest missing-pieces explanation. Weather is explicitly not fetched or assumed.
- Suggested → Planned → Worn are separate states. Users accept, edit/swap owned pieces, dismiss with a reason, or confirm actual worn pieces atomically. Finished outfits cannot silently change state.
- Voice capture is explicit and limited to 60 seconds. Audio is sent for transcription only after a second deliberate Transcribe action, held in memory server-side, and not uploaded to Wardrobe storage or Zep. The editable transcript is never automatically submitted for recommendations. Cancellation/background/unmount stops recording; native temporary files are deleted.
- Google Calendar is a progressive Clerk OAuth connection. Existing Google sign-in does not imply calendar consent. Users choose up to ten calendars in the web flow, which native opens in the browser using the same Wardrobe account.
- Scopes: `calendar.events.readonly` and `calendar.calendarlist.readonly`. Provider tokens stay server-side. Only event title, start/end and location are requested, not descriptions or attendees. Reads are bounded and partial busy-day context is labeled.
- Disconnect stops reads and deletes saved calendar-derived recommendations, including planned/worn entries, after a clear user confirmation. It does not break Google sign-in. Users can separately revoke the provider grant in Google Account settings. A connection revision prevents an in-flight request from restoring context after disconnect/reconnect.
- Latest 100 recommendation records retained per user. Account deletion also removes planning settings/history. Nothing is written to a user's Google Calendar.

## Analytics and privacy

`planning_operation_finished` (web), `native_request_completed/failed` (native), and authenticated `native_operation_finished` (API) provide bounded operation/outcome/duration dimensions for load, generate, accept, edit, dismiss and worn. Axiom records API timing/status with no request or response bodies. Existing analytics opt-out and native session correlation remain in force.

Never send day text, audio, calendar content/IDs, garment descriptions/photos, rationales, or dismissal text to analytics. Web inputs and generated context are masked/blocked; native generated recommendations and item selectors use `PostHogMaskView`, in addition to existing global media/input masking. Native replay remains disabled unless `EXPO_PUBLIC_REPLAY_MASKING_VERIFIED=true`; this is not set by this release work without iOS **and** Android masking evidence.

## Verification

- Existing tests plus new ownership, lifecycle, foreign/deleted-piece, rate-limit, disconnect/reconnect race, malformed model output, date and byte-limit tests.
- DST test covers the 23-hour New York spring-transition day and an Auckland local day.
- Authenticated development API smoke test: four synthetic owned pieces → generated grounded suggestion → accepted → edited → worn with actual choices persisted.
- Browser smoke: signed-in Fits planner renders; typed day generates an honest empty-inventory response; accepting an outfit with no owned pieces is disabled.
- Web production compilation succeeds with real local development environment values. Native TypeScript and TestFlight preflight pass.
- Local iOS simulator runtime and Android emulator are unavailable; no device replay proof is claimed.

## Release gates

1. Confirm Calendar API is enabled and incremental consent works for the existing production OAuth client. Google Cloud project `221493786724` currently denies `davidschmittemail@gmail.com` project/service-list access. The owning Google account must be used; do not replace credentials or broaden sign-in scopes to work around it.
2. Build iOS/Android candidates; verify build results. New `expo-audio` and the already-merged native replay module require new binaries, not an OTA to build 4.
3. Merge/deploy the complete release after the Calendar integration gate is resolved, then submit iOS to TestFlight. Do not start an Apple approval watcher.

The development-only `apps/web/scripts/planning-smoke.ts` refuses production credentials and a nonempty fixture inventory. It creates explicitly synthetic fixture data in the designated development environment, not real tester data.
