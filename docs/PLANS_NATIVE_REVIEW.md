# Plans: week-ahead design review

Status: **mockup approved; interactive iOS design prototype implemented** (September 15, 2026). Not a production release.

The user's September 15 clarification supersedes the day-form-first prototype:

- Preserve the existing division of views and navigation. Concentrate on Plans inside Fits.
- The coming week and its suggested outfits are the primary workspace, not a separate one-day form.
- Dictation can describe several days in one utterance. Review the interpreted dates/context before generating or replacing suggestions for those days.
- Google Calendar events and dictated context complement one another. Users can inspect and adjust context for a day.
- Show a wireframe/mockup and obtain feedback before further app implementation.

## First concept for review

1. A seven-row week overview on iPhone, with short event context and visible outfit previews beside each day. Navigate weeks without checkbox-style date selection.
2. A native dictation sheet: editable transcript, interpreted day/context rows, and one action to suggest outfits for the affected days. Preserve the remaining week.
3. A per-day outfit detail: short rationale, individual swaps, and an explicit planning action. Suggested, planned and actually worn stay distinct.

The user approved the week-first mockup with “mockup looks great, proceed.” `apps/planner-prototype` now implements this composition with real native navigation, date pickers, segmented control and sheets. Calendar authorization and outfit generation remain explicitly labeled local simulations. The garment photos are generated sample assets, not personal wardrobe data.

Next design review: try the interactive flow before adapting it into the live app's existing API, Google callback and masked telemetry. Preserve the existing navigation; this is not authorization to replace production screens with sample data.

## Mockup audit before implementation

The generated board is a concept, not runtime evidence. Review found these corrections to carry into the next approved iteration:

- **Preserve committed outfits:** the board labels Friday as Planned in the week but offers Plan this outfit in detail. Detail must reflect the actual state. Updating suggestions for several days must not silently overwrite an already planned outfit.
- **Make context sources truthful:** the board repeats Calendar icons beside all days, including Free day. Show a Calendar source only for an imported event; dictated notes and an empty calendar are different states.
- **Keep the week readable at larger text sizes:** seven days visible is the default composition, not a fixed-height constraint. Allow scrolling rather than shrinking text or garment previews at accessibility sizes.
- **Resolve ambiguous dictated dates:** let users edit the interpreted day/context before generating. Do not silently assign a vague phrase to a date, or replace unrelated days.
- **Complete the Calendar return path:** connection is optional. From the same week, open consent, select calendars, and return to the preserved week and dictation draft. Cancellation and failure must also return without draft loss. The mockup shows connected context, not proof of real authorization.

These corrections are implemented in the week-first prototype. The prior day-form draft is superseded.

## Verification and handoff

- iPhone 17 Pro simulator, iOS 26.2, Expo Go 57: seven-day overview, garment previews, detail, native swap sheet, explicit plan action, interpreted-day editing with a native date picker, and targeted bulk suggestions exercised through the UI.
- Friday was swapped and marked planned. Wednesday's interpreted date was corrected to Thursday, then Thursday and Sunday updated. Friday remained planned and unchanged; the notice reported two updated days and one kept outfit.
- Calendar preview: connection failure, cancellation from the dictation sheet, retry, calendar selection and successful return exercised. The week and transcript survived; a reload also preserved local outfits and notes.
- Accessibility-large text and dark appearance exercised. Content scrolls instead of squeezing seven days onto one screen; the bulk action remains reachable. Weekday width and inactive tab contrast were corrected during this check. Native header items are visible and operable, but the Simulator accessibility bridge intermittently omits them; full VoiceOver validation remains pending.
- `bun run typecheck` passes. `bun run test` passes 10 tests / 30 assertions covering date boundaries, interpretation, targeted updates, protected outfits, calendar context, state restoration and lifecycle rules.
- Spoken dictation was not end-to-end tested. The prototype focuses an editable native text input so system keyboard dictation can supply text; the sample helper is not a microphone transcription implementation.

Local screenshots and the unedited simulator walkthrough are in `output/ios-planner/` (ignored build/review artifacts). See the prototype README for launch instructions and exact production integration boundaries. No production API calls, analytics events, deployment, OTA publication, or TestFlight submission were made for this prototype.
