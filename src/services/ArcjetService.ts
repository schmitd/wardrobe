import { Effect, Context, Layer } from "effect"
import arcjet, { ArcjetDecision, detectBot, fixedWindow, slidingWindow, ArcjetNextRequest } from "@arcjet/next"

export class ArcjetError extends Error {
    readonly _tag = "ArcjetError"
    constructor(public error: unknown) {
        super(typeof error === 'object' && error !== null && 'message' in error ? (error as any).message : String(error))
    }
}

export type ArcjetTier = 'free' | 'pro';

export interface ArcjetService {
    readonly protect: (
        req: ArcjetNextRequest,
        props: { userId: string },
        tier: ArcjetTier
    ) => Effect.Effect<ArcjetDecision, ArcjetError>
}

// Rules
const BotRule = detectBot({
    mode: "LIVE",
    allow: [
        "CATEGORY:SEARCH_ENGINE",
        "CATEGORY:MONITOR",
        "CATEGORY:PREVIEW",
    ],
});

// Base Rules (Free Tier defaults)
const FreeFixedWindow = fixedWindow({ mode: "LIVE", window: "1d", max: 5 });
const FreeSlidingWindow = slidingWindow({ mode: "LIVE", interval: "10s", max: 1 });

// Client
const key = process.env.ARCJET_KEY;

const client = key ? arcjet({
    key,
    characteristics: ["userId"],
    rules: [
        BotRule,
    ]
}) : null;

export const ArcjetService = Context.GenericTag<ArcjetService>("ArcjetService")

const make = Effect.gen(function* () {
    if (!process.env.ARCJET_KEY) {
        return yield* Effect.fail(new ArcjetError("Missing ARCJET_KEY"))
    }

    if (!client) {
        return yield* Effect.fail(new ArcjetError("Failed to initialize Arcjet client"))
    }

    return {
        protect: (req: ArcjetNextRequest, props: { userId: string }, tier: ArcjetTier) =>
            Effect.tryPromise({
                try: async () => {
                    const overrides = tier === 'pro' ? [
                        fixedWindow({ mode: "LIVE", window: "1d", max: 50 }),
                        slidingWindow({ mode: "LIVE", interval: "10s", max: 5 })
                    ] : [
                        fixedWindow({ mode: "LIVE", window: "1d", max: 5 }),
                        slidingWindow({ mode: "LIVE", interval: "10s", max: 1 })
                    ];

                    return client.protect(req, { ...props, overrides } as any)
                },
                catch: (e) => new ArcjetError(e)
            }).pipe(
                Effect.withSpan("arcjet.protect", { attributes: { "user.id": props.userId, "arcjet.tier": tier } })
            )
    }
})

export const ArcjetLive = Layer.effect(ArcjetService, make)
