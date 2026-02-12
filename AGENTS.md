# Wardrobe Application

## Development
- Always use Bun to run node commands
- Always use Effect and its core patterns to structure the codebase
- Prefer `Effect.gen` for workflows and keep side effects inside Effects
- Use `Layer` for dependency injection and testable service composition
- Use `Context`/service tags for dependency access instead of direct instantiation in business logic
- Use typed error channels and `Effect.tryPromise` / `Effect.try` wrappers for fallible IO
- Install dependencies with `bun install`
- Start the app with `bun dev`
- Run lint checks with `bun run lint`
- Run tests with `bun test` (`bun:test` is used across `*.test.ts` / `*.test.tsx`)
- Sync existing wardrobe items to Zep with `bun run src/scripts/sync-to-zep.ts`
