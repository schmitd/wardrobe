'use client';

import Image from 'next/image';
import { useMemo, useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import { Camera, Shirt, Sparkles } from 'lucide-react';
import ImageUploader, { type UploadedFile } from '@/components/ImageUploader';
import { recordDailyFitCheckAction, recordTryOnFitCheckAction } from '@/app/actions/wardrobe';
import { createTraceContext } from '@/lib/trace';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

type FitCheckMode = 'daily_fit_check' | 'try_on';
type FitCheckResult = Awaited<ReturnType<typeof recordDailyFitCheckAction>>;

const modeCopy = {
  daily_fit_check: {
    label: 'Daily fit',
    title: 'Record today',
    uploadLabel: 'Upload daily fit',
    icon: Camera,
  },
  try_on: {
    label: 'Try-on',
    title: 'Record try-on',
    uploadLabel: 'Upload try-on',
    icon: Shirt,
  },
} satisfies Record<FitCheckMode, { label: string; title: string; uploadLabel: string; icon: typeof Camera }>;

export default function FitsPage() {
  const { isLoaded, isSignedIn } = useUser();
  const fitChecks = useQuery(api.fitChecks.listFitChecks, isLoaded && isSignedIn ? { limit: 20 } : 'skip');
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [latestResult, setLatestResult] = useState<FitCheckResult | null>(null);

  const groupedChecks = useMemo(() => fitChecks ?? [], [fitChecks]);

  const recordFit = async (mode: FitCheckMode, uploads: UploadedFile[]) => {
    if (uploads.length === 0) return;
    const upload = uploads[0];
    const trace = createTraceContext();
    setStatus(`${modeCopy[mode].label} processing...`);
    setError(null);

    try {
      const result =
        mode === 'daily_fit_check'
          ? await recordDailyFitCheckAction({ storageId: upload.storageId, ...trace })
          : await recordTryOnFitCheckAction({ storageId: upload.storageId, ...trace });

      setLatestResult(result);
      setStatus(`${modeCopy[mode].label} recorded.`);
      setTimeout(() => setStatus(null), 3000);
    } catch (caught) {
      console.error('fit_check.record.failed', caught);
      setError(caught instanceof Error ? caught.message : 'Fit check failed');
      setStatus(null);
    }
  };

  if (!isLoaded) {
    return <div className="p-8 text-sm font-semibold uppercase tracking-wide">Loading fits...</div>;
  }

  if (!isSignedIn) {
    return (
      <main className="mx-auto w-full max-w-[1320px] px-4 py-8 lg:px-8">
        <Card className="rack-panel rounded-none py-0">
          <CardContent className="px-0">
            <h1 className="text-4xl font-black uppercase tracking-tight text-[#310A31]">Fits</h1>
            <p className="mt-3 text-sm font-medium text-slate-700">Sign in to record outfit history.</p>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-[1320px] space-y-6 px-4 py-8 lg:px-8">
      <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <Card className="rack-panel rounded-none py-0">
          <CardContent className="px-0">
            <Badge variant="outline" className="rounded-none border-2 border-black bg-white px-2 py-0 text-[10px] font-bold tracking-[0.2em] text-[#9C92A3]">
              Outfit Memory
            </Badge>
            <h1 className="mt-3 text-4xl font-black uppercase tracking-tight text-[#310A31]">Fits</h1>
            <p className="mt-3 text-sm font-medium leading-relaxed text-slate-700">
              Daily outfits and try-ons are recorded separately so the graph can tell worn history from acquisition intent.
            </p>
            {(status || error) && (
              <div className={`mt-4 border-2 border-black p-3 text-sm font-semibold ${error ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-900'}`}>
                {error ?? status}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-6 md:grid-cols-2">
          {(['daily_fit_check', 'try_on'] as FitCheckMode[]).map((mode) => {
            const Icon = modeCopy[mode].icon;
            return (
              <Card key={mode} className="rack-panel rounded-none py-0">
                <CardContent className="px-0">
                  <div className="mb-4 flex items-center gap-2 text-[#310A31]">
                    <Icon className="h-4 w-4" />
                    <h2 className="text-lg font-black uppercase tracking-wide">{modeCopy[mode].title}</h2>
                  </div>
                  <ImageUploader
                    label={modeCopy[mode].uploadLabel}
                    allowMultiple={false}
                    enablePreview
                    capture="environment"
                    onUploadComplete={(uploads) => void recordFit(mode, uploads)}
                  />
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      {latestResult && (
        <Card className="rack-panel rounded-none py-0">
          <CardContent className="px-0">
            <div className="mb-3 flex items-center gap-2 text-[#310A31]">
              <Sparkles className="h-4 w-4" />
              <h2 className="text-lg font-black uppercase tracking-wide">Latest transcription</h2>
            </div>
            <p className="text-sm font-semibold text-slate-800">{latestResult.transcription}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {latestResult.items.map((item) => (
                <Badge key={String(item.id)} variant="outline" className="rounded-none border-2 border-black bg-white">
                  {item.category ?? 'Item'} · {item.source.replaceAll('_', ' ')}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <section className="space-y-4">
        <h2 className="text-2xl font-black uppercase tracking-tight text-[#310A31]">Recent fits</h2>
        <div className="grid gap-4 lg:grid-cols-2">
          {groupedChecks.map((fitCheck) => (
            <article key={String(fitCheck._id)} className="border-4 border-black bg-white p-4 shadow-[6px_6px_0_#000]">
              <div className="grid gap-4 sm:grid-cols-[160px_1fr]">
                {fitCheck.imageUrl && (
                  <div className="relative aspect-[4/5] overflow-hidden border-2 border-black bg-slate-100">
                    <Image
                      src={fitCheck.imageUrl}
                      alt={fitCheck.transcription ?? fitCheck.type}
                      fill
                      sizes="160px"
                      className="object-cover"
                    />
                  </div>
                )}
                <div className="min-w-0">
                  <Badge variant="outline" className="rounded-none border-2 border-black bg-[#f3eef6]">
                    {fitCheck.type.replaceAll('_', ' ')}
                  </Badge>
                  <p className="mt-3 text-sm font-semibold leading-relaxed text-slate-800">
                    {fitCheck.transcription ?? fitCheck.description ?? 'No transcription yet.'}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {fitCheck.items.map((item) => (
                      <Badge key={String(item._id)} variant="outline" className="rounded-none border-2 border-black bg-white text-[10px]">
                        {item.category ?? 'Item'} · {item.source.replaceAll('_', ' ')}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
