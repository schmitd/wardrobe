'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { SignInButton, SignUpButton } from '@clerk/nextjs';
import { Loader2, Sparkles } from 'lucide-react';
import { analyzeGuestBatchAction, type GuestBatchAnalysisResult } from '@/app/actions/wardrobe';
import { createTraceContext } from '@/lib/trace';
import { loadGuestSnapshot, saveGuestSnapshot } from '@/lib/guestSnapshot';
import { downscaleToJpegDataUrl } from '@/lib/imageClient';
import { userFacingErrorMessage } from '@/lib/userFacingError';
import { Button } from '@/components/ui/button';
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
  const hasGeneratedBio = demoComplete && bio.trim().length > 0;

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
      const result: GuestBatchAnalysisResult = await analyzeGuestBatchAction({
        items: payload.map((entry) => ({
          fileName: entry.fileName,
          mimeType: entry.mimeType,
          base64: entry.dataUrl,
        })),
        ...trace,
      });

      if (result.kind === 'limit') {
        setLimitMessage(result.message);
        setShowSignupPrompt(true);
        return;
      }

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
      <section className="rack-panel rack-panel--shell" aria-labelledby="guest-style-bio-title">
        <div className="max-w-2xl">
          <h1 id="guest-style-bio-title" className="text-3xl font-extrabold leading-tight text-[var(--rack-ink)] md:text-5xl">
            Build a closet bio from real clothes
          </h1>
          <p className="mt-3 max-w-xl text-sm font-medium leading-relaxed text-[var(--rack-ink-soft)] md:text-base">
            Start with a few clear garment photos. Wardrobe drafts the bio and turns the pieces into rack cards you can save after signup.
          </p>
        </div>

        {hasGeneratedBio && (
          <div className="mt-6">
            <div className="mb-3 flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              <p className="text-sm font-semibold text-[var(--rack-ink)]">Your closet bio</p>
            </div>
            <Textarea
              value={bio}
              onChange={(event) => setBio(event.target.value)}
              className="h-36 w-full resize-none rounded-none border border-[var(--rack-line)] bg-white p-4 text-sm font-medium leading-relaxed text-[var(--rack-ink)]"
            />
            <p className="mt-3 text-sm font-medium text-[var(--rack-ink-soft)]">
              Edit the bio after analysis, then save it to your account.
            </p>
          </div>
        )}
      </section>

      <section id="rack-uploader" className="rack-panel rack-panel--action" aria-labelledby="guest-upload-title">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 id="guest-upload-title" className="text-xl font-extrabold text-[var(--rack-ink)]">
              Add clothes to the demo rack
            </h2>
            <p className="mt-2 max-w-2xl text-sm font-medium leading-relaxed text-[var(--rack-ink-soft)]">
              Choose photos where each item fills the frame. The first batch becomes rack cards below.
            </p>
          </div>
          <Button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="h-auto w-full rounded-none border border-[var(--rack-line)] bg-[var(--rack-action)] px-5 py-3 text-sm font-extrabold text-[var(--rack-ink)] shadow-[3px_3px_0_var(--rack-panel-shadow)] hover:bg-[var(--rack-action-hover)] sm:w-auto"
          >
            Add Clothes
          </Button>
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

        {isAnalyzing && (
          <div className="mt-4 flex items-center gap-2 text-sm font-semibold text-[var(--rack-ink)]">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Reading textures, palettes, and silhouettes...</span>
          </div>
        )}

        {error && <p className="mt-4 border border-[var(--rack-line)] bg-[var(--rack-danger-wash)] p-3 text-sm font-semibold text-[var(--rack-danger)]">{error}</p>}
      </section>

      {items.length > 0 && <div className="guest-rack-grid">{rackCards}</div>}

      {limitMessage && (
        <section className="rack-panel rack-panel--shell" aria-label="Demo limit reached">
          <p className="text-sm font-semibold text-[var(--rack-ink)]">{limitMessage}</p>
          <p className="mt-2 text-sm font-medium text-[var(--rack-ink-soft)]">
            Sign up or sign in to continue adding clothes and save the rack you&apos;ve built so far.
          </p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <SignUpButton mode="modal" forceRedirectUrl="/" fallbackRedirectUrl="/">
              <Button
                type="button"
                className="h-auto w-full rounded-none border border-[var(--rack-line)] bg-[var(--rack-action)] px-5 py-3 text-sm font-extrabold text-[var(--rack-ink)] shadow-[3px_3px_0_var(--rack-panel-shadow)] hover:bg-[var(--rack-action-hover)] sm:w-auto"
              >
                Sign up
              </Button>
            </SignUpButton>
            <SignInButton mode="modal">
              <Button
                type="button"
                variant="outline"
                className="h-auto w-full rounded-none border border-[var(--rack-line)] bg-white px-5 py-3 text-sm font-semibold text-[var(--rack-ink)] shadow-[3px_3px_0_var(--rack-panel-shadow)] sm:w-auto"
              >
                Sign in
              </Button>
            </SignInButton>
          </div>
        </section>
      )}

      {demoComplete && !limitMessage && (
        <section className="rack-panel" aria-label="Save demo profile">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <Button
              type="button"
              onClick={() => setShowSignupPrompt(true)}
              className="h-auto w-full rounded-none border border-[var(--rack-line)] bg-[var(--rack-action)] px-5 py-3 text-sm font-extrabold text-[var(--rack-ink)] shadow-[3px_3px_0_var(--rack-panel-shadow)] hover:bg-[var(--rack-action-hover)] sm:w-auto"
            >
              Save my style profile
            </Button>
            <p className="text-sm font-medium text-[var(--rack-ink-soft)]">
              Includes compatibility checks and deeper personalization.
            </p>
          </div>

          {showSignupPrompt && (
            <div className="mt-4 border border-[var(--rack-line)] bg-[var(--rack-wash)] p-4">
              <p className="text-sm font-semibold text-[var(--rack-ink)]">
                Create your free account to save this closet profile, track your wardrobe, and continue comparisons.
              </p>
              <div className="mt-3">
                <SignUpButton mode="modal" forceRedirectUrl="/" fallbackRedirectUrl="/">
                  <Button
                    variant="outline"
                    className="rounded-none border border-[var(--rack-line)] bg-white px-4 py-2 text-sm font-semibold text-[var(--rack-ink)]"
                  >
                    Create free account
                  </Button>
                </SignUpButton>
              </div>
            </div>
          )}
        </section>
      )}
    </section>
  );
}
