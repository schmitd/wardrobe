/// <reference types="bun" />

import { describe, expect, test } from "bun:test";
import { Cause, Effect, Exit, Option } from "effect";

import { checkNativeAuthConfiguration, NativeAuthConfigurationError } from "./native-auth-preflight";

const publishableKey = `pk_live_${btoa("clerk.example.com$")}`;

describe("native auth preflight", () => {
  test("accepts an enabled Clerk native endpoint", async () => {
    const requests: URL[] = [];
    const fetchImplementation = async (input: string | URL) => {
      requests.push(new URL(input));
      return Response.json({ auth_config: { object: "auth_config" }, display_config: { object: "display_config" }, user_settings: {} });
    };

    await Effect.runPromise(checkNativeAuthConfiguration(publishableKey, fetchImplementation));

    expect(requests[0]?.toString()).toBe("https://clerk.example.com/v1/environment?_is_native=1");
  });

  test("preserves Clerk's native_api_disabled diagnosis", async () => {
    const fetchImplementation = async () => Response.json({
      errors: [{
        code: "native_api_disabled",
        long_message: "The Native API is disabled for this instance.",
      }],
    }, { status: 400 });

    const exit = await Effect.runPromiseExit(checkNativeAuthConfiguration(publishableKey, fetchImplementation));

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      const error = Option.getOrThrow(Cause.findErrorOption(exit.cause));
      expect(error).toBeInstanceOf(NativeAuthConfigurationError);
      expect((error as NativeAuthConfigurationError).code).toBe("native_api_disabled");
    }
  });

  test("rejects a successful response that is not a Clerk environment", async () => {
    const exit = await Effect.runPromiseExit(checkNativeAuthConfiguration(publishableKey, async () => Response.json({ client: {} })));
    expect(Exit.isFailure(exit)).toBe(true);
  });

  test("rejects malformed publishable keys before making a request", async () => {
    let requested = false;
    const exit = await Effect.runPromiseExit(checkNativeAuthConfiguration("invalid", async () => {
      requested = true;
      return Response.json({});
    }));

    expect(Exit.isFailure(exit)).toBe(true);
    expect(requested).toBe(false);
  });
});
