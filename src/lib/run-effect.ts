import { Effect, ManagedRuntime } from "effect"
import { RuntimeLive } from "./effect-runtime"

// Create a managed runtime that includes the Telemetry layer
export const runtime = ManagedRuntime.make(RuntimeLive)

export const runServerAction = <A, E>(effect: Effect.Effect<A, E>) =>
    runtime.runPromise(effect)
