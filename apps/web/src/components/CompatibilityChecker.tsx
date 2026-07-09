'use client';

import Image from 'next/image';
import { Loader2, Ticket } from 'lucide-react';
import ImageUploader, { type UploadedFile } from './ImageUploader';
import { useCompatibilityCheck } from '@/hooks/useCompatibilityCheck';
import { userFacingErrorMessage } from '@/lib/userFacingError';

export default function CompatibilityChecker() {
  const { result, isProcessing, status, runCompatibilityCheck } = useCompatibilityCheck();

  const handleCheck = async (uploads: UploadedFile[]) => {
    if (uploads.length === 0) return;

    const upload = uploads[0];
    await runCompatibilityCheck(upload.storageId, {
      startMessage: 'Comparing this piece with your closet...',
      fallbackErrorMessage: 'Compatibility check failed. Try another photo.',
    });
  };

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div id="rack-uploader" className="rack-panel">
        <h2 className="text-3xl font-black uppercase tracking-tight text-[#310A31]">
          Does this fit your closet?
        </h2>
        <p className="mt-2 text-sm font-medium text-slate-700">
          Upload one candidate piece and compare it against your saved wardrobe.
        </p>
        <div className="mt-5">
          <ImageUploader
            onUploadComplete={handleCheck}
            label="Upload Candidate Piece"
            allowMultiple={false}
          />
        </div>

        {isProcessing && (
          <div className="mt-5 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-[#310A31]">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>{status}</span>
          </div>
        )}

        {status && !isProcessing && !result && (
          <div className="mt-5 border-2 border-black bg-rose-100 p-3 text-sm font-semibold text-rose-700">
            {status}
          </div>
        )}
      </div>

      {result && (
        <>
          {result.evaluation ? (
            <section className="space-y-7">
              <article className="rack-panel">
                <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-600">
                      Compatibility Score
                    </p>
                    <p className="mt-1 text-6xl font-black text-[#310A31]">{result.evaluation.score}%</p>
                  </div>
                  <div className="max-w-2xl border-2 border-black bg-white p-4">
                    <p className="text-sm font-medium leading-relaxed text-slate-800">
                      {result.evaluation.explanation}
                    </p>
                  </div>
                </div>

                <div className="mt-5 border-2 border-black bg-[#c6b9cd] p-4 text-[#310A31]">
                  <p className="text-xs font-bold uppercase tracking-[0.2em]">Candidate piece</p>
                  <p className="mt-2 text-sm font-semibold">{result.candidate.description}</p>
                  {result.candidate.style_tags.length > 0 && (
                    <p className="mt-3 text-xs font-black uppercase tracking-[0.08em] text-[#363240]">
                      {result.candidate.style_tags.slice(0, 4).join(' / ')}
                    </p>
                  )}
                </div>
              </article>

              <article className="rack-panel">
                <h3 className="text-xl font-black uppercase tracking-tight text-[#310A31]">Best matches</h3>
                {result.similarItems.length > 0 ? (
                  <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
                    {result.similarItems.map((item) => (
                      <div key={item.id} className="border-2 border-black bg-white p-3">
                        <div className="relative h-56 w-full border-2 border-black">
                          <Image
                            src={item.imageUrl ?? ''}
                            alt={item.description ?? 'Closet item'}
                            fill
                            sizes="(min-width: 768px) 33vw, 100vw"
                            className="object-cover"
                          />
                        </div>
                        <p className="mt-2 text-sm font-black uppercase text-[#310A31]">{item.category}</p>
                        <p className="text-xs font-semibold text-emerald-800">
                          Match {Math.round(item.similarity * 100)}%
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-4 text-sm font-medium text-slate-700">
                    No strong matches yet. Add more closet pieces to improve recommendations.
                  </p>
                )}
              </article>

              {result.dissimilarItems.length > 0 && (
                <article className="rack-panel">
                  <h3 className="text-xl font-black uppercase tracking-tight text-[#310A31]">
                    Potential clashes
                  </h3>
                  <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
                    {result.dissimilarItems.map((item) => (
                      <div key={item.id} className="border-2 border-black bg-white p-3">
                        <div className="relative h-56 w-full border-2 border-black">
                          <Image
                            src={item.imageUrl ?? ''}
                            alt={item.description ?? 'Closet item'}
                            fill
                            sizes="(min-width: 768px) 33vw, 100vw"
                            className="object-cover"
                          />
                        </div>
                        <p className="mt-2 text-sm font-black uppercase text-[#310A31]">{item.category}</p>
                        <p className="text-xs font-semibold text-rose-700">
                          Clash {Math.round(item.similarity * 100)}%
                        </p>
                      </div>
                    ))}
                  </div>
                </article>
              )}
            </section>
          ) : (
            <div className="rack-panel">
              <div className="flex items-center gap-2 text-[#310A31]">
                <Ticket className="h-5 w-5" />
                <p className="text-sm font-semibold">{userFacingErrorMessage(result.message, 'Compatibility check failed')}</p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
