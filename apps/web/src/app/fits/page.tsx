'use client';

import Image from 'next/image';
import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import { Camera, ImagePlus, Shirt } from 'lucide-react';
import { getUploadUrlAction, recordDailyFitCheckAction, refreshStyleBioAction } from '@/app/actions/wardrobe';
import TryOnFeedback from '@/components/TryOnFeedback';
import { useCompatibilityCheck } from '@/hooks/useCompatibilityCheck';
import { createTraceContext } from '@/lib/trace';
import { userFacingErrorMessage } from '@/lib/userFacingError';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

type FitCheckMode = 'daily_fit_check' | 'try_on';

const copy: Record<FitCheckMode, { title: string; description: string; icon: typeof Camera }> = {
  daily_fit_check: { title: 'Fit check', description: 'Keep today’s outfit in your visual record.', icon: Camera },
  try_on: { title: 'Try on', description: 'Capture a candidate before it earns a place in your closet.', icon: Shirt },
};

const dayKey = (date: Date | number) => {
  const value = new Date(date);
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
};

function CaptureCard({ mode, onComplete }: { mode: FitCheckMode; onComplete: (mode: FitCheckMode, file: File) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const Icon = copy[mode].icon;
  const onChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) onComplete(mode, file);
  };

  return (
    <Card className="rack-panel rack-panel--shell rounded-none py-0">
      <CardContent className="px-0">
        <div className="flex items-center gap-2 text-[#241426]"><Icon className="h-4 w-4" /><h2 className="text-lg font-extrabold">{copy[mode].title}</h2></div>
        <p className="mt-2 text-sm font-medium leading-relaxed text-[#56345c]">{copy[mode].description}</p>
        <input ref={inputRef} className="hidden" type="file" accept="image/*" onChange={onChange} />
        <Button type="button" onClick={() => inputRef.current?.click()} className="mt-5 h-10 rounded-none border border-[var(--rack-line)] bg-[#DCE66E] px-4 text-sm font-extrabold text-[#241426] shadow-[2px_2px_0_var(--rack-panel-shadow)]"><ImagePlus className="h-4 w-4" /> Add photo</Button>
      </CardContent>
    </Card>
  );
}

export default function FitsPage() {
  return <FitsContent />;
}

function FitsContent() {
  const { isLoaded, isSignedIn } = useUser();
  const fitChecks = useQuery(api.fitChecks.listFitChecks, isLoaded && isSignedIn ? { limit: 100 } : 'skip');
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tryOnPreview, setTryOnPreview] = useState<string | null>(null);
  const tryOn = useCompatibilityCheck();

  useEffect(() => () => { if (tryOnPreview) URL.revokeObjectURL(tryOnPreview); }, [tryOnPreview]);

  const dailyChecks = useMemo(() => (fitChecks ?? []).filter((check) => check.type === 'daily_fit_check'), [fitChecks]);
  const checkByDay = useMemo(() => new Map(dailyChecks.map((check) => [dayKey(check.createdAt), check])), [dailyChecks]);
  const days = useMemo(() => Array.from({ length: 84 }, (_, index) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - (83 - index));
    return date;
  }), []);

  const record = async (mode: FitCheckMode, file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Choose a photo file to continue.');
      return;
    }
    setStatus(`${copy[mode].title} is being recorded…`);
    setError(null);
    try {
      const uploadUrl = await getUploadUrlAction();
      const upload = await fetch(uploadUrl, { method: 'POST', body: file });
      if (!upload.ok) throw new Error(`Upload failed: ${upload.statusText}`);
      const { storageId } = await upload.json();
      if (!storageId) throw new Error('Upload response missing storageId.');
      const trace = createTraceContext();
      if (mode === 'try_on') {
        if (tryOnPreview) URL.revokeObjectURL(tryOnPreview);
        setTryOnPreview(URL.createObjectURL(file));
        await tryOn.runCompatibilityCheck(storageId, { startMessage: 'Reading your Collections, then finding closet anchors…', fallbackErrorMessage: 'Try-on feedback failed.' });
        setStatus(null);
      } else {
        await recordDailyFitCheckAction({ storageId, ...trace });
        setStatus('Fit check saved.');
      }
      void refreshStyleBioAction().catch((refreshError) => console.warn('style_bio.background_refresh.failed', refreshError));
    } catch (caught) {
      setError(userFacingErrorMessage(caught, 'Could not save this fit right now.'));
      setStatus(null);
    }
  };

  if (!isLoaded) return <div className="p-8 text-sm font-semibold">Loading fits…</div>;
  if (!isSignedIn) {
    return <main className="mx-auto w-full max-w-[1320px] px-6 py-10 lg:px-10"><Card className="rack-panel rack-panel--shell rounded-none py-0"><CardContent className="px-0"><h1 className="text-4xl font-extrabold text-[#241426]">Fits</h1><p className="mt-3 text-sm font-medium text-[#56345c]">Sign in to keep a visual record of what you wear.</p></CardContent></Card></main>;
  }

  return (
    <main className="mx-auto w-full max-w-[1320px] space-y-6 px-6 py-10 lg:px-10">
      <section className="space-y-4">
        <div><p className="text-sm font-semibold text-[#56345c]">Outfit memory</p><h1 className="mt-2 text-4xl font-extrabold text-[#241426]">Fits</h1><p className="mt-2 max-w-2xl text-sm font-medium leading-relaxed text-[#56345c]">A visual record of what you wore and what you considered.</p></div>
        <div className="grid gap-4 md:grid-cols-2"><CaptureCard mode="daily_fit_check" onComplete={record} /><CaptureCard mode="try_on" onComplete={record} /></div>
        {(status || error) && <p role="status" className={`border p-3 text-sm font-semibold ${error ? 'border-[#B93267] bg-[var(--rack-danger-wash)] text-[#B93267]' : 'border-[var(--rack-line)] bg-[var(--rack-success-wash)] text-[#241426]'}`}>{error ?? status}</p>}
      </section>

      {tryOn.isProcessing && <section className="rack-panel rack-panel--shell flex min-h-52 flex-col items-center justify-center text-center"><p className="text-lg font-extrabold text-[#241426]">{tryOn.status}</p><p className="mt-2 text-sm font-medium text-[#56345c]">The result will explain compatibility and surface the closest pieces you already own.</p></section>}
      {!tryOn.isProcessing && tryOn.status && !tryOn.result && <p role="alert" className="border border-[#B93267] bg-[var(--rack-danger-wash)] p-4 text-sm font-semibold text-[#B93267]">{tryOn.status}</p>}
      {tryOn.result && <section className="space-y-4"><h2 className="text-xl font-extrabold text-[#241426]">Latest try-on feedback</h2><TryOnFeedback result={tryOn.result} previewUrl={tryOnPreview} /></section>}

      <section className="rack-panel rounded-none">
        <div className="flex flex-wrap items-end justify-between gap-4"><div><h2 className="text-xl font-extrabold text-[#241426]">Your recent rhythm</h2><p className="mt-1 text-sm font-medium text-[#56345c]">Each photo marks a day you checked in.</p></div><span className="text-xs font-semibold text-[#56345c]">Last 12 weeks</span></div>
        <div className="mt-5 grid grid-cols-12 gap-1.5 sm:gap-2" aria-label="Daily fit calendar">
          {days.map((date) => {
            const key = dayKey(date);
            const check = checkByDay.get(key);
            const today = key === dayKey(new Date());
            const content = check?.imageUrl ? <Image src={check.imageUrl} alt={`Fit from ${date.toLocaleDateString()}`} fill sizes="72px" className="object-cover" /> : null;
            return check ? <a key={key} href={`#fit-${String(check._id)}`} aria-label={`View fit from ${date.toLocaleDateString()}`} className={`relative aspect-square overflow-hidden border ${today ? 'border-[#241426] ring-2 ring-[#DCE66E] ring-offset-1' : 'border-[var(--rack-line)]'} bg-[var(--rack-wash)] hover:-translate-y-0.5`}>{content}</a> : <span key={key} aria-label={`${date.toLocaleDateString()}: no fit recorded`} className={`aspect-square border ${today ? 'border-[#241426] bg-[#DCE66E]' : 'border-[#d8c9dc] bg-[#fbf9fa]'}`} />;
          })}
        </div>
      </section>

      <section><h2 className="text-xl font-extrabold text-[#241426]">Recent fits</h2><div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{(fitChecks ?? []).map((fitCheck) => <article id={`fit-${String(fitCheck._id)}`} key={String(fitCheck._id)} className="overflow-hidden border border-[var(--rack-line)] bg-white shadow-[3px_3px_0_var(--rack-panel-shadow)]"><div className="relative aspect-[4/3] bg-[var(--rack-wash)]">{fitCheck.imageUrl && <Image src={fitCheck.imageUrl} alt={fitCheck.transcription ?? fitCheck.type} fill sizes="(max-width: 768px) 100vw, 33vw" className="object-cover" />}</div><div className="p-4"><p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#56345c]">{fitCheck.type === 'try_on' ? 'Try on' : 'Fit check'} · {new Date(fitCheck.createdAt).toLocaleDateString()}</p><p className="mt-2 text-sm font-medium leading-relaxed text-[#241426]">{fitCheck.transcription ?? fitCheck.description ?? 'No notes yet.'}</p></div></article>)}</div></section>
    </main>
  );
}
