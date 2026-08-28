const MIN_WORKING_VOLUME = 0.08;
const MAX_WORKING_VOLUME = 0.92;

export const normalizeVolume = (value: number) =>
  Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0.5;

export const workingVolumeFor = (originalVolume: number) =>
  Math.max(MIN_WORKING_VOLUME, Math.min(MAX_WORKING_VOLUME, normalizeVolume(originalVolume)));

export const createShutterDebouncer = (minimumIntervalMs = 650) => {
  let lastAcceptedAt = Number.NEGATIVE_INFINITY;

  return (at: number) => {
    if (at - lastAcceptedAt < minimumIntervalMs) return false;
    lastAcceptedAt = at;
    return true;
  };
};
