'use client';

import posthog from 'posthog-js';
import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import {
  BookmarkPlus,
  Check,
  Loader2,
  RotateCcw,
  Sparkles,
  Ticket,
  X,
} from 'lucide-react';
import { getUploadUrlAction, saveInspirationAction } from '@/app/actions/wardrobe';
import { createTraceContext } from '@/lib/trace';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useCompatibilityCheck } from '@/hooks/useCompatibilityCheck';
import TryOnFeedback from '@/components/TryOnFeedback';

interface QuickCompareActionProps {
  inputId: string;
}

export default function QuickCompareAction({ inputId }: QuickCompareActionProps) {
  const previewUrlRef = useRef<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [storageId, setStorageId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const { result, isProcessing, status, setStatus, reset, runCompatibilityCheck } =
    useCompatibilityCheck();

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, []);

  const updatePreview = (url: string | null) => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = url;
    setPreviewUrl(url);
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    reset();
    setSaveStatus(null);
    setStorageId(null);
    setOpen(true);

    if (!file.type.startsWith('image/')) {
      setStatus('Only image files are supported for try-on.');
      return;
    }

    updatePreview(URL.createObjectURL(file));

    try {
      const uploadUrl = await getUploadUrlAction();
      const uploadResponse = await fetch(uploadUrl, { method: 'POST', body: file });
      if (!uploadResponse.ok) throw new Error(`Upload failed: ${uploadResponse.statusText}`);

      const payload = await uploadResponse.json();
      if (!payload.storageId) throw new Error('Upload response missing storageId.');

      setStorageId(payload.storageId);
      await runCompatibilityCheck(payload.storageId, {
        startMessage: 'Reading your closet memory and finding wardrobe anchors...',
        fallbackErrorMessage: 'Try-on feedback failed.',
      });
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Try-on feedback failed.');
    }
  };

  const closeAndReset = () => {
    setOpen(false);
    reset();
    setSaveStatus(null);
    setStorageId(null);
    updatePreview(null);
  };

  const tryAnother = () => {
    closeAndReset();
    requestAnimationFrame(() => document.getElementById(inputId)?.click());
  };

  const saveToInspiration = async () => {
    if (!storageId || !result) return;
    setIsSaving(true);
    setSaveStatus('Saving this candidate to inspiration...');
    try {
      await saveInspirationAction({
        storageId,
        note: 'Saved after a closet try-on.',
        candidate: {
          category: result.candidate.category,
          description: result.candidate.description,
          styleTags: result.candidate.style_tags,
        },
        ...createTraceContext(),
      });
      setSaveStatus('Saved to inspiration. It is still not in your closet.');
      posthog.capture('try_on_saved_to_inspiration', {
        candidate_category: result.candidate.category,
        compatibility_score: result.evaluation?.score,
        compatibility_verdict: result.evaluation?.verdict,
      });
    } catch (error) {
      posthog.captureException(error);
      setSaveStatus(error instanceof Error ? error.message : 'Could not save this inspiration.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <input
        id={inputId}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
      />

      <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && closeAndReset()}>
        <DialogContent
          showCloseButton={false}
          className="max-h-[94vh] overflow-y-auto rounded-none border-4 border-black bg-[#f6f1f8] p-0 shadow-[10px_10px_0_#000] sm:max-w-4xl"
        >
          <DialogHeader className="border-b-4 border-black bg-white px-5 py-5 text-left sm:px-7">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-[#310A31]">
                <Sparkles className="h-5 w-5" />
                <p className="text-[10px] font-black uppercase tracking-[0.2em]">Closet try-on</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={closeAndReset}
                aria-label="Close try-on"
                className="rounded-none border-2 border-black bg-white"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <DialogTitle className="text-3xl font-black uppercase leading-tight text-[#310A31]">
              Does it earn a place?
            </DialogTitle>
            <DialogDescription className="font-medium text-slate-700">
              This is feedback only. The candidate is not added to your closet unless you use the separate Add to closet action.
            </DialogDescription>
          </DialogHeader>

          <div className="px-5 py-5 sm:px-7">
            {isProcessing && (
              <div className="grid min-h-72 place-items-center border-4 border-black bg-white p-8 text-center">
                <div>
                  <Loader2 className="mx-auto h-10 w-10 animate-spin text-[#310A31]" />
                  <p className="mt-5 text-lg font-black uppercase text-[#310A31]">Checking the closet</p>
                  <p className="mx-auto mt-2 max-w-md text-sm font-medium text-slate-700">{status}</p>
                  <div className="mx-auto mt-6 grid max-w-md grid-cols-3 gap-2 text-[9px] font-black uppercase tracking-wide text-[#6f5472]">
                    <span className="border-2 border-black bg-[#ece4f0] p-2">Zep memory</span>
                    <span className="border-2 border-black bg-[#ece4f0] p-2">Closet anchors</span>
                    <span className="border-2 border-black bg-[#ece4f0] p-2">Stylist read</span>
                  </div>
                </div>
              </div>
            )}

            {!isProcessing && status && !result && (
              <div className="border-4 border-black bg-rose-100 p-5 text-sm font-semibold text-rose-800">
                {status}
              </div>
            )}

            {result?.evaluation && (
              <div className="space-y-5">
                {previewUrl && <TryOnFeedback previewUrl={previewUrl} data={result} />}

                {saveStatus && (
                  <div role="status" className="flex items-center gap-2 border-2 border-black bg-white p-3 text-sm font-semibold text-[#310A31]">
                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    <span>{saveStatus}</span>
                  </div>
                )}
              </div>
            )}

            {result && !result.evaluation && (
              <div className="flex items-start gap-3 border-4 border-black bg-white p-5 text-[#310A31]">
                <Ticket className="mt-0.5 h-5 w-5" />
                <div>
                  <p className="font-black uppercase">Not enough closet evidence yet</p>
                  <p className="mt-1 text-sm font-medium text-slate-700">{result.message}</p>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="border-t-4 border-black bg-white px-5 py-4 sm:px-7">
            {result && (
              <Button
                type="button"
                variant="outline"
                disabled={isSaving || Boolean(saveStatus?.startsWith('Saved'))}
                onClick={saveToInspiration}
                className="min-h-11 rounded-none border-2 border-black px-4 font-black uppercase"
              >
                <BookmarkPlus className="h-4 w-4" />
                Save as inspiration
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              onClick={tryAnother}
              className="min-h-11 rounded-none border-2 border-black px-4 font-black uppercase"
            >
              <RotateCcw className="h-4 w-4" />
              Try another
            </Button>
            <Button
              type="button"
              onClick={closeAndReset}
              className="min-h-11 rounded-none border-2 border-black px-5 font-black uppercase shadow-[3px_3px_0_#000]"
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
