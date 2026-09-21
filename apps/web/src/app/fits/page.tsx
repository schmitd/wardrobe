'use client';


import Image from 'next/image';
import Link from 'next/link';
import { Suspense, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { usePaginatedQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import GarmentObservationReview from '@/components/GarmentObservationReview';
import DayPlanner from '@/components/DayPlanner';
import WornOutfits from '@/components/WornOutfits';

const dayKey = (date: Date | number) => {
  const value = new Date(date);
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
};

export default function FitsPage() {
  return <Suspense fallback={<div className="p-8 text-sm font-semibold">Loading fits…</div>}><FitsContent /></Suspense>;
}

function FitsContent() {
  const searchParams = useSearchParams();
  const activeView = searchParams.get('view') === 'diary' ? 'diary' : 'plan';
  const { isLoaded, isSignedIn } = useUser();
  const history = usePaginatedQuery(api.fitChecks.pageFitChecks, isLoaded && isSignedIn ? {} : 'skip', { initialNumItems: 20 });
  const fitChecks = history.results;
  const dailyChecks = useMemo(() => (fitChecks ?? []).filter((check) => check.type === 'daily_fit_check'), [fitChecks]);
  const checkByDay = useMemo(() => new Map(dailyChecks.map((check) => [dayKey(check.createdAt), check])), [dailyChecks]);
  const days = useMemo(() => Array.from({ length: 84 }, (_, index) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - (83 - index));
    return date;
  }), []);

  if (!isLoaded) return <div className="p-8 text-sm font-semibold">Loading fits…</div>;
  if (!isSignedIn) {
    return <main className="mx-auto w-full max-w-[1320px] px-6 py-10 lg:px-10"><Card className="rack-panel rack-panel--shell rounded-none py-0"><CardContent className="px-0"><h1 className="text-4xl font-extrabold text-[#241426]">Fits</h1><p className="mt-3 text-sm font-medium text-[#56345c]">Sign in to keep a visual record of what you wear.</p></CardContent></Card></main>;
  }

  return (
    <main className="mx-auto w-full max-w-[1320px] space-y-5 px-4 py-5 pb-28 sm:px-6 lg:px-10">
      <section>
        <h1 className="text-3xl font-bold text-[#241426]">Fits</h1>
        <nav className="mt-2 flex gap-3 border-b border-[#d8c9dc]" aria-label="Fits views">
          <Link href="/fits?view=plan" aria-current={activeView === 'plan' ? 'page' : undefined} className={`flex min-h-11 items-center border-b-2 px-4 text-sm font-semibold ${activeView === 'plan' ? 'border-[#241426] text-[#241426]' : 'border-transparent text-[#56345c]'}`}>Plan</Link>
          <Link href="/fits?view=diary" aria-current={activeView === 'diary' ? 'page' : undefined} className={`flex min-h-11 items-center border-b-2 px-4 text-sm font-semibold ${activeView === 'diary' ? 'border-[#241426] text-[#241426]' : 'border-transparent text-[#56345c]'}`}>Diary</Link>
        </nav>
      </section>

      {activeView === 'plan' ? <DayPlanner /> : <div id="fits-diary" className="space-y-6">
      <WornOutfits />
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

      <section><h2 className="text-xl font-extrabold text-[#241426]">Recent fits</h2>{history.status === 'CanLoadMore' && <Button variant="outline" onClick={() => history.loadMore(20)}>Load earlier fits</Button>}<div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{(fitChecks ?? []).map((fitCheck) => <article id={`fit-${String(fitCheck._id)}`} key={String(fitCheck._id)} className="overflow-hidden border border-[var(--rack-line)] bg-white shadow-[3px_3px_0_var(--rack-panel-shadow)]"><div className="relative aspect-[4/3] bg-[var(--rack-wash)]">{fitCheck.imageUrl && <Image src={fitCheck.imageUrl} alt={fitCheck.transcription ?? fitCheck.type} fill sizes="(max-width: 768px) 100vw, 33vw" className="object-cover" />}</div><div className="p-4"><p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#56345c]">{fitCheck.type === 'try_on' ? 'Try on' : 'Fit check'} · {new Date(fitCheck.createdAt).toLocaleDateString()}</p><p className="mt-2 text-sm font-medium leading-relaxed text-[#241426]">{fitCheck.transcription ?? fitCheck.description ?? 'No notes yet.'}</p>{fitCheck.type === 'daily_fit_check' && <GarmentObservationReview observations={fitCheck.observations} />}</div></article>)}</div></section>
      </div>}
    </main>
  );
}
