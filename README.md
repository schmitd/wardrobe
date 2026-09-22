# Wardrobe

Wardrobe turns closet photos, fit checks, and style notes into a maintained personal style profile and day/week outfit plans. Web and Expo clients share Convex data and server workflows; the Chrome extension and ChatGPT app use the context API.

## Workspaces

| Path | Responsibility |
| --- | --- |
| `apps/web` | Next.js app, HTTP adapters, Effect workflows, Confect/Convex backend |
| `apps/mobile` | Expo Router iOS/Android client |
| `apps/chrome-extension` | Product-page fit checks |
| `apps/chatgpt-app` | HTTP MCP server and widget |
| `packages/shared` | Shared mobile/planning contracts and model selection |
| `packages/context-client` | Context API client |

Read [architecture](docs/ARCHITECTURE.md), [product context](apps/web/PRODUCT.md), and [observability](docs/OBSERVABILITY.md) before changing behavior. The Effect 4 migration is **locally verified, pending rollout**; [release gates](docs/REPAIR_RELEASE.md) include legacy-photo review.

## Development

Use Bun 1.3.8. Effect `4.0.0-rc.115`, Confect `10.0.0-next.22`, and Convex `1.46.0` are pinned together. These are deliberately selected prereleases, not an automatic upgrade policy.

```sh
bun install --frozen-lockfile
bun run --bun confect codegen
bun run --bun convex dev
```

Run these commands at the repository root. `convex.json` points to `apps/web/convex`; Confect sources are in `apps/web/confect`. Use a development Convex deployment and the matching Clerk development issuer. Set the following in `apps/web/.env.local` for Next.js:

```env
NEXT_PUBLIC_CONVEX_URL=<development Convex URL>
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=<development public key>
CLERK_SECRET_KEY=<development secret key>
CLERK_JWT_TEMPLATE=convex
OPENAI_API_KEY=<server-only generation and transcription key>
GEMINI_API_KEY=<server-only direct image and text embedding key>
ZEP_KEY=<optional graph integration key>
ARCJET_KEY=<protection key>
AXIOM_TOKEN=<server-only telemetry token>
AXIOM_DATASET=<dataset>
NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN=<public project token>
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
```

The Clerk JWT template must set `aud` to `convex`. Backend authentication configuration is in `apps/web/convex/auth.config.ts`; use matching deployments and never copy production credentials into fixtures. **Convex also needs `OPENAI_API_KEY` for scheduled style-memory generation and `GEMINI_API_KEY` for the inference layer’s embedding capability** and `ZEP_KEY` if graph enrichment is enabled. Vercel variables do not configure Convex automatically.

```sh
bun dev
```

Use `bun run backend:watch` while editing Confect source; it regenerates and runs the backend. The anonymous local Convex backend also needs a supported Node runtime for its action executor even when its CLI is invoked with Bun. The migration was verified with Node 22 on that executor. See `apps/mobile/.env.example` for native public configuration.

## Verification and release

```sh
bun run test
bun run typecheck
bun run lint
bun run build
```

CI checks generation drift, tests, types, lint, and builds. Model constants live in `packages/shared/src`; preserve the 768-dimensional embedding index when changing models. [Observability](docs/OBSERVABILITY.md) defines privacy-safe events and the `bun run observability:smoke` ingestion check.

Vercel uses `bun run vercel-build`: Confect generation, then Convex deployment and the web build. `CONVEX_DEPLOY_KEY` must select the intended deployment. This migration cannot safely use unattended deployment until [the storage cutover](docs/STORAGE_CUTOVER.md) is completed. Native preflight/build/replay gates are in [TESTFLIGHT_ANALYTICS.md](docs/TESTFLIGHT_ANALYTICS.md) and [MOBILE_UPDATES.md](docs/MOBILE_UPDATES.md).

Set `STYLE_FIT_API_TOKEN` on the web server to require a bearer token for `/api/context/style-fit`. Configure companion credentials on their appropriate trusted surface; never embed server secrets in public Expo variables.
