# Day planning release — issue #65

## Implemented

- Fits → Plans contains a day planner on web, iOS and Android; no new top-level destination.
- A seven-day outlook replaces the dense day checklist. Dictation or typed descriptions are interpreted into editable dated activities; a reviewed batch generates up to seven outfits atomically. Ambiguous dates require clarification. Explicit dates up to one year ahead remain supported.
- iOS uses system segmented controls, date pickers, push details and form sheets. Android uses underlined tabs, rounded actions, touch feedback and its system date dialog. Web uses a responsive week board, native date inputs and keyboard/focus-managed dialogs. Existing Wardrobe / Capture / Fits and Diary / Plans navigation remains intact.
- Opening the visible week reads selected Calendar titles/times for display. Outfit generation reads only the reviewed dates with DST-aware boundaries. No automatic background generation or calendar writes are added.
- Gemini recommendations use bounded owned inventory, recent fits, the style profile, a selected existing Plan and its owned-piece anchors, Zep preference retrieval, and previous suggestion outcomes/dismissal reasons.
- Model output is validated before persistence. Invented/foreign IDs are rejected; an empty or incomplete wardrobe gets an honest missing-pieces explanation. Weather is explicitly not fetched or assumed.
- Suggested → Planned → Worn are separate states. Users accept, edit/swap owned pieces, dismiss with a reason, or confirm actual worn pieces atomically. Finished outfits cannot silently change state.
- Voice capture is explicit and limited to 60 seconds. Audio is sent for transcription only after a second deliberate Transcribe action, held in memory server-side, and not uploaded to Wardrobe storage or Zep. The editable transcript is never automatically submitted for recommendations. Cancellation/background/unmount stops recording; native temporary files are deleted.
- Google Calendar is a progressive Clerk OAuth connection. Existing Google sign-in does not imply calendar consent. Users choose up to ten calendars in the web flow, which native opens in the browser using the same Wardrobe account.
- Scopes: `calendar.events.readonly` and `calendar.calendarlist.readonly`. Provider tokens stay server-side. Only event title, start/end and location are requested, not descriptions or attendees. Reads are bounded and partial busy-day context is labeled.
- Disconnect stops reads and deletes saved calendar-derived recommendations, including planned/worn entries, after a clear user confirmation. It does not break Google sign-in. Users can separately revoke the provider grant in Google Account settings. A connection revision prevents an in-flight request from restoring context after disconnect/reconnect.
- Up to 100 recommendation records retained per user. Regeneration never overwrites planned/worn entries, including a concurrent acceptance during AI generation. Retention evicts only uncommitted outfits; a full committed history returns an actionable error. Worn outfits also appear in Diary. Account deletion removes planning settings/history.
- User-scoped drafts survive the Google browser handoff for eight hours: encrypted SecureStore on native and tab-scoped sessionStorage on web. Provider tokens stay server-side; no auth tokens are added to draft storage.

## Analytics and privacy

`planning_operation_finished` (web), `native_request_completed/failed` (native), and authenticated `native_operation_finished` (API) provide bounded operation/outcome/duration dimensions for load, interpret, calendar-week reads, week generation, accept, edit, dismiss and worn. Web now propagates consent-gated session correlation as well. Axiom records API timing/status with no request or response bodies. Existing analytics opt-out remains in force.

Never send day text, audio, calendar content/IDs, garment descriptions/photos, rationales, or dismissal text to analytics. Web inputs and generated context are masked/blocked; native generated recommendations and item selectors use `PostHogMaskView`, in addition to existing global media/input masking. Native replay remains disabled unless `EXPO_PUBLIC_REPLAY_MASKING_VERIFIED=true`; this is not set by this release work without iOS **and** Android masking evidence.

## Verification

- Existing tests plus new ownership, lifecycle, foreign/deleted-piece, rate-limit, disconnect/reconnect race, malformed model output, date and byte-limit tests.
- DST test covers the 23-hour New York spring-transition day and an Auckland local day.
- Authenticated development API smoke test: four synthetic owned pieces → generated grounded suggestion → accepted → edited → worn with actual choices persisted.
- Browser smoke: signed-in Fits planner renders; typed day generates an honest empty-inventory response; accepting an outfit with no owned pieces is disabled.
- Web production compilation succeeds with real local development environment values. Native TypeScript and TestFlight preflight pass.
- The actual app launches in iOS 26.2 Expo Go. Android emulator is not installed locally; no Android device interaction or replay-masking proof is claimed.
- Live week smoke: three dates generate owned-only recommendations; editing persists; a second batch updates one suggested day and keeps planned/worn days untouched. See `apps/web/scripts/planning-week-smoke.ts`, restricted to the dedicated development review account and synthetic inventory.
- Browser testing caught and fixed date edits being lost on date-input events. Reviewed dates/activities now persist before generation; empty inventory remains explicitly incomplete rather than inventing ownership.

## Platform release 0.1.5

This production integration supersedes the sample-only iOS prototype in PR #85. New system date-picker and segmented-control native modules require new iOS/Android binaries; do not send this JavaScript to an older fingerprint through OTA. Compatible subsequent fixes may use OTA. TestFlight submission is in scope; Apple approval monitoring is not.

## Release gates

1. Google Cloud project `221493786724` (`gen-lang-client-0224409020`) is accessible with `davidschmittgit@gmail.com`. Calendar API enablement was verified September 15, 2026. OAuth branding, publication and a real incremental-consent connection remain to be verified. Do not replace credentials or broaden default sign-in scopes to work around a missing grant.
2. Both native candidates for `4da675f` finished successfully: iOS 0.1.4 (5), build `bc860c8f-9832-483a-8646-adf11bb87ce7`; Android 0.1.4 (2), build `43478da2-8baa-4826-9059-5be5e9f45a42`. New `expo-audio` and the already-merged native replay module require new binaries, not an OTA to build 4. Subsequent privacy-page changes are web-only.
3. Deploy the public `/privacy` notice and complete OAuth configuration before testing production incremental consent. Verify the production planning API before submitting iOS to TestFlight. Do not start an Apple approval watcher or claim Calendar consent/replay masking is verified without evidence.

The development-only `apps/web/scripts/planning-smoke.ts` refuses production credentials and a nonempty fixture inventory. It creates explicitly synthetic fixture data in the designated development environment, not real tester data.
