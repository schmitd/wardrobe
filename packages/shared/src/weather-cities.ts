/** GeoNames CC BY 4.0, curated 2026-10-07, representative coordinates rounded to 2 decimals.
 * Sources: https://www.geonames.org/{id}/. Finite coverage; no inferred location. */
export const weatherCities = [
  { id: "4460243", label: "Charlotte, North Carolina, United States", latitude: 35.23, longitude: -80.84, timezone: "America/New_York" },
  { id: "2643743", label: "London, England, United Kingdom", latitude: 51.51, longitude: -0.13, timezone: "Europe/London" },
  { id: "524901", label: "Moscow, Moscow, Russia", latitude: 55.75, longitude: 37.62, timezone: "Europe/Moscow" },
  { id: "5128581", label: "New York City, New York, United States", latitude: 40.71, longitude: -74.01, timezone: "America/New_York" },
  { id: "2988507", label: "Paris, Île-de-France, France", latitude: 48.85, longitude: 2.35, timezone: "Europe/Paris" },
  { id: "2147714", label: "Sydney, New South Wales, Australia", latitude: -33.87, longitude: 151.21, timezone: "Australia/Sydney" },
] as const;
export type WeatherCity = (typeof weatherCities)[number];
