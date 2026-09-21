# PR-driven Wardrobe review

This trusted local controller replaces the six-hour Desktop heartbeat. There is no recurring repository sweep. GitHub delivers signed events over a dedicated Tailscale Funnel port to a loopback Bun receiver. Only authenticated, bounded event metadata is queued; PR text and workflow code are never executed by the receiver.

## Events and gates

- PR opened, reopened, synchronized, or marked ready: review its current revision.
- CI workflow completed: recheck required CI and reuse completed independent evidence only for the exact base/head.
- Codex review submitted or its summary updated: investigate late findings before publication.
- Main updated: update affected open branches without force-pushing, then review the resulting revision.
- Hold/draft changes: eligibility is checked again before every consequential action. Closed PR events record the eventual merge SHA.

The controller uses GitHub's current API state, not a webhook conclusion, to decide readiness. It requires `Merge checks`, `Wardrobe adversarial`, strict up-to-date checks, and admin enforcement. It calls only the installed trusted merge publisher. Missing checks remain pending. No protection bypass is provided.

A fresh subscription-backed Codex process performs each independent review in an exported candidate with synthetic data. Known GitHub findings are hypotheses to investigate, with a disposition and evidence for every unresolved thread. A separate author process can fix routine findings or required CI failures. The controller commits and pushes only after checking the remote revision again, without force. A pushed fix must pass a fresh review. Actual decisions receive a `needs-decision` hold and pending auto-merge is canceled.

Desktop execution is restricted to same-repository revisions attributed by signed GitHub events to configured trusted actors. Forks and other untrusted revisions stay unapproved and require isolated Cloud review; the receiver does not execute them. A GitHub Actions self-hosted runner is deliberately not registered on this public repository. Candidate instructions cannot replace the installed controller, prompts or publisher.

## Installation

Use Bun. Run `bun install --cwd tooling/review-events --frozen-lockfile --ignore-scripts`, `bun run --cwd tooling/review-events typecheck`, and `bun run --cwd tooling/review-events test`.

Install a reviewed immutable copy of this directory outside candidate worktrees. Supply a private JSON configuration with:

```json
{
  "port": 4920,
  "secretFile": "/private/wardrobe-review/webhook-secret",
  "stateDirectory": "/private/wardrobe-review/state",
  "trustedRoot": "/private/wardrobe-review/trusted-tools",
  "trustedActors": ["schmitd"],
  "execute": false
}
```

`trustedRoot` must be a reviewed Git checkout of Wardrobe with the existing validation tools and a trusted origin. Keep it separate from author worktrees. The controller must have the existing `gh` and subscription-backed `codex` logins, Bun, and installed Chrome for the trusted synthetic browser broker. It provisions no API key and makes no API-billed model request. Use `PLAYWRIGHT_CHANNEL=chrome` when appropriate.

Keep configuration, secret and state private (directory mode 700; files 600). Generate a random webhook secret of at least 32 characters. Run `bun /installed/review-events/service.ts /private/config.json` under a persistent user service with an explicit PATH. Start with `execute: false` to verify authenticated delivery without running a reviewer. Only enable execution after independently reviewing the installed code.

Expose only this receiver on a dedicated Funnel HTTPS port, e.g. port 10000 forwarding to loopback 4920. Do not convert existing private service ports to public access. Register `/github` as a JSON GitHub repository webhook with the same secret and events `pull_request`, `pull_request_review`, `issue_comment`, `workflow_run`, and `push`. The public route serves no files and requires a valid SHA-256 HMAC before accepting events. Verify forged requests are rejected, valid events are durably queued, and GitHub records successful delivery.

## Operation and limits

SQLite stores a durable delivery queue, replay deduplication and exact trusted heads. It caps pending/running work at 1,000 events (returning 503 rather than silently losing excess work) and retains the latest 5,000 terminal metadata rows. Deduplication is bounded to that operational window; replayed older events still undergo current-state and exact-revision checks. Only the current trusted head per PR is needed, and verified closed PRs clear that trust entry. This does not delete independent review evidence or historical photos. A process restart resumes queued/interrupted work, not a scan of all PRs. Successful review evidence, author results, logs and merge SHAs stay in the private state directory. An incomplete review never publishes a pass. Failed author attempts on the same head are retained for inspection instead of repeatedly launching the same fix.

The Mac and receiver must be online to receive events. GitHub does not automatically redeliver failed webhooks. With no scheduled recovery sweep, deliveries missed while offline must be redelivered explicitly from GitHub. Transport errors, oversized review/log context, merge conflicts GitHub cannot update, and validation gaps remain visible failures for follow-up. They never become passing checks.

Each completed or failed review copies its synthetic probe output into the private evidence directory and removes the installed temporary workspace. Author worktrees similarly preserve probe output, an uncommitted patch and untracked source files before removal; committed fixes remain in Git. If evidence preservation fails, cleanup fails visibly rather than silently discarding work. Retained evidence remains available independently of candidate dependency installations.

Pause execution by setting `execute: false` and restarting the local service; disable the GitHub webhook to stop intake. Remove only this Funnel port when uninstalling. Do not reset unrelated Tailscale services. The old heartbeat must remain paused; no daily fallback is installed.

References: [GitHub webhook delivery guidance](https://docs.github.com/en/webhooks/using-webhooks/best-practices-for-using-webhooks), [failed deliveries](https://docs.github.com/en/webhooks/using-webhooks/handling-failed-webhook-deliveries), [Tailscale Funnel](https://tailscale.com/kb/1223/funnel).
