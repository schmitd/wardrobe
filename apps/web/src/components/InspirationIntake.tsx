'use client';

import { uploadPhotoFile } from "@/services/photoUpload";

import { type ChangeEvent, useRef, useState } from 'react';
import { useMutation } from 'convex/react';
import { api } from '@convex/_generated/api';
import { ImagePlus, Loader2 } from 'lucide-react';
import { enrichInspirationAction } from '@/app/actions/wardrobe';
import { Button } from '@/components/ui/button';
import { Result, promiseEffect, runBackground, runEffectResult } from '@/lib/effect-result';
import { createTraceContext } from '@/lib/trace';
import { userFacingErrorMessage } from '@/lib/userFacingError';
import posthog from 'posthog-js';

export default function InspirationIntake({ collectionId, collectionName }: { collectionId: string; collectionName: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const getUploadUrl = useMutation(api.wardrobe.getUploadUrl);
  const registerUpload = useMutation(api.storage.registerUpload);
  const createInspiration = useMutation(api.candidates.createInspiration);
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const addInspiration = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setState('error');
      setMessage('Choose a photo to add to this collection.');
      return;
    }
    setState('saving');
    setMessage('');
    let stage: 'upload' | 'register' | 'save' = 'upload';
    const outcome = await runEffectResult(
      promiseEffect(async () => {
        // Keep this path in the authenticated Convex session. A photo reference does
        // not need a server-action round trip before it is safely persisted.
        const storageId = await uploadPhotoFile(file, () => getUploadUrl({}));
        const trace = createTraceContext();
        stage = 'register';
        await registerUpload({ storageId: storageId as never, purpose: 'inspiration' });
        stage = 'save';
        const saved = await createInspiration({
          wardrobeId: collectionId as never,
          storageId: storageId as never,
          category: 'Visual reference',
          description: 'Saved visual reference',
          styleTags: [],
          ...trace,
        });
        return { saved, storageId, trace };
      })
    );
    if (Result.isFailure(outcome)) {
      posthog.captureException(outcome.failure, { workflow: 'inspiration_add', stage });
      console.error('inspiration.add.failed', { stage, error: outcome.failure });
      setState('error');
      setMessage(userFacingErrorMessage(
        outcome.failure,
        stage === 'upload'
          ? 'The photo could not upload. Please try again.'
          : stage === 'register'
            ? 'The photo uploaded but could not be linked to your account. Please try again.'
            : 'The photo uploaded but could not be added to this collection. Please try again.'
      ));
      return;
    }
    setState('saved');
    setMessage(`Added to ${collectionName}.`);
    posthog.capture('inspiration_saved', {
      has_photo: true,
      collection_type: 'wardrobe',
    });
    runBackground('inspiration.enrichment.failed', () => enrichInspirationAction({
      candidateItemId: String(outcome.success.saved.id),
      storageId: outcome.success.storageId,
      ...outcome.success.trace,
    }));
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <input ref={inputRef} className="hidden" type="file" accept="image/*" onChange={addInspiration} />
      <Button type="button" onClick={() => inputRef.current?.click()} disabled={state === 'saving'} className="h-10 rounded-none border border-[var(--rack-line)] bg-[#DCE66E] px-4 text-sm font-extrabold text-[#241426] shadow-[2px_2px_0_var(--rack-panel-shadow)]">
        {state === 'saving' ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
        {state === 'saving' ? 'Adding…' : 'Add inspiration'}
      </Button>
      {message && <p role={state === 'error' ? 'alert' : 'status'} className={`text-sm font-semibold ${state === 'error' ? 'text-[#B93267]' : 'text-[#3F7C5D]'}`}>{message}</p>}
    </div>
  );
}
