# Generated Convex adapters

Confect owns the table schemas and function specs in `../confect`. Most TypeScript files here are generated adapters that preserve the public Convex function paths. Edit the matching `confect/*.spec.ts`, `*.impl.ts`, `tables/*`, or native interop implementation in `confect/legacy` instead.

Run from the repository root:

```sh
bun run --bun confect codegen
bun run --bun convex dev
```

`auth.config.ts`, `convex.config.ts`, and `http.ts` are explicit runtime configuration. Do not put helpers or tests in this directory; generation can remove unrecognized files. `confect/_generated` and `convex/_generated` are generated too.

See [architecture](../../../docs/ARCHITECTURE.md) and [storage cutover](../../../docs/STORAGE_CUTOVER.md) before changing or deploying the backend. Never deploy this migration to an existing production dataset without the legacy-photo review.
