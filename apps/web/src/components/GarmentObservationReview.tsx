'use client';

import Image from 'next/image';
import { useState } from 'react';
import { useMutation } from 'convex/react';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { Check, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { userFacingErrorMessage } from '@/lib/userFacingError';

type Candidate = {
  id: Id<'wardrobeItems'>;
  imageUrl: string | null;
  category: string | null;
  description: string | null;
  score: number;
};

type Observation = {
  _id: Id<'garmentObservations'>;
  category: string;
  description: string;
  cropUrl: string | null;
  resolutionStatus: 'auto_matched' | 'needs_confirmation' | 'confirmed' | 'unresolved' | 'promoted_new' | 'rejected';
  matchScore?: number;
  candidates: Candidate[];
};

export default function GarmentObservationReview({ observations }: { observations: Observation[] }) {
  const resolveObservation = useMutation(api.fitChecks.resolveGarmentObservation);
  const promoteObservation = useMutation(api.fitChecks.promoteGarmentObservation);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (id: Id<'garmentObservations'>, operation: () => Promise<unknown>) => {
    setPendingId(String(id));
    setError(null);
    try {
      await operation();
    } catch (caught) {
      setError(userFacingErrorMessage(caught, 'Could not save that garment match.'));
    } finally {
      setPendingId(null);
    }
  };

  if (observations.length === 0) return null;

  return (
    <div className="mt-4 space-y-4 border-t border-[var(--rack-line)] pt-4">
      <div>
        <p className="text-xs font-extrabold uppercase tracking-[.14em] text-[#56345c]">Detected pieces</p>
        <p className="mt-1 text-xs font-medium text-[#56345c]">Wardrobe asks only when a repeat match stays genuinely ambiguous.</p>
      </div>
      {error && <p role="alert" className="text-xs font-semibold text-[#B93267]">{error}</p>}
      <div className="space-y-3">
        {observations.map((observation) => {
          const resolved = ['auto_matched', 'confirmed', 'promoted_new'].includes(observation.resolutionStatus);
          const needsConfirmation = observation.resolutionStatus === 'needs_confirmation';
          return (
            <article key={String(observation._id)} className="border border-[var(--rack-line)] bg-[var(--rack-paper)] p-3">
              <div className="flex gap-3">
                <div className="relative h-20 w-16 shrink-0 overflow-hidden border border-[var(--rack-line)] bg-white">
                  {observation.cropUrl && <Image src={observation.cropUrl} alt={observation.description} fill sizes="64px" className="object-cover" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-extrabold text-[#241426]">{observation.category}</p>
                    {resolved && <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-[#3F7C5D]"><Check className="h-3 w-3" />{observation.resolutionStatus === 'promoted_new' ? 'Added as new' : 'Repeat recognized'}</span>}
                    {observation.resolutionStatus === 'unresolved' && <span className="text-[11px] font-extrabold text-[#56345c]">No repeat recognized</span>}
                  </div>
                  <p className="mt-1 text-xs font-medium leading-relaxed text-[#56345c]">{observation.description}</p>
                </div>
              </div>
              {needsConfirmation && (
                <div className="mt-3 space-y-2">
                  {observation.candidates.slice(0, 3).map((candidate) => (
                    <button
                      key={String(candidate.id)}
                      type="button"
                      disabled={pendingId === String(observation._id)}
                      onClick={() => run(observation._id, () => resolveObservation({ observationId: observation._id, wardrobeItemId: candidate.id }))}
                      className="flex w-full items-center gap-3 border border-[var(--rack-line)] bg-white p-2 text-left hover:bg-[var(--rack-action-wash)] disabled:opacity-60"
                    >
                      <span className="relative h-12 w-12 shrink-0 overflow-hidden bg-[var(--rack-wash)]">{candidate.imageUrl && <Image src={candidate.imageUrl} alt={candidate.description ?? candidate.category ?? 'Closet item'} fill sizes="48px" className="object-cover" />}</span>
                      <span className="min-w-0 flex-1"><span className="block truncate text-xs font-extrabold text-[#241426]">{candidate.category ?? 'Closet item'}</span><span className="block truncate text-[11px] font-medium text-[#56345c]">{candidate.description ?? 'Previously saved item'}</span></span>
                      <span className="text-[11px] font-extrabold text-[#56345c]">{Math.round(candidate.score * 100)}%</span>
                    </button>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    disabled={pendingId === String(observation._id)}
                    onClick={() => run(observation._id, () => promoteObservation({ observationId: observation._id }))}
                    className="h-9 rounded-none border-[var(--rack-line)] bg-white text-xs font-extrabold text-[#241426]"
                  >
                    <Plus className="h-3.5 w-3.5" /> This is a new closet item
                  </Button>
                </div>
              )}
              {observation.resolutionStatus === 'unresolved' && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={pendingId === String(observation._id)}
                  onClick={() => run(observation._id, () => promoteObservation({ observationId: observation._id }))}
                  className="mt-3 h-9 rounded-none border-[var(--rack-line)] bg-white text-xs font-extrabold text-[#241426]"
                >
                  <Plus className="h-3.5 w-3.5" /> Add as a new wardrobe piece
                </Button>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
