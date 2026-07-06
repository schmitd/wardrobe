# Virtual Wardrobe Stylist

Wardrobe is a Turborepo monorepo for a virtual wardrobe stylist. The web app lets users upload wardrobe photos and check whether a new clothing purchase fits their style; companion surfaces reuse the same backend context layer.

## Features

- **Wardrobe Management**: Upload and view your clothing items.
- **AI Analysis**: Automatically extracts category, description, and style tags using Gemini Vision.
- **Compatibility Check**: Upload a candidate item to see if it fits your wardrobe.
- **Style Match**: Uses vector embeddings and RAG to find similar items and evaluate fit.

## Tech Stack

- **Monorepo**: Turborepo + Bun workspaces
- **Web Framework**: Next.js (App Router)
- **Styling**: Tailwind CSS
- **Database + Sync**: Convex
- **Storage**: Convex File Storage
- **AI**: Google Gemini (Vision & Text Embeddings)
- **Background Jobs**: Convex Scheduler + Action Retrier

## Workspaces

- `apps/web`: Existing Next.js + Convex application and backend context API.
- `apps/mobile`: Expo Router iOS/Android app that calls the context API.
- `apps/chrome-extension`: Manifest V3 extension for one-click product-page fit checks.
- `apps/chatgpt-app`: HTTP MCP server and widget resource for a ChatGPT app.
- `packages/context-client`: Shared client for the web backend context layer.
- `packages/shared`: Shared request/response types and model selection constants.

## Model Selection

Use `gemini-2.5-flash` in Google AI Studio for the app's primary fit-checking feature. It supports multimodal text/image input, structured JSON outputs, URL context, function calling, and a large context window, which covers product-page interpretation, wardrobe context, and low-latency recommendations. Use `gemini-2.5-flash-lite` for upload/image-analysis paths where free-tier availability and low latency matter more than deep reasoning. Use `gemini-embedding-2` with 768 output dimensions for wardrobe similarity embeddings so vectors match the Convex index. Keep `gemini-2.5-pro` as an escalation model for deeper styling or profile-generation flows.

## Setup

1.  **Clone the repository**.
2.  **Install dependencies**:
    ```bash
    bun install
    ```
3.  **Convex Setup**:
    ```bash
    bunx convex dev
    ```
    This creates the Convex project config and generates the `convex/_generated` API types.
4.  **Environment Variables**:
    Copy `.env.local` (or create it) and fill in the following:
    ```env
    GEMINI_API_KEY=your_gemini_key
    NEXT_PUBLIC_CONVEX_URL=your_convex_url
    CLERK_SECRET_KEY=your_clerk_secret_key
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
    CLERK_JWT_ISSUER_DOMAIN=your_clerk_jwt_issuer_domain
    CLERK_JWT_TEMPLATE=convex
    ZEP_KEY=your_zep_key
    AXIOM_TOKEN=your_axiom_token
    AXIOM_DATASET=your_axiom_dataset
    ```
    Notes:
    - The production Clerk issuer (`https://clerk.wardrobe.davidcschmitt.com`) is trusted by Convex by default. Set `CLERK_JWT_ISSUER_DOMAIN` for local/dev Clerk.
    - The Clerk JWT template must include the `aud` claim set to `convex`.
    - Server actions export OTLP telemetry to Axiom via Effect runtime; enable Convex log streaming separately if you want Convex logs in Axiom.
5.  **Run the app**:
    ```bash
    bun dev
    ```

## Builds

```bash
bun run build
bun run lint
bun run typecheck
```

Vercel builds through `bun run vercel-build`, which runs the web workspace's Convex CLI with `convex deploy --cmd "cd ../.. && bun run web-build"`. Set `CONVEX_DEPLOY_KEY` in Vercel so each production or preview web deployment deploys the matching Convex functions and schema before the frontend build completes.

Set `STYLE_FIT_API_TOKEN` on the web app to require `Authorization: Bearer <token>` for `/api/context/style-fit`. Companion apps can pass the token through their own runtime config (`WARDROBE_API_TOKEN` for the ChatGPT app, Chrome extension storage, or `EXPO_PUBLIC_WARDROBE_API_TOKEN` for Expo development builds).

## Usage

1.  Upload items to your wardrobe on the home page.
2.  Go to "Check Compatibility" to upload a new item you are considering.
3.  The AI will analyze the item and tell you if it fits your style!
