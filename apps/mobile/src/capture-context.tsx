import { createContext, type PropsWithChildren, useContext, useMemo, useState } from "react";

import type { CompatibilityResult } from "@/types";

type CaptureState = {
  result: CompatibilityResult | null;
  setResult: (result: CompatibilityResult | null) => void;
};

const Context = createContext<CaptureState | null>(null);

export function CaptureProvider({ children }: PropsWithChildren) {
  const [result, setResult] = useState<CompatibilityResult | null>(null);
  const value = useMemo(() => ({ result, setResult }), [result]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useCaptureResult() {
  const context = useContext(Context);
  if (!context) throw new Error("useCaptureResult must be used within CaptureProvider");
  return context;
}
