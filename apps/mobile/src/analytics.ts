import PostHog from "posthog-react-native";
import { nativeApplicationVersion, nativeBuildVersion } from "expo-application";
import { Platform } from "react-native";
import { safeProperties } from "./analytics-core";
import { nativeReplayPrivacy } from "./replay-privacy";

const token = process.env.EXPO_PUBLIC_POSTHOG_PROJECT_TOKEN;
const host = process.env.EXPO_PUBLIC_POSTHOG_HOST;
export const analytics = new PostHog(token || "disabled", {
  host: host || "https://us.i.posthog.com",
  disabled: !token || !host || __DEV__,
  captureAppLifecycleEvents: false,
  enableSessionReplay: false,
  sessionReplayConfig: nativeReplayPrivacy,
  capturePushNotificationSubscriptions: false,
  capturePushNotificationOpened: false,
  disableGeoip: true,
  preloadFeatureFlags: false,
  flushAt: 10,
  flushInterval: 10_000,
  // Capture only deliberate, sanitized exceptions below. Never console output.
  errorTracking: { autocapture: { uncaughtExceptions: false, unhandledRejections: false, console: [] } },
});

export const releaseProperties = () => ({
  platform: Platform.OS,
  app_version: nativeApplicationVersion ?? "development",
  build_number: nativeBuildVersion ?? "development",
  environment: __DEV__ ? "development" : "production",
  source: "native",
  analytics_schema: 1,
});

export function track(event: string, properties: Record<string, unknown> = {}) {
  try { analytics.capture(event, { ...releaseProperties(), ...safeProperties(properties) }); } catch { /* telemetry must not block the app */ }
}

export function trackFailure(stage: string, properties: Record<string, unknown> = {}) {
  try {
    const safe = safeProperties({ ...properties, stage });
    // Original exceptions may embed credentials, server messages, or local URLs.
    analytics.captureException(new Error(`Wardrobe ${safe.stage ?? "operation"} failed`), { ...releaseProperties(), ...safe });
  } catch { /* best effort */ }
}

export function analyticsHeaders(): Record<string, string> {
  try {
    if (analytics.optedOut || __DEV__ || !token || !host) return {};
    return { "X-POSTHOG-DISTINCT-ID": analytics.getDistinctId(), "X-POSTHOG-SESSION-ID": analytics.getSessionId() };
  } catch { return {}; }
}
