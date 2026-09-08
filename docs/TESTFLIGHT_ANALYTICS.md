# TestFlight feedback instrumentation

Implementation tracked in [issue #69](https://github.com/schmitd/wardrobe/issues/69).
## Deployment evidence (2026-09-08)

- Server telemetry deployed to production: `dpl_E2SDVCCgVytgb95a3TnHjW6e1n54`,
  aliased to https://wardrobe.davidcschmitt.com (HTTP 200 verified).
- Smoke `d909f87a-10bf-478d-a336-1906c224a5e3` is queryable in both PostHog and
  Axiom, with the production deployment URL. This verifies sink ingestion, not
  an authenticated request through the deployed API wrapper.
- PostHog has a real `native_capture_completed` event for app `0.1.2`, build `2`,
  production, at `2026-09-07T09:07:15.924Z`. This predates the server rollout.
- [TestFlight Feedback dashboard](https://us.posthog.com/project/281423/dashboard/2076007)
  contains verified sign-in and capture funnels. Known reviewer identity and
  configured test accounts are excluded; anonymous pre-login attempts may remain.
  Capture currently has no non-reviewer funnel data. Do not interpret this as a
  broken funnel or draw statistical conclusions from the small beta population.
- Automated tests cover authenticated correlation, content exclusion, opt-out
  header suppression, and sink/handler failures. A fresh physical-device capture
  and persisted opt-out check after this deployment still require verification.
- No native rebuild is required for these server changes. Native replay and
  autonomous UX changes remain disabled.

## Questions to answer

| Question | Signals |
| --- | --- |
| Can testers sign in? | `native_auth_attempted`, authentication completion/failure, method and stage |
| Do testers reach first value? | `native_capture_started` → `native_capture_completed`, split by onboarding and intent |
| Where does capture stall? | routed/failed events, upload/route/commit stage, duration and attempt |
| Is the problem UI or server? | client request results vs `native_operation_finished`, joined with `trace_id` |
| Is a release regressing? | failure rate and duration by app version/build; server environment and Git SHA |

Native screen events contain route templates, never item IDs or URL parameters.
Identity uses the same opaque authenticated Clerk ID as web; no new email/name traits.
Event properties are explicitly allowlisted. Exceptions are replaced with generic errors;
photos, passwords, style notes, filenames and original error messages are excluded.
Native replay and automatic console/error capture remain disabled until real-device masking is verified.

The Account screen has a usage-analytics opt-out. Opted-out clients omit PostHog correlation
headers and therefore suppress backend product events too. Essential Axiom reliability logs
remain enabled and contain bounded operation/status/duration and random trace IDs, not user content.
Server product events require the forwarded distinct ID to match authenticated identity.
Client completion measures perceived success; server completion measures API success: do not
sum them as two conversions. Keep reviewer and smoke traffic out of tester funnels.

## Environment and verification gates

EAS production needs `EXPO_PUBLIC_POSTHOG_PROJECT_TOKEN` and `EXPO_PUBLIC_POSTHOG_HOST`.
Only the public project token belongs in the app. Axiom tokens stay on the server.
Web needs the existing PostHog and Axiom variables documented in [OBSERVABILITY.md](./OBSERVABILITY.md).
The mobile API emits a compact `mobile.request.finished` event directly to Axiom; existing
OTLP spans still provide the detailed server trace.

Before inviting testers:

1. Run mobile/web tests and typechecks, production preflight, and the observability smoke.
2. Confirm the same smoke ID is actually queryable in both services, not merely HTTP-accepted.
3. On the release build, sign in, capture a photo, retry a failure and opt out. Check funnels,
   trace correlation, sanitized properties, and absence of subsequent product events after opt-out.
4. Verify Apple's independent password login and external-beta approval; only then share the public link.

With five testers, investigate individual failed flows and interview feedback before interpreting
percentages as statistically reliable. Use PostHog to propose UX hypotheses and GitHub to record
reproduction, acceptance criteria and approval. Future Autopilot-style fixes require an explicit
review/PR/deployment gate; this change enables no autonomous production edits or rollout.
