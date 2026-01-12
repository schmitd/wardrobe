import { describe, it, expect } from "bun:test"
import { Effect, Layer } from "effect"
import { ArcjetService } from "./ArcjetService"

// Mock
const ArcjetTest = Layer.succeed(
    ArcjetService,
    ArcjetService.of({
        protect: () => Effect.succeed({
            isDenied: () => false,
            isAllowed: () => true
        } as any)
    })
)

describe("ArcjetService", () => {
    it("allows requests", async () => {
        const program = Effect.gen(function* () {
            const service = yield* ArcjetService
            const decision = yield* service.protect(new Request("http://localhost"), { userId: "user" }, 'free')
            return decision.isAllowed()
        })

        const result = await Effect.runPromise(
            program.pipe(Effect.provide(ArcjetTest))
        )

        expect(result).toBe(true)
    })
})
