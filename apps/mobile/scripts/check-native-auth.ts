import { Console, Effect } from "effect";

import { checkNativeAuthConfiguration } from "../src/native-auth-preflight";

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "";

const program = checkNativeAuthConfiguration(publishableKey).pipe(
  Effect.tap(() => Console.log("Clerk Native API preflight passed.")),
  Effect.catchAll((error) => Console.error(`Clerk Native API preflight failed: ${error.message}`).pipe(
    Effect.zipRight(Effect.sync(() => {
      process.exitCode = 1;
    })),
  )),
);

void Effect.runPromise(program);
