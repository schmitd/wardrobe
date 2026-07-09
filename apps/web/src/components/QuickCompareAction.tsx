'use client';

import Image from 'next/image';
import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { Loader2, Sparkles, Ticket } from 'lucide-react';
import { getUploadUrlAction } from '@/app/actions/wardrobe';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useCompatibilityCheck } from '@/hooks/useCompatibilityCheck';
import { userFacingErrorMessage } from '@/lib/userFacingError';

interface QuickCompareActionProps {
  inputId: string;
}

export default function QuickCompareAction({ inputId }: QuickCompareActionProps) {
  const previewUrlRef = useRef<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [lastStorageId, setLastStorageId] = useState<string | null>(null);
  const { result, isProcessing, status, setStatus, reset, runCompatibilityCheck } =
    useCompatibilityCheck();

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
    };
  }, []);

  const updatePreview = (url: string | null) => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
    }
    previewUrlRef.current = url;
    setPreviewUrl(url);
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    reset();
    setLastStorageId(null);

    if (!file.type.startsWith('image/')) {
      setStatus('Only image files are supported for quick compare.');
      return;
    }

    updatePreview(URL.createObjectURL(file));

    try {
      const uploadUrl = await getUploadUrlAction();
      const uploadResponse = await fetch(uploadUrl, {
        method: 'POST',
        body: file,
      });

      if (!uploadResponse.ok) {
        throw new Error(`Upload failed: ${uploadResponse.statusText}`);
      }

      const payload = await uploadResponse.json();
      if (!payload.storageId) {
        throw new Error('Upload response missing storageId.');
      }

      setLastStorageId(payload.storageId);
      await runCompatibilityCheck(payload.storageId, {
        startMessage: 'Comparing this piece with your closet...',
        fallbackErrorMessage: 'Quick compare failed.',
      });
    } catch (error) {
      setStatus(userFacingErrorMessage(error, 'Quick compare failed'));
    }
  };

  const retryLastCompare = async () => {
    if (!lastStorageId) return;
    await runCompatibilityCheck(lastStorageId, {
      startMessage: 'Comparing this piece with your closet again...',
      fallbackErrorMessage: 'Quick compare failed.',
    });
  };

  const showPanel = isProcessing || Boolean(status) || Boolean(result);

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

      {showPanel && (
        <Card id="rack-compare-result" className="rack-panel rounded-none py-0">
          <CardContent className="px-0">
          <div className="flex items-center gap-2 text-[#310A31]">
            <Sparkles className="h-4 w-4" />
            <h3 className="text-base font-black uppercase tracking-[0.12em]">Quick compare result</h3>
          </div>

          {isProcessing && (
            <div className="mt-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-[#310A31]">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>{status}</span>
            </div>
          )}

          {!isProcessing && status && (
            <div className="mt-4 grid gap-4 md:grid-cols-[180px_1fr]">
              {previewUrl && (
                <Image
                  src={previewUrl}
                  alt="Candidate item"
                  width={360}
                  height={360}
                  unoptimized
                  className="h-44 w-full border-2 border-black object-cover"
                />
              )}
              <div className="border-2 border-black bg-rose-100 p-3 text-sm font-semibold text-rose-700">
                <p>{status}</p>
                {lastStorageId && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={retryLastCompare}
                    className="mt-3 h-auto rounded-none border-2 border-black bg-white px-3 py-2 text-xs font-black uppercase tracking-[0.08em] text-[#310A31]"
                  >
                    Try compare again
                  </Button>
                )}
              </div>
            </div>
          )}

          {result && (
            <div className="mt-4 grid gap-4 md:grid-cols-[220px_1fr]">
              {previewUrl && (
                <Image
                  src={previewUrl}
                  alt="Candidate item"
                  width={440}
                  height={440}
                  unoptimized
                  className="h-56 w-full border-2 border-black object-cover"
                />
              )}
              <div className="space-y-3">
                {result.evaluation ? (
                  <>
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-600">
                      Compatibility score
                    </p>
                    <p className="text-5xl font-black text-[#310A31]">{result.evaluation.score}%</p>
                    <p className="border-2 border-black bg-white p-3 text-sm font-medium text-slate-800">
                      {result.evaluation.explanation}
                    </p>
                  </>
                ) : (
                  <div className="flex items-center gap-2 border-2 border-black bg-white p-3 text-sm font-semibold text-[#310A31]">
                    <Ticket className="h-4 w-4" />
                    <span>{userFacingErrorMessage(result.message, 'Quick compare failed')}</span>
                  </div>
                )}
              </div>
            </div>
          )}
          </CardContent>
        </Card>
      )}
    </>
  );
}
