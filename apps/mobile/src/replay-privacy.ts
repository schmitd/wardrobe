export const nativeReplayPrivacy = {
  maskAllTextInputs: true,
  maskAllImages: true,
  maskAllSandboxedViews: true,
  captureLog: false,
  captureNetworkTelemetry: false,
  verifyScreenshotMaskAlignment: true,
  throttleDelayMs: 1000,
};

// Set only after reviewing synthetic-data recordings on iOS AND Android.
export const nativeReplayAvailable = process.env.EXPO_PUBLIC_REPLAY_MASKING_VERIFIED === "true";
