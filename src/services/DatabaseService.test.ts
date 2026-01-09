import { describe, it, expect, mock } from "bun:test"
import { Effect, Layer } from "effect"
import { DatabaseService } from "./DatabaseService"

// Mock implementation of DatabaseService
const DatabaseMock = Layer.succeed(
    DatabaseService,
    DatabaseService.of({
        addWardrobeItems: () => Effect.void,
        getWardrobeItems: () => Effect.succeed([
            { id: "1", category: "test", description: "test item" }
        ]),
        searchWardrobeItems: () => Effect.succeed([
            { id: "2", category: "matched", similarity: 0.9 }
        ]),
        getDissimilarWardrobeItems: () => Effect.succeed([
             { id: "3", category: "dissimilar", similarity: 0.1 }
        ])
    })
)

describe("DatabaseService", () => {
    it("can retrieve wardrobe items", async () => {
        const program = Effect.gen(function* () {
            const service = yield* DatabaseService
            const items = yield* service.getWardrobeItems("test-user")
            return items
        })

        const result = await Effect.runPromise(
            program.pipe(Effect.provide(DatabaseMock))
        )

        expect(result).toHaveLength(1)
        expect(result[0].category).toBe("test")
    })

    it("can search wardrobe items", async () => {
        const program = Effect.gen(function* () {
            const service = yield* DatabaseService
            const items = yield* service.searchWardrobeItems("test-user", [], 0.5, 5)
            return items
        })

        const result = await Effect.runPromise(
            program.pipe(Effect.provide(DatabaseMock))
        )

        expect(result).toHaveLength(1)
        expect(result[0].similarity).toBe(0.9)
    })
})
