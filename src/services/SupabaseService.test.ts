import { describe, it, expect } from "bun:test"
import { Effect, Layer } from "effect"
import { SupabaseService } from "./SupabaseService"

const SupabaseTest = Layer.succeed(
    SupabaseService,
    SupabaseService.of({
        getClient: (token) => Effect.succeed({
            from: () => ({
                insert: () => Promise.resolve({ error: null })
            })
        } as any)
    })
)

describe("SupabaseService", () => {
    it("provides a client", async () => {
        const program = Effect.gen(function* () {
            const service = yield* SupabaseService
            const client = yield* service.getClient("fake-token")
            return client
        })

        const result = await Effect.runPromise(
            program.pipe(Effect.provide(SupabaseTest))
        )

        expect(result).toBeDefined()
    })
})
