import arcjet, { detectBot, fixedWindow, request, slidingWindow } from "@arcjet/next";
import { Context, Effect, Layer } from "effect";

export type UserTier = "free" | "pro";
export type AuthenticatedScope = "upload" | "routing" | "check" | "inference" | "onboarding";

const UPLOAD_DAILY_LIMIT: Record<UserTier, number> = { free: 5, pro: 20 };
// Upload creation is already rate limited. Routing needs extra headroom for retries and
// review corrections so a valid uploaded photo cannot become permanently unsavable.
const ROUTING_DAILY_LIMIT: Record<UserTier, number> = { free: 60, pro: 240 };
const CHECK_DAILY_LIMIT: Record<UserTier, number> = { free: 3, pro: 20 };
// A normal day can include pieces, fits, and inspiration enrichment. Sharing one
// five-request bucket across those workflows made valid saves block one another.
const INFERENCE_DAILY_LIMIT: Record<UserTier, number> = { free: 20, pro: 80 };
const ONBOARDING_DAILY_LIMIT: Record<UserTier, number> = { free: 2, pro: 10 };
const RATE_LIMIT_WINDOW = "1d";
const RATE_LIMIT_BURST_INTERVAL = "10s";
const RATE_LIMIT_BURST_MAX: Partial<Record<AuthenticatedScope, number>> = {
  routing: 4,
  check: 1,
  inference: 1,
};

// Preview deployments are exercised repeatedly by CI and manual QA from the same
// browser/IP. Keep production's public allowance intentionally small without
// making a successful preview impossible to retest during a release cycle.
const GUEST_BATCH_UPLOAD_LIMIT = process.env.VERCEL_ENV === "preview" ? 8 : 2;
const GUEST_BATCH_LIMIT_WINDOW = "7d";

const SECURITY_UNAVAILABLE_MESSAGE = "Security checks are unavailable right now. Please try again.";
const BOT_BLOCK_MESSAGE = "Request blocked because automated traffic was detected.";
const UPLOAD_RATE_LIMIT_MESSAGE =
  "Upload limit reached for your plan. Please try again later or upgrade to continue.";
const ROUTING_RATE_LIMIT_MESSAGE =
  "Photo routing limit reached for your plan. Please try again later or upgrade to continue.";
const CHECK_RATE_LIMIT_MESSAGE =
  "Compatibility check limit reached for your plan. Please try again later or upgrade to continue.";
const INFERENCE_RATE_LIMIT_MESSAGE =
  "Analysis limit reached for your plan. Please try again later or upgrade to continue.";
const ONBOARDING_RATE_LIMIT_MESSAGE =
  "Onboarding limit reached for today. Please try again tomorrow.";
const GUEST_AUTH_PROMPT_MESSAGE =
  "You have reached the guest upload limit (2 batches per week). Please sign in or create an account to continue.";
const GUEST_BOT_BLOCK_MESSAGE =
  "Upload blocked because automated traffic was detected. Please sign in or create an account to continue.";

export interface ArcjetService {
  readonly protectAuthenticated: (input: {
    scope: AuthenticatedScope;
    tier: UserTier;
    userId: string;
  }) => Effect.Effect<void, Error>;

  readonly protectGuestBatch: () => Effect.Effect<void, Error>;
}

export const ArcjetService = Context.GenericTag<ArcjetService>("ArcjetService");

const deniedErrorForScope = (scope: AuthenticatedScope) => {
  switch (scope) {
    case "upload":
      return new Error(UPLOAD_RATE_LIMIT_MESSAGE);
    case "check":
      return new Error(CHECK_RATE_LIMIT_MESSAGE);
    case "routing":
      return new Error(ROUTING_RATE_LIMIT_MESSAGE);
    case "onboarding":
      return new Error(ONBOARDING_RATE_LIMIT_MESSAGE);
    case "inference":
    default:
      return new Error(INFERENCE_RATE_LIMIT_MESSAGE);
  }
};

const createAuthenticatedProtection = (scope: AuthenticatedScope, dailyLimit: number, key: string) =>
  arcjet({
    key,
    characteristics: ["userId"],
    rules: [
      detectBot({
        mode: "LIVE",
        allow: [],
      }),
      fixedWindow({
        mode: "LIVE",
        max: dailyLimit,
        window: RATE_LIMIT_WINDOW,
        characteristics: ["userId"],
      }),
      ...(RATE_LIMIT_BURST_MAX[scope]
        ? [
            slidingWindow({
              mode: "LIVE",
              max: RATE_LIMIT_BURST_MAX[scope],
              interval: RATE_LIMIT_BURST_INTERVAL,
              characteristics: ["userId"],
            }),
          ]
        : []),
    ],
  });

const make = Effect.gen(function* () {
  const arcjetKey = process.env.ARCJET_KEY;
  if (!arcjetKey) {
    return yield* Effect.fail(new Error(SECURITY_UNAVAILABLE_MESSAGE));
  }

  const authenticatedProtection = {
    upload: {
      free: createAuthenticatedProtection("upload", UPLOAD_DAILY_LIMIT.free, arcjetKey),
      pro: createAuthenticatedProtection("upload", UPLOAD_DAILY_LIMIT.pro, arcjetKey),
    },
    routing: {
      free: createAuthenticatedProtection("routing", ROUTING_DAILY_LIMIT.free, arcjetKey),
      pro: createAuthenticatedProtection("routing", ROUTING_DAILY_LIMIT.pro, arcjetKey),
    },
    check: {
      free: createAuthenticatedProtection("check", CHECK_DAILY_LIMIT.free, arcjetKey),
      pro: createAuthenticatedProtection("check", CHECK_DAILY_LIMIT.pro, arcjetKey),
    },
    inference: {
      free: createAuthenticatedProtection("inference", INFERENCE_DAILY_LIMIT.free, arcjetKey),
      pro: createAuthenticatedProtection("inference", INFERENCE_DAILY_LIMIT.pro, arcjetKey),
    },
    onboarding: {
      free: createAuthenticatedProtection("onboarding", ONBOARDING_DAILY_LIMIT.free, arcjetKey),
      pro: createAuthenticatedProtection("onboarding", ONBOARDING_DAILY_LIMIT.pro, arcjetKey),
    },
  } as const;

  const guestBatchProtection = arcjet({
    key: arcjetKey,
    rules: [
      fixedWindow({
        mode: "LIVE",
        max: GUEST_BATCH_UPLOAD_LIMIT,
        window: GUEST_BATCH_LIMIT_WINDOW,
        characteristics: [
          "ip.src",
          'http.request.headers["user-agent"]',
        ],
      }),
    ],
  });

  return {
    protectAuthenticated: ({ scope, tier, userId }) =>
      Effect.tryPromise({
        try: async () => {
          const req = await request();
          const decision = await authenticatedProtection[scope][tier].protect(req, { userId });

          if (!decision.isDenied()) return;
          if (decision.reason.isBot()) throw new Error(BOT_BLOCK_MESSAGE);
          if (decision.reason.isRateLimit()) throw deniedErrorForScope(scope);
          throw new Error("Request denied. Please try again.");
        },
        catch: (error) => (error instanceof Error ? error : new Error(String(error))),
      }),

    protectGuestBatch: () =>
      Effect.tryPromise({
        try: async () => {
          const req = await request();
          const decision = await guestBatchProtection.protect(req);

          if (!decision.isDenied()) return;
          if (decision.reason.isBot()) throw new Error(GUEST_BOT_BLOCK_MESSAGE);
          if (decision.reason.isRateLimit()) throw new Error(GUEST_AUTH_PROMPT_MESSAGE);
          throw new Error("Guest upload request blocked. Please sign in or create an account.");
        },
        catch: (error) => (error instanceof Error ? error : new Error(String(error))),
      }),
  } satisfies ArcjetService;
});

export const ArcjetLive = Layer.effect(ArcjetService, make);
