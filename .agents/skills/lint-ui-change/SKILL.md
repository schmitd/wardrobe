---
name: lint-ui-change
description: Implement or review Lint web UI changes involving entity choices, task sheets, recovery, auth/provider states, notifications or loading continuity using the repository's existing UX contract and gates.
---

Read [the UI contribution contract](../../../docs/UX_CONTRIBUTION.md) before changing these flows. Use its canonical components and short evidence checklist; keep product rules in that document instead of duplicating them here.

Inspect the real entry and reachable cancel/back/error/retry/reload and account boundaries. Extend the nearest real-component test or browser fixture for the regression, mocking only external boundaries. Preserve ownership/auth, native platform affordances and user-authorized scope.

Run `bun run validate ux` from the root and the other applicable [validation gates](../../../docs/VALIDATION.md). Report exact source revision, executed commands, screenshots/geometry/contrast evidence and untested paths. Functional passes do not establish visual acceptance. Read a lint refusal as a concrete boundary to fix; use the contract's scoped exception process for a justified different interaction.
