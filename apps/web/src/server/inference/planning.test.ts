import { expect, test } from "bun:test";
import { Effect } from "effect";
import { recommendWeek } from "./planning";
import { InferenceService } from "../../services/InferenceService";
const days = [{ date: "2026-09-28", description: "", calendar: null }, { date: "2026-09-29", description: "Client meeting", calendar: null }];
const data = { items: [{ id: "own", category: "Shirt", description: "Cotton", note: "" }], plans: [], bio: "", history: [], suggestions: [], inventoryTruncated: false };
const outfit = (date: string) => ({ date, title: "Everyday", rationale: "A cotton layer", itemIds: ["own"], missing: ["Bottom"] });
const run = (outfits: unknown) => Effect.runPromise(recommendWeek({ data, days, timezone: "UTC" }).pipe(Effect.provideService(InferenceService, {
  generateContent: () => Effect.succeed({ response: { text: () => JSON.stringify({ outfits }) } }),
  embedContent: () => Effect.die("Unexpected embedding"), batchEmbedContents: () => Effect.die("Unexpected embedding"), transcribe: () => Effect.die("Unexpected transcription"),
})));
test("week inference retains every requested date including quiet days and rejects incomplete or unowned results", async () => {
  const complete = days.map(day => outfit(day.date));
  expect((await run(complete)).map(row => row.date)).toEqual(days.map(day => day.date));
  await expect(run(complete.slice(1))).rejects.toThrow();
  await expect(run([...complete].reverse())).rejects.toThrow();
  await expect(run([complete[0], { ...complete[1], itemIds: ["someone-elses-item"] }])).rejects.toThrow();
});
