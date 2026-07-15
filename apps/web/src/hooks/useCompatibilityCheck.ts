'use client';

import { useCallback, useState } from 'react';
import { checkCompatibilityAction } from '@/app/actions/wardrobe';
import { createTraceContext } from '@/lib/trace';
import { userFacingErrorMessage } from '@/lib/userFacingError';
import posthog from 'posthog-js';

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
        const score = response.evaluation?.score ?? null;
        posthog.capture('compatibility_check_completed', {
          category: response.candidate.category,
          verdict: score === null ? 'new_direction' : score >= 75 ? 'strong_fit' : score >= 50 ? 'mixed_fit' : 'poor_fit',
          score,
          similar_item_count: response.similarItems.length,
          dissimilar_item_count: response.dissimilarItems.length,
        });
        setResult(response);
        setStatus(null);
        return response;
      } catch (error) {
        posthog.captureException(error, { workflow: 'compatibility_check' });
        const message = userFacingErrorMessage(
          error,
          options?.fallbackErrorMessage ?? 'Compatibility check failed.'
        );
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
