'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import { Check, ExternalLink, Layers3, Save, Sparkles } from 'lucide-react';
import { saveInspirationAction } from '@/app/actions/wardrobe';
import type { CompatibilityCheckResult } from '@/hooks/useCompatibilityCheck';
import { createTraceContext } from '@/lib/trace';
import { userFacingErrorMessage } from '@/lib/userFacingError';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

type TryOnFeedbackProps = {
  result: CompatibilityCheckResult;
  previewUrl?: string | null;
  allowSave?: boolean;
};

const verdictFor = (score: number) => {
  if (score >= 75) return 'Strong closet fit';
  if (score >= 50) return 'Useful with limits';
  return 'Harder to integrate';
};

export default function TryOnFeedback({ result, previewUrl, allowSave = true }: TryOnFeedbackProps) {
  const wardrobes = useQuery(api.wardrobes.listWardrobes, allowSave ? {} : 'skip');
  const [wardrobeId, setWardrobeId] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [note, setNote] = useState('');
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveMessage, setSaveMessage] = useState('');

  const activeWardrobeId = wardrobeId || String(wardrobes?.[0]?._id ?? '');
  const selectedWardrobe = useMemo(
    () => wardrobes?.find((wardrobe) => String(wardrobe._id) === activeWardrobeId),
    [activeWardrobeId, wardrobes]
  );
  const evaluation = result.evaluation;
  const scoreTone = !evaluation
    ? null
    : evaluation.score >= 75
      ? {
          panel: 'rack-panel--success',
          label: 'text-[var(--rack-success)]',
          score: 'text-[var(--rack-success)]',
        }
      : evaluation.score < 50
        ? {
            panel: 'rack-panel--danger',
            label: 'text-[var(--rack-danger)]',
            score: 'text-[var(--rack-danger)]',
          }
        : {
            panel: 'rack-panel--shell',
            label: 'text-[var(--rack-ink-soft)]',
            score: 'text-[var(--rack-ink)]',
          };

  const saveToInspiration = async () => {
    if (!activeWardrobeId) {
      setSaveState('error');
      setSaveMessage('Create a wardrobe locus before saving inspiration.');
      return;
    }
    setSaveState('saving');
    setSaveMessage('');
    try {
      await saveInspirationAction({
        wardrobeId: activeWardrobeId,
        storageId: result.storageId,
        ...(sourceUrl.trim() ? { sourceUrl: sourceUrl.trim() } : {}),
        ...(note.trim() ? { note: note.trim() } : {}),
        candidate: result.candidate,
        ...createTraceContext(),
      });
      setSaveState('saved');
      setSaveMessage(`Saved as inspiration in ${selectedWardrobe?.name ?? 'your locus'}.`);
    } catch (error) {
      setSaveState('error');
      setSaveMessage(userFacingErrorMessage(error, 'Could not save inspiration.'));
    }
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-5 md:grid-cols-[minmax(180px,0.72fr)_minmax(0,1.28fr)]">
        <div className="space-y-3">
          {previewUrl ? (
            <Image
              src={previewUrl}
              alt={`Candidate ${result.candidate.category}`}
              width={640}
              height={800}
              unoptimized
              className="aspect-[4/5] w-full border border-[var(--rack-line)] bg-[var(--rack-wash)] object-cover shadow-[3px_3px_0_var(--rack-panel-shadow)]"
            />
          ) : (
            <div className="grid aspect-[4/5] place-items-center border border-[var(--rack-line)] bg-[var(--rack-wash)] text-sm font-semibold text-[var(--rack-ink-soft)]">
              Try-on photo
            </div>
          )}
          <div className="border border-[var(--rack-line)] bg-white p-3">
            <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-[var(--rack-ink-soft)]">
              Candidate, not closet inventory
            </p>
            <p className="mt-1 text-sm font-semibold text-[var(--rack-ink)]">
              {result.candidate.description}
            </p>
            <p className="mt-2 text-xs font-medium leading-relaxed text-[var(--rack-ink-soft)]">
              Remembered in Fits as a try-on. It remains outside owned inventory.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {evaluation ? (
            <>
              <section className={cn('rack-panel', scoreTone?.panel)}>
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <p className={cn('text-xs font-extrabold uppercase tracking-[0.14em]', scoreTone?.label)}>
                      Closet compatibility
                    </p>
                    <h3 className="mt-1 text-2xl font-extrabold text-[var(--rack-ink)]">
                      {verdictFor(evaluation.score)}
                    </h3>
                  </div>
                  <p className={cn('font-heading text-5xl font-black leading-none', scoreTone?.score)}>
                    {evaluation.score}
                    <span className="text-lg">/100</span>
                  </p>
                </div>
                <p className="mt-4 text-sm font-medium leading-relaxed text-[var(--rack-ink)]">
                  {evaluation.explanation}
                </p>
              </section>

              <section className="border border-[var(--rack-line)] bg-white p-4 shadow-[3px_3px_0_var(--rack-panel-shadow)]">
                <div className="flex items-center gap-2 text-[var(--rack-ink)]">
                  <Layers3 className="h-4 w-4" />
                  <h4 className="text-sm font-extrabold">Closest pieces already in your closet</h4>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  {result.similarItems.slice(0, 3).map((item) => (
                    <article key={String(item.id)} className="min-w-0 border border-[var(--rack-line)] bg-[var(--rack-paper)] p-2">
                      {item.imageUrl && (
                        <Image
                          src={item.imageUrl}
                          alt={item.description ?? item.category ?? 'Closet item'}
                          width={240}
                          height={240}
                          className="aspect-square w-full object-cover"
                        />
                      )}
                      <p className="mt-2 truncate text-xs font-extrabold text-[var(--rack-ink)]">
                        {item.category ?? 'Closet item'}
                      </p>
                      <p className="text-[11px] font-semibold text-[var(--rack-ink-soft)]">
                        {Math.round(item.similarity * 100)}% closet similarity
                      </p>
                    </article>
                  ))}
                  {result.similarItems.length === 0 && (
                    <p className="text-sm font-medium text-[var(--rack-ink-soft)]">
                      No close closet anchor yet. The piece can still shape a future locus.
                    </p>
                  )}
                </div>
              </section>

              {result.dissimilarItems.length > 0 && (
                <section className="border border-[var(--rack-line)] bg-[var(--rack-danger-wash)] p-4">
                  <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-[var(--rack-danger)]">
                    Watch-outs
                  </p>
                  <p className="mt-2 text-sm font-medium text-[var(--rack-ink)]">
                    It sits furthest from {result.dissimilarItems.slice(0, 2).map((item) => item.category ?? 'an existing piece').join(' and ')}. Treat those as contrast signals, not automatic rejections.
                  </p>
                </section>
              )}
            </>
          ) : (
            <section className="rack-panel rack-panel--shell">
              <div className="flex items-center gap-2 text-[var(--rack-ink)]">
                <Sparkles className="h-4 w-4" />
                <h3 className="text-lg font-extrabold">A new direction</h3>
              </div>
              <p className="mt-3 text-sm font-medium leading-relaxed text-[var(--rack-ink)]">
                {result.message}
              </p>
            </section>
          )}
        </div>
      </div>

      {allowSave && (
        <section className="border border-[var(--rack-line)] bg-[var(--rack-action-wash)] p-4 shadow-[3px_3px_0_var(--rack-panel-shadow)]">
          <div className="flex items-start gap-3">
            <Save className="mt-0.5 h-4 w-4 text-[var(--rack-ink)]" />
            <div>
              <h4 className="text-sm font-extrabold text-[var(--rack-ink)]">Keep the idea, not the item</h4>
              <p className="mt-1 text-sm font-medium text-[var(--rack-ink-soft)]">
                Save this candidate as inspiration in a locus. It stays outside your owned rack.
              </p>
            </div>
          </div>

          {wardrobes && wardrobes.length > 0 ? (
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div>
                <Label htmlFor="try-on-locus" className="text-xs font-extrabold uppercase tracking-[0.12em] text-[var(--rack-ink)]">
                  Inspiration locus
                </Label>
                <select
                  id="try-on-locus"
                  value={activeWardrobeId}
                  onChange={(event) => setWardrobeId(event.target.value)}
                  className="mt-2 h-10 w-full border border-[var(--rack-line)] bg-white px-3 text-sm font-semibold text-[var(--rack-ink)]"
                >
                  {wardrobes.map((wardrobe) => (
                    <option key={String(wardrobe._id)} value={String(wardrobe._id)}>
                      {wardrobe.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="try-on-source" className="text-xs font-extrabold uppercase tracking-[0.12em] text-[var(--rack-ink)]">
                  Source URL (optional)
                </Label>
                <Input
                  id="try-on-source"
                  type="url"
                  value={sourceUrl}
                  onChange={(event) => setSourceUrl(event.target.value)}
                  placeholder="https://shop.example/item"
                  className="mt-2 rounded-none border-[var(--rack-line)] bg-white"
                />
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="try-on-note" className="text-xs font-extrabold uppercase tracking-[0.12em] text-[var(--rack-ink)]">
                  What is worth remembering? (optional)
                </Label>
                <Textarea
                  id="try-on-note"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="The cropped proportion and warm neutral are the useful parts."
                  className="mt-2 min-h-20 rounded-none border-[var(--rack-line)] bg-white"
                />
              </div>
              <div className="flex flex-wrap items-center gap-3 md:col-span-2">
                <Button
                  type="button"
                  onClick={saveToInspiration}
                  disabled={saveState === 'saving' || saveState === 'saved'}
                  className="rounded-none border border-[var(--rack-line)] bg-[var(--rack-action)] text-[var(--rack-ink)] shadow-[2px_2px_0_var(--rack-panel-shadow)] hover:bg-[var(--rack-action-hover)]"
                >
                  {saveState === 'saved' ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
                  {saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Saved as inspiration' : 'Save inspiration'}
                </Button>
                {sourceUrl && (
                  <a href={sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-bold text-[var(--rack-ink)] underline underline-offset-4">
                    Check source <ExternalLink className="h-3 w-3" />
                  </a>
                )}
                {saveMessage && (
                  <p
                    role={saveState === 'error' ? 'alert' : 'status'}
                    className={`text-sm font-semibold ${saveState === 'error' ? 'text-[var(--rack-danger)]' : 'text-[var(--rack-success)]'}`}
                  >
                    {saveMessage}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border border-[var(--rack-line)] bg-white p-3">
              <p className="text-sm font-semibold text-[var(--rack-ink)]">
                Create a wardrobe locus first, then save this candidate there as inspiration.
              </p>
              <Button asChild variant="outline" className="rounded-none border-[var(--rack-line)] bg-[var(--rack-action)] text-[var(--rack-ink)]">
                <Link href="/wardrobes">Create a locus</Link>
              </Button>
            </div>
          )}
          <div className="mt-4 border-t border-[var(--rack-line)] pt-3">
            <Button asChild variant="outline" className="rounded-none border-[var(--rack-line)] bg-white text-[var(--rack-ink)]">
              <Link href="/fits">View saved try-on in Fits</Link>
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}
