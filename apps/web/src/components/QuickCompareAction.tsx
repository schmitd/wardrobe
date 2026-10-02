'use client';

import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { Loader2, RotateCcw, Sparkles } from 'lucide-react';
import { getUploadUrlAction } from '@/app/actions/wardrobe';
import TryOnFeedback from '@/components/TryOnFeedback';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useCompatibilityCheck } from '@/hooks/useCompatibilityCheck';
import { userFacingErrorMessage } from '@/lib/userFacingError';

interface QuickCompareActionProps {
  inputId: string;
}

export default function QuickCompareAction({ inputId }: QuickCompareActionProps) {
  const previewUrlRef = useRef<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [lastStorageId, setLastStorageId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const { result, isProcessing, status, setStatus, reset, runCompatibilityCheck } =
    useCompatibilityCheck();

  useEffect(() => () => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
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
    setLastStorageId(null);
    setOpen(true);

    if (!file.type.startsWith('image/')) {
      setStatus('Choose an image to try on against your closet.');
      return;
    }

    updatePreview(URL.createObjectURL(file));
    try {
      const uploadUrl = await getUploadUrlAction();
      const uploadResponse = await fetch(uploadUrl, { method: 'POST', body: file });
      if (!uploadResponse.ok) throw new Error(`Upload failed: ${uploadResponse.statusText}`);
      const payload = await uploadResponse.json();
      if (!payload.storageId) throw new Error('Upload response missing storageId.');

      setLastStorageId(payload.storageId);
      await runCompatibilityCheck(payload.storageId, {
        startMessage: 'Reading your loci, then finding closet anchors…',
        fallbackErrorMessage: 'Try-on feedback failed.',
      });
    } catch (error) {
      setStatus(userFacingErrorMessage(error, 'Try-on feedback failed'));
    }
  };

  const retryLastCompare = async () => {
    if (!lastStorageId) return;
    await runCompatibilityCheck(lastStorageId, {
      startMessage: 'Rechecking your closet context…',
      fallbackErrorMessage: 'Try-on feedback failed.',
    });
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92dvh] max-w-5xl overflow-y-auto rounded-none border border-[var(--rack-line)] bg-[var(--rack-paper)] p-5 shadow-[4px_4px_0_var(--rack-panel-shadow)] sm:p-7">
          <DialogHeader className="border-b border-[var(--rack-line)] pb-4 pr-8">
            <div className="flex items-center gap-2 text-[var(--rack-ink)]">
              <Sparkles className="h-4 w-4" />
              <DialogTitle className="text-2xl font-extrabold">Try it with your closet</DialogTitle>
            </div>
            <DialogDescription className="text-sm font-medium text-[var(--rack-ink-soft)]">
              Feedback only. This photo is evaluated as a candidate and is not added to your rack.
            </DialogDescription>
          </DialogHeader>

          {isProcessing && (
            <div className="rack-panel rack-panel--shell flex min-h-64 flex-col items-center justify-center text-center">
              <Loader2 className="h-7 w-7 animate-spin text-[var(--rack-ink)]" />
              <p className="mt-4 text-base font-extrabold text-[var(--rack-ink)]">{status}</p>
              <p className="mt-2 max-w-md text-sm font-medium text-[var(--rack-ink-soft)]">
                We’re checking the directions you’ve saved, then grounding the result in pieces you already own.
              </p>
            </div>
          )}

          {!isProcessing && status && !result && (
            <div role="alert" className="border border-[var(--rack-line)] bg-[var(--rack-danger-wash)] p-4 text-sm font-semibold text-[var(--rack-danger)]">
              <p>{status}</p>
              {lastStorageId && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={retryLastCompare}
                  className="mt-3 rounded-none border-[var(--rack-line)] bg-white text-[var(--rack-ink)]"
                >
                  <RotateCcw className="h-4 w-4" />
                  Try again
                </Button>
              )}
            </div>
          )}

          {result && <TryOnFeedback result={result} previewUrl={previewUrl} />}
        </DialogContent>
      </Dialog>
    </>
  );
}
