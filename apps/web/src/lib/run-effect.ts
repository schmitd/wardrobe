import { Effect, Layer, ManagedRuntime } from "effect";
import { RuntimeLive } from "./effect-runtime";
import { InferenceLive, type InferenceService } from "../services/InferenceService";

const runtime = ManagedRuntime.make(RuntimeLive);
// Services are built lazily once per warm process. Share the telemetry layer;
// request identities are always provided separately and never cached here.
const inferenceRuntime = ManagedRuntime.make(Layer.merge(RuntimeLive, InferenceLive), { memoMap: runtime.memoMap });
export const runServerAction = <A, E>(effect: Effect.Effect<A, E>, options?: Effect.RunOptions) => runtime.runPromise(effect, options);
export const runInference = <A, E>(effect: Effect.Effect<A, E, InferenceService>, options?: Effect.RunOptions) => inferenceRuntime.runPromise(effect, options);
