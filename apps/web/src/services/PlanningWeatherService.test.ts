import { afterEach, expect, mock, spyOn, test } from "bun:test";
import { Effect } from "effect";
import { weatherCities } from "@wardrobe/shared";
import { cityForecastDays, forecastAdvice, optionalCityWeather, PlanningWeatherLive, resetWeatherCacheForTest, validateWeatherCity } from "./PlanningWeatherService";

const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; resetWeatherCacheForTest(); });
const fixture = (now: number) => ({ properties: { meta: { updated_at: new Date(now).toISOString() }, timeseries: [
  { time: new Date(now + 3600000).toISOString(), data: { instant: { details: { air_temperature: 12 } }, next_1_hours: { details: { probability_of_precipitation: null } } } },
  { time: new Date(now + 7200000).toISOString(), data: { instant: { details: { air_temperature: 15 } }, next_6_hours: { details: { probability_of_precipitation: 65 } } } },
] } });
const week = (id: string) => Effect.runPromise(optionalCityWeather(id, "UTC").pipe(Effect.provide(PlanningWeatherLive)));

test("explicit supported city only; skip and invalid city make no provider calls", async () => {
  const fetcher = mock(() => Promise.reject(new Error("unexpected")));
  globalThis.fetch = fetcher as unknown as typeof fetch;
  expect(await week("")).toEqual([]);
  expect(await week("arbitrary city")).toEqual([]);
  expect(() => validateWeatherCity("123 Main Street")).toThrow();
  expect(() => validateWeatherCity("Charlotte")).toThrow();
  expect(fetcher).not.toHaveBeenCalled();
});
test("MET transport uses fixed host, coarse city, contact, expiry cache and request deduplication", async () => {
  const now = Date.now();
  const fetcher = mock(async () => new Response(JSON.stringify(fixture(now)), { headers: { Expires: new Date(now + 600000).toUTCString(), "Last-Modified": new Date(now).toUTCString() } }));
  globalThis.fetch = fetcher as unknown as typeof fetch;
  const [a,b] = await Promise.all([week("4460243"),week("4460243")]);
  expect(a.length).toBeGreaterThan(0); expect(a).toEqual(b);
  await week("4460243"); expect(fetcher).toHaveBeenCalledTimes(1);
  const [url, options] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
  expect(url).toBe("https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=35.23&lon=-80.84");
  expect((options.headers as Record<string,string>)["User-Agent"]).toContain("davidschmittgit@gmail.com");
  expect(options.redirect).toBe("error");
});
test("city-local days across DST, freshness and missing rain probability are honest", () => {
  const now = Date.parse("2026-11-01T04:30:00Z"), city = weatherCities[0];
  const result = cityForecastDays(fixture(now), city, now);
  expect(result[0].date).toBe("2026-11-01"); expect(result[0].rainChance).toBe(65);
  const noRain = fixture(now); noRain.properties.timeseries[1].data.next_6_hours!.details.probability_of_precipitation = null as unknown as number;
  expect(cityForecastDays(noRain, city, now)[0].rainChance).toBeNull();
  expect(forecastAdvice(cityForecastDays(noRain, city, now)[0])).toContain("Rain probability unavailable");
  expect(cityForecastDays(fixture(now - 7 * 3600000), city, now)).toEqual([]);
});
test("expired forecasts revalidate with the exact Last-Modified header and accept 304", async () => {
  const now = Date.now(), modified = new Date(now).toUTCString();
  const clock = spyOn(Date, "now").mockReturnValue(now);
  const fetcher = mock(async () => new Response(JSON.stringify(fixture(now)), { headers: { Expires: new Date(now + 1000).toUTCString(), "Last-Modified": modified } }));
  globalThis.fetch = fetcher as unknown as typeof fetch;
  try {
    const first = await week("4460243");
    clock.mockReturnValue(now + 2000);
    fetcher.mockImplementation(async () => new Response(null, { status: 304, headers: { Expires: new Date(now + 600000).toUTCString() } }));
    expect(await week("4460243")).toEqual(first);
    const options = (fetcher.mock.calls[1] as unknown as [string, RequestInit])[1];
    expect((options.headers as Record<string,string>)["If-Modified-Since"]).toBe(modified);
    expect(fetcher).toHaveBeenCalledTimes(2);
  } finally { clock.mockRestore(); }
});
test("outage and malformed forecast preserve optional planning fallback", async () => {
  const unavailable = mock(async () => new Response("offline", { status: 429, headers: { "Retry-After": "1800" } }));
  globalThis.fetch = unavailable as unknown as typeof fetch;
  expect(await week("4460243")).toEqual([]);
  expect(await week("4460243")).toEqual([]);
  expect(unavailable).toHaveBeenCalledTimes(1);
  resetWeatherCacheForTest();
  globalThis.fetch = mock(async () => new Response(JSON.stringify({ properties: {} }))) as unknown as typeof fetch;
  expect(await week("4460243")).toEqual([]);
});
