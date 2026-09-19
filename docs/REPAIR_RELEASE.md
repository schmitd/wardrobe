# Effect 4 repair: implementation and release record

Base: `449e64e75d1a369ac632bed4a7732bcc799c5546` (main at audit). Branch: `codex/effect4-storage-repair`. Initial validation: 2026-09-17. The strict Convex backend and matching web build were deployed on 2026-09-19 after the owner approved the historical-photo cutover. Native distribution remains separate. Existing archive and dirty worktrees were preserved.

## Implemented work

| Tracking | Result on this branch | Remaining release evidence |
| --- | --- | --- |
| Private storage finding | Server-owned upload provenance, common read/write/delete enforcement, revocable tickets, bounded account cleanup, explicit legacy review | Deployed; consistent current owners adopted under the approved snapshot policy |
| [#87](https://github.com/schmitd/wardrobe/issues/87) | Native account/session providers and account-specific cache keys | Physical account switch / session expiry |
| [#88](https://github.com/schmitd/wardrobe/issues/88) | Past planning access, add/remove actual-worn pieces, dismissed-suggestion tombstone | Web/native diary flow |
| [#89](https://github.com/schmitd/wardrobe/issues/89) | Minimal passive Calendar fields; truncated-day disclosure | Authorized Calendar integration |
| [#90](https://github.com/schmitd/wardrobe/issues/90) | Week enforcement, UTF-8 body budget, nonblank missing items, referenced older pieces | Large closet and seven-day multilingual flow |
| [#91](https://github.com/schmitd/wardrobe/issues/91) | Typed safe HTTP failures; separate saved-but-stale warnings; Plan detail loading independent of bootstrap | Injected provider/refresh failures in deployed clients |
| [#92](https://github.com/schmitd/wardrobe/issues/92) | Paginated current bootstrap, lists and details; vector-free fit projections; bounded planning/profile context | Production payload/latency comparison; old bootstrap compatibility retirement later |
| [#93](https://github.com/schmitd/wardrobe/issues/93) | Capture intent fixed before async work; full-fit try-on follows full-fit analysis and persistence | Real multi-garment photos and provider result quality |
| [#94](https://github.com/schmitd/wardrobe/issues/94) | Disconnect-safe progress channel and authenticated stream protection | Deployed capture after navigation/disconnect |
| [#95](https://github.com/schmitd/wardrobe/issues/95) | Durable coalesced mutation-triggered style-memory jobs, stale-result guards and bounded retries | Convex provider secret configured and Node runtime verified; generated updates still need provider validation |
| [#96](https://github.com/schmitd/wardrobe/issues/96) | Auth preflight deadline and successful-body schema in production/TestFlight paths | Native distribution and real sign-in |
| [#63](https://github.com/schmitd/wardrobe/issues/63), [#69](https://github.com/schmitd/wardrobe/issues/69) | CI tests/generation drift checks; logout identity reset and OTA release dimensions | Required CI/release policy, authenticated ingestion and opt-out evidence |
| [#75](https://github.com/schmitd/wardrobe/issues/75), [#82](https://github.com/schmitd/wardrobe/issues/82) | Style-memory masking, consent-loading guard, full-image native closet thumbnails | Physical masking/crop checks; replay gate remains off |

PR #84 capture localization remains separate and is not superseded. Historical experimental and dirty worktrees are not safe to delete based solely on this migration. Broad architecture work includes shared runtime/provider cancellation and schemas, thin authenticated action adapters, shared mobile types, Confect schema/function ownership, and refreshed durable guidance.

## Local validation

Commands are from the repository root unless stated otherwise. See the private local audit report for logs and the independent security review.

| Check | Result |
| --- | --- |
| `bun run test` | PASS: 92 web tests, 27 mobile tests; other workspace checks passed |
| `bun run typecheck` | PASS after explicit inventory-page typing in the operator CLI |
| `bun run lint` | PASS, 3 pre-existing warnings; no errors |
| `bun run --bun confect codegen` plus generation comparison | PASS, deterministic generated outputs |
| `bun install --frozen-lockfile` | PASS |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_dGVzdC5jbGVyay5hY2NvdW50cy5kZXYk bun run build` | PASS, all workspaces |
| From `apps/mobile`: `bun run --bun expo export --platform ios --platform android --output-dir /tmp/wardrobe-effect4-native-export` | PASS, both native bundles; no native binary produced |
| From `apps/web`: `bun run scripts/verify-local-storage.ts` with local Convex running | PASS, actual HTTP upload/ticket replay/foreign registration and refs/revocation, mobile bootstrap and Node action execution |
| From `apps/web`: `bun run scripts/storage-review.ts inventory --local --out ../../.private/storage-inventory.json` | PASS, empty inventory after synthetic cleanup; no remote data |
| Browser smoke on local development app | PASS, anonymous home and Clerk sign-in gate; no authenticated provider call |

The original synthetic attack no longer succeeds: a foreign storage reference cannot create authoritative ownership, issue an application URL, be attached through sibling wardrobe/fit/crop paths, or delete the foreign blob during account cleanup. Real upload controls and same-owner access still succeed. `confect/storage.integration.test.ts` verifies poisoned references, ticket replay, deletion races, reviewed-ownership conflicts, and positive controls using the actual registered functions; `scripts/verify-local-storage.ts` exercises the real local Convex HTTP runtime. A fresh independent security review found no surviving ownership bypass; its upload-size regression was corrected.

Additional focused checks cover pagination/account isolation and embedding exclusion, scheduled-memory coalescing/manual-edit guards, real SDK fetch abortion, malformed model success payloads, nontransient retry behavior, and disconnected progress readers. Integration fixtures omit the optional external Zep retrier component, producing expected enqueue warnings; these tests do not claim to verify graph delivery.

## Closure gates

The initial [storage cutover](STORAGE_CUTOVER.md) is deployed. All 119 original files retain their hashes; 100 consistently associated files received approved ownership records, and 19 unreferenced files were preserved without inventing owners. A live synthetic upload verified CORS, single-use tickets, owner access, cross-account rejection and cleanup. Production bootstrap and the Confect Node action runtime also executed successfully without requesting provider inference. A fresh signed-in browser loaded the closet, diary and Plans; Calendar refresh still needs operational verification. These checks do not establish provider delivery or native device behavior. Do not restore the old ownership path as a rollback.

GitHub bugs remain open until deployment and both user-flow and operational verification, per [OBSERVABILITY.md](OBSERVABILITY.md). Local tests cannot establish calendar consent, generated-image quality, signed-in browser usability, real-device masking, telemetry ingestion, EAS availability, or delivery to testers. No current Expo quota or Apple release-state claim is made here.
