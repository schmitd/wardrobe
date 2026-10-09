import type { SyntheticEvent } from "react";

// Next Image invokes onLoad after decoding. Keep the image visible without JS,
// and animate only its paint, never the card geometry or shell palette.
export function revealDecodedImage({ currentTarget: image }: SyntheticEvent<HTMLImageElement>) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  image.animate?.([{ opacity: 0.65 }, { opacity: 1 }], {
    duration: 160,
    easing: "ease-out",
  });
}

