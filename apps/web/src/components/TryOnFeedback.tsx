'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import { Check, Layers3, Save } from 'lucide-react';
import { refreshStyleBioAction, saveInspirationAction } from '@/app/actions/wardrobe';
import type { CompatibilityCheckResult } from '@/hooks/useCompatibilityCheck';
import { createTraceContext } from '@/lib/trace';
import { userFacingErrorMessage } from '@/lib/userFacingError';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Either, promiseEffect, runBackground, runEffectResult } from '@/lib/effect-result';

export default function TryOnFeedback({ result, previewUrl }: { result: CompatibilityCheckResult; previewUrl?: string | null }) {
  const plans = useQuery(api.wardrobes.listWardrobes, {});
  const [planId, setPlanId] = useState('');
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const activePlanId = planId || String(plans?.[0]?._id ?? '');
  const selected = useMemo(() => plans?.find((plan) => String(plan._id) === activePlanId), [activePlanId, plans]);
  const evaluation = result.evaluation;
  const verdict = !evaluation ? 'A new direction' : evaluation.score >= 75 ? 'Strong closet fit' : evaluation.score >= 50 ? 'Useful with limits' : 'Harder to integrate';
  const tone = !evaluation || evaluation.score >= 50 ? 'rack-panel--success' : 'rack-panel--danger';

  const save = async () => {
    if (!activePlanId) return;
    setSaveState('saving');
    const outcome = await runEffectResult(
      promiseEffect(() => saveInspirationAction({
        wardrobeId: activePlanId,
        storageId: result.storageId,
        candidate: result.candidate,
        ...createTraceContext(),
      }))
    );
    if (Either.isLeft(outcome)) {
      setSaveState('error');
      setMessage(userFacingErrorMessage(outcome.left, 'Could not save this inspiration.'));
      return;
    }
    setSaveState('saved');
    setMessage(`Saved to ${selected?.name ?? 'your plan'} as inspiration.`);
    runBackground('style_bio.background_refresh.failed', () => refreshStyleBioAction());
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-5 md:grid-cols-[minmax(180px,.7fr)_minmax(0,1.3fr)]">
        <div className="space-y-3">
          {previewUrl && <Image src={previewUrl} alt={`Try-on candidate: ${result.candidate.category}`} width={640} height={800} unoptimized className="aspect-[4/5] w-full border border-[var(--rack-line)] bg-[var(--rack-wash)] object-cover shadow-[3px_3px_0_var(--rack-panel-shadow)]" />}
          <div className="border border-[var(--rack-line)] bg-white p-3">
            <p className="text-xs font-extrabold uppercase tracking-[.14em] text-[#56345c]">Candidate · not in your Wardrobe</p>
            <p className="mt-2 text-sm font-semibold text-[#241426]">{result.candidate.description}</p>
            <p className="mt-2 text-xs font-medium text-[#56345c]">Saved in your Fits history as a try-on.</p>
          </div>
        </div>
        <div className="space-y-4">
          <section className={`rack-panel ${tone}`}>
            <div className="flex items-end justify-between gap-3"><div><p className="text-xs font-extrabold uppercase tracking-[.14em] text-[#56345c]">Closet compatibility</p><h3 className="mt-1 text-2xl font-extrabold text-[#241426]">{verdict}</h3></div>{evaluation && <p className="font-heading text-5xl font-black text-[#241426]">{evaluation.score}<span className="text-lg">/100</span></p>}</div>
            <p className="mt-4 text-sm font-medium leading-relaxed text-[#241426]">{evaluation?.explanation ?? result.message}</p>
          </section>
          <section className="border border-[var(--rack-line)] bg-white p-4 shadow-[3px_3px_0_var(--rack-panel-shadow)]">
            <div className="flex items-center gap-2"><Layers3 className="h-4 w-4" /><h4 className="text-sm font-extrabold text-[#241426]">Closet anchors</h4></div>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">{result.similarItems.slice(0, 3).map((item) => <article key={String(item.id)} className="border border-[var(--rack-line)] bg-[var(--rack-paper)] p-2">{item.imageUrl && <Image src={item.imageUrl} alt={item.description ?? item.category ?? 'Closet item'} width={220} height={220} className="aspect-square w-full object-cover" />}<p className="mt-2 truncate text-xs font-extrabold text-[#241426]">{item.category ?? 'Closet item'}</p><p className="text-[11px] font-semibold text-[#56345c]">{Math.round(item.similarity * 100)}% similar</p></article>)}</div>
          </section>
        </div>
      </div>
      <section className="border border-[var(--rack-line)] bg-[var(--rack-action-wash)] p-4 shadow-[3px_3px_0_var(--rack-panel-shadow)]">
        <h4 className="text-sm font-extrabold text-[#241426]">Keep the idea, not the item</h4>
        <p className="mt-1 text-sm font-medium text-[#56345c]">Save the useful direction to a Plan without adding it to your Wardrobe.</p>
        {plans && plans.length > 0 ? <div className="mt-4 flex flex-wrap items-end gap-3"><div className="min-w-52"><Label htmlFor="try-on-plan">Plan</Label><select id="try-on-plan" value={activePlanId} onChange={(event) => setPlanId(event.target.value)} className="mt-2 h-10 w-full border border-[var(--rack-line)] bg-white px-3 text-sm font-semibold">{plans.map((plan) => <option key={String(plan._id)} value={String(plan._id)}>{plan.name}</option>)}</select></div><Button type="button" onClick={save} disabled={saveState === 'saving' || saveState === 'saved'} className="h-10 rounded-none border border-[var(--rack-line)] bg-[#DCE66E] text-[#241426]">{saveState === 'saved' ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}{saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Saved' : 'Save to plan'}</Button>{message && <p role={saveState === 'error' ? 'alert' : 'status'} className={`text-sm font-semibold ${saveState === 'error' ? 'text-[#B93267]' : 'text-[#3F7C5D]'}`}>{message}</p>}</div> : <div className="mt-4 flex items-center justify-between gap-3 border border-[var(--rack-line)] bg-white p-3"><p className="text-sm font-semibold">Create a Plan before saving inspiration.</p><Button asChild variant="outline" className="rounded-none"><Link href="/fits?view=plans#plans">Create plan</Link></Button></div>}
      </section>
    </div>
  );
}
