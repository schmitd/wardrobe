'use client';

import { useCallback, useState } from 'react';
import { checkCompatibilityAction } from '@/app/actions/wardrobe';
import { createTraceContext } from '@/lib/trace';

export type CompatibilityCheckResult = Awaited<ReturnType<typeof checkCompatibilityAction>>;

type RunCompatibilityOptions = {
  startMessage?: string;
  fallbackErrorMessage?: string;
};

export function useCompatibilityCheck() {
  const [result, setResult] = useState<CompatibilityCheckResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const reset = useCallback(() => {
    setResult(null);
    setStatus(null);
  }, []);

  const runCompatibilityCheck = useCallback(
    async (storageId: string, options?: RunCompatibilityOptions) => {
      setIsProcessing(true);
      setResult(null);
      setStatus(options?.startMessage ?? 'Comparing this piece with your closet...');

      try {
        const trace = createTraceContext();
        const response = await checkCompatibilityAction({ storageId, ...trace });
        setResult(response);
        setStatus(null);
        return response;
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : options?.fallbackErrorMessage ?? 'Compatibility check failed.';
        setStatus(message);
        return null;
      } finally {
        setIsProcessing(false);
      }
    },
    []
  );

  return {
    result,
    isProcessing,
    status,
    setStatus,
    reset,
    runCompatibilityCheck,
  };
}
