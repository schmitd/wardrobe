import { Effect, Context, Layer } from "effect"
import arcjet, { ArcjetDecision, detectBot, ArcjetNextRequest, Primitive, Product } from "@arcjet/next"

export class ArcjetError extends Error {
    readonly _tag = "ArcjetError"
    constructor(public error: unknown) {
        super(typeof error === 'object' && error !== null && 'message' in error ? (error as any).message : String(error))
    }
}

export interface ArcjetService {
    readonly protect: (
        req: ArcjetNextRequest,
        props: { userId: string },
        rules?: Primitive | Product | (Primitive | Product)[]
    ) => Effect.Effect<ArcjetDecision, ArcjetError>
}

// Pre-defined rules to be reused
export const BotDetectionRule = detectBot({
    mode: "LIVE",
    allow: [
        "CATEGORY:SEARCH_ENGINE",
        "CATEGORY:MONITOR",
        "CATEGORY:PREVIEW",
    ],
})

export const ArcjetService = Context.GenericTag<ArcjetService>("ArcjetService")

const make = Effect.gen(function* () {
    const key = process.env.ARCJET_KEY
    if (!key) {
        return yield* Effect.fail(new ArcjetError("Missing ARCJET_KEY"))
    }

    const aj = arcjet({
        key,
        characteristics: ["userId"],
        rules: []
    })

    return {
        protect: (req: ArcjetNextRequest, props: { userId: string }, rules?: Primitive | Product | (Primitive | Product)[]) =>
            Effect.tryPromise({
                try: async () => {
                    let client = aj
                    if (rules) {
                        const rulesArray = Array.isArray(rules) ? rules : [rules]
                        client = rulesArray.reduce((acc, rule) => acc.withRule(rule as any), aj)
                    }
                    return client.protect(req, props)
                },
                catch: (e) => new ArcjetError(e)
            }).pipe(
                Effect.withSpan("arcjet.protect", { attributes: { "user.id": props.userId } })
            )
    }
})

export const ArcjetLive = Layer.effect(ArcjetService, make)
