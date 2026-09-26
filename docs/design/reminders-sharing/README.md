# Fit reminders and image sharing

Design direction reviewed on 2026-09-22; implementation continued through 2026-09-26. David accepted two reminders per day, noon for untimed plans, and one selected phone, and highlighted mockups B and C as major improvements. The draft now includes runtime implementation, tests, platform adapters and SDK-compatible native dependencies. No real push delivery, production migration, or release was performed. See [implemented behavior and release gates](implementation.md).

Tracking: [notification foundation #107](https://github.com/schmitd/wardrobe/issues/107), [share fit #108](https://github.com/schmitd/wardrobe/issues/108). Notification eligibility depends on [fit evidence #105](https://github.com/schmitd/wardrobe/issues/105) and the authoritative model discussed in [ontology #106](https://github.com/schmitd/wardrobe/issues/106), but never on a Zep query at send time. This branch is stacked on PR #109 so reminders use the same canonical evidence.

![Proposed midday reminder, settings, native image sharing, and web fallback](01-reminders-and-sharing.png)

The image was made with built-in imagegen using [this prompt](imagegen-prompts.md). People, garments and system share suggestions are synthetic. Native share targets and browser capabilities vary; the render is illustrative, not a device test. The address shown by imagegen is illustrative and does not designate a new deployment. The two-per-day cap is accepted; the remaining settings are working defaults/options for implementation review.

## Discussion direction

- Timed accepted plan: invite a fit photo when the event starts; cancel the reminder when the corresponding capture or wear has been recorded.
- No accepted plan that local day: one reminder at noon if no fit/wear has been recorded. A saved partial daily fit counts as having answered the capture prompt; unresolved pieces remain an in-app question.
- Accepted on 2026-09-22: an untimed plan gets one noon reminder. Delivery goes to one selected phone; registering another device does not enable multiple-device delivery.
- Past unconfirmed plan: leave a quiet **Wore it** affordance in Diary. No repeated push demanding an answer.
- Accepted cap for multiple events: at most two reminders per local day. Retain the proposed minimum three-hour spacing; quiet hours 9 PM–9 AM remain a working default. This records David’s explicit response.
- Share fit: hand the image to the operating system. No contact permission, social destination inside Wardrobe or public link.

Read the [notification architecture](notification-architecture.md) for conditions, time rules, delivery semantics and rollout gates. Read [image sharing](share-fit.md) for platform adapters and failure states.

## Baseline constraints from the original design

At the design baseline, main `24a30cc` contained Expo SDK 57 and existing camera, filesystem and routing primitives, and its mobile package did not yet list `expo-notifications`, `expo-sharing` or `expo-clipboard`. Source search found no existing push-token registration, Web Push service worker, or image-share adapter in the app code. Permission/notification analytics capture is currently disabled in [analytics.ts](../../../apps/mobile/src/analytics.ts). This source audit does not establish the state of external APNs/FCM credentials or installed binaries.

The accepted-outfit table is day-based and lacks a stable calendar occurrence/start-time association. Event-start reminders need the occurrence/timing model and a reliable, explicitly consented background calendar synchronization contract. Existing on-demand calendar planning is not proof of background freshness. Link work to [#65](https://github.com/schmitd/wardrobe/issues/65), [#89](https://github.com/schmitd/wardrobe/issues/89) and [#90](https://github.com/schmitd/wardrobe/issues/90).

Native push/share features may require a compatible new binary plus signing/provider setup; this PR does not claim they can ship as an OTA update. Web Push needs its own capability-tested adapter. EAS preview jobs subsequently reported exhausted monthly build quota; installed device behavior remains a release gate.

## Original implementation sequence

1. Agree on notification catalog/defaults and sharing interaction here or in #107/#108.
2. Implement preference/installation records, authoritative policy function, transactional intent/attempt ledger and cancellation hooks, with synthetic time/race tests.
3. Integrate native permission/token registration and deep links, then Expo sending/receipts; separately implement Web Push from the same policy and account budget. Require compatible device builds.
4. Implement image export and platform share/copy/download adapters independently.
5. Verify real iOS/Android and supported web behavior, consent and masking before enabling delivery. Keep implementation PRs draft for review.

No subscriptions, messages to contacts, or real push notifications were created during implementation.
