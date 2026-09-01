import { useEffect, useRef } from "react";

import { createShutterDebouncer, normalizeVolume, workingVolumeFor } from "@/volume-shutter-core";

type VolumeManagerModule = typeof import("react-native-volume-manager");

const INTERNAL_CHANGE_GRACE_MS = 220;

/**
 * Turns either hardware volume key into a shutter while the camera is active.
 * The user's original media volume and native volume UI are restored on exit.
 * This uses native code, so Expo Go intentionally falls back to the on-screen
 * shutter while development and store builds get hardware-key support.
 */
export const useVolumeShutter = (enabled: boolean, onShutter: () => void) => {
  const shutterRef = useRef(onShutter);
  shutterRef.current = onShutter;

  useEffect(() => {
    if (!enabled || process.env.EXPO_OS === "web") return;

    let cancelled = false;
    let subscription: { remove: () => void } | null = null;
    let volumeModule: VolumeManagerModule | null = null;
    let originalVolume: number | null = null;
    let workingVolume: number | null = null;
    let ignoreChangesUntil = 0;
    const acceptShutter = createShutterDebouncer();

    const restoreWorkingVolume = async () => {
      if (!volumeModule || workingVolume === null) return;
      ignoreChangesUntil = Date.now() + INTERNAL_CHANGE_GRACE_MS;
      await volumeModule.VolumeManager.setVolume(workingVolume, {
        type: "music",
        showUI: false,
        playSound: false,
      });
    };

    const setup = import("react-native-volume-manager").then(async (module) => {
      volumeModule = module;
      const current = await module.VolumeManager.getVolume();
      if (cancelled) return;

      originalVolume = normalizeVolume(current.volume);
      workingVolume = workingVolumeFor(originalVolume);
      await module.VolumeManager.showNativeVolumeUI({ enabled: false });
      if (workingVolume !== originalVolume) await restoreWorkingVolume();
      if (cancelled) return;

      subscription = module.VolumeManager.addVolumeListener(() => {
        if (cancelled || Date.now() <= ignoreChangesUntil) return;
        if (!acceptShutter(Date.now())) return;
        shutterRef.current();
        void restoreWorkingVolume();
      });
    }).catch(async () => {
      // The native module is unavailable in Expo Go. The visible shutter stays usable.
      subscription?.remove();
      const module = volumeModule;
      if (!module) return;
      try {
        try {
          if (originalVolume !== null) {
            await module.VolumeManager.setVolume(originalVolume, {
              type: "music",
              showUI: false,
              playSound: false,
            });
          }
        } finally {
          await module.VolumeManager.showNativeVolumeUI({ enabled: true });
        }
      } catch {}
    });

    return () => {
      cancelled = true;
      subscription?.remove();
      void setup.finally(async () => {
        subscription?.remove();
        const module = volumeModule;
        const restoreVolume = originalVolume;
        if (!module) return;
        try {
          if (restoreVolume !== null) {
            await module.VolumeManager.setVolume(restoreVolume, {
              type: "music",
              showUI: false,
              playSound: false,
            });
          }
        } finally {
          await module.VolumeManager.showNativeVolumeUI({ enabled: true });
        }
      }).catch(() => undefined);
    };
  }, [enabled]);
};
