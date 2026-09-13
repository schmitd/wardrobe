import * as SecureStore from "expo-secure-store";
import { analytics } from "./analytics";
import { nativeReplayAvailable } from "./replay-privacy";
import { createReplayConsent } from "./replay-consent-core";

const key = "wardrobe-replay-consent-v1";
const consent = createReplayConsent({
  available: nativeReplayAvailable,
  optedOut: () => analytics.optedOut,
  read: async () => (await SecureStore.getItemAsync(key)) === "true",
  write: (enabled) => SecureStore.setItemAsync(key, String(enabled)),
  start: () => analytics.startSessionRecording(),
  stop: () => analytics.stopSessionRecording(),
});
export const readReplayConsent = consent.read;
export const syncReplayConsent = consent.sync;
export const setReplayConsent = consent.set;
