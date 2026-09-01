# PostHog post-wizard report

The wizard has completed a full PostHog analytics integration for this Next.js App Router wardrobe app. PostHog is initialized via `instrumentation-client.ts` (Next.js 15.3+ pattern) with a reverse proxy at `/ingest` to avoid ad blockers. Session replay masks all inputs and any element marked `data-private`. A server-side client in `src/lib/posthog-server.ts` captures only authoritative product outcomes that are not already represented by client events. Users are identified with their Clerk user ID via `PostHogIdentify.tsx`, which is mounted inside `Providers.tsx`.

## Telemetry ownership

- **PostHog:** product analytics, feature-flag exposure, surveys, client exceptions, and privacy-masked session replay.
- **Axiom:** server logs, traces, latency, infrastructure failures, and AI-provider operations.
- Do not copy raw logs, prompts, uploaded content, filenames, or trace payloads into PostHog event properties.

## Events instrumented

| Event name | Description | File |
|---|---|---|
| `guest_demo_analyzed` | Guest user completed the free batch upload and received AI analysis of their closet photos. | `src/components/GuestClosetDemo.tsx` |
| `guest_signup_prompted` | Guest user triggered the sign-up prompt after completing the demo or clicking 'Save my style profile'. | `src/components/GuestClosetDemo.tsx` |
| `wardrobe_item_added` | Signed-in user successfully uploaded and processed a new clothing item to their closet. | `src/components/AddItemSection.tsx` |
| `try_on_saved_to_inspiration` | User saved a try-on candidate item to their inspiration shelf from the quick compare dialog. | `src/components/QuickCompareAction.tsx` |
| `inspiration_saved` | User saved a new inspiration item (photo or URL) to their inspiration shelf. | `src/components/InspirationDialog.tsx` |
| `profile_bio_saved` | User saved their style bio on the profile page. | `src/app/profile/page.tsx` |
| `selfie_analyzed` | User uploaded a selfie and received an AI-generated tone profile and style bio. | `src/app/profile/page.tsx` |
| `compatibility_check_completed` | The browser received a completed closet compatibility result, enabling the event-triggered feedback survey without duplicating the server trace. | `src/hooks/useCompatibilityCheck.ts` |
| `wardrobe_item_deleted` | Server confirmed a wardrobe item was deleted, capturing the reason the user selected. | `src/app/actions/wardrobe.ts` |

## Next steps

A dashboard and five insights have been created in PostHog to track the key user behaviors:

- [Analytics basics (wizard) — dashboard](https://us.posthog.com/project/281423/dashboard/1836234)
- [Guest-to-signup conversion funnel](https://us.posthog.com/project/281423/insights/gyFQnOUM)
- [Wardrobe items added over time](https://us.posthog.com/project/281423/insights/LO7tDDh3)
- [Compatibility check verdict breakdown](https://us.posthog.com/project/281423/insights/BAoI8LsM)
- [Inspirations saved over time](https://us.posthog.com/project/281423/insights/AlwLtEeh)
- [Profile setup actions](https://us.posthog.com/project/281423/insights/3ZpnqEzY)

## Verify before merging

- [x] `bun run lint` completed with no errors (four existing generated-file warnings).
- [x] `bun test` passed all 27 tests.
- [x] `bun run build` completed successfully, including TypeScript and static generation.
- [x] PostHog environment variables were added to Vercel for Production and Preview; names and ownership are documented in `README.md`.
- [x] Returning signed-in visitors are identified from Clerk after `isLoaded`; logout resets only a previously identified session so anonymous continuity is preserved.
- [ ] Deploy the reviewed worktree so Vercel builds with the new code and environment variables. This was intentionally not done from an uncommitted, mixed worktree.

### Agent skill

We've left an agent skill folder in your project at `.claude/skills/integration-nextjs-app-router/`. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.
