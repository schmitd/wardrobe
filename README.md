# Virtual Wardrobe Stylist

A Single Page Application (SPA) that acts as a "Virtual Wardrobe Stylist". The app allows users to upload photos of their wardrobe and checks if a new clothing purchase would be a good fit based on style compatibility.

## Features

- **Wardrobe Management**: Upload and view your clothing items.
- **AI Analysis**: Automatically extracts category, description, and style tags using Gemini Vision.
- **Compatibility Check**: Upload a candidate item to see if it fits your wardrobe.
- **Style Match**: Uses vector embeddings and RAG to find similar items and evaluate fit.

## Tech Stack

- **Framework**: Next.js (App Router)
- **Styling**: Tailwind CSS
- **Database + Sync**: Convex
- **Storage**: Convex File Storage
- **AI**: Google Gemini (Vision & Text Embeddings)
- **Background Jobs**: Convex Scheduler + Action Retrier

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
    CLERK_JWT_AUDIENCE=convex
    CLERK_JWT_TEMPLATE=convex
    ZEP_KEY=your_zep_key
    AXIOM_TOKEN=your_axiom_token
    AXIOM_DATASET=your_axiom_dataset
    ```
    Notes:
    - The Clerk JWT template must include the `aud` claim matching `CLERK_JWT_AUDIENCE` (default `convex`).
    - Server actions export OTLP telemetry to Axiom via Effect runtime; enable Convex log streaming separately if you want Convex logs in Axiom.
5.  **Run the app**:
    ```bash
    bun dev
    ```

## Usage

1.  Upload items to your wardrobe on the home page.
2.  Go to "Check Compatibility" to upload a new item you are considering.
3.  The AI will analyze the item and tell you if it fits your style!
