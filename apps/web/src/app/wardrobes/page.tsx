'use client';

import { FormEvent, useMemo, useState } from 'react';
import Image from 'next/image';
import { useUser } from '@clerk/nextjs';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import { ArrowRight, ExternalLink, FolderHeart, Plus, X } from 'lucide-react';
import { createTraceContext } from '@/lib/trace';
import { refreshStyleBioAction } from '@/app/actions/wardrobe';
import InspirationIntake from '@/components/InspirationIntake';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function WardrobesPage() {
  const { isLoaded, isSignedIn } = useUser();
  const wardrobes = useQuery(api.wardrobes.listWardrobes, isLoaded && isSignedIn ? {} : 'skip');
  const closetItems = useQuery(api.wardrobe.listWardrobeItems, isLoaded && isSignedIn ? {} : 'skip');
  const createWardrobe = useMutation(api.wardrobes.createWardrobe);
  const addItem = useMutation(api.wardrobes.addItemToWardrobe);
  const removeItem = useMutation(api.wardrobes.removeItemFromWardrobe);

  const [selectedLocusId, setSelectedLocusId] = useState<string | null>(null);
  const selectedLocus = useMemo(
    () => wardrobes?.find((locus) => String(locus._id) === selectedLocusId) ?? wardrobes?.[0] ?? null,
    [selectedLocusId, wardrobes]
  );
  const detail = useQuery(
    api.wardrobes.getWardrobeDetail,
    selectedLocus ? { wardrobeId: selectedLocus._id } : 'skip'
  );
  const inspirations = useQuery(
    api.candidates.listInspirationByWardrobe,
    selectedLocus ? { wardrobeId: selectedLocus._id } : 'skip'
  );

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<'idle' | 'saving' | 'error'>('idle');
  const [error, setError] = useState('');

  const memberIds = useMemo(
    () => new Set((detail?.items ?? []).map((membership) => String(membership.item.id))),
    [detail]
  );
  const availableItems = useMemo(
    () => (closetItems ?? []).filter((item) => !memberIds.has(String(item.id))).slice(0, 12),
    [closetItems, memberIds]
  );

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!name.trim()) return;
    setStatus('saving');
    setError('');

    try {
      const trace = createTraceContext();
      const result = await createWardrobe({
        name: name.trim(),
        kind: 'locus',
        ...(description.trim() ? { description: description.trim() } : {}),
        ...trace,
      });
      setName('');
      setDescription('');
      setSelectedLocusId(String(result.id));
      setStatus('idle');
      void refreshStyleBioAction().catch((refreshError) => console.warn('style_bio.background_refresh.failed', refreshError));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not create this locus');
      setStatus('error');
    }
  };

  const addToLocus = async (itemId: string, membershipKind = 'owned') => {
    if (!selectedLocus) return;
    const trace = createTraceContext();
    await addItem({
      wardrobeId: selectedLocus._id,
      itemId: itemId as never,
      membershipKind,
      ...trace,
    });
    void refreshStyleBioAction().catch((refreshError) => console.warn('style_bio.background_refresh.failed', refreshError));
  };

  const removeFromLocus = async (itemId: string) => {
    if (!selectedLocus) return;
    await removeItem({ wardrobeId: selectedLocus._id, itemId: itemId as never });
    void refreshStyleBioAction().catch((refreshError) => console.warn('style_bio.background_refresh.failed', refreshError));
  };

  if (!isLoaded) return <div className="p-8 text-sm font-semibold">Loading collections…</div>;

  if (!isSignedIn) {
    return (
      <main className="mx-auto w-full max-w-[1320px] px-6 py-10 lg:px-10">
        <Card className="rack-panel rack-panel--shell rounded-none py-0">
          <CardContent className="px-0">
            <h1 className="text-4xl font-extrabold text-[#241426]">Collections</h1>
            <p className="mt-3 text-sm font-medium text-[#56345c]">Sign in to shape the collections that matter to you.</p>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-[1320px] space-y-6 px-6 py-10 lg:px-10">
      <section className="grid gap-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <Card className="rack-panel rack-panel--shell rounded-none py-0">
          <CardContent className="px-0">
            <p className="text-sm font-semibold text-[#56345c]">Your point of view</p>
            <h1 className="mt-2 text-4xl font-extrabold text-[#241426]">Collections</h1>
            <p className="mt-3 max-w-xl text-sm font-medium leading-relaxed text-[#56345c]">
              Make a collection for anything you want to explore. Keep pieces you own beside references that are
              shaping your next move.
            </p>
          </CardContent>
        </Card>

        <Card className="rack-panel rack-panel--action rounded-none py-0">
          <CardContent className="px-0">
            <form className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto] sm:items-end" onSubmit={submit}>
              <div>
                <Label htmlFor="locus-name" className="text-sm font-semibold text-[#241426]">Name</Label>
                <Input id="locus-name" value={name} onChange={(event) => setName(event.target.value)} className="mt-2 rounded-none border border-[var(--rack-line)] bg-white" placeholder="Quietly tailored" />
              </div>
              <div>
                <Label htmlFor="locus-purpose" className="text-sm font-semibold text-[#241426]">What is this helping you decide?</Label>
                <Input id="locus-purpose" value={description} onChange={(event) => setDescription(event.target.value)} className="mt-2 rounded-none border border-[var(--rack-line)] bg-white" placeholder="A softer weekday uniform" />
              </div>
              <Button type="submit" disabled={status === 'saving' || !name.trim()} className="h-10 rounded-none border border-[var(--rack-line)] bg-[#DCE66E] px-4 text-sm font-extrabold text-[#241426] shadow-[2px_2px_0_var(--rack-panel-shadow)]">
                <Plus className="h-4 w-4" /> {status === 'saving' ? 'Saving…' : 'Create'}
              </Button>
            </form>
            {status === 'error' && <p className="mt-3 text-sm font-semibold text-[#B93267]">{error}</p>}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-[minmax(240px,0.7fr)_minmax(0,1.3fr)]">
        <div className="space-y-3">
          <h2 className="text-lg font-extrabold text-[#241426]">Your collections</h2>
          {(wardrobes ?? []).length === 0 ? (
            <div className="rack-empty-state text-sm font-medium text-[#56345c]">Start with a phrase, a trip, or a feeling you want to keep in view.</div>
          ) : (
            (wardrobes ?? []).map((locus) => {
              const active = String(locus._id) === String(selectedLocus?._id);
              return (
                <button key={String(locus._id)} type="button" onClick={() => setSelectedLocusId(String(locus._id))} className={`w-full border p-4 text-left transition ${active ? 'border-[#241426] bg-[#DCE66E] shadow-[3px_3px_0_var(--rack-panel-shadow)]' : 'border-[var(--rack-line)] bg-white hover:bg-[var(--rack-wash)]'}`}>
                  <span className="flex items-center justify-between gap-3 text-base font-extrabold text-[#241426]">
                    {locus.name} <ArrowRight className="h-4 w-4 shrink-0" />
                  </span>
                  {locus.description && <span className="mt-2 block text-sm font-medium leading-relaxed text-[#56345c]">{locus.description}</span>}
                </button>
              );
            })
          )}
        </div>

        <Card className="rack-panel rounded-none py-0">
          <CardContent className="px-0">
            {!selectedLocus ? (
              <div className="flex min-h-64 items-center justify-center text-sm font-medium text-[#56345c]">Choose or create a collection to start arranging it.</div>
            ) : (
              <div className="space-y-7">
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--rack-line)] pb-5">
                  <div>
                    <div className="flex items-center gap-2 text-[#241426]"><FolderHeart className="h-5 w-5" /><h2 className="text-2xl font-extrabold">{selectedLocus.name}</h2></div>
                    <p className="mt-2 max-w-2xl text-sm font-medium leading-relaxed text-[#56345c]">{selectedLocus.description || 'A collection you can shape as your point of view changes.'}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3"><span className="border border-[var(--rack-line)] bg-[var(--rack-wash)] px-3 py-1 text-xs font-semibold text-[#241426]">{detail?.items.length ?? 0} owned · {inspirations?.length ?? 0} inspiration</span><InspirationIntake collectionId={String(selectedLocus._id)} collectionName={selectedLocus.name} /></div>
                </div>

                <div className="border-t border-[var(--rack-line)] pt-6">
                  <div className="flex items-end justify-between gap-3"><div><h3 className="text-base font-extrabold text-[#241426]">Inspiration</h3><p className="mt-1 text-sm font-medium text-[#56345c]">References shaping this point of view. These are never treated as owned pieces.</p></div><span className="text-xs font-semibold text-[#56345c]">{inspirations?.length ?? 0} saved</span></div>
                  {(inspirations ?? []).length > 0 ? <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{(inspirations ?? []).map((item) => <article key={String(item._id)} className="overflow-hidden border border-[var(--rack-line)] bg-[var(--rack-action-wash)]"><div className="relative aspect-[4/3] bg-[var(--rack-wash)]">{item.imageUrl ? <Image src={item.imageUrl} alt={item.description ?? item.category ?? 'Saved inspiration'} fill sizes="(max-width: 768px) 50vw, 220px" className="object-cover" /> : <div className="grid h-full place-items-center text-[#56345c]"><ExternalLink className="h-5 w-5" /></div>}</div><div className="p-3"><p className="text-[10px] font-extrabold uppercase tracking-[.14em] text-[#56345c]">Inspiration · not owned</p><p className="mt-1 line-clamp-2 text-sm font-semibold text-[#241426]">{item.description ?? item.category ?? item.sourceUrl ?? 'Reference'}</p>{item.sourceUrl && <a href={item.sourceUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-[#241426] underline underline-offset-4">View source <ExternalLink className="h-3 w-3" /></a>}</div></article>)}</div> : <div className="mt-4 border border-dashed border-[var(--rack-line)] bg-[var(--rack-wash)] p-4 text-sm font-medium text-[#56345c]">Add a try-on, photo, or source URL to make this direction more concrete.</div>}
                </div>

                <div>
                  <h3 className="text-base font-extrabold text-[#241426]">In this collection</h3>
                  <p className="mt-1 text-sm font-medium text-[#56345c]">Mark how each piece relates to this idea. You can change your mind at any time.</p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {(detail?.items ?? []).map((membership) => (
                      <article key={String(membership._id)} className="overflow-hidden border border-[var(--rack-line)] bg-white">
                        <div className="relative aspect-square bg-[var(--rack-wash)]"><Image src={membership.item.imageUrl} alt={membership.item.description ?? membership.item.category ?? 'Collection item'} fill sizes="(max-width: 768px) 50vw, 220px" className="object-cover" /></div>
                        <div className="space-y-3 p-3">
                          <p className="text-sm font-semibold text-[#241426]">{membership.item.category ?? 'Untitled piece'}</p>
                          <div className="flex items-center gap-2">
                            <select aria-label={`Relationship for ${membership.item.category ?? 'item'}`} value={membership.membershipKind === 'owned' || membership.membershipKind === 'included' ? 'owned' : 'inspiration'} onChange={(event) => void addToLocus(String(membership.item.id), event.target.value)} className="min-h-9 flex-1 border border-[var(--rack-line)] bg-white px-2 text-xs font-semibold text-[#241426]">
                              <option value="owned">Owned</option><option value="inspiration">Inspiration</option>
                            </select>
                            <button type="button" aria-label={`Remove ${membership.item.category ?? 'item'} from collection`} onClick={() => void removeFromLocus(String(membership.item.id))} className="grid h-9 w-9 place-items-center border border-[var(--rack-line)] bg-white text-[#B93267] hover:bg-[var(--rack-danger-wash)]"><X className="h-4 w-4" /></button>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                  {detail && detail.items.length === 0 && <p className="mt-4 border border-dashed border-[var(--rack-line)] bg-[var(--rack-wash)] p-4 text-sm font-medium text-[#56345c]">Add a piece below to give this collection a starting point.</p>}
                </div>

                <div>
                  <h3 className="text-base font-extrabold text-[#241426]">Add from your closet</h3>
                  <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-5">
                    {availableItems.map((item) => (
                      <button key={String(item.id)} type="button" onClick={() => void addToLocus(String(item.id))} className="group relative overflow-hidden border border-[var(--rack-line)] bg-white text-left hover:-translate-y-0.5 hover:shadow-[3px_3px_0_var(--rack-panel-shadow)]">
                        <div className="relative aspect-square bg-[var(--rack-wash)]"><Image src={item.imageUrl ?? ''} alt={item.description ?? item.category ?? 'Closet item'} fill sizes="160px" className="object-cover" /></div>
                        <span className="block truncate px-2 py-2 text-xs font-semibold text-[#241426]">{item.category ?? 'Add piece'}</span>
                        <span className="absolute right-2 top-2 grid h-7 w-7 place-items-center border border-[var(--rack-line)] bg-[#DCE66E] text-[#241426]"><Plus className="h-4 w-4" /></span>
                      </button>
                    ))}
                  </div>
                  {availableItems.length === 0 && <p className="mt-3 text-sm font-medium text-[#56345c]">Everything in your closet is already represented here.</p>}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
