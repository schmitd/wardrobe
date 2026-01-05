# Virtual Wardrobe Stylist

A Single Page Application (SPA) that acts as a "Virtual Wardrobe Stylist". The app allows users to upload photos of their wardrobe and checks if a new clothing purchase would be a good fit based on style compatibility.

## Features

- **Wardrobe Management**: Upload and view your clothing items.
- **AI Analysis**: Automatically extracts category, description, and style tags using Gemini Vision.
- **Compatibility Check**: Upload a candidate item to see if it fits your wardrobe.
- **Style Match**: Uses vector embeddings and RAG to find similar items and evaluate fit.

## Tech Stack

- **Framework**: Next.js 14+ (App Router)
- **Styling**: Tailwind CSS
- **Database**: Supabase (PostgreSQL + pgvector)
- **Storage**: UploadThing
- **AI**: Google Gemini (Vision & Text Embeddings)

## Setup

1.  **Clone the repository**.
2.  **Install dependencies**:
    ```bash
    bun install
    ```
3.  **Environment Variables**:
    Copy `.env.local` (or create it) and fill in the following:
    ```env
    GEMINI_API_KEY=your_gemini_key
    UPLOADTHING_TOKEN=your_uploadthing_token
    NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
    NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_key
    ```
4.  **Supabase Setup**:
    -   Create a new Supabase project.
    -   Go to the SQL Editor and run the script in `sql/schema.sql`.
    -   This will enable `pgvector` and create the `wardrobe_items` table and matching function.
5.  **Run the app**:
    ```bash
    bun dev
    ```

## Usage

1.  Upload items to your wardrobe on the home page.
2.  Go to "Check Compatibility" to upload a new item you are considering.
3.  The AI will analyze the item and tell you if it fits your style!
