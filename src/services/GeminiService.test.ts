import { describe, it, expect } from "bun:test"
import { Effect, Layer } from "effect"
import { GeminiService } from "./GeminiService"

// Mock implementation
const GeminiTest = Layer.succeed(
    GeminiService,
    GeminiService.of({
        generateContent: () => Effect.succeed({
            response: { text: () => "Mocked Response" }
        } as any),
        embedContent: () => Effect.succeed({
            embedding: { values: [0.1, 0.2, 0.3] }
        } as any),
        batchEmbedContents: () => Effect.succeed({
            embeddings: [{ values: [0.1] }]
        } as any)
    })
)

describe("GeminiService", () => {
    it("generates content using the service", async () => {
        const program = Effect.gen(function* () {
            const service = yield* GeminiService
            const result = yield* service.generateContent('gemini-2.5-flash-lite', "test")
            return result.response.text()
        })

        const result = await Effect.runPromise(
            program.pipe(Effect.provide(GeminiTest))
        )

        expect(result).toBe("Mocked Response")
    })
})
