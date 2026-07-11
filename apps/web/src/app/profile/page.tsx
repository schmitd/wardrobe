'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useClerk, useUser } from '@clerk/nextjs';
import { useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import Image from 'next/image';
import { Sparkles } from 'lucide-react';
import ImageUploader, { type UploadedFile } from '@/components/ImageUploader';
import { analyzeSelfieAction, refreshStyleBioAction, updateProfileBioAction } from '@/app/actions/wardrobe';
import { createTraceContext } from '@/lib/trace';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';

export default function ProfilePage() {
  const { isLoaded, isSignedIn } = useUser();
  const clerk = useClerk();
  const profile = useQuery(api.profile.getProfile, isLoaded && isSignedIn ? {} : 'skip');
  const latestSelfie = useQuery(
    api.storage.getLatestUploadByPurpose,
    isLoaded && isSignedIn ? { purpose: 'selfie' } : 'skip'
  );

  const [bioDraft, setBioDraft] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'loading' | 'saving' | 'success' | 'error'>(
    'idle'
  );
  const [errorMessage, setErrorMessage] = useState('');
  const [analysisOverride, setAnalysisOverride] = useState<{
    skinTone: string;
    complexion?: string;
    hairColor: string;
    colorSeason?: string;
  } | null>(null);
  const refreshAttempted = useRef(false);

  useEffect(() => {
    if (!isSignedIn || profile === undefined || refreshAttempted.current) return;
    refreshAttempted.current = true;
    void refreshStyleBioAction()
      .then((result) => {
        if (result.updated) setBioDraft(result.bio);
        setSaveStatus(result.updated ? 'success' : 'idle');
      })
      .catch((error) => {
        console.error('style_bio.refresh.failed', error);
        setSaveStatus('idle');
      });
  }, [isSignedIn, profile]);

  const bio = useMemo(() => bioDraft ?? profile?.bio ?? '', [bioDraft, profile]);
  const analysisResult = useMemo(() => {
    if (analysisOverride) return analysisOverride;
    if (profile?.skinTone || profile?.complexion || profile?.hairColor || profile?.colorSeason) {
      return {
        skinTone: profile.skinTone ?? 'Unknown',
        complexion: profile.complexion ?? 'Unknown',
        hairColor: profile.hairColor ?? 'Unknown',
        colorSeason: profile.colorSeason ?? 'Unknown',
      };
    }
    return null;
  }, [analysisOverride, profile]);

  const handleSave = async () => {
    setSaveStatus('saving');
    setErrorMessage('');
    try {
      const trace = createTraceContext();
      await updateProfileBioAction({ bio, ...trace });
      setSaveStatus('success');
    } catch (error) {
      setSaveStatus('error');
      setErrorMessage(String(error));
    }
  };

  const handleSelfieUpload = async (uploads: UploadedFile[]) => {
    if (uploads.length === 0) return;
    setSaveStatus('loading');
    try {
      const trace = createTraceContext();
      const result = await analyzeSelfieAction({
        storageId: uploads[0].storageId,
        ...trace,
      });
      setAnalysisOverride({
        skinTone: result.skin_tone,
        complexion: result.complexion,
        hairColor: result.hair_color,
        colorSeason: result.color_season,
      });
      setSaveStatus('success');
    } catch (error) {
      console.error('selfie.analyze.failed', error);
      setSaveStatus('error');
      setErrorMessage('Failed to analyze selfie');
    }
  };

  if (!isLoaded) {
    return <div className="p-8 text-sm font-semibold">Loading profile...</div>;
  }

  if (!isSignedIn) {
    return (
      <main className="mx-auto w-full max-w-[1320px] px-4 py-8 lg:px-8">
        <Card className="rack-panel rounded-none py-0">
          <CardContent className="px-0">
            <h1 className="text-4xl font-black uppercase tracking-tight text-[#310A31]">Style profile</h1>
            <p className="mt-3 text-sm font-medium text-slate-700">Sign in to manage your style profile.</p>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto grid w-full max-w-[1320px] gap-6 px-4 py-8 lg:grid-cols-[1.1fr_1fr] lg:px-8">
      <section className="space-y-6">
        <Card className="rack-panel rack-panel--shell rounded-none py-0">
          <CardContent className="px-0">
          <p className="text-sm font-semibold text-[#56345c]">Personalization</p>
          <h1 className="mt-2 text-4xl font-extrabold text-[#241426]">
            Style profile
          </h1>
          <p className="mt-3 text-sm font-medium text-slate-700">
            Keep your style notes current so recommendations stay aligned with your closet goals.
          </p>
          </CardContent>
        </Card>

        <Card className="rack-panel rack-panel--action rounded-none py-0">
          <CardContent className="px-0">
          <label className="block text-sm font-semibold text-[#241426]">
            Style bio
          </label>
          <Textarea
            value={bio}
            onChange={(event) => setBioDraft(event.target.value)}
            placeholder="I build around neutral layers, tailored fits, and statement outerwear..."
            className="mt-3 h-48 w-full resize-none rounded-none border border-[var(--rack-line)] bg-white p-4 text-sm font-medium leading-relaxed text-slate-900"
          />

          {saveStatus === 'error' && (
            <p className="mt-4 border border-[var(--rack-line)] bg-[#f8e6ee] p-3 text-sm font-semibold text-[#b93267]">
              {errorMessage}
            </p>
          )}

          {saveStatus === 'success' && (
            <p className="mt-4 border border-[var(--rack-line)] bg-[#e8f3ec] p-3 text-sm font-semibold text-[#3f7c5d]">
              Profile updated.
            </p>
          )}

          <Button
            type="button"
            onClick={handleSave}
            disabled={saveStatus === 'saving'}
            className="mt-4 h-auto rounded-none border border-[var(--rack-line)] bg-[#DCE66E] px-5 py-3 text-sm font-extrabold text-[#241426] shadow-[3px_3px_0_var(--rack-panel-shadow)] disabled:opacity-60"
          >
            {saveStatus === 'saving' ? 'Saving...' : 'Save profile'}
          </Button>
          </CardContent>
        </Card>

        <Card className="rack-panel rack-panel--shell rounded-none py-0">
          <CardContent className="px-0">
          <div className="mb-4 flex items-center gap-2 text-[#241426]">
            <Sparkles className="h-4 w-4" />
            <h2 className="text-lg font-extrabold">Color and fit profile</h2>
          </div>
          <p className="mb-4 text-sm font-medium text-slate-700">
            Upload a selfie to refresh color notes. Your style bio is maintained from your closet, fits, collections, and your own edits.
          </p>

          {latestSelfie?.url ? (
            <>
              <div className="border border-[var(--rack-line)] bg-white">
                <div className="relative aspect-[4/5] w-full overflow-hidden bg-slate-100">
                  <Image
                    src={latestSelfie.url}
                    alt="Most recently uploaded selfie"
                    fill
                    sizes="(max-width: 1024px) 100vw, 45vw"
                    className="object-cover"
                    priority
                  />
                </div>
              </div>
              <details className="mt-4">
                <summary className="inline-flex cursor-pointer border border-[var(--rack-line)] bg-white px-4 py-3 text-sm font-semibold text-[#241426] shadow-[3px_3px_0_var(--rack-panel-shadow)]">
                  Replace selfie
                </summary>
                <div className="mt-4">
                  <ImageUploader
                    label="Upload Selfie"
                    allowMultiple={false}
                    onUploadComplete={handleSelfieUpload}
                  />
                </div>
              </details>
            </>
          ) : (
            <ImageUploader
              label="Upload Selfie"
              allowMultiple={false}
              onUploadComplete={handleSelfieUpload}
            />
          )}

          {analysisResult && (
            <div className="mt-4 grid grid-cols-2 gap-3 border border-[var(--rack-line)] bg-white p-4">
              <div>
                <span className="text-xs font-semibold text-[#56345c]">
                  Skin tone
                </span>
                <p className="mt-1 text-sm font-extrabold text-[#241426]">
                  {analysisResult.skinTone}
                </p>
              </div>
              <div>
                <span className="text-xs font-semibold text-[#56345c]">Complexion</span>
                <p className="mt-1 text-sm font-extrabold text-[#241426]">
                  {analysisResult.complexion}
                </p>
              </div>
              <div>
                <span className="text-xs font-semibold text-[#56345c]">Hair color</span>
                <p className="mt-1 text-sm font-extrabold text-[#241426]">
                  {analysisResult.hairColor}
                </p>
              </div>
              <div>
                <span className="text-xs font-semibold text-[#56345c]">Color season</span>
                <p className="mt-1 text-sm font-extrabold text-[#241426]">
                  {analysisResult.colorSeason}
                </p>
              </div>
            </div>
          )}
          </CardContent>
        </Card>
      </section>

      <Card className="rack-panel rounded-none py-0">
        <CardContent className="px-0">
          <h2 className="text-lg font-extrabold text-[#241426]">Account settings</h2>
          <p className="mt-2 text-sm font-medium text-slate-700">
            Manage account details, authentication methods, and security settings.
          </p>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button
              type="button"
              onClick={() => clerk.openUserProfile()}
              className="h-auto rounded-none border border-[var(--rack-line)] bg-[#DCE66E] px-5 py-3 text-sm font-extrabold text-[#241426] shadow-[3px_3px_0_var(--rack-panel-shadow)]"
            >
              Manage account
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => clerk.signOut({ redirectUrl: '/' })}
              className="h-auto rounded-none border border-[var(--rack-line)] bg-white px-5 py-3 text-sm font-semibold text-[#241426] shadow-[3px_3px_0_var(--rack-panel-shadow)]"
            >
              Sign out
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
