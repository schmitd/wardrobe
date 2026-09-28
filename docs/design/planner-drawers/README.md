# Recommendation and drawer interaction study

September 27, 2026. Based on fetched `origin/main` at `100c351`. The study below informed the approved implementation. Implementation is in this branch; no deployment or live planning mutation was performed.

Open `index.html` directly, or serve it with Bun. Both examples are interactive, with mobile and desktop presentation. Garments, dates, calendar connection, microphone, and generated results are illustrative. This is not a connected planner.

## Direction

Use one consistent task drawer: bottom sheet on phones, fixed-width side sheet on desktop. Plan composition, calendar settings, item details, and secondary editors use the same shell. Keep a separate confirmation only when an action truly warrants interruption (e.g. destructive removal), preferably in the same sheet. Do not convert simple anchored menus such as Add into task drawers.

1. Plan automatically maintains suggestions for the next seven local dates. Assumption pending user preference: include quiet days, using closet/style context without inventing events. Calendar access remains explicit and optional. Missing suggestions fill once; opening a view must not regenerate repeatedly. Protect chosen and worn outfits. Account for rollover, timezone changes, duplicate jobs, stale responses, pause, rate limits, disconnected calendars, and per-day failures before implementing background generation.
2. One optional day-or-week description. Dictation writes into that same field. Tap to start, tap to finish, then automatically transcribe; keep editable text and one Update outfits action. Clearly disclose audio transmission at first use. Retain cancellation, denied permission, interrupted recording, transcription failure and the typed fallback.
3. Interpret and generate as one visible operation after Update outfits. Ask a brief targeted question only when dates really are ambiguous. No mandatory seven-row form or separate per-day textareas. A request for today changes today; a week description changes its explicitly named dates. The default remains today through the next six days, matching the existing product contract.
4. Show useful progress in a reserved status line beside the action. Preserve the draft on failure, offer Retry there, and show the completed outfit without requiring a second hidden action. The mock demonstrates the happy path and empty-input feedback; it does not implement model interpretation or backend retries.
5. On item detail, opening Labels, Collections or My note replaces only the body. Keep the garment summary, sheet bounds, header, and action rail fixed. Back restores the overview. Avoid stacking another modal. This is a detail view rather than an accordion, so neighboring rows do not slide or compress.

## Research and interpretation

- [Nielsen Norman Group: Accordions Are Not Always the Answer](https://www.nngroup.com/articles/accordions-complex-content/) explains the decision and click cost of hiding related content, and recommends displaying content when people need most of it. Application here: keep the garment summary visible; avoid a mandatory accordion-driven planning form.
- [IBM Carbon: Accordion](https://carbondesignsystem.com/components/accordion/usage/) recommends one scrolling accordion rather than independently scrolling nested panels, and identifies content switching and tabs as alternatives for related content in the same space. Application here: one scrollable detail body; replace its view for longer editors. An accordion can remain appropriate for short optional information, but only in that body.
- [IBM Carbon: UI shell right panel](https://carbondesignsystem.com/components/UI-shell-right-panel/usage/) uses consistent-width full-height panels anchored at the right edge. This is a shell pattern, not direct guidance for clothing editors. Its stable geometry is a useful precedent for our desktop adaptation.

The fixed header/hero/footer and body replacement are our synthesis of those patterns, not a claim that the sources prescribe this exact Wardrobe design.

## Investigation: confirmed code behavior vs unverified failure

Current source: `apps/web/src/components/DayPlanner.tsx`, `DayVoiceInput.tsx`, `ItemDetailsDrawer.tsx`, `ui/dialog.tsx`, `apps/web/src/app/globals.css`; native counterpart `apps/mobile/app/planner/describe.tsx`.

- Typing updates draft.description only. Transcription also only updates the draft. Review days invokes `planning_interpret`, which produces reviewed days; it does not generate outfits. Only the later Suggest outfits action calls `planning_generate_week`. This is a confirmed interaction mismatch with the user's expectation, not proof of a provider failure.
- Recording ends by storing a blob; another Transcribe recording action is required before text appears. The UI then still requires review and generation.
- Calendar use seeds seven editable review rows; it does not start automatic generation. An automatic daily planner requires backend scheduling/idempotency work, not just relabeling a button.
- Error text is rendered in the open dialog, after its long body. Therefore errors can be below the visible scroll area. It would be inaccurate to claim that the current code drops every error.
- The generic dialog uses centered transforms, grid layout, and content-driven height. The mobile item drawer overrides anchoring and sets only a max-height; collection management inserts an inline list. This permits sheet growth and repositioning as content changes. Actual affected dimensions in production remain to be measured. On desktop align-content:start already exists, so it is not valid to blame all desktop movement on stretched grid rows.
- The current day selectors already reserve their border width and minimum height. Their selected color alone does not prove a layout bug. Selected content changes and other closet selection paths need a signed-in reproduction, including scrollbar locking and long content.
- Live browser reached the signed-out guest page. No authenticated generation was submitted. Backend/provider failure and the user's exact production layout shift remain unverified; no claim of a deployed fix is made.

## Implementation acceptance criteria

- Exactly one shared day/week text field. Dictation completion populates it automatically; one action produces visible outfit progress/results or an actionable error.
- Calendar auto-plan covers all eligible dates under the chosen policy; it neither overwrites planned/worn fits nor repeatedly generates on renders. Quiet-day suggestions do not fabricate events. Connection expiry and partial failures are visible per day.
- One responsive sheet component with explicit block size and grid rows `auto minmax(0,1fr) auto`; a fixed-size garment summary where present. Body alone scrolls; no auto-height animation, flex shrink, or space redistribution for the hero and footer. Stable image aspect ratios and selection borders; reserve scrollbar space.
- At small heights or with the keyboard open, use available viewport height and allow the body to scroll. Fixed-size does not mean content gets clipped at 200% text size.
- Focus remains inside a live modal sheet, Escape backs out of details before dismissing, close restores focus to the trigger, and background content is inert. Provide reduced motion and screen-reader progress. The side-by-side study is a comparison board, not the production modal accessibility implementation.
- Measure sheet, image and action bounds before/after detail expansion, collection choice, pending/error states, long content, and day changes. Check phone widths 320/390 and desktop, keyboard, zoom, and reduced motion. Verify real signed-in web/native generation plus traces before closing the bug.

## Mockup verification

Browser interaction verified: detail navigation, dictation demo state, sample transcript, generation busy state and result, desktop mode. In phone study, drawer is 428×570; hero 428×145; action 384×44 before and after entering Collections. Hero and action offsets relative to drawer remain 76px and 508px. Browser scroll changed viewport coordinates during focus navigation; element sizes and internal positions stayed constant. These measurements validate the study, not production.

## Follow-up diagnosis

Use an authenticated reproduction at the user's failure time. Correlate `planning_interpret` and `planning_generate_week` success/failure and trace IDs without copying transcripts or calendar details into telemetry. Determine whether the request never fires, fails, returns clarification, saves zero eligible days, or saves successfully but fails to refresh. Include one successful control before assigning a backend root cause. Existing issues #90, #91, #118 and #125 are adjacent work; this study is not evidence that they are all resolved.

## Implementation validation (September 28)

`TaskSheet` is shared by the real web planner, item details, collection create/edit/add, and style notes. Native planning uses the same one-action request and automatic transcription behavior in its existing native sheet. The native closet navigation is outside this web drawer change.

A durable Convex job fills missing next-seven-day suggestions just after local midnight, with revision guards, a watchdog, one transient retry, pause, and account-deletion protection. Calendar selection changes invalidate in-flight jobs. Existing suggestions, dismissed dates, and chosen/worn outfits are kept by automatic filling. The shared inference boundary rejects missing dates or unowned item IDs, and mutations recheck ownership. Manual updates still protect chosen/worn fits.

The loopback browser gallery mounts real components with synthetic external boundaries. Browser regressions cover one-field generation, retained drafts and retries, clarification, dictation finish/cancel, and fixed sheet/hero/footer bounds through collection and note edits at 320px, 390px and 1280px. Collection selection retains the grid origin. Provider authentication, actual microphone hardware, native device behavior, and overnight delivery need live release checks; fixture success is not proof of those integrations or of the original reported provider failure.

Before deployment, verify `OPENAI_API_KEY` and (for connected Calendars) `CLERK_SECRET_KEY` in the intended Convex environment. No new credentials or production configuration were installed by this implementation. Confirm one signed-in typed request, one real dictation, and a durable job outcome before closing the production issue.
