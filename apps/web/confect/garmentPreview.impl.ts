import { FunctionImpl, GroupImpl } from "@confect/server";
import { Effect, Exit, Layer } from "effect";
import { internal } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { ActionCtx } from "./_generated/services";
import schema from "./_generated/schema";
import spec from "./garmentPreview.spec";
import { GarmentPreviewLive, GarmentPreviewService, PREVIEW_MODEL } from "../src/services/GarmentPreviewService";
import { runServerAction } from "../src/lib/run-effect";

const generate = FunctionImpl.make(schema, spec, "generate", (args): Effect.Effect<null, never, ActionCtx> => Effect.gen(function* () {
  const ctx = yield* ActionCtx;
  const source = yield* Effect.promise(() => ctx.runMutation(internal.garmentPreviewData.claim, args));
  if (!source) return null;
  const started = Date.now();
  let stored: Id<"_storage"> | undefined;
  let committed = false;
  let skipped = false;
  const work = Effect.gen(function* () {
    const input = yield* Effect.promise(() => ctx.storage.get(source.storageId));
    if (!input) return;
    const service = yield* GarmentPreviewService;
    const output = yield* service.generate(input).pipe(Effect.tapError(error => Effect.sync(() => { skipped = error._tag === "PreviewFailure" && error.reason === "input"; })));
    stored = yield* Effect.promise(() => ctx.storage.store(output));
    committed = yield* Effect.promise(() => ctx.runMutation(internal.garmentPreviewData.commit, { ...args, userId: source.userId, sourceStorageId: source.storageId, storageId: stored! }));
  }).pipe(Effect.provide(GarmentPreviewLive));
  const result = yield* Effect.promise(() => runServerAction(Effect.exit(work)));
  if (stored && !committed) yield* Effect.promise(() => ctx.runMutation(internal.garmentPreviewData.discard, { storageId: stored! }));
  yield* Effect.promise(() => ctx.runMutation(internal.garmentPreviewData.finish, { ...args, skipped }));
  yield* Effect.promise(() => runServerAction(Effect.logInfo("garment_preview.finished", { model: PREVIEW_MODEL, itemId: args.itemId, traceId: source.traceId, duration_ms: Date.now() - started, outcome: committed ? "ready" : skipped ? "skipped" : Exit.isFailure(result) ? "error" : "stale" })));
  return null;
}));
export default GroupImpl.make(schema, spec).pipe(Layer.provide(generate), GroupImpl.finalize);
