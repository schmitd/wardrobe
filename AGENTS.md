# Wardrobe Application

## Development
- Always use Bun to run node commands.
- Read `docs/ARCHITECTURE.md` before backend changes and `docs/REPAIR_RELEASE.md` before releasing the Effect 4 migration.
- Use Effect 4 Context services, Layers, tagged errors, schemas, cancellation, and the shared runtime for server I/O workflows. Keep deterministic transformations and React state plain TypeScript.
- Confect source lives in `apps/web/confect`; `confect/_generated` and most of `apps/web/convex` are generated. Never put helpers in the generated directory. Regenerate with `bun run --bun confect codegen` at the repository root.
- Enforce identity, storage ownership, and related-record ownership in Convex. A web action or client check cannot secure a public Convex function. Caller-supplied storage references are not proof of ownership.
- Bound database reads, paginate user collections, and project UI data without embeddings. Schedule domain follow-up work from successful mutations so all clients get the same behavior.
- Prefer meaningful boundary and integration checks over tests that mirror implementation. Run `bun run test`, `bun run typecheck`, `bun run lint`, and relevant builds before release.

## Product and observability context

- Read `docs/OBSERVABILITY.md` before instrumenting product behavior, investigating production bugs, or changing telemetry.
- PostHog owns product analytics, feature flags, surveys, masked session replay, and client-side exceptions.
- Axiom owns server logs, traces, latency, infrastructure signals, and AI-operation telemetry. Do not duplicate those payloads in PostHog.
- Never send prompts, uploads, filenames, style-bio text, image-derived attributes, raw logs, or trace payloads to PostHog.
- Use GitHub issues as the source of truth for bug and product triage. Link PostHog replays/insights and Axiom trace IDs or queries instead of pasting sensitive payloads.
- Preserve the event names and safe property contracts documented in `docs/OBSERVABILITY.md`; update that document when the contract changes.
- Analytics are a default requirement for future feature work: preserve native/web user-flow events, authenticated client/server correlation, and Axiom operational telemetry. Add safe events for new meaningful flows rather than silently shipping uninstrumented behavior.
- Preserve analytics opt-out, content allowlists, and reviewer/test-traffic exclusions. Test telemetry changes and verify ingestion after deployment; do not enable native replay or autonomous UX changes without separate approval.

## Code Review Rules

- Review the changed behavior and reachable callers against `docs/ARCHITECTURE.md`. Confirm a failure path and a legitimate control before reporting a defect. Give the exact revision, affected boundary, and a focused reproduction command; distinguish observed failures from hypotheses. Formatting and mechanical lint findings belong in CI.
- Apply the nearest scoped guidance, especially `apps/web/confect/AGENTS.md`. Read the pinned package declarations when uncertain about a prerelease API. Do not demand blanket Effect conversion, blanket return validators, or more mocks when the existing boundary already enforces the invariant.
- Resolve routine implementation/test failures autonomously. Escalate actual product or operational tradeoffs: changing ownership/authorization semantics, destructive migration or retention, new external credentials/spend, publishing/deployment, or a conflicting user-visible contract. A scary filename alone does not require a decision. See `docs/VALIDATION.md` for narrow probes and evidence requirements.
