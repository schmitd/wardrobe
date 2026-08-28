declare module "react-native-volume-manager" {
  type AndroidVolumeType = "music" | "call" | "system" | "ring" | "alarm" | "notification";

  type Subscription = { remove: () => void };

  export const VolumeManager: {
    getVolume: () => Promise<{ volume: number; type?: AndroidVolumeType }>;
    setVolume: (
      value: number,
      config?: { type?: AndroidVolumeType; showUI?: boolean; playSound?: boolean }
    ) => Promise<void>;
    showNativeVolumeUI: (config: { enabled: boolean }) => Promise<void>;
    addVolumeListener: (
      listener: (result: { volume: number; type?: AndroidVolumeType }) => void
    ) => Subscription;
  };
}
