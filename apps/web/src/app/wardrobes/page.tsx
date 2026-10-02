'use client';

import Image from 'next/image';
import { useMemo, useState, type FormEvent } from 'react';
import { useUser } from '@clerk/nextjs';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import { ExternalLink, Layers3, Plus } from 'lucide-react';
import InspirationIntake from '@/components/InspirationIntake';
import { createTraceContext } from '@/lib/trace';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

const wardrobeKinds = ['style_locus', 'capsule', 'mood', 'season', 'trip', 'workwear'] as const;

export default function WardrobesPage() {
  const { isLoaded, isSignedIn } = useUser();
  const wardrobes = useQuery(api.wardrobes.listWardrobes, isLoaded && isSignedIn ? {} : 'skip');
  const inspirations = useQuery(api.candidates.listInspiration, isLoaded && isSignedIn ? {} : 'skip');
  const createWardrobe = useMutation(api.wardrobes.createWardrobe);

  const [name, setName] = useState('');
  const [kind, setKind] = useState<(typeof wardrobeKinds)[number]>('style_locus');
  const [description, setDescription] = useState('');
  const [moodWords, setMoodWords] = useState('');
  const [status, setStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [error, setError] = useState('');

  const normalizedWardrobes = useMemo(() => wardrobes ?? [], [wardrobes]);
  const inspirationByWardrobe = useMemo(() => {
    const grouped = new Map<string, NonNullable<typeof inspirations>>();
    for (const item of inspirations ?? []) {
      const key = String(item.wardrobeId);
      grouped.set(key, [...(grouped.get(key) ?? []), item]);
    }
    return grouped;
  }, [inspirations]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!name.trim()) return;
    setStatus('saving');
    setError('');
    try {
      await createWardrobe({
        name: name.trim(),
        kind,
        ...(description.trim() ? { description: description.trim() } : {}),
        moodWords: moodWords.split(',').map((word) => word.trim()).filter(Boolean).slice(0, 12),
        ...createTraceContext(),
      });
      setName('');
      setDescription('');
      setMoodWords('');
      setStatus('success');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not create wardrobe');
      setStatus('error');
    }
  };

  if (!isLoaded) return <div className="p-8 text-sm font-semibold text-[var(--rack-ink)]">Loading wardrobes…</div>;

  if (!isSignedIn) {
    return (
      <main className="mx-auto w-full max-w-[1320px] px-4 py-8 lg:px-8">
        <Card className="rack-panel rounded-none py-0"><CardContent className="px-0"><h1 className="text-4xl font-extrabold text-[var(--rack-ink)]">Wardrobes</h1><p className="mt-3 text-sm font-medium text-[var(--rack-ink-soft)]">Sign in to manage wardrobe loci and inspiration.</p></CardContent></Card>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-[1320px] space-y-6 px-4 py-8 lg:px-8">
      <header className="rack-panel rack-panel--shell flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[var(--rack-ink-soft)]">Closet loci</p>
          <h1 className="mt-2 text-4xl font-extrabold text-[var(--rack-ink)]">Wardrobes</h1>
          <p className="mt-3 max-w-2xl text-sm font-medium leading-relaxed text-[var(--rack-ink-soft)]">
            Loci hold a direction: owned pieces can belong here, and online references can inspire it without pretending they are in your closet.
          </p>
        </div>
        <InspirationIntake wardrobes={normalizedWardrobes} />
      </header>

      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <section className="rack-panel h-fit">
          <div className="flex items-center gap-2 text-[var(--rack-ink)]"><Plus className="h-4 w-4" /><h2 className="text-lg font-extrabold">New locus</h2></div>
          <form className="mt-5 space-y-4" onSubmit={submit}>
            <div><Label htmlFor="locus-name" className="text-xs font-extrabold uppercase tracking-[0.12em] text-[var(--rack-ink)]">Name</Label><Input id="locus-name" value={name} onChange={(event) => setName(event.target.value)} className="mt-2 rounded-none border-[var(--rack-line)] bg-white" placeholder="Winter work capsule" /></div>
            <div>
              <Label htmlFor="locus-kind" className="text-xs font-extrabold uppercase tracking-[0.12em] text-[var(--rack-ink)]">Kind</Label>
              <select id="locus-kind" value={kind} onChange={(event) => setKind(event.target.value as typeof kind)} className="mt-2 h-10 w-full border border-[var(--rack-line)] bg-white px-3 text-sm font-semibold text-[var(--rack-ink)]">
                {wardrobeKinds.map((option) => <option key={option} value={option}>{option.replace('_', ' ')}</option>)}
              </select>
            </div>
            <div><Label htmlFor="locus-mood" className="text-xs font-extrabold uppercase tracking-[0.12em] text-[var(--rack-ink)]">Mood words</Label><Input id="locus-mood" value={moodWords} onChange={(event) => setMoodWords(event.target.value)} className="mt-2 rounded-none border-[var(--rack-line)] bg-white" placeholder="tailored, warm, graphic" /></div>
            <div><Label htmlFor="locus-intent" className="text-xs font-extrabold uppercase tracking-[0.12em] text-[var(--rack-ink)]">Intent</Label><Textarea id="locus-intent" value={description} onChange={(event) => setDescription(event.target.value)} className="mt-2 min-h-28 rounded-none border-[var(--rack-line)] bg-white" placeholder="A compact set for cold office days…" /></div>
            {status === 'error' && <p className="border border-[var(--rack-line)] bg-[var(--rack-danger-wash)] p-3 text-sm font-semibold text-[var(--rack-danger)]">{error}</p>}
            {status === 'success' && <p className="border border-[var(--rack-line)] bg-[var(--rack-success-wash)] p-3 text-sm font-semibold text-[var(--rack-success)]">Locus saved.</p>}
            <Button type="submit" disabled={status === 'saving' || !name.trim()} className="rounded-none border border-[var(--rack-line)] bg-[var(--rack-action)] text-[var(--rack-ink)] shadow-[2px_2px_0_var(--rack-panel-shadow)] hover:bg-[var(--rack-action-hover)]">{status === 'saving' ? 'Saving…' : 'Create locus'}</Button>
          </form>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-extrabold text-[var(--rack-ink)]">Active loci</h2>
          {normalizedWardrobes.length === 0 ? (
            <div className="rack-empty-state"><h3 className="text-lg font-extrabold text-[var(--rack-ink)]">Make your first locus</h3><p className="mt-2 text-sm font-medium text-[var(--rack-ink-soft)]">A locus can be a capsule, mood, trip, season, or any style direction you want Zep to remember.</p></div>
          ) : (
            <div className="space-y-5">
              {normalizedWardrobes.map((wardrobe) => {
                const locusInspiration = inspirationByWardrobe.get(String(wardrobe._id)) ?? [];
                return (
                  <article key={String(wardrobe._id)} className="border border-[var(--rack-line)] bg-white p-5 shadow-[3px_3px_0_var(--rack-panel-shadow)]">
                    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                      <div>
                        <div className="flex items-center gap-2 text-[var(--rack-ink)]"><Layers3 className="h-4 w-4" /><h3 className="text-xl font-extrabold">{wardrobe.name}</h3></div>
                        <p className="mt-2 text-xs font-extrabold uppercase tracking-[0.12em] text-[var(--rack-ink-soft)]">{wardrobe.kind.replace('_', ' ')} / {wardrobe.status}</p>
                      </div>
                      <InspirationIntake wardrobes={normalizedWardrobes} defaultWardrobeId={String(wardrobe._id)} />
                    </div>
                    {wardrobe.description && <p className="mt-4 max-w-2xl text-sm font-medium leading-relaxed text-[var(--rack-ink)]">{wardrobe.description}</p>}
                    {wardrobe.moodWords && wardrobe.moodWords.length > 0 && <p className="mt-3 text-xs font-bold uppercase tracking-[0.1em] text-[var(--rack-ink-soft)]">{wardrobe.moodWords.join(' / ')}</p>}

                    <div className="mt-5 border-t border-[var(--rack-line)] pt-4">
                      <div className="flex items-center justify-between gap-3"><h4 className="text-sm font-extrabold text-[var(--rack-ink)]">Inspiration</h4><span className="text-xs font-bold text-[var(--rack-ink-soft)]">{locusInspiration.length} saved</span></div>
                      {locusInspiration.length > 0 ? (
                        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                          {locusInspiration.map((item) => (
                            <div key={String(item._id)} className="border border-[var(--rack-line)] bg-[var(--rack-action-wash)] p-2">
                              {item.imageUrl ? <Image src={item.imageUrl} alt={item.description ?? item.category ?? 'Saved inspiration'} width={360} height={300} className="aspect-[4/3] w-full object-cover" /> : <div className="grid aspect-[4/3] place-items-center bg-[var(--rack-wash)] text-sm font-semibold text-[var(--rack-ink-soft)]"><ExternalLink className="h-5 w-5" /></div>}
                              <p className="mt-2 text-[10px] font-extrabold uppercase tracking-[0.14em] text-[var(--rack-ink-soft)]">Inspiration · not owned</p>
                              <p className="mt-1 line-clamp-2 text-sm font-semibold text-[var(--rack-ink)]">{item.description ?? item.category ?? item.sourceUrl ?? 'Online reference'}</p>
                              {item.sourceUrl && <a href={item.sourceUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-[var(--rack-ink)] underline underline-offset-4">View source <ExternalLink className="h-3 w-3" /></a>}
                            </div>
                          ))}
                        </div>
                      ) : <p className="mt-3 text-sm font-medium text-[var(--rack-ink-soft)]">No inspiration saved yet. Add a photo or source URL to make this direction concrete.</p>}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
