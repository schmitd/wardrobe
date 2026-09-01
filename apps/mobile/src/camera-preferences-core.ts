import type { CameraType } from "expo-camera";

export const normalizeCameraFacing = (
  value: string | null | undefined,
  fallback: CameraType
): CameraType => value === "front" || value === "back" ? value : fallback;
