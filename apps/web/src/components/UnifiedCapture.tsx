'use client';

import { uploadPhoto } from "@/services/photoUpload";

import Link from 'next/link';
import { ChangeEvent, createContext, useContext, useRef, useState, type ReactNode } from 'react';
import {
  Check,
  ImagePlus,
  Loader2,
  Sparkles,
  X,
} from 'lucide-react';
import posthog from 'posthog-js';
import { Effect } from 'effect';

import {
  createWardrobeItemAction,
  getUploadUrlAction,
  recordDailyFitCheckAction,
  routeCaptureAction,
} from '@/app/actions/wardrobe';
import TryOnFeedback from '@/components/TryOnFeedback';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useCompatibilityCheck } from '@/hooks/useCompatibilityCheck';
import { Result, promiseEffect, runEffectResult } from '@/lib/effect-result';
import { createTraceContext } from '@/lib/trace';
import { userFacingErrorMessage } from '@/lib/userFacingError';
import type { CaptureRoute, CaptureScope } from '@/server/captureRouter';

import { CaptureMenu, type CaptureIntent } from '@/components/CaptureMenu';

const CaptureContext = createContext<{ pending: boolean; onOpen: () => void; chooseIntent: (intent: CaptureIntent) => void } | null>(null);

type PendingCapture = {
  file: File;
  storageId: string;
  previewUrl: string;
  route: CaptureRoute;
  intent: CaptureIntent;
};

type Toast = {
  message: string;
  href?: string;
  error?: boolean;
};

type SavedCapture =
  | { kind: 'fit'; id: string }
  | { kind: 'piece'; id: string };

type StreamEvent =
  | { type: 'status'; stage: string }
  | { type: 'complete' }
  | { type: 'error'; error?: string };

const uploadCapture = (file: File) => uploadPhoto(file, getUploadUrlAction);

const waitForWardrobeItem = (input: {
  itemId: string;
  traceId: string;
  traceparent: string;
  onStage: (stage: string) => void;
}) =>
  Effect.gen(function* () {
    const response = yield* promiseEffect(() =>
      fetch('/api/wardrobe/process-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId: input.itemId,
          traceId: input.traceId,
          traceparent: input.traceparent,
        }),
      })
    );
    if (!response.ok || !response.body) {
      return yield* Effect.fail(new Error(`Processing failed: ${response.status}`));
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let pending = '';
    let completed = false;
    let failure: string | null = null;

    while (true) {
      const chunk = yield* promiseEffect(() => reader.read());
      if (chunk.done) break;
      pending += decoder.decode(chunk.value, { stream: true });
      const lines = pending.split('\n');
      pending = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.trim()) continue;
        const event = yield* Effect.try({
          try: () => JSON.parse(line) as StreamEvent,
          catch: () => new Error('The item update could not be read.'),
        });
        if (event.type === 'status') input.onStage(event.stage);
        if (event.type === 'complete') completed = true;
        if (event.type === 'error') failure = event.error ?? 'Analysis failed.';
      }
    }

    if (pending.trim()) {
      const event = yield* Effect.try({
        try: () => JSON.parse(pending) as StreamEvent,
        catch: () => new Error('The final item update could not be read.'),
      });
      if (event.type === 'complete') completed = true;
      if (event.type === 'error') failure = event.error ?? 'Analysis failed.';
    }
    if (failure) return yield* Effect.fail(new Error(failure));
    if (!completed) return yield* Effect.fail(new Error('Processing ended before completion.'));
    return input.itemId;
  });

export function UnifiedCaptureTrigger({ variant }: { variant: 'mobile' | 'desktop' }) {
  const capture = useContext(CaptureContext);
  if (!capture) throw new Error('Capture trigger requires a capture controller');
  return <CaptureMenu variant={variant} disabled={capture.pending} onSelect={capture.chooseIntent} onOpen={capture.onOpen} />;
}

export function UnifiedCaptureController({ children }: { children: ReactNode }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const selectedIntentRef = useRef<CaptureIntent>('my_wardrobe');
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [tryOnOpen, setTryOnOpen] = useState(false);
  const [tryOnPreview, setTryOnPreview] = useState<string | null>(null);
  const tryOn = useCompatibilityCheck();

  const chooseIntent = (intent: CaptureIntent) => {
    if (pending) return;
    selectedIntentRef.current = intent;
    setToast(null);
    inputRef.current?.click();
  };

  const completeCapture = async (capture: PendingCapture, scope: CaptureScope) => {
    setPending(true);

    if (capture.intent === 'just_trying') {
      if (tryOnPreview) URL.revokeObjectURL(tryOnPreview);
      setTryOnPreview(capture.previewUrl);
      setTryOnOpen(true);
      setStatus(null);
      const result = await tryOn.runCompatibilityCheck(capture.storageId, {
        scope,
        startMessage: 'Checking outfit…',
        fallbackErrorMessage: 'Try-on feedback failed.',
      });
      setPending(false);
      setStatus(null);
      if (!result) {
        setToast({ message: 'Try-on feedback failed. Please try another photo.', error: true });
        return;
      }
      posthog.capture('unified_capture_completed', { intent: capture.intent, scope });
      return;
    }

    const trace = createTraceContext();
    const captureEffect: Effect.Effect<SavedCapture, Error> =
      scope === 'full_fit'
        ? promiseEffect(async (): Promise<SavedCapture> => {
            setStatus('Saving outfit…');
            const saved = await recordDailyFitCheckAction({ storageId: capture.storageId, ...trace });
            return { kind: 'fit' as const, id: String(saved.id) };
          })
        : Effect.gen(function* () {
            setStatus('Adding piece…');
            const created = yield* promiseEffect(() =>
              createWardrobeItemAction({
                storageId: capture.storageId,
                clientFileName: capture.file.name,
                contentType: capture.file.type,
                ...trace,
              })
            );
            yield* waitForWardrobeItem({
              itemId: String(created.id),
              ...trace,
              onStage: () => setStatus('Adding piece…'),
            });
            return { kind: 'piece' as const, id: String(created.id) } satisfies SavedCapture;
          });
    const outcome = await runEffectResult(captureEffect);

    setPending(false);
    setStatus(null);
    URL.revokeObjectURL(capture.previewUrl);
    if (Result.isFailure(outcome)) {
      setToast({
        message: userFacingErrorMessage(outcome.failure, 'This photo could not be saved. Please try again.'),
        error: true,
      });
      return;
    }

    const saved = outcome.success;
    setToast(
      saved.kind === 'fit'
        ? { message: 'Outfit saved.', href: `/fits?view=diary#fit-${saved.id}` }
        : { message: 'Piece added.', href: '/' }
    );
    posthog.capture('unified_capture_completed', { intent: capture.intent, scope });
  };

  const onFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || pending) return;
    const intent = selectedIntentRef.current;
    if (!file.type.startsWith('image/')) {
      setToast({ message: 'Choose a photo to continue.', error: true });
      return;
    }

    setPending(true);
    setStatus('Adding photo…');
    const previewUrl = URL.createObjectURL(file);
    const trace = createTraceContext();
    const outcome = await runEffectResult(
      Effect.gen(function* () {
        const storageId = yield* uploadCapture(file);
        const route = yield* promiseEffect(() => routeCaptureAction({ storageId, ...trace }));
        return {
          file,
          storageId,
          previewUrl,
          route,
          intent,
        } satisfies PendingCapture;
      })
    );

    if (Result.isFailure(outcome)) {
      setPending(false);
      setStatus(null);
      URL.revokeObjectURL(previewUrl);
      setToast({
        message: userFacingErrorMessage(outcome.failure, 'This photo could not be read. Please try again.'),
        error: true,
      });
      return;
    }

    void completeCapture(outcome.success, outcome.success.route.scope);
  };

  return (
    <CaptureContext.Provider value={{ pending, chooseIntent, onOpen: () => setToast(null) }}>
      {children}
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={onFileChange} />

      {pending && (status || (!tryOnOpen && tryOn.isProcessing)) && (
        <div className="rack-capture-status" role="status" aria-live="polite">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>{status ?? "Checking outfit…"}</span>
        </div>
      )}

      {toast && !(tryOnOpen && tryOn.status && !tryOn.result) && (
        <div className={`rack-capture-toast ${toast.error ? 'rack-capture-toast--error' : ''}`} role={toast.error ? 'alert' : 'status'} aria-live="polite">
          {toast.error ? <ImagePlus className="h-5 w-5" /> : <Check className="h-5 w-5" />}
          {toast.href ? <Link href={toast.href} className="min-w-0 flex-1 font-extrabold underline decoration-2 underline-offset-4">{toast.message}</Link> : <span className="min-w-0 flex-1 font-semibold">{toast.message}</span>}
          <button type="button" onClick={() => setToast(null)} aria-label="Dismiss notification" className="grid h-8 w-8 shrink-0 place-items-center hover:bg-black/5"><X className="h-4 w-4" /></button>
        </div>
      )}

      <Dialog open={tryOnOpen} onOpenChange={setTryOnOpen}>
        <DialogContent aria-describedby={undefined} className="max-h-[92dvh] max-w-5xl overflow-y-auto rounded-none border border-[var(--rack-line)] bg-[var(--rack-paper)] p-5 sm:p-7">
          <DialogHeader className="border-b border-[var(--rack-line)] pb-4 pr-8 text-left">
            <DialogTitle className="flex items-center gap-2 text-2xl font-extrabold"><Sparkles className="h-5 w-5" />Try on outfit</DialogTitle>
          </DialogHeader>
          {tryOn.isProcessing && <div className="rack-panel rack-panel--shell flex min-h-64 flex-col items-center justify-center text-center"><Loader2 className="h-7 w-7 animate-spin" /><p className="mt-4 text-base font-extrabold">{tryOn.status}</p></div>}
          {!tryOn.isProcessing && tryOn.status && !tryOn.result && <p role="alert" className="border border-[#B93267] bg-[var(--rack-danger-wash)] p-4 text-sm font-semibold text-[#B93267]">{tryOn.status}</p>}
          {tryOn.result && <TryOnFeedback result={tryOn.result} previewUrl={tryOnPreview} />}
        </DialogContent>
      </Dialog>
    </CaptureContext.Provider>
  );
}
