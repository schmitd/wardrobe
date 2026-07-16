# Wardrobe Application

## Development
- Always use Bun to run node commands.

## Product and observability context

- Read `docs/OBSERVABILITY.md` before instrumenting product behavior, investigating production bugs, or changing telemetry.
- PostHog owns product analytics, feature flags, surveys, masked session replay, and client-side exceptions.
- Axiom owns server logs, traces, latency, infrastructure signals, and AI-operation telemetry. Do not duplicate those payloads in PostHog.
- Never send prompts, uploads, filenames, style-bio text, image-derived attributes, raw logs, or trace payloads to PostHog.
- Use GitHub issues as the source of truth for bug and product triage. Link PostHog replays/insights and Axiom trace IDs or queries instead of pasting sensitive payloads.
- Preserve the event names and safe property contracts documented in `docs/OBSERVABILITY.md`; update that document when the contract changes.
