import { expect, test } from "bun:test";
import { Effect } from "effect";
import { everydayOutfits } from "./planningFallback";
import { recommendWeekBestEffort } from "./inference/planning";
import { InferenceError, InferenceService } from "../services/InferenceService";
import { WeatherFailure, PlanningWeather, optionalCityWeather, validateWeatherCity, forecastAdvice } from "../services/PlanningWeatherService";

const data = { items: [
  { id: "top", category: "top", description: "Cotton tee", note: "" },
  { id: "bottom", category: "Chinos", description: "Dark trousers", note: "" },
  { id: "shoe", category: "Footwear", description: "Lace-up shoes", note: "" },
  { id: "unknown", category: "Smartwatch", description: "Watch", note: "" },
], plans: [], bio: "", history: [], suggestions: [], inventoryTruncated: false };
const days = [{ date: "2026-10-07", description: "", calendar: null, calendarUnavailable: true }];
const failing = { generateContent: () => Effect.fail(new InferenceError(new TypeError("offline"))), embedContent: () => Effect.die("unexpected"), batchEmbedContents: () => Effect.die("unexpected"), transcribe: () => Effect.die("unexpected") };

test("calendar and model outage still give concrete owned pieces and honest incomplete inventory", async () => {
  const [outfit] = await Effect.runPromise(recommendWeekBestEffort({ data, days, timezone: "UTC" }).pipe(Effect.provideService(InferenceService, failing)));
  expect(outfit.itemIds).toEqual(["top", "bottom", "shoe"]);
  expect(outfit.rationale).toContain("Cotton tee");
  expect(outfit.context).toContain("Calendar unavailable; everyday defaults used");
  expect(everydayOutfits({ ...data, items: [data.items[0]] }, days)[0].missing).toEqual(["Bottom", "Weather-suitable shoes"]);
  expect(everydayOutfits({ ...data, items: [] }, days)[0].itemIds).toEqual([]);
});

test("untrusted generated IDs fall back rather than persist foreign inventory", async () => {
  const [outfit] = await Effect.runPromise(recommendWeekBestEffort({ data, days, timezone: "UTC" }).pipe(Effect.provideService(InferenceService, { ...failing, generateContent: () => Effect.succeed({ response: { text: () => JSON.stringify({ outfits: [{ date: days[0].date, title: "bad", rationale: "bad", itemIds: ["foreign"], missing: [] }] }) } }) })));
  expect(outfit.itemIds).not.toContain("foreign");
});

test("optional weather absence/outage is useful and city input excludes addresses", async () => {
  expect(validateWeatherCity("4460243")).toBe("4460243");
  expect(() => validateWeatherCity("123 Main Street")).toThrow();
  let reads = 0;
  const service = { week: () => { reads++; return Effect.fail(new WeatherFailure({ message: "Forecast unavailable" })); } };
  expect(await Effect.runPromise(optionalCityWeather("", "UTC").pipe(Effect.provideService(PlanningWeather, service)))).toEqual([]);
  expect(reads).toBe(0);
  expect(await Effect.runPromise(optionalCityWeather("Charlotte", "UTC").pipe(Effect.provideService(PlanningWeather, service)))).toEqual([]);
  expect(forecastAdvice()).toContain("removable layers");
  expect(forecastAdvice({ date: days[0].date, lowC: 5, highC: 12, rainChance: 80 })).toContain("rain-suitable shoes");
});

test("work-to-skating starting outfit names a collared top, trousers and practical transition", () => {
  const withPolo = { ...data, items: [...data.items, { id: "polo", category: "top", description: "Blue collared polo", note: "" }] };
  const [outfit] = everydayOutfits(withPolo, [{ ...days[0], description: "For this week, I need to dress each weekday for work while being able to skate after work." }]);
  expect(outfit.itemIds).toEqual(["polo", "bottom", "shoe"]);
  expect(outfit.rationale).toContain("After work");
  expect(outfit.rationale).toContain("comfortable movement");
});

test("interruption stays interrupted rather than generating or saving a fallback", async () => {
  const controller = new AbortController();
  const pending = Effect.runPromise(recommendWeekBestEffort({ data, days, timezone: "UTC" }).pipe(Effect.provideService(InferenceService, { ...failing, generateContent: () => Effect.never })), { signal: controller.signal });
  controller.abort();
  await expect(pending).rejects.toThrow();
});
test("work-to-skate recommendations do not bleed into other days", () => {
  const outfits = everydayOutfits(data, [{ ...days[0], description: "work then skate" }, { ...days[0], date: "2026-10-08", description: "relax at home" }]);
  expect(outfits[0].rationale).toContain("After work");
  expect(outfits[1].rationale).not.toContain("After work");
});
