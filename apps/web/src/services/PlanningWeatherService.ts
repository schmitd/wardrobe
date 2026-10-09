import { Context, Data, Effect, Layer, Schema } from "effect";
import { weatherCities, type WeatherCity } from "@wardrobe/shared";

export type CityForecast = { date: string; lowC: number; highC: number; rainChance: number | null; retrievedAt?: string };
export const WEATHER_FALLBACK = "Forecast unavailable. Use removable layers; check rain before leaving and choose weather-suitable shoes.";
export class WeatherFailure extends Data.TaggedError("WeatherFailure")<{ readonly message: string }> {}
const unavailable = () => new WeatherFailure({ message: "Forecast unavailable" });
const interval = Schema.Struct({ details: Schema.Struct({ probability_of_precipitation: Schema.optional(Schema.NullOr(Schema.Number)) }) });
const forecastSchema = Schema.Struct({ properties: Schema.Struct({ meta: Schema.Struct({ updated_at: Schema.String }), timeseries: Schema.Array(Schema.Struct({
  time: Schema.String,
  data: Schema.Struct({ instant: Schema.Struct({ details: Schema.Struct({ air_temperature: Schema.Number }) }), next_1_hours: Schema.optional(interval), next_6_hours: Schema.optional(interval) }),
})) }) });
type ForecastResponse = typeof forecastSchema.Type;
export function validateWeatherCity(value: unknown): string {
  if (value === undefined || value === "") return "";
  if (typeof value !== "string" || !weatherCities.some(city => city.id === value)) throw new Error("Choose a supported city or skip weather.");
  return value;
}
export function forecastAdvice(day?: CityForecast): string {
  if (!day) return WEATHER_FALLBACK;
  const rain = day.rainChance === null ? "Rain probability unavailable; check rain before leaving." : `${Math.round(day.rainChance)}% maximum period rain chance. ${day.rainChance >= 40 ? "Choose rain-suitable shoes and bring rain protection." : "Check conditions before leaving."}`;
  return `City forecast: about ${Math.round(day.lowC)}–${Math.round(day.highC)}°C across forecast periods. ${day.highC < 15 ? "Use a warm removable layer." : day.highC > 27 ? "Prefer light breathable pieces." : "Use a removable layer for cooler hours."} ${rain}${day.retrievedAt ? ` Retrieved ${day.retrievedAt}.` : ""}`;
}
/** Period samples are not daily extrema. Precipitation amount is never treated as probability. */
export function cityForecastDays(response: ForecastResponse, city: WeatherCity, now = Date.now()): CityForecast[] {
  const updated = Date.parse(response.properties.meta.updated_at);
  if (!Number.isFinite(updated) || updated > now + 60000 || now - updated > 6 * 3600000) return [];
  const format = new Intl.DateTimeFormat("en-CA", { timeZone: city.timezone, year: "numeric", month: "2-digit", day: "2-digit" });
  const dayOf = (time: number) => format.format(new Date(time));
  const today = dayOf(now), days = new Map<string, CityForecast>();
  for (const entry of response.properties.timeseries.slice(0, 300)) {
    const time = Date.parse(entry.time), temperature = entry.data.instant.details.air_temperature;
    if (!Number.isFinite(time) || time < now - 3600000 || time > now + 9 * 86400000 || !Number.isFinite(temperature) || temperature < -90 || temperature > 65) continue;
    const date = dayOf(time);
    if (date < today) continue;
    const probability = entry.data.next_1_hours?.details.probability_of_precipitation ?? entry.data.next_6_hours?.details.probability_of_precipitation;
    const rainChance = typeof probability === "number" && Number.isFinite(probability) && probability >= 0 && probability <= 100 ? probability : null;
    const day = days.get(date);
    if (day) {
      day.lowC = Math.min(day.lowC, temperature); day.highC = Math.max(day.highC, temperature);
      if (rainChance !== null) day.rainChance = Math.max(day.rainChance ?? 0, rainChance);
    } else days.set(date, { date, lowC: temperature, highC: temperature, rainChance, retrievedAt: new Date(now).toISOString() });
  }
  return [...days.values()].sort((a, b) => a.date.localeCompare(b.date)).slice(0, 9);
}
type Cached = { response: ForecastResponse; expires: number; modified: string | null; retrievedAt: number };
// Bounded by the public city catalog; no identity or guest input is cached.
const cache = new Map<string, Cached>();
const pending = new Map<string, Promise<Cached>>();
const retryAt = new Map<string, number>();
export function resetWeatherCacheForTest() { cache.clear(); pending.clear(); retryAt.clear(); }
async function retrieveCity(city: WeatherCity): Promise<Cached> {
  const cached = cache.get(city.id);
  if (cached && cached.expires > Date.now()) return cached;
  const current = pending.get(city.id);
  if (current) return current;
  if ((retryAt.get(city.id) ?? 0) > Date.now()) throw unavailable();
  const work = (async () => {
    const response = await fetch(`https://api.met.no/weatherapi/locationforecast/2.0/compact?${new URLSearchParams({ lat: String(city.latitude), lon: String(city.longitude) })}`, {
      headers: { "User-Agent": "Lint/0.1 (https://lint.fit; davidschmittgit@gmail.com)", ...(cached?.modified ? { "If-Modified-Since": cached.modified } : {}) },
      redirect: "error", signal: AbortSignal.timeout(3500), cache: "no-store",
    });
    if (response.status !== 304 && response.status !== 200) {
      const retry = response.headers.get("Retry-After");
      if (retry) {
        const until = /^\d+$/.test(retry) ? Date.now() + Number(retry) * 1000 : Date.parse(retry);
        if (Number.isFinite(until)) retryAt.set(city.id, until);
      }
      throw unavailable();
    }
    const expires = Date.parse(response.headers.get("Expires") ?? "");
    const expiry = Number.isFinite(expires) && expires > Date.now() ? expires : Date.now() + 10 * 60000;
    if (response.status === 304) {
      if (!cached) throw unavailable();
      const refreshed = { ...cached, expires: expiry };
      cache.set(city.id, refreshed); return refreshed;
    }
    const bytes = await response.text();
    if (bytes.length > 1000000) throw unavailable();
    const parsed = Schema.decodeUnknownSync(forecastSchema)(JSON.parse(bytes));
    const result = { response: parsed, expires: expiry, modified: response.headers.get("Last-Modified"), retrievedAt: Date.now() };
    cache.set(city.id, result); return result;
  })();
  pending.set(city.id, work);
  try { return await work; } catch {
    retryAt.set(city.id, Math.max(retryAt.get(city.id) ?? 0, Date.now() + 10 * 60000));
    throw unavailable();
  } finally { pending.delete(city.id); }
}
interface PlanningWeather { readonly week: (city: string, timezone: string) => Effect.Effect<CityForecast[], WeatherFailure> }
export const PlanningWeather = Context.Service<PlanningWeather>("PlanningWeather");
export const PlanningWeatherLive = Layer.succeed(PlanningWeather, {
  week: cityId => Effect.tryPromise({ try: async () => {
    const city = weatherCities.find(city => city.id === cityId);
    if (!city) return [];
    const result = await retrieveCity(city);
    return cityForecastDays(result.response, city).map(day => ({ ...day, retrievedAt: new Date(result.retrievedAt).toISOString() }));
  }, catch: unavailable }),
});
export const optionalCityWeather = (city: string, timezone: string) => city ? Effect.flatMap(PlanningWeather, service => service.week(city, timezone)).pipe(Effect.catch(() => Effect.succeed([] as CityForecast[]))) : Effect.succeed([] as CityForecast[]);
