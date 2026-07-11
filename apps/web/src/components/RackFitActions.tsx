'use client';

import Link from 'next/link';
import { ChangeEvent, useEffect, useRef, useState } from 'react';
import { Camera, Loader2, Shirt, X } from 'lucide-react';
import {
  getUploadUrlAction,
  recordDailyFitCheckAction,
  refreshStyleBioAction,
} from '@/app/actions/wardrobe';
import TryOnFeedback from '@/components/TryOnFeedback';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useCompatibilityCheck } from '@/hooks/useCompatibilityCheck';
import { createTraceContext } from '@/lib/trace';
import { userFacingErrorMessage } from '@/lib/userFacingError';
import { Button } from '@/components/ui/button';
import { Effect } from 'effect';
import { Either, promiseEffect, runBackground, runEffectResult } from '@/lib/effect-result';

type FitCheckMode = 'daily_fit_check' | 'try_on';

const modeCopy = {
  daily_fit_check: { label: 'Fit check', icon: Camera },
  try_on: { label: 'Try on', icon: Shirt },
} satisfies Record<FitCheckMode, { label: string; icon: typeof Camera }>;

export default function RackFitActions() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<FitCheckMode>('daily_fit_check');
  const [pendingMode, setPendingMode] = useState<FitCheckMode | null>(null);
  const [toast, setToast] = useState<{ message: string; href?: string; error?: boolean } | null>(null);
  const [tryOnOpen, setTryOnOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const tryOn = useCompatibilityCheck();

  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  const choosePhoto = (nextMode: FitCheckMode) => {
    setMode(nextMode);
    setToast(null);
    requestAnimationFrame(() => inputRef.current?.click());
  };

  const record = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setToast({ message: 'Choose a photo to continue.', error: true });
      return;
    }

    setPendingMode(mode);
    setToast({ message: `${modeCopy[mode].label} is being recorded...` });
    const uploadOutcome = await runEffectResult(
      Effect.gen(function* () {
        const uploadUrl = yield* promiseEffect(() => getUploadUrlAction());
        const upload = yield* promiseEffect(() => fetch(uploadUrl, { method: 'POST', body: file }));
        if (!upload.ok) return yield* Effect.fail(new Error(`Upload failed: ${upload.statusText}`));
        const { storageId } = yield* promiseEffect(() => upload.json() as Promise<{ storageId?: string }>);
        if (!storageId) return yield* Effect.fail(new Error('Upload response missing storageId.'));
        return storageId;
      })
    );
    if (Either.isLeft(uploadOutcome)) {
      setPendingMode(null);
      setToast({
        message: userFacingErrorMessage(uploadOutcome.left, `Could not save this ${modeCopy[mode].label.toLowerCase()}.`),
        error: true,
      });
      return;
    }
    const storageId = uploadOutcome.right;
    if (mode === 'try_on') {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(file));
      setTryOnOpen(true);
      setToast(null);
      const compatibilityOutcome = await runEffectResult(
        promiseEffect(() => tryOn.runCompatibilityCheck(storageId, {
          startMessage: 'Reading your Collections, then finding closet anchors…',
          fallbackErrorMessage: 'Try-on feedback failed.',
        }))
      );
      setPendingMode(null);
      if (Either.isLeft(compatibilityOutcome)) {
        setToast({ message: userFacingErrorMessage(compatibilityOutcome.left, 'Try-on feedback failed.'), error: true });
        return;
      }
      runBackground('style_bio.background_refresh.failed', () => refreshStyleBioAction());
      return;
    }
    const fitOutcome = await runEffectResult(
      promiseEffect(() => recordDailyFitCheckAction({ storageId, ...createTraceContext() }))
    );
    setPendingMode(null);
    if (Either.isLeft(fitOutcome)) {
      setToast({ message: userFacingErrorMessage(fitOutcome.left, 'Could not save this fit check.'), error: true });
      return;
    }
    setToast({
      message: `${modeCopy[mode].label} saved.`,
      href: `/fits#fit-${String(fitOutcome.right.id)}`,
    });
    runBackground('style_bio.background_refresh.failed', () => refreshStyleBioAction());
  };

  return (
    <>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={record} />
      {(Object.keys(modeCopy) as FitCheckMode[]).map((actionMode) => {
        const Icon = modeCopy[actionMode].icon;
        const pending = pendingMode === actionMode;
        return (
          <Button
            key={actionMode}
            type="button"
            variant="outline"
            disabled={pendingMode !== null}
            onClick={() => choosePhoto(actionMode)}
            className="rack-action-button rounded-none border border-[var(--rack-line)]"
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
            <span>{pending ? 'Saving...' : modeCopy[actionMode].label}</span>
          </Button>
        );
      })}

      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed bottom-5 left-1/2 z-50 flex w-[min(92vw,420px)] -translate-x-1/2 items-center gap-3 border px-4 py-3 shadow-[4px_4px_0_var(--rack-panel-shadow)] ${toast.error ? 'border-[#B93267] bg-[var(--rack-danger-wash)] text-[#7F2148]' : 'border-[var(--rack-line)] bg-white text-[#241426]'}`}
        >
          {toast.href ? (
            <Link href={toast.href} className="min-w-0 flex-1 text-sm font-extrabold underline decoration-2 underline-offset-4">
              {toast.message} View in Fits
            </Link>
          ) : (
            <span className="min-w-0 flex-1 text-sm font-semibold">{toast.message}</span>
          )}
          <button type="button" onClick={() => setToast(null)} aria-label="Dismiss notification" className="grid h-8 w-8 shrink-0 place-items-center hover:bg-black/5">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      <Dialog open={tryOnOpen} onOpenChange={setTryOnOpen}>
        <DialogContent className="max-h-[92dvh] max-w-5xl overflow-y-auto rounded-none border border-[var(--rack-line)] bg-[var(--rack-paper)] p-5 sm:p-7">
          <DialogHeader className="border-b border-[var(--rack-line)] pb-4 pr-8"><DialogTitle className="text-2xl font-extrabold">Try it with your closet</DialogTitle><DialogDescription>Compatibility feedback only. This candidate stays outside your owned rack.</DialogDescription></DialogHeader>
          {tryOn.isProcessing && <div className="rack-panel rack-panel--shell flex min-h-64 flex-col items-center justify-center text-center"><Loader2 className="h-7 w-7 animate-spin" /><p className="mt-4 text-base font-extrabold">{tryOn.status}</p></div>}
          {!tryOn.isProcessing && tryOn.status && !tryOn.result && <p role="alert" className="border border-[#B93267] bg-[var(--rack-danger-wash)] p-4 text-sm font-semibold text-[#B93267]">{tryOn.status}</p>}
          {tryOn.result && <TryOnFeedback result={tryOn.result} previewUrl={previewUrl} />}
        </DialogContent>
      </Dialog>
    </>
  );
}
