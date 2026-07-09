'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { SignUpButton } from '@clerk/nextjs';
import { Loader2, Sparkles } from 'lucide-react';
import { analyzeGuestBatchAction } from '@/app/actions/wardrobe';
import { createTraceContext } from '@/lib/trace';
import { loadGuestSnapshot, saveGuestSnapshot } from '@/lib/guestSnapshot';
import { downscaleToJpegDataUrl } from '@/lib/imageClient';
import { userFacingErrorMessage } from '@/lib/userFacingError';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import RackItemCard from './RackItemCard';

type GuestDemoItem = {
  id: string;
  fileName: string;
  previewUrl: string;
  dataUrl: string;
  category: string;
  description: string;
  styleTags: string[];
};

interface GuestClosetDemoProps {
  uploaderInputId?: string;
}

export default function GuestClosetDemo({ uploaderInputId }: GuestClosetDemoProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [demoComplete, setDemoComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bio, setBio] = useState('');
  const [showSignupPrompt, setShowSignupPrompt] = useState(false);
  const [items, setItems] = useState<GuestDemoItem[]>([]);
  const [limitMessage, setLimitMessage] = useState<string | null>(null);

  useEffect(() => {
    const snapshot = loadGuestSnapshot();
    if (!snapshot || snapshot.items.length === 0) return;

    setItems(
      snapshot.items.map((item) => ({
        id: item.id,
        fileName: item.fileName,
        previewUrl: item.dataUrl,
        dataUrl: item.dataUrl,
        category: item.category,
        description: item.description,
        styleTags: item.styleTags,
      }))
    );
    setBio(snapshot.bio);
    setDemoComplete(true);
  }, []);

  useEffect(() => {
    if (!demoComplete) return;
    // Persist the demo so that completing signup (which flips isSignedIn and unmounts this
    // component) can be imported into the real closet.
    saveGuestSnapshot({
      version: 1,
      createdAt: Date.now(),
      bio,
      items: items.map((item) => ({
        id: item.id,
        fileName: item.fileName,
        mimeType: "image/jpeg",
        dataUrl: item.dataUrl,
        category: item.category,
        description: item.description,
        styleTags: item.styleTags,
      })),
    });
  }, [bio, demoComplete, items]);

  const handleFiles = async (files: File[]) => {
    if (files.length === 0) return;
    if (demoComplete) {
      setShowSignupPrompt(true);
      return;
    }

    setError(null);
    setIsAnalyzing(true);
    setLimitMessage(null);

    try {
      const imageFiles = files.filter((file) => file.type.startsWith('image/'));
      const payload = await Promise.all(
        imageFiles.map(async (file) => ({
          id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
          fileName: file.name,
          ...(await downscaleToJpegDataUrl(file, { maxSize: 1024, quality: 0.82 })),
        }))
      );

      const trace = createTraceContext();
      const result = await analyzeGuestBatchAction({
        items: payload.map((entry) => ({
          fileName: entry.fileName,
          mimeType: entry.mimeType,
          base64: entry.dataUrl,
        })),
        ...trace,
      });

      setItems(
        result.items.map((entry, index) => ({
          id: payload[index]?.id ?? `${entry.fileName}-${index}`,
          fileName: entry.fileName,
          previewUrl: payload[index]?.dataUrl ?? '',
          dataUrl: payload[index]?.dataUrl ?? '',
          category: entry.category,
          description: entry.description,
          styleTags: entry.styleTags,
        }))
      );
      setBio(result.suggestedBio);
      setDemoComplete(true);
      if (result.capped) {
        setLimitMessage(`Demo capped at ${result.limit} photos. Create an account to continue.`);
      }
    } catch (uploadError) {
      const message = userFacingErrorMessage(uploadError, 'Analysis failed');
      setError(message);
      if (/sign in|create an account/i.test(message)) {
        setShowSignupPrompt(true);
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  const rackCards = useMemo(
    () =>
      items.map((item) => (
        <div
          key={item.id}
          className="transition-transform"
        >
          <RackItemCard
            imageUrl={item.previewUrl}
            category={item.category}
            description={item.description}
            styleTags={item.styleTags}
            badgeLabel="Demo"
          />
        </div>
      )),
    [items]
  );

  return (
    <section className="space-y-6">
      <Card id="rack-uploader" className="rack-panel rounded-none py-0">
        <div className="mb-5 flex flex-col gap-3 px-0 md:flex-row md:items-end md:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#4e1e51]">Season Rack</p>
            <h1 className="mt-2 text-3xl font-black uppercase leading-none text-[#310A31] md:text-5xl">
              Try your closet companion
            </h1>
            <p className="mt-3 max-w-2xl text-sm font-medium leading-relaxed text-slate-800 md:text-base">
              Upload a first batch of closet photos. We analyze the pieces, draft a style profile, and show the first rack cards before you create an account.
            </p>
          </div>
          <p className="w-fit border-2 border-black bg-white px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-[#310A31]">
            First batch free
          </p>
        </div>

        <input
          id={uploaderInputId}
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept="image/*"
          multiple
          capture="environment"
          onChange={(event) => handleFiles(Array.from(event.target.files ?? []))}
        />

        <Button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          variant="secondary"
          className="flex h-auto w-full min-w-0 flex-col items-start whitespace-normal rounded-none border-4 border-black bg-[#c6b9cd] px-4 py-7 text-left shadow-[8px_8px_0_#000] transition-transform hover:-translate-y-1 hover:bg-[#c6b9cd]/95 sm:px-6 sm:py-8"
        >
          <p className="max-w-full text-base font-black uppercase leading-snug text-[#310A31] sm:text-lg">
            {isAnalyzing ? 'Analyzing your first batch...' : 'Upload photos from your closet'}
          </p>
          <p className="mt-2 max-w-full text-sm font-medium leading-relaxed text-[#310A31]">
            We analyze your first batch and prefill a style profile you can edit.
          </p>
        </Button>

        {isAnalyzing && (
          <div className="mt-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-[#310A31]">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Reading textures, palettes, and silhouettes...</span>
          </div>
        )}

        {error && <p className="mt-4 border-2 border-black bg-rose-100 p-3 text-sm font-semibold">{error}</p>}
        {limitMessage && <p className="mt-4 border-2 border-black bg-amber-100 p-3 text-sm font-semibold">{limitMessage}</p>}
      </Card>

      {items.length > 0 && <div className="space-y-8">{rackCards}</div>}

      {demoComplete && (
        <Card className="rack-panel rounded-none py-0">
          <CardContent className="px-0">
            <div className="mb-3 flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              <p className="text-xs font-bold uppercase tracking-[0.18em]">Suggested Style Profile</p>
            </div>
            <Textarea
              value={bio}
              onChange={(event) => setBio(event.target.value)}
              className="h-40 w-full resize-none rounded-none border-4 border-black bg-white p-4 text-sm leading-relaxed text-slate-900"
            />
            <p className="mt-3 text-xs font-medium uppercase tracking-wide text-slate-600">
              Edit this profile, then save it to your account.
            </p>

            <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <Button
                type="button"
                onClick={() => setShowSignupPrompt(true)}
                className="h-auto w-full rounded-none border-4 border-black bg-[#310A31] px-5 py-3 text-sm font-black uppercase tracking-wide text-white shadow-[6px_6px_0_#000] sm:w-auto"
              >
                Save my style profile
              </Button>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-700">
                Includes compatibility checks and deeper personalization.
              </p>
            </div>

            {showSignupPrompt && (
              <div className="mt-4 border-4 border-black bg-[#9C92A3] p-4">
                <p className="text-sm font-semibold text-white">
                  Create your free account to save this closet profile, track your wardrobe, and continue comparisons.
                </p>
                <div className="mt-3">
                  <SignUpButton mode="modal" forceRedirectUrl="/" fallbackRedirectUrl="/">
                    <Button
                      variant="outline"
                      className="rounded-none border-2 border-black bg-white px-4 py-2 text-xs font-black uppercase tracking-wide text-[#310A31]"
                    >
                      Create free account
                    </Button>
                  </SignUpButton>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </section>
  );
}
