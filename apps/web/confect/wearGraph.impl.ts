import { FunctionImpl, GroupImpl } from "@confect/server";
import { Effect, Layer } from "effect";
import { internal } from "../convex/_generated/api";
import { ActionCtx } from "./_generated/services";
import schema from "./_generated/schema";
import spec from "./wearGraph.spec";
import { publishWearProjection } from "./legacy/wearGraphProvider";

const project = FunctionImpl.make(
  schema,
  spec,
  "project",
  ({ id }): Effect.Effect<null, never, ActionCtx> =>
    Effect.gen(function* () {
      const ctx = yield* ActionCtx;
      const snapshot = yield* Effect.promise(() =>
        ctx.runMutation(internal.wearProjectionData.claim, { id }),
      );
      if (!snapshot) return null;
      const references = yield* Effect.promise(() =>
        ctx.runQuery(internal.wearProjectionData.references, { id }),
      );
      const result = yield* Effect.tryPromise({
        try: () =>
          publishWearProjection(snapshot, references, async (progress) => {
            const current = await ctx.runMutation(
              internal.wearProjectionData.progress,
              { id, ...progress },
            );
            if (!current) throw new Error("Projection superseded");
          }),
        catch: () => new Error("Wear projection failed"),
      }).pipe(
        Effect.catch(() =>
          Effect.succeed({
            edgeIds: [] as string[],
            nodeIds: [] as { sourceRef: string; uuid: string; kind: string }[],
            taskIds: [] as string[],
            failureKind: "provider_unknown",
          }),
        ),
      );
      yield* Effect.promise(() =>
        ctx.runMutation(internal.wearProjectionData.finish, { id, ...result }),
      );
      return null;
    }),
);
export default GroupImpl.make(schema, spec).pipe(
  Layer.provide(project),
  GroupImpl.finalize,
);
