#!/usr/bin/env bash
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
bun install --frozen-lockfile
bun run --cwd apps/web playwright install --with-deps chromium
bun run validate core
