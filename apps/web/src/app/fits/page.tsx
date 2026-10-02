'use client';

import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import { Camera, Loader2, Shirt, Sparkles } from 'lucide-react';
import ImageUploader, { type UploadedFile } from '@/components/ImageUploader';
import TryOnFeedback from '@/components/TryOnFeedback';
import { recordDailyFitCheckAction } from '@/app/actions/wardrobe';
import { useCompatibilityCheck } from '@/hooks/useCompatibilityCheck';
import { createTraceContext } from '@/lib/trace';
import { Card, CardContent } from '@/components/ui/card';

type DailyFitResult = Awaited<ReturnType<typeof recordDailyFitCheckAction>>;

export default function FitsPage() {
  const { isLoaded, isSignedIn } = useUser();
  const fitChecks = useQuery(api.fitChecks.listFitChecks, isLoaded && isSignedIn ? { limit: 20 } : 'skip');
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dailyResult, setDailyResult] = useState<DailyFitResult | null>(null);
  const [tryOnPreview, setTryOnPreview] = useState<string | null>(null);
  const tryOn = useCompatibilityCheck();

  const groupedChecks = useMemo(() => fitChecks ?? [], [fitChecks]);

  useEffect(() => () => {
    if (tryOnPreview) URL.revokeObjectURL(tryOnPreview);
  }, [tryOnPreview]);

  const recordDailyFit = async (uploads: UploadedFile[]) => {
    if (uploads.length === 0) return;
    setStatus('Reading today’s outfit…');
    setError(null);
    try {
      const result = await recordDailyFitCheckAction({
        storageId: uploads[0].storageId,
        ...createTraceContext(),
      });
      setDailyResult(result);
      setStatus('Daily fit recorded.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Fit check failed');
      setStatus(null);
    }
  };

  const checkTryOn = async (uploads: UploadedFile[]) => {
    if (uploads.length === 0) return;
    if (tryOnPreview) URL.revokeObjectURL(tryOnPreview);
    setTryOnPreview(URL.createObjectURL(uploads[0].file));
    setDailyResult(null);
    await tryOn.runCompatibilityCheck(uploads[0].storageId, {
      startMessage: 'Reading your loci, then finding closet anchors…',
      fallbackErrorMessage: 'Try-on feedback failed. Try another photo.',
    });
  };

  if (!isLoaded) {
    return <div className="p-8 text-sm font-semibold text-[var(--rack-ink)]">Loading fits…</div>;
  }

  if (!isSignedIn) {
    return (
      <main className="mx-auto w-full max-w-[1320px] px-4 py-8 lg:px-8">
        <Card className="rack-panel rounded-none py-0">
          <CardContent className="px-0">
            <h1 className="text-4xl font-extrabold text-[var(--rack-ink)]">Fits</h1>
            <p className="mt-3 text-sm font-medium text-[var(--rack-ink-soft)]">Sign in to record outfits and try candidates against your closet.</p>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-[1320px] space-y-6 px-4 py-8 lg:px-8">
      <header className="rack-panel rack-panel--shell">
        <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[var(--rack-ink-soft)]">Closet feedback</p>
        <h1 className="mt-2 text-4xl font-extrabold text-[var(--rack-ink)]">Fits</h1>
        <p className="mt-3 max-w-2xl text-sm font-medium leading-relaxed text-[var(--rack-ink-soft)]">
          Record what you actually wore, or try on a candidate for compatibility feedback. Try-ons stay outside the owned rack unless you deliberately add them later.
        </p>
      </header>

      {error && <p role="alert" className="border border-[var(--rack-line)] bg-[var(--rack-danger-wash)] p-4 text-sm font-semibold text-[var(--rack-danger)]">{error}</p>}
      {status && <p role="status" className="border border-[var(--rack-line)] bg-[var(--rack-success-wash)] p-4 text-sm font-semibold text-[var(--rack-success)]">{status}</p>}

      <section className="grid gap-5 lg:grid-cols-2">
        <Card className="rack-panel rounded-none py-0">
          <CardContent className="px-0">
            <div className="mb-4 flex items-start gap-3">
              <span className="grid h-9 w-9 place-items-center border border-[var(--rack-line)] bg-[var(--rack-wash)] text-[var(--rack-ink)]"><Camera className="h-4 w-4" /></span>
              <div>
                <h2 className="text-xl font-extrabold text-[var(--rack-ink)]">Record today</h2>
                <p className="mt-1 text-sm font-medium text-[var(--rack-ink-soft)]">Adds worn-history context; unmatched outfit pieces can be captured as owned.</p>
              </div>
            </div>
            <ImageUploader label="Upload daily fit" allowMultiple={false} capture="environment" onUploadComplete={(uploads) => void recordDailyFit(uploads)} />
          </CardContent>
        </Card>

        <Card className="rack-panel rack-panel--action rounded-none py-0">
          <CardContent className="px-0">
            <div className="mb-4 flex items-start gap-3">
              <span className="grid h-9 w-9 place-items-center border border-[var(--rack-line)] bg-[var(--rack-action)] text-[var(--rack-ink)]"><Shirt className="h-4 w-4" /></span>
              <div>
                <h2 className="text-xl font-extrabold text-[var(--rack-ink)]">Try something on</h2>
                <p className="mt-1 text-sm font-medium text-[var(--rack-ink-soft)]">Uses remembered loci plus top closet matches. Never adds the candidate to your rack.</p>
              </div>
            </div>
            <ImageUploader label="Upload try-on" allowMultiple={false} capture="environment" onUploadComplete={(uploads) => void checkTryOn(uploads)} />
          </CardContent>
        </Card>
      </section>

      {tryOn.isProcessing && (
        <section className="rack-panel rack-panel--shell flex min-h-52 flex-col items-center justify-center text-center">
          <Loader2 className="h-6 w-6 animate-spin text-[var(--rack-ink)]" />
          <h2 className="mt-4 text-xl font-extrabold text-[var(--rack-ink)]">{tryOn.status}</h2>
          <p className="mt-2 text-sm font-medium text-[var(--rack-ink-soft)]">The result will show why it works, which owned pieces anchor it, and what may clash.</p>
        </section>
      )}

      {!tryOn.isProcessing && tryOn.status && !tryOn.result && (
        <p role="alert" className="border border-[var(--rack-line)] bg-[var(--rack-danger-wash)] p-4 text-sm font-semibold text-[var(--rack-danger)]">{tryOn.status}</p>
      )}

      {tryOn.result && (
        <section className="space-y-4">
          <div className="flex items-center gap-2 text-[var(--rack-ink)]"><Sparkles className="h-4 w-4" /><h2 className="text-2xl font-extrabold">Try-on feedback</h2></div>
          <TryOnFeedback result={tryOn.result} previewUrl={tryOnPreview} />
        </section>
      )}

      {dailyResult && (
        <section className="rack-panel">
          <h2 className="text-xl font-extrabold text-[var(--rack-ink)]">Latest daily fit</h2>
          <p className="mt-3 text-sm font-medium text-[var(--rack-ink)]">{dailyResult.transcription}</p>
          <p className="mt-3 text-xs font-bold uppercase tracking-[0.12em] text-[var(--rack-ink-soft)]">
            {dailyResult.items.map((item) => `${item.category ?? 'Item'} · ${item.source.replaceAll('_', ' ')}`).join(' / ')}
          </p>
        </section>
      )}

      <section className="space-y-4">
        <h2 className="text-2xl font-extrabold text-[var(--rack-ink)]">Recent recorded fits</h2>
        <div className="grid gap-4 lg:grid-cols-2">
          {groupedChecks.map((fitCheck) => (
            <article key={String(fitCheck._id)} className="border border-[var(--rack-line)] bg-white p-4 shadow-[3px_3px_0_var(--rack-panel-shadow)]">
              <div className="grid gap-4 sm:grid-cols-[140px_1fr]">
                {fitCheck.imageUrl && (
                  <div className="relative aspect-[4/5] overflow-hidden border border-[var(--rack-line)] bg-[var(--rack-wash)]">
                    <Image src={fitCheck.imageUrl} alt={fitCheck.transcription ?? fitCheck.type} fill sizes="140px" className="object-cover" />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-[var(--rack-ink-soft)]">{fitCheck.type.replaceAll('_', ' ')}</p>
                  <p className="mt-3 text-sm font-medium leading-relaxed text-[var(--rack-ink)]">{fitCheck.transcription ?? fitCheck.description ?? 'No transcription yet.'}</p>
                  <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--rack-ink-soft)]">{fitCheck.items.map((item) => `${item.category ?? 'Item'} · ${item.source.replaceAll('_', ' ')}`).join(' / ')}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
