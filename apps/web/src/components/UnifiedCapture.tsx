'use client';

import Link from 'next/link';
import { ChangeEvent, useEffect, useRef, useState } from 'react';
import {
  Camera,
  Check,
  DoorClosed,
  ImagePlus,
  Loader2,
  Plus,
  Shirt,
  ScanSearch,
  Sparkles,
  X,
} from 'lucide-react';
import posthog from 'posthog-js';
import { Effect } from 'effect';

import {
  createWardrobeItemAction,
  getUploadUrlAction,
  recordDailyFitCheckAction,
  refreshStyleBioAction,
  routeCaptureAction,
} from '@/app/actions/wardrobe';
import TryOnFeedback from '@/components/TryOnFeedback';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useCompatibilityCheck } from '@/hooks/useCompatibilityCheck';
import { OPEN_CAPTURE_MENU_EVENT, openCaptureMenu } from '@/lib/captureEvents';
import { Either, promiseEffect, runBackground, runEffectResult } from '@/lib/effect-result';
import { createTraceContext } from '@/lib/trace';
import { userFacingErrorMessage } from '@/lib/userFacingError';
import type { CaptureRoute, CaptureScope } from '@/server/captureRouter';

type CaptureIntent = 'my_wardrobe' | 'just_trying';

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

const stageLabel = (stage: string) => {
  switch (stage) {
    case 'fetching_image':
      return 'Preparing your piece…';
    case 'analyzing_tags':
      return 'Reading its visual language…';
    case 'analyzing_description':
      return 'Writing closet notes…';
    case 'embedding':
      return 'Connecting it to your wardrobe…';
    case 'persisting':
      return 'Putting it on the rack…';
    default:
      return 'Adding your piece…';
  }
};

const uploadCapture = (file: File) =>
  Effect.gen(function* () {
    const uploadUrl = yield* promiseEffect(() => getUploadUrlAction());
    const upload = yield* promiseEffect(() => fetch(uploadUrl, { method: 'POST', body: file }));
    if (!upload.ok) return yield* Effect.fail(new Error(`Upload failed: ${upload.statusText}`));
    const payload = yield* promiseEffect(() => upload.json() as Promise<{ storageId?: string }>);
    if (!payload.storageId) return yield* Effect.fail(new Error('Upload response missing storageId.'));
    return payload.storageId;
  });

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
  if (variant === 'mobile') {
    return (
      <button
        type="button"
        onClick={openCaptureMenu}
        className="rack-capture-trigger rack-capture-trigger--mobile"
        aria-label="Add a wardrobe photo"
        aria-haspopup="menu"
      >
        <Plus className="h-8 w-8" strokeWidth={2.25} />
      </button>
    );
  }

  return (
    <Button
      type="button"
      variant="outline"
      onClick={openCaptureMenu}
      aria-haspopup="menu"
      className="min-h-11 rounded-none border border-[var(--rack-line)] bg-[var(--rack-action)] px-3 text-xs font-extrabold text-[var(--rack-ink)] shadow-[2px_2px_0_var(--rack-panel-shadow)] hover:bg-[var(--rack-action-hover)]"
    >
      <Plus className="h-4 w-4" />
      Add
    </Button>
  );
}

export function UnifiedCaptureController() {
  const inputRef = useRef<HTMLInputElement>(null);
  const selectedIntentRef = useRef<CaptureIntent>('my_wardrobe');
  const [menuOpen, setMenuOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [reviewCapture, setReviewCapture] = useState<PendingCapture | null>(null);
  const [tryOnOpen, setTryOnOpen] = useState(false);
  const [tryOnPreview, setTryOnPreview] = useState<string | null>(null);
  const tryOn = useCompatibilityCheck();

  useEffect(() => {
    const open = () => {
      setToast(null);
      setMenuOpen((current) => !current);
    };
    window.addEventListener(OPEN_CAPTURE_MENU_EVENT, open);
    return () => window.removeEventListener(OPEN_CAPTURE_MENU_EVENT, open);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest('.rack-capture-intent, .rack-capture-trigger')) return;
      setMenuOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('pointerdown', onPointerDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('pointerdown', onPointerDown);
    };
  }, [menuOpen]);

  const chooseIntent = (intent: CaptureIntent) => {
    selectedIntentRef.current = intent;
    setMenuOpen(false);
    setToast(null);
    requestAnimationFrame(() => inputRef.current?.click());
  };

  const completeCapture = async (capture: PendingCapture, scope: CaptureScope) => {
    setReviewCapture(null);
    setPending(true);

    if (capture.intent === 'just_trying') {
      if (tryOnPreview) URL.revokeObjectURL(tryOnPreview);
      setTryOnPreview(capture.previewUrl);
      setTryOnOpen(true);
      setStatus(scope === 'full_fit' ? 'Comparing this fit with your closet…' : 'Comparing this piece with your closet…');
      const result = await tryOn.runCompatibilityCheck(capture.storageId, {
        startMessage: 'Reading your wardrobe, then finding useful anchors…',
        fallbackErrorMessage: 'Try-on feedback failed.',
      });
      setPending(false);
      setStatus(null);
      if (!result) {
        setToast({ message: 'Try-on feedback failed. Please try another photo.', error: true });
        return;
      }
      posthog.capture('unified_capture_completed', { intent: capture.intent, scope });
      runBackground('style_bio.background_refresh.failed', () => refreshStyleBioAction());
      return;
    }

    const trace = createTraceContext();
    const captureEffect: Effect.Effect<SavedCapture, Error> =
      scope === 'full_fit'
        ? promiseEffect(async (): Promise<SavedCapture> => {
            setStatus('Recording your fit and recognizing familiar pieces…');
            const saved = await recordDailyFitCheckAction({ storageId: capture.storageId, ...trace });
            return { kind: 'fit' as const, id: String(saved.id) };
          })
        : Effect.gen(function* () {
            setStatus('Adding one piece to your wardrobe…');
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
              onStage: (stage) => setStatus(stageLabel(stage)),
            });
            return { kind: 'piece' as const, id: String(created.id) } satisfies SavedCapture;
          });
    const outcome = await runEffectResult(captureEffect);

    setPending(false);
    setStatus(null);
    URL.revokeObjectURL(capture.previewUrl);
    if (Either.isLeft(outcome)) {
      setToast({
        message: userFacingErrorMessage(outcome.left, 'This photo could not be saved. Please try again.'),
        error: true,
      });
      return;
    }

    const saved = outcome.right;
    setToast(
      saved.kind === 'fit'
        ? { message: 'Fit recorded. Familiar pieces were matched when confidence was high.', href: `/fits#fit-${saved.id}` }
        : { message: 'Piece added to your wardrobe.', href: '/' }
    );
    posthog.capture('unified_capture_completed', { intent: capture.intent, scope });
    runBackground('style_bio.background_refresh.failed', () => refreshStyleBioAction());
  };

  const onFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setToast({ message: 'Choose a photo to continue.', error: true });
      return;
    }

    setPending(true);
    setStatus('Reading the photo…');
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
          intent: selectedIntentRef.current,
        } satisfies PendingCapture;
      })
    );

    if (Either.isLeft(outcome)) {
      setPending(false);
      setStatus(null);
      URL.revokeObjectURL(previewUrl);
      setToast({
        message: userFacingErrorMessage(outcome.left, 'This photo could not be read. Please try again.'),
        error: true,
      });
      return;
    }

    if (outcome.right.route.needsReview) {
      setPending(false);
      setStatus(null);
      setReviewCapture(outcome.right);
      return;
    }
    void completeCapture(outcome.right, outcome.right.route.scope);
  };

  const dismissReview = () => {
    if (reviewCapture?.previewUrl) URL.revokeObjectURL(reviewCapture.previewUrl);
    setReviewCapture(null);
  };

  return (
    <>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={onFileChange} />

      {menuOpen && (
        <div className="rack-capture-intent" role="menu" aria-label="What should Wardrobe do with this photo?">
          <button type="button" role="menuitem" onClick={() => chooseIntent('my_wardrobe')} className="rack-capture-intent-option rack-capture-intent-option--primary">
            <DoorClosed className="h-5 w-5" />
            <span><strong>My wardrobe</strong><small>I own or wore it</small></span>
          </button>
          <button type="button" role="menuitem" onClick={() => chooseIntent('just_trying')} className="rack-capture-intent-option">
            <ScanSearch className="h-5 w-5" />
            <span><strong>Just trying</strong><small>Feedback, not owned</small></span>
          </button>
        </div>
      )}

      {pending && status && (
        <div className="rack-capture-status" role="status" aria-live="polite">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>{status}</span>
        </div>
      )}

      {toast && (
        <div className={`rack-capture-toast ${toast.error ? 'rack-capture-toast--error' : ''}`} role={toast.error ? 'alert' : 'status'} aria-live="polite">
          {toast.error ? <ImagePlus className="h-5 w-5" /> : <Check className="h-5 w-5" />}
          {toast.href ? <Link href={toast.href} className="min-w-0 flex-1 font-extrabold underline decoration-2 underline-offset-4">{toast.message}</Link> : <span className="min-w-0 flex-1 font-semibold">{toast.message}</span>}
          <button type="button" onClick={() => setToast(null)} aria-label="Dismiss notification" className="grid h-8 w-8 shrink-0 place-items-center hover:bg-black/5"><X className="h-4 w-4" /></button>
        </div>
      )}

      <Dialog open={reviewCapture !== null} onOpenChange={(open) => { if (!open) dismissReview(); }}>
        <DialogContent className="max-w-md rounded-none border border-[var(--rack-line)] bg-[var(--rack-paper)] p-5 shadow-[4px_4px_0_var(--rack-panel-shadow)]">
          <DialogHeader className="pr-8 text-left">
            <DialogTitle className="text-2xl font-extrabold">A quick nudge</DialogTitle>
            <DialogDescription>I’m not fully certain how this photo is framed. Choose once and I’ll handle the rest.</DialogDescription>
          </DialogHeader>
          {reviewCapture && (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={reviewCapture.previewUrl} alt="Capture awaiting classification" className="max-h-64 w-full border border-[var(--rack-line)] bg-white object-contain" />
              <p className="text-sm font-medium text-[var(--rack-ink-soft)]">{reviewCapture.route.rationale}</p>
              <div className="grid grid-cols-2 gap-3">
                <Button type="button" variant="outline" onClick={() => void completeCapture(reviewCapture, 'single_piece')} className="h-auto min-h-20 rounded-none border border-[var(--rack-line)] bg-white px-3 py-4 text-[var(--rack-ink)]">
                  <Shirt className="h-5 w-5" /><span className="text-sm font-extrabold">One piece</span>
                </Button>
                <Button type="button" variant="outline" onClick={() => void completeCapture(reviewCapture, 'full_fit')} className="h-auto min-h-20 rounded-none border border-[var(--rack-line)] bg-[var(--rack-action-wash)] px-3 py-4 text-[var(--rack-ink)]">
                  <Camera className="h-5 w-5" /><span className="text-sm font-extrabold">Full fit</span>
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={tryOnOpen} onOpenChange={setTryOnOpen}>
        <DialogContent className="max-h-[92dvh] max-w-5xl overflow-y-auto rounded-none border border-[var(--rack-line)] bg-[var(--rack-paper)] p-5 sm:p-7">
          <DialogHeader className="border-b border-[var(--rack-line)] pb-4 pr-8 text-left">
            <DialogTitle className="flex items-center gap-2 text-2xl font-extrabold"><Sparkles className="h-5 w-5" />Try it with your closet</DialogTitle>
            <DialogDescription>Compatibility feedback only. Nothing from this photo is added to your owned rack.</DialogDescription>
          </DialogHeader>
          {tryOn.isProcessing && <div className="rack-panel rack-panel--shell flex min-h-64 flex-col items-center justify-center text-center"><Loader2 className="h-7 w-7 animate-spin" /><p className="mt-4 text-base font-extrabold">{tryOn.status}</p></div>}
          {!tryOn.isProcessing && tryOn.status && !tryOn.result && <p role="alert" className="border border-[#B93267] bg-[var(--rack-danger-wash)] p-4 text-sm font-semibold text-[#B93267]">{tryOn.status}</p>}
          {tryOn.result && <TryOnFeedback result={tryOn.result} previewUrl={tryOnPreview} />}
        </DialogContent>
      </Dialog>
    </>
  );
}
