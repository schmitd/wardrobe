import { expect, test } from "bun:test";
import { nativeReplayPrivacy, nativeReplayAvailable } from "./replay-privacy";

test("native replay masks media, all text and system pickers without logs or network capture", () => {
  expect(nativeReplayPrivacy.maskAllImages).toBe(true);
  expect(nativeReplayPrivacy.maskAllTextInputs).toBe(true);
  expect(nativeReplayPrivacy.maskAllSandboxedViews).toBe(true);
  expect(nativeReplayPrivacy.captureLog).toBe(false);
  expect(nativeReplayPrivacy.captureNetworkTelemetry).toBe(false);
  expect(nativeReplayPrivacy.verifyScreenshotMaskAlignment).toBe(true);
  expect(nativeReplayAvailable).toBe(process.env.EXPO_PUBLIC_REPLAY_MASKING_VERIFIED === "true");
});
