'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { SignInButton, SignUpButton } from '@clerk/nextjs';
import { Loader2, Sparkles } from 'lucide-react';
import { analyzeGuestFitCheckAction, type GuestFitCheckAnalysisResult } from '@/app/actions/wardrobe';
import { createTraceContext } from '@/lib/trace';
import { loadGuestSnapshot, saveGuestSnapshot } from '@/lib/guestSnapshot';
import { downscaleToJpegDataUrl } from '@/lib/imageClient';
import { userFacingErrorMessage } from '@/lib/userFacingError';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import RackItemCard from './RackItemCard';
import posthog from 'posthog-js';

type GuestDemoItem = {
  id: string;
  fileName: string;
  previewUrl: string;
  dataUrl: string;
  category: string;
  description: string;
  styleTags: string[];
};

type GuestSourceFit = {
  fileName: string;
  mimeType: string;
  dataUrl: string;
  transcription: string;
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
  const [items, setItems] = useState<GuestDemoItem[]>([]);
  const [sourceFit, setSourceFit] = useState<GuestSourceFit | null>(null);
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
    setSourceFit(snapshot.sourceFit ?? null);
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
      ...(sourceFit ? { sourceFit } : {}),
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
  }, [bio, demoComplete, items, sourceFit]);

  const handleFiles = async (files: File[]) => {
    if (files.length === 0) return;
    if (demoComplete) {
      return;
    }

    setError(null);
    setIsAnalyzing(true);
    setLimitMessage(null);

    try {
      const imageFile = files.find((file) => file.type.startsWith('image/'));
      if (!imageFile) throw new Error('Choose a photo file to continue.');
      const payload = {
        id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
        fileName: imageFile.name,
        ...(await downscaleToJpegDataUrl(imageFile, { maxSize: 1280, quality: 0.82 })),
      };

      const trace = createTraceContext();
      const result: GuestFitCheckAnalysisResult = await analyzeGuestFitCheckAction({
        photo: {
          fileName: payload.fileName,
          mimeType: payload.mimeType,
          base64: payload.dataUrl,
        },
        ...trace,
      });

      if (result.kind === 'limit') {
        setLimitMessage(result.message);
        return;
      }

      setItems(
        result.items.map((entry, index) => ({
          id: `${payload.id}-${index}`,
          fileName: entry.fileName,
          previewUrl: entry.dataUrl,
          dataUrl: entry.dataUrl,
          category: entry.category,
          description: entry.description,
          styleTags: entry.styleTags,
        }))
      );
      setBio(result.suggestedBio);
      setSourceFit({
        fileName: payload.fileName,
        mimeType: payload.mimeType,
        dataUrl: payload.dataUrl,
        transcription: result.transcription,
      });
      setDemoComplete(true);
      posthog.capture('guest_fit_check_analyzed', {
        item_count: result.items.length,
      });
    } catch (uploadError) {
      posthog.captureException(uploadError, { workflow: 'guest_demo' });
      const message = userFacingErrorMessage(uploadError, 'Analysis failed');
      setError(message);
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
            badgeLabel="From your fit"
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
            Create your dream wardrobe
          </h1>
          <p className="mt-3 max-w-xl text-sm font-medium leading-relaxed text-[var(--rack-ink-soft)] md:text-base">
            Find your style based on what you already wear. Start with one full-body photo and we will pick out the pieces, define your look, and help you perfect your wardrobe.
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
              First, add one full-body fit check
            </h2>
            <p className="mt-2 max-w-2xl text-sm font-medium leading-relaxed text-[var(--rack-ink-soft)]">
              Press Start with a fit check to take a full-body selfie or choose one from your camera roll. Keep your whole outfit in frame and wear something that feels quintessentially &quot;you.&quot;
            </p>
          </div>
          <Button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="h-auto w-fit self-start rounded-none border border-[var(--rack-line)] bg-[var(--rack-action)] px-5 py-3 text-sm font-extrabold text-[var(--rack-ink)] shadow-[3px_3px_0_var(--rack-panel-shadow)] hover:bg-[var(--rack-action-hover)]"
          >
            Start with a fit check
          </Button>
        </div>

        <input
          id={uploaderInputId}
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept="image/*"
          onChange={(event) => handleFiles(Array.from(event.target.files ?? []))}
        />

        {isAnalyzing && (
          <div className="mt-4 flex items-center gap-2 text-sm font-semibold text-[var(--rack-ink)]">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Reading your outfit’s textures, palette, and silhouette...</span>
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
                onClick={() => posthog.capture('guest_signup_prompted', { source: 'demo_limit' })}
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
            <SignUpButton mode="modal" forceRedirectUrl="/" fallbackRedirectUrl="/">
              <Button
                type="button"
                onClick={() => posthog.capture('guest_signup_prompted', { source: 'demo_complete' })}
                className="h-auto w-full rounded-none border border-[var(--rack-line)] bg-[var(--rack-action)] px-5 py-3 text-sm font-extrabold text-[var(--rack-ink)] shadow-[3px_3px_0_var(--rack-panel-shadow)] hover:bg-[var(--rack-action-hover)] sm:w-auto"
              >
                Save my style profile
              </Button>
            </SignUpButton>
            <p className="text-sm font-medium text-[var(--rack-ink-soft)]">
              Includes compatibility checks and deeper personalization.
            </p>
          </div>
        </section>
      )}
    </section>
  );
}
