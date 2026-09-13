import type { SessionRecordingOptions } from "posthog-js";

// Block media nodes, not merely their text: src/srcset can reveal private photos.
export const REPLAY_BLOCK_SELECTOR = 'img, picture, video, canvas, iframe, object, embed, svg image, input[type="file"], input[type="hidden"], [data-private], [style*="url("], [style*="image-set("]';

export const replayPrivacy: SessionRecordingOptions = {
  maskAllInputs: true,
  maskTextSelector: "*",
  blockSelector: REPLAY_BLOCK_SELECTOR,
  blockClass: "ph-no-capture",
  maskAttributeFn: (name, value) => {
    if (/^(src|srcset|href|poster|alt|title|value|aria-label|data-)/i.test(name)) return "[redacted]";
    if (name === "style" && /url\s*\(|image-set\s*\(/i.test(value)) return "";
    return value;
  },
  recordHeaders: false,
  recordBody: false,
  captureCanvas: { recordCanvas: false },
  captureJsonLd: false,
  maskCapturedNetworkRequestFn: () => null,
};
