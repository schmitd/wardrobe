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
    readonly createSignedUploadUrl: (path: string) => Effect.Effect<{ signedUrl: string; token: string; path: string }, SupabaseError>
    readonly createSignedUrl: (path: string, expiresIn: number) => Effect.Effect<string, SupabaseError>
}

export const SupabaseService = Context.GenericTag<SupabaseService>("SupabaseService")

const make = Effect.gen(function* () {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseKey) {
        return yield* Effect.fail(new SupabaseError("Missing Supabase environment variables"))
    }

    const getServiceRoleClient = () =>
        Effect.try({
            try: () => {
                const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
                if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not defined");
                return createClient(supabaseUrl, key);
            },
            catch: (error) => new SupabaseError(error),
        })

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
        createSignedUploadUrl: (path: string) =>
            Effect.gen(function* () {
                const client = yield* getServiceRoleClient()
                return yield* Effect.tryPromise({
                    try: async () => {
                        const { data, error } = await client.storage
                            .from('uploads')
                            .createSignedUploadUrl(path)
                        if (error) throw error
                        return data
                    },
                    catch: (error) => new SupabaseError(error)
                })
            }),
        createSignedUrl: (path: string, expiresIn: number) =>
            Effect.gen(function* () {
                const client = yield* getServiceRoleClient()
                return yield* Effect.tryPromise({
                    try: async () => {
                        const { data, error } = await client.storage
                            .from('uploads')
                            .createSignedUrl(path, expiresIn)
                        if (error) throw error
                        return data.signedUrl
                    },
                    catch: (error) => new SupabaseError(error)
                })
            })
    }
})

export const SupabaseLive = Layer.effect(SupabaseService, make)
