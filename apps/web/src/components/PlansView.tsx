'use client';

import { FormEvent, useMemo, useState } from 'react';
import Image from 'next/image';
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

export default function PlansView() {
  const plans = useQuery(api.wardrobes.listWardrobes, {});
  const closetItems = useQuery(api.wardrobe.listWardrobeItems, {});
  const createPlan = useMutation(api.wardrobes.createWardrobe);
  const addItem = useMutation(api.wardrobes.addItemToWardrobe);
  const removeItem = useMutation(api.wardrobes.removeItemFromWardrobe);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const selectedPlan = useMemo(
    () => plans?.find((plan) => String(plan._id) === selectedPlanId) ?? plans?.[0] ?? null,
    [plans, selectedPlanId]
  );
  const detail = useQuery(api.wardrobes.getWardrobeDetail, selectedPlan ? { wardrobeId: selectedPlan._id } : 'skip');
  const inspirations = useQuery(api.candidates.listInspirationByWardrobe, selectedPlan ? { wardrobeId: selectedPlan._id } : 'skip');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<'idle' | 'saving' | 'error'>('idle');
  const [error, setError] = useState('');
  const memberIds = useMemo(() => new Set((detail?.items ?? []).map((membership) => String(membership.item.id))), [detail]);
  const availableItems = useMemo(() => (closetItems ?? []).filter((item) => !memberIds.has(String(item.id))).slice(0, 12), [closetItems, memberIds]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!name.trim()) return;
    setStatus('saving');
    setError('');
    try {
      const result = await createPlan({ name: name.trim(), kind: 'locus', ...(description.trim() ? { description: description.trim() } : {}), ...createTraceContext() });
      setName('');
      setDescription('');
      setSelectedPlanId(String(result.id));
      setStatus('idle');
      void refreshStyleBioAction().catch((refreshError) => console.warn('style_bio.background_refresh.failed', refreshError));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not create this plan');
      setStatus('error');
    }
  };

  const addToPlan = async (itemId: string, membershipKind = 'owned') => {
    if (!selectedPlan) return;
    await addItem({ wardrobeId: selectedPlan._id, itemId: itemId as never, membershipKind, ...createTraceContext() });
    void refreshStyleBioAction().catch((refreshError) => console.warn('style_bio.background_refresh.failed', refreshError));
  };

  const removeFromPlan = async (itemId: string) => {
    if (!selectedPlan) return;
    await removeItem({ wardrobeId: selectedPlan._id, itemId: itemId as never });
    void refreshStyleBioAction().catch((refreshError) => console.warn('style_bio.background_refresh.failed', refreshError));
  };

  return (
    <div id="plans" className="scroll-mt-24 space-y-6">
      <section className="grid gap-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <Card className="rack-panel rack-panel--shell rounded-none py-0">
          <CardContent className="px-0">
            <p className="text-sm font-semibold text-[#56345c]">Look ahead</p>
            <h2 className="mt-2 text-3xl font-extrabold text-[#241426]">Plans</h2>
            <p className="mt-3 max-w-xl text-sm font-medium leading-relaxed text-[#56345c]">Bring owned pieces and inspiration together for a trip, occasion, capsule, or idea you want to try.</p>
          </CardContent>
        </Card>
        <Card className="rack-panel rack-panel--action rounded-none py-0">
          <CardContent className="px-0">
            <form className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto] sm:items-end" onSubmit={submit}>
              <div><Label htmlFor="plan-name" className="text-sm font-semibold text-[#241426]">Name</Label><Input id="plan-name" value={name} onChange={(event) => setName(event.target.value)} className="mt-2 rounded-none border border-[var(--rack-line)] bg-white" placeholder="Weekend in Montreal" /></div>
              <div><Label htmlFor="plan-purpose" className="text-sm font-semibold text-[#241426]">What are you planning for?</Label><Input id="plan-purpose" value={description} onChange={(event) => setDescription(event.target.value)} className="mt-2 rounded-none border border-[var(--rack-line)] bg-white" placeholder="Three easy looks for changing weather" /></div>
              <Button type="submit" disabled={status === 'saving' || !name.trim()} className="h-10 rounded-none border border-[var(--rack-line)] bg-[#DCE66E] px-4 text-sm font-extrabold text-[#241426] shadow-[2px_2px_0_var(--rack-panel-shadow)]"><Plus className="h-4 w-4" /> {status === 'saving' ? 'Saving…' : 'Create plan'}</Button>
            </form>
            {status === 'error' && <p role="alert" className="mt-3 text-sm font-semibold text-[#B93267]">{error}</p>}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-[minmax(240px,0.7fr)_minmax(0,1.3fr)]">
        <div className="space-y-3">
          <h3 className="text-lg font-extrabold text-[#241426]">Your plans</h3>
          {plans === undefined ? <div className="rack-empty-state text-sm font-medium text-[#56345c]">Loading plans…</div> : plans.length === 0 ? <div className="rack-empty-state text-sm font-medium text-[#56345c]">Start with a trip, occasion, capsule, or feeling you want to explore.</div> : plans.map((plan) => {
            const active = String(plan._id) === String(selectedPlan?._id);
            return <button key={String(plan._id)} type="button" onClick={() => setSelectedPlanId(String(plan._id))} aria-pressed={active} className={`w-full border p-4 text-left transition ${active ? 'border-[#241426] bg-[#DCE66E] shadow-[3px_3px_0_var(--rack-panel-shadow)]' : 'border-[var(--rack-line)] bg-white hover:bg-[var(--rack-wash)]'}`}><span className="flex items-center justify-between gap-3 text-base font-extrabold text-[#241426]">{plan.name} <ArrowRight className="h-4 w-4 shrink-0" /></span>{plan.description && <span className="mt-2 block text-sm font-medium leading-relaxed text-[#56345c]">{plan.description}</span>}</button>;
          })}
        </div>

        <Card className="rack-panel rounded-none py-0">
          <CardContent className="px-0">
            {!selectedPlan ? <div className="flex min-h-64 items-center justify-center text-sm font-medium text-[#56345c]">Create a plan to start arranging it.</div> : (
              <div className="space-y-7">
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--rack-line)] pb-5">
                  <div><div className="flex items-center gap-2 text-[#241426]"><FolderHeart className="h-5 w-5" /><h3 className="text-2xl font-extrabold">{selectedPlan.name}</h3></div><p className="mt-2 max-w-2xl text-sm font-medium leading-relaxed text-[#56345c]">{selectedPlan.description || 'A plan you can shape as your needs change.'}</p></div>
                  <div className="flex flex-wrap items-center gap-3"><span className="border border-[var(--rack-line)] bg-[var(--rack-wash)] px-3 py-1 text-xs font-semibold text-[#241426]">{detail?.items.length ?? 0} owned · {inspirations?.length ?? 0} inspiration</span><InspirationIntake collectionId={String(selectedPlan._id)} collectionName={selectedPlan.name} /></div>
                </div>

                <div>
                  <div className="flex items-end justify-between gap-3"><div><h4 className="text-base font-extrabold text-[#241426]">Inspiration</h4><p className="mt-1 text-sm font-medium text-[#56345c]">References shaping this plan. These are never treated as owned pieces.</p></div><span className="text-xs font-semibold text-[#56345c]">{inspirations?.length ?? 0} saved</span></div>
                  {(inspirations ?? []).length > 0 ? <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{(inspirations ?? []).map((item) => <article key={String(item._id)} className="overflow-hidden border border-[var(--rack-line)] bg-[var(--rack-action-wash)]"><div className="relative aspect-[4/3] bg-[var(--rack-wash)]">{item.imageUrl ? <Image src={item.imageUrl} alt={item.description ?? item.category ?? 'Saved inspiration'} fill sizes="(max-width: 768px) 50vw, 220px" className="object-cover" /> : <div className="grid h-full place-items-center text-[#56345c]"><ExternalLink className="h-5 w-5" /></div>}</div><div className="p-3"><p className="text-[10px] font-extrabold uppercase tracking-[.14em] text-[#56345c]">Inspiration · not owned</p><p className="mt-1 line-clamp-2 text-sm font-semibold text-[#241426]">{item.description ?? item.category ?? item.sourceUrl ?? 'Reference'}</p>{item.sourceUrl && <a href={item.sourceUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-[#241426] underline underline-offset-4">View source <ExternalLink className="h-3 w-3" /></a>}</div></article>)}</div> : <div className="mt-4 border border-dashed border-[var(--rack-line)] bg-[var(--rack-wash)] p-4 text-sm font-medium text-[#56345c]">Add a try-on, photo, or source URL to make this plan more concrete.</div>}
                </div>

                <div>
                  <h4 className="text-base font-extrabold text-[#241426]">In this plan</h4><p className="mt-1 text-sm font-medium text-[#56345c]">Keep owned pieces beside inspiration without changing what is in your Wardrobe.</p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{(detail?.items ?? []).map((membership) => <article key={String(membership._id)} className="overflow-hidden border border-[var(--rack-line)] bg-white"><div className="relative aspect-square bg-[var(--rack-wash)]"><Image src={membership.item.imageUrl} alt={membership.item.description ?? membership.item.category ?? 'Plan item'} fill sizes="(max-width: 768px) 50vw, 220px" className="object-cover" /></div><div className="space-y-3 p-3"><p className="text-sm font-semibold text-[#241426]">{membership.item.category ?? 'Untitled piece'}</p><div className="flex items-center gap-2"><select aria-label={`Relationship for ${membership.item.category ?? 'item'}`} value={membership.membershipKind === 'owned' || membership.membershipKind === 'included' ? 'owned' : 'inspiration'} onChange={(event) => void addToPlan(String(membership.item.id), event.target.value)} className="min-h-9 flex-1 border border-[var(--rack-line)] bg-white px-2 text-xs font-semibold text-[#241426]"><option value="owned">Owned</option><option value="inspiration">Inspiration</option></select><button type="button" aria-label={`Remove ${membership.item.category ?? 'item'} from plan`} onClick={() => void removeFromPlan(String(membership.item.id))} className="grid h-9 w-9 place-items-center border border-[var(--rack-line)] bg-white text-[#B93267] hover:bg-[var(--rack-danger-wash)]"><X className="h-4 w-4" /></button></div></div></article>)}</div>
                  {detail && detail.items.length === 0 && <p className="mt-4 border border-dashed border-[var(--rack-line)] bg-[var(--rack-wash)] p-4 text-sm font-medium text-[#56345c]">Add a piece below to give this plan a starting point.</p>}
                </div>

                <div>
                  <h4 className="text-base font-extrabold text-[#241426]">Add from your Wardrobe</h4>
                  <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-5">{availableItems.map((item) => <button key={String(item.id)} type="button" onClick={() => void addToPlan(String(item.id))} className="group relative overflow-hidden border border-[var(--rack-line)] bg-white text-left hover:-translate-y-0.5 hover:shadow-[3px_3px_0_var(--rack-panel-shadow)]"><div className="relative aspect-square bg-[var(--rack-wash)]"><Image src={item.imageUrl ?? ''} alt={item.description ?? item.category ?? 'Wardrobe item'} fill sizes="160px" className="object-cover" /></div><span className="block truncate px-2 py-2 text-xs font-semibold text-[#241426]">{item.category ?? 'Add piece'}</span><span className="absolute right-2 top-2 grid h-7 w-7 place-items-center border border-[var(--rack-line)] bg-[#DCE66E] text-[#241426]"><Plus className="h-4 w-4" /></span></button>)}</div>
                  {availableItems.length === 0 && <p className="mt-3 text-sm font-medium text-[#56345c]">Everything in your Wardrobe is already represented here.</p>}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
