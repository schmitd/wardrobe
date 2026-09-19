# Testing and instrumentation

The old unresolved merge of Supabase/Vitest proposals has been retired; its full text remains in Git history. Current commands are `bun run test`, `bun run typecheck`, `bun run lint`, and `bun run build` from the repository root.

Use real Convex integration tests for authorization, ownership, pagination, scheduling, and deletion. Use focused boundary tests for model response decoding, cancellation, HTTP errors, and upload/auth preflight contracts. Test pure planning invariants directly. Avoid redundant wrapper tests and implementation-shaped mocks when a shared invariant removes the failure mode.

Bun is the test runner. Browser/device checks complement automated tests; a successful local export does not establish signed-in device behavior. See [architecture](../../../docs/ARCHITECTURE.md), [release evidence](../../../docs/REPAIR_RELEASE.md), [observability](../../../docs/OBSERVABILITY.md), and [TestFlight analytics](../../../docs/TESTFLIGHT_ANALYTICS.md).
