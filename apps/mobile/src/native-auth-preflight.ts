import { Data, Effect } from "effect";

type Fetch = (input: string | URL, init?: RequestInit) => Promise<Response>;

type ClerkErrorPayload = {
  errors?: Array<{
    code?: string;
    long_message?: string;
    message?: string;
  }>;
};

export class NativeAuthConfigurationError extends Data.TaggedError("NativeAuthConfigurationError")<{
  readonly message: string;
  readonly code?: string;
  readonly status?: number;
}> {}

const decodeFrontendApiUrl = (publishableKey: string) => Effect.try({
  try: () => {
    const encoded = publishableKey.match(/^pk_(?:test|live)_(.+)$/)?.[1];
    if (!encoded) throw new Error("The Clerk publishable key has an invalid format.");

    const normalized = encoded.replace(/-/g, "+").replace(/_/g, "/");
    const padding = "=".repeat((4 - (normalized.length % 4)) % 4);
    const host = atob(`${normalized}${padding}`).replace(/\$$/, "");
    return new URL(`https://${host}`);
  },
  catch: () => new NativeAuthConfigurationError({
    message: "EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY does not contain a valid Clerk Frontend API URL.",
  }),
});

const readPayload = (response: Response) => Effect.tryPromise({
  try: () => response.json() as Promise<ClerkErrorPayload>,
  catch: () => new NativeAuthConfigurationError({
    message: `Clerk returned HTTP ${response.status} without a readable response.`,
    status: response.status,
  }),
});

export const checkNativeAuthConfiguration = (
  publishableKey: string,
  fetchImplementation: Fetch = fetch,
) => Effect.gen(function* () {
  const frontendApiUrl = yield* decodeFrontendApiUrl(publishableKey);
  const endpoint = new URL("/v1/environment", frontendApiUrl);
  endpoint.searchParams.set("_is_native", "1");

  const response = yield* Effect.tryPromise({
    try: () => fetchImplementation(endpoint, {
      headers: {
        "x-expo-sdk-version": "3.7.8",
        "x-mobile": "1",
      },
    }),
    catch: () => new NativeAuthConfigurationError({
      message: "Clerk's native authentication endpoint could not be reached.",
    }),
  });

  if (response.ok) return;

  const payload = yield* readPayload(response);
  const clerkError = payload.errors?.[0];
  return yield* Effect.fail(new NativeAuthConfigurationError({
    code: clerkError?.code,
    message: clerkError?.long_message ?? clerkError?.message ?? `Clerk rejected native authentication with HTTP ${response.status}.`,
    status: response.status,
  }));
});
