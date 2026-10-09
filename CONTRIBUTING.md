# Contributing to Lint

Use Bun and the nearest [AGENTS.md](AGENTS.md). Backend and observability contracts live in [Architecture](docs/ARCHITECTURE.md) and [Observability](docs/OBSERVABILITY.md).

For web UI changes, follow [the UI contribution contract](docs/UX_CONTRIBUTION.md) and record its short checklist in the PR. Agent workflow: [lint-ui-change](.agents/skills/lint-ui-change/SKILL.md). Reuse the canonical surfaces before adding a chooser, modal, state message or loading placeholder.

Run the existing lint, typecheck and test gates plus relevant browser journeys; commands and coverage boundaries are in [Validation](docs/VALIDATION.md). `bun run validate ux` runs the focused UI checks, production source lint and the existing real-component browser gate. A successful functional check is evidence for the tested interaction; screenshots and visual review remain required for changed appearance.
