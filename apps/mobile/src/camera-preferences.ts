import * as SecureStore from "expo-secure-store";
import type { CameraType } from "expo-camera";

import { normalizeCameraFacing } from "@/camera-preferences-core";

const LAST_CAMERA_FACING_KEY = "wardrobe.last-camera-facing.v1";

export const readLastCameraFacing = async (fallback: CameraType): Promise<CameraType> => {
  try {
    return normalizeCameraFacing(await SecureStore.getItemAsync(LAST_CAMERA_FACING_KEY), fallback);
  } catch {
    return fallback;
  }
};

export const rememberCameraFacing = async (facing: CameraType): Promise<void> => {
  try {
    await SecureStore.setItemAsync(LAST_CAMERA_FACING_KEY, facing);
  } catch {
    // A storage failure should never make the camera unusable.
  }
};
