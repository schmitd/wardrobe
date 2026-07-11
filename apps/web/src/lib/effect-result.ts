import { Effect, Either } from 'effect';

export const toError = (error: unknown) =>
  error instanceof Error ? error : new Error(String(error));

export const promiseEffect = <A>(operation: () => Promise<A>) =>
  Effect.tryPromise({ try: operation, catch: toError });

/**
 * Represents an expected boundary failure as data so UI state transitions do
 * not depend on ad-hoc try/catch blocks.
 */
export const runEffectResult = <A, E>(effect: Effect.Effect<A, E>) =>
  Effect.runPromise(effect.pipe(Effect.either));

/** Fire-and-forget work that must never change the result of the foreground task. */
export const runBackground = (label: string, operation: () => Promise<unknown>) =>
  Effect.runFork(
    promiseEffect(operation).pipe(
      Effect.catchAll((error) => Effect.sync(() => console.warn(label, error)))
    )
  );

export { Either };
