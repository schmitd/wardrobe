import { Effect, Context, Layer } from "effect"
import { createClient, SupabaseClient } from "@supabase/supabase-js"

export class SupabaseError extends Error {
    readonly _tag = "SupabaseError"
    constructor(public error: unknown) {
        super(typeof error === 'object' && error !== null && 'message' in error ? (error as any).message : String(error))
    }
}

export interface SupabaseService {
    readonly getClient: (token: string) => Effect.Effect<SupabaseClient, SupabaseError>
}

export const SupabaseService = Context.GenericTag<SupabaseService>("SupabaseService")

const make = Effect.gen(function* () {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseKey) {
        return yield* Effect.fail(new SupabaseError("Missing Supabase environment variables"))
    }

    return {
        getClient: (token: string) =>
            Effect.try({
                try: () => createClient(supabaseUrl, supabaseKey, {
                    global: {
                        headers: { Authorization: `Bearer ${token}` },
                    },
                }),
                catch: (error) => new SupabaseError(error),
            }),
    }
})

export const SupabaseLive = Layer.effect(SupabaseService, make)
