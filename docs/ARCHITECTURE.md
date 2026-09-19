# Architecture decision: Effect 4 and Confect

Decision date: 2026-09-17. Status: implemented on the repair branch; production rollout pending. This supersedes the old Supabase/Vitest implementation proposals. The user approved broader Effect use and the Confect prerelease that supports Effect 4.

## Dependency boundary

Pin Effect and `@effect/opentelemetry` to `4.0.0-rc.115`, Confect core/server/CLI to `10.0.0-next.22`, Convex to `1.46.0`, and the Convex test harness to `0.0.59`. Root overrides prevent two incompatible Effect or Convex copies. Upgrade this set deliberately with code generation, types, backend execution, web build, and native export checked together. A release candidate carries greater API and upgrade risk than stable Effect 3; local validation does not replace a staged release.

The exact Confect package source is the API authority for this prerelease. See [Confect](https://github.com/rjdellecese/confect/tree/v10.0.0-next.22) and the installed type declarations. Effect 3 examples can use incompatible service, result, schema, and error APIs.

## Execution and source ownership

| Boundary | Source of truth |
| --- | --- |
| Next.js server actions | `apps/web/src/app/actions/wardrobe.ts`: public, authenticated adapters only |
| Wardrobe orchestration | `apps/web/src/server/workflows/wardrobe.ts` |
| Model workflows and schemas | `apps/web/src/server/inference` |
| Request identity and public error mapping | `apps/web/src/server/auth.ts`, `errors.ts` |
| Shared server runtimes | `apps/web/src/lib/run-effect.ts` |
| External capabilities | `apps/web/src/services` |
| Confect function/schema source | `apps/web/confect/*.spec.ts`, `*.impl.ts`, `tables` |
| Existing Convex implementation interop | `apps/web/confect/legacy` |
| Generated adapters | `apps/web/confect/_generated`, `apps/web/convex` |
| Transport and deterministic planning contracts | `packages/shared/src` |

Use Context services and Layers for capabilities and scoped dependencies, typed errors for recoverable failures, and schemas at untrusted boundaries. Provider inference uses the shared ManagedRuntime with a memoized Gemini layer and telemetry. Never memoize a user's identity in a process-wide Layer. Pass authenticated context only inside server modules; context-taking helpers must not be exported from a `use server` module.

Confect owns all function specs and table schemas. Storage, upload finalization, deletion, migration, and scheduled style-memory execution use Effect implementations. Existing domain functions use Confect's supported native Convex interop so public function paths and validators survive the migration. `legacy` denotes that adapter boundary, not dead code. Move a domain to Effect when changing its I/O/error behavior; do not mechanically wrap pure transforms or React state.

`auth.config.ts`, `convex.config.ts`, and `http.ts` remain explicit Convex configuration. Other helpers belong outside `convex/`: Confect generation may remove unrecognized files there. Regenerate at the root with `bun run --bun confect codegen`; then run Convex codegen against the intended development deployment. Commit generated adapters and check regeneration drift in CI.

## Invariants

- **Trust belongs in Convex.** Public database functions authenticate and validate ownership of storage and related rows even when callers bypass Next.js. Server-minted, short-lived upload tickets bind the actual stored object to the authenticated owner. Metadata registration cannot grant ownership. URL issuance and deletion consult the same provenance table. Unknown legacy objects require review, never implicit adoption.
- **Deletion revokes first.** A tombstone rejects stale tokens and in-flight finalization before bounded scheduled cleanup. Cleanup deletes only blobs with authoritative ownership, regardless of poisoned application references.
- **Reads are bounded.** Current clients paginate closet, fit, Plan, and Plan-item collections. UI projections omit embeddings. Planning uses a recent context window plus referenced owned items and exposes truncation. The unversioned mobile bootstrap remains a bounded compatibility adapter for older installed clients; its per-Plan detail expansion is not the new pagination path.
- **Follow-up work belongs to mutations.** Closet analysis/deletion, fit recording/promotion, and Plan/inspiration changes coalesce a durable style-memory job. Revision guards protect manual edits and newer context. Failure retries are bounded; a watchdog handles interrupted jobs. Client refresh remains a presentation concern.
- **Failure semantics survive the boundary.** Decode model JSON with the operation schema. Retry only transient provider failures with backoff, pass cancellation to the provider SDK, and map recognized errors once to safe HTTP results. Unexpected failures are server errors, not blanket input or rate-limit errors. A disconnected progress reader cannot fail a persisted analysis.
- **Cache ownership follows identity.** Native query providers are scoped to identity/session; keys also carry the account. Refresh warnings do not reinterpret successful writes as failed writes.

## Validation and limits

Use real Convex integration tests for ownership, transactions, pagination, and scheduled cleanup. Keep targeted tests for model decoding, actual fetch cancellation, transport status, and deterministic planner rules. Do not add redundant mocks merely to hit every wrapper. Local browser checks cover anonymous entry/auth gating; signed-in capture, calendar, provider generation, production telemetry, and physical iOS/Android flows remain release checks.

The repair does not settle retention for historical unowned blobs, perform unattended garbage collection, enable native replay, delete old branches, or supersede the capture-localization work in PR #84. See [release record](REPAIR_RELEASE.md) and the private audit artifacts for the remaining evidence.
