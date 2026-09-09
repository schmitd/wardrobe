type Dependencies = {
  available: boolean;
  optedOut: () => boolean;
  read: () => Promise<boolean>;
  write: (enabled: boolean) => Promise<void>;
  start: () => Promise<void>;
  stop: () => Promise<void>;
};

export function createReplayConsent(deps: Dependencies) {
  let operations: Promise<unknown> = Promise.resolve();
  const serialize = (operation: () => Promise<void>) => {
    const next = operations.catch(() => undefined).then(operation);
    operations = next;
    return next;
  };
  return {
    read: deps.read,
    sync: (signedIn: boolean) => serialize(async () => {
      await deps.stop();
      const consent = await deps.read();
      if (deps.available && signedIn && !deps.optedOut() && consent) await deps.start();
    }),
    set: (enabled: boolean) => serialize(async () => {
      if (enabled && (!deps.available || deps.optedOut())) throw new Error("Replay unavailable");
      if (!enabled) await deps.stop();
      await deps.write(enabled);
      // Consent may have changed while persistent storage was writing.
      if (enabled && !deps.optedOut()) await deps.start();
    }),
  };
}
