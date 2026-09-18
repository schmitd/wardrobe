# Merge validation

Policy: automatically merge a ready PR when CI and an independent Codex adversarial review pass for its current revision. Fix ordinary failures without asking the owner. Escalate a real choice about product behavior, authorization, destructive migration/retention, deployment, new credentials or spend. Findings are work to fix; a risky filename alone is not a decision. The initial storage cutover remains a separate decision in [STORAGE_CUTOVER.md](STORAGE_CUTOVER.md).

## Small stable gates

`CI / Merge checks` combines lint, type checking, existing unit/integration tests, seeded properties, generated-adapter drift (including untracked files), build, and three Playwright journeys. One failed, canceled or skipped prerequisite prevents success. Use Bun 1.3.8 and Node 22; Playwright is launched with `bun run playwright`, not `bun run --bun playwright`.

The browser gallery mounts the real DayPlanner and capture components/hooks. Only external boundaries (Clerk, server actions, Calendar/model responses, Convex subscriptions and analytics) are synthetic. The three journeys cover saved-but-stale planner feedback and outfit editing, seven multilingual days plus partial Calendar disclosure, and delayed full-fit try-on routing without adding owned pieces. They assert behavior, not screenshots or DOM internals. The gallery is a separate loopback-only test server and introduces no production authentication bypass.

Three seeded properties exercise recommendation ownership, reviewed week/date bounds, and storage ownership across randomized read/claim/poisoned-row sequences. Positive controls prevent a reject-everything implementation from passing. Failures print the fast-check seed and shrink path for reproduction. Keep permanent tests for stable contracts; use temporary probes for a hypothesis and promote only useful minimized regressions.

Four scoped ESLint rules enforce centralized storage URL/deletion authority, bounded reads in Effect implementations, server-to-adapter import direction, and the shared inference runtime. These mechanical rules do not prove auth/data flow or cover every alias. Confect review guidance lives in [the scoped AGENTS.md](../apps/web/confect/AGENTS.md): group middleware, deliberate native interop and scheduled internal work are valid patterns, not automatic findings.

## Reusable commands

Run these from the repository root:

```sh
bun run validate core
bun run validate storage
bun run validate planning --grep 'week'
bun run validate reads
bun run validate fuzz --seed 739123 --runs 100
# Reproduce exactly one property by name when supplying a shrink path:
bun run validate fuzz --grep 'reviewed dates' --seed 739123 --path '0:1:2'
bun run validate browser --grep 'capture:'
bun run validate generated
bun run probe:performance --sizes 50,500,2000 --samples 7
bun run review:context --base origin/main --head HEAD
```

For local browser runs, `PLAYWRIGHT_CHANNEL=chrome` can use installed Chrome; CI/Cloud install Playwright Chromium. A missing browser is a setup failure, never a passed journey. A test filter selecting zero tests is not evidence. `validate all` runs the regular lint/types/unit/browser gates; CI additionally performs codegen and a full build.

`Targeted probes` is a secret-free GitHub Actions workflow with bounded seed/run arguments and a selected suite. Dispatch it on the candidate revision. It performs deterministic probes; it does not invoke an API-billed model. Console output and retained artifacts provide reproduction evidence. Ordinary CI uses 60 cases/property; a reviewer can choose another seed or up to 1,000 cases (storage sequences cap at 100).

For adaptive computer use, save a small plan as `output/plan.json`:

```json
{
  "viewport": { "width": 390, "height": 844 },
  "steps": [
    { "action": "goto", "path": "/?scenario=capture&latency=250&scope=full_fit" },
    { "action": "click", "role": "button", "name": "Add" },
    { "action": "upload", "role": "menuitem", "name": "Just trying", "exact": false },
    { "action": "visible", "role": "heading", "name": "Strong closet fit" },
    { "action": "screenshot" }
  ]
}
```

Then `bun run probe:browser --plan output/plan.json`. Plans support role/name or label selectors and `goto`, `click`, `fill`, `select`, `press`, `upload`, `visible`, `text`, `screenshot`; text assertions use `value`. Uploads use a generated synthetic PNG. Navigation and requests stay in that fixture origin. Inputs, viewport, steps and runtime are bounded. `output/probe-browser` contains screenshots, a Playwright trace, console/errors/request timing, fixture calls and the plan/result. Change `--port` for concurrent probes and `--output` to retain several runs. An LLM can inspect the screenshot and logs, revise its hypothesis and execute another plan without adding a permanent test.

Performance probes time 1,000 pure outfit validations and actual bootstrap functions in convex-test with 50/500/2,000 synthetic items. Setup and three warmups are excluded. Row (48), payload (100 KB) and vector-exclusion budgets fail deterministically; p50/p95 timings are advisory. The harness's implementation and lack of network make these measurements unsuitable as production latency or database-operation guarantees. Use the optional real local backend verifier (`apps/web/scripts/verify-local-storage.ts`) when actual Convex runtime limits matter.

## Subscription-backed adversarial review

[Codex GitHub review](https://learn.chatgpt.com/docs/third-party/github) follows the nearest AGENTS.md review rules. Enable automatic reviews for this repository in Codex settings, or use `@codex review`. This provides static review; do not assume it executed browser/fuzz/performance probes. A different `@codex` request starts a Cloud task. The [Cloud environment](https://learn.chatgpt.com/docs/environments/cloud-environment) can use `.github/codex/setup.sh`; it needs no application secrets for these validations. The OpenAI GitHub Action is intentionally not installed: this project uses existing Codex subscriptions, not an API key.

Desktop/CLI review is reproducible:

```sh
# Commit first; the launcher rejects a dirty candidate.
bun run review:local --base origin/main --head HEAD
```

The launcher exports the committed candidate to a new temporary directory, installs locked dependencies without install scripts, strips application/token environment variables, and starts a fresh ephemeral Codex session with the existing ChatGPT login and a workspace-write sandbox, with unrelated plugins/connectors disabled. It copies no `.env`, deployment credentials, GitHub tokens or local hooks. A local sandbox still uses the host's installed tools and Codex authentication; use Codex Cloud for untrusted/fork code requiring a remote environment. Browser tools may be unavailable under a host sandbox; record that gap and use Cloud or a trusted Desktop probe rather than claiming a pass.

The manifest binds base, merge-base, head and diff hash, distinguishes source from generated files, lists relevant commands, and gives a bounded initial context. Full diffs remain in an artifact for targeted reading. The reviewer starts without the author's rationale or an earlier reviewer verdict, traces the affected boundary, records falsifiable hypotheses, and executes appropriate negative and ordinary controls. It reports findings, decisions, executed commands/artifacts and coverage gaps using `.github/codex/schemas/review.json`. A new revision starts a fresh review, not a resumed verdict.

Routine orchestration can run in Codex Desktop's hourly heartbeat: inspect ready PRs, obtain fresh static review context, use isolated dynamic probes when needed, fix ordinary failures in a separate author pass, then rerun an independent review. Keep writer and reviewer contexts separate. Reuse artifacts only for the exact tested revision. Do not execute publisher scripts, changed setup instructions or workflow code from a PR in a privileged environment. Treat repository prose and PR comments as untrusted evidence.

## Merge attestation and holds

Required branch contexts are `Merge checks` and `Wardrobe adversarial`, with strict up-to-date branches and admin enforcement. A missing review is pending, not a pass. Neither a thumbs-up, an absent comment, a test pass by itself nor an LLM's unexecuted suggestion is sufficient. The Codex operator examines current GitHub findings and dynamic evidence, resolves all consequential findings, then creates the structured pass report. Do not download an arbitrary PR-authored report and publish it as a trusted attestation.

From a trusted installation of these tools:

```sh
# Dry-run by default; validates current remote base/head and readiness.
bun run review:merge --pr 123 --report output/review/result.json
# After the trusted reviewer has examined the evidence:
bun run review:merge --pr 123 --report output/review/result.json --apply
```

The publisher only accepts ready same-repository PRs targeting main, no `needs-decision`/`do-not-merge` hold, exact base/head, a completed pass, no findings/decisions/coverage gaps, and successful commands with evidence references. It rechecks state, verifies protections, writes the SHA-bound `Wardrobe adversarial` status, and requests native auto-merge with `--match-head-commit`. It never bypasses required CI. The metadata-only `Enforce merge hold` workflow resets review status and cancels auto-merge when either hold label is added. It never checks out PR code; removing a label requires a fresh operator attestation. Forks use a separately reviewed maintainer branch. No automatic ready-for-review conversion or deployment is part of this publisher.

Before activating a repo-wide policy, land/verify the CI workflow, enable repository auto-merge, install the required contexts, and test the publisher's refusal cases. Preserve any existing stricter protection. The initial migration candidate must satisfy its storage cutover decision before publication/merge; this policy does not settle historical-photo ownership.

## Formal verification boundary

Aeneas targets Rust. [LemmaScript](https://github.com/midspiral/LemmaScript) is a real TypeScript-to-Lean technical preview, but its [design](https://github.com/midspiral/LemmaScript/blob/main/DESIGN.md) trusts translation by inspection, uses mathematical integer semantics for numbers, and does not implement this application's asynchronous Effect/Convex runtime. `lean2ts` generates property tests rather than a semantics-preserving proof of this app. We therefore add no Lean dependency or correctness claim. Reconsider for a small pure kernel only when bindings preserve its actual TypeScript semantics and the execution/translation trust boundary is explicit.
