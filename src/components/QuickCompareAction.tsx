'use client';

import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { Loader2, Sparkles, Ticket } from 'lucide-react';
import { checkCompatibilityAction, getUploadUrlAction } from '@/app/actions/wardrobe';
import { createTraceContext } from '@/lib/trace';
import { Card, CardContent } from '@/components/ui/card';

type CompatibilityResult = Awaited<ReturnType<typeof checkCompatibilityAction>>;

interface QuickCompareActionProps {
  inputId: string;
}

export default function QuickCompareAction({ inputId }: QuickCompareActionProps) {
  const previewUrlRef = useRef<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [result, setResult] = useState<CompatibilityResult | null>(null);

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

    setResult(null);
    setStatus(null);

    if (!file.type.startsWith('image/')) {
      setStatus('Only image files are supported for quick compare.');
      return;
    }

    updatePreview(URL.createObjectURL(file));
    setIsChecking(true);
    setStatus('Comparing this piece with your closet...');

    try {
      const uploadTarget = await getUploadUrlAction({
        fileName: file.name,
        contentType: file.type,
        fileSizeBytes: file.size,
      });
      const uploadResponse = await fetch(uploadTarget.uploadUrl, {
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

      const trace = createTraceContext();
      const response = await checkCompatibilityAction({
        storageId: payload.storageId,
        ...trace,
      });
      setResult(response);
      setStatus(null);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Quick compare failed.');
    } finally {
      setIsChecking(false);
    }
  };

  const showPanel = isChecking || Boolean(status) || Boolean(result);

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

          {isChecking && (
            <div className="mt-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-[#310A31]">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>{status}</span>
            </div>
          )}

          {!isChecking && status && (
            <div className="mt-4 border-2 border-black bg-rose-100 p-3 text-sm font-semibold text-rose-700">
              {status}
            </div>
          )}

          {result && (
            <div className="mt-4 grid gap-4 md:grid-cols-[220px_1fr]">
              {previewUrl && (
                <img
                  src={previewUrl}
                  alt="Candidate item"
                  className="h-56 w-full border-2 border-black object-cover"
                  loading="lazy"
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
                    <span>{result.message}</span>
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
