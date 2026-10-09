import { weatherCities } from "@wardrobe/shared";

/** Coordinates stay on this device; only a public catalog city ID enters the draft. */
export function nearbyWeatherCity(latitude: number, longitude: number) {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  const lat = Math.round(latitude * 10) / 10, lon = Math.round(longitude * 10) / 10;
  const distance = (a: number, b: number) => {
    const radians = Math.PI / 180;
    const x = (b - lon) * radians * Math.cos((a + lat) / 2 * radians), y = (a - lat) * radians;
    return 6371 * Math.sqrt(x * x + y * y);
  };
  const nearest = [...weatherCities].sort((a, b) => distance(a.latitude, a.longitude) - distance(b.latitude, b.longitude))[0];
  return nearest && distance(nearest.latitude, nearest.longitude) <= 100 ? nearest : null;
}
export function requestWeatherCity(geolocation: Pick<Geolocation, "getCurrentPosition"> | undefined) {
  return new Promise<ReturnType<typeof nearbyWeatherCity>>((resolve, reject) => {
    if (!geolocation) { reject(new Error("Location unavailable. Choose a city instead.")); return; }
    geolocation.getCurrentPosition(position => resolve(nearbyWeatherCity(position.coords.latitude, position.coords.longitude)), () => reject(new Error("Location unavailable or access declined. Choose a city instead.")), { enableHighAccuracy: false, maximumAge: 300000, timeout: 8000 });
  });
}
