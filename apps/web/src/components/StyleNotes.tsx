'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { useQuery } from 'convex/react';
import { Sparkles } from 'lucide-react';
import posthog from 'posthog-js';
import { api } from '@convex/_generated/api';
import { refreshStyleBioAction, updateProfileBioAction } from '@/app/actions/wardrobe';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { createTraceContext } from '@/lib/trace';
import { userFacingErrorMessage } from '@/lib/userFacingError';

export default function StyleNotes() {
  const { isLoaded, isSignedIn } = useUser();
  const profile = useQuery(api.profile.getProfile, isLoaded && isSignedIn ? {} : 'skip');
  const [draft, setDraft] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const refreshAttempted = useRef(false);

  useEffect(() => {
    if (!isSignedIn || profile === undefined || refreshAttempted.current) return;
    refreshAttempted.current = true;
    void refreshStyleBioAction()
      .then((result) => {
        if (result.updated) setDraft(result.bio);
      })
      .catch((error) => console.warn('style_bio.background_refresh.failed', error));
  }, [isSignedIn, profile]);

  const notes = useMemo(() => draft ?? profile?.bio ?? '', [draft, profile]);
  const hasChanges = draft !== null && draft !== (profile?.bio ?? '');

  const save = async () => {
    setStatus('saving');
    setMessage('');
    try {
      await updateProfileBioAction({ bio: notes, ...createTraceContext() });
      setStatus('saved');
      setMessage('Style notes saved.');
      posthog.capture('profile_bio_saved', { character_count: notes.length, surface: 'wardrobe' });
    } catch (error) {
      setStatus('error');
      setMessage(userFacingErrorMessage(error, 'Could not save your style notes.'));
      posthog.captureException(error, { workflow: 'profile_bio_save', surface: 'wardrobe' });
    }
  };

  if (!isSignedIn) return null;

  return (
    <section id="style-notes" className="rack-panel rack-panel--shell scroll-mt-24 rounded-none" aria-labelledby="style-notes-title">
      <details>
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 marker:content-none">
          <span className="flex min-w-0 items-center gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center border border-[var(--rack-line)] bg-[#DCE66E] text-[#241426]">
              <Sparkles className="h-4 w-4" aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span id="style-notes-title" className="block text-base font-extrabold text-[#241426]">Style notes</span>
              <span className="block truncate text-xs font-medium text-[#56345c]">
                {notes || 'Add fit preferences, practical needs, and anything Wardrobe should remember.'}
              </span>
            </span>
          </span>
          <span className="shrink-0 text-xs font-extrabold uppercase tracking-[0.12em] text-[#56345c]">Edit</span>
        </summary>

        <div className="mt-4 border-t border-[var(--rack-line)] pt-4">
          <p className="max-w-3xl text-sm font-medium leading-relaxed text-[#56345c]">
            One living note keeps your fit, color, comfort, and lifestyle context together. Wardrobe also learns from the pieces and fits you save.
          </p>
          <Textarea
            value={notes}
            onChange={(event) => {
              setDraft(event.target.value);
              setStatus('idle');
              setMessage('');
            }}
            aria-label="Style notes"
            placeholder="Relaxed through the shoulders, avoids dry-clean-only pieces, likes warm neutrals…"
            className="mt-3 min-h-28 resize-y rounded-none border border-[var(--rack-line)] bg-white p-4 text-sm font-medium leading-relaxed text-[#241426]"
          />
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Button
              type="button"
              onClick={save}
              disabled={status === 'saving' || !hasChanges}
              className="h-10 rounded-none border border-[var(--rack-line)] bg-[#DCE66E] px-4 text-sm font-extrabold text-[#241426] shadow-[2px_2px_0_var(--rack-panel-shadow)]"
            >
              {status === 'saving' ? 'Saving…' : 'Save notes'}
            </Button>
            {message && (
              <p role={status === 'error' ? 'alert' : 'status'} className={`text-sm font-semibold ${status === 'error' ? 'text-[#B93267]' : 'text-[#3F7C5D]'}`}>
                {message}
              </p>
            )}
          </div>
        </div>
      </details>
    </section>
  );
}
