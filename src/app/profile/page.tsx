'use client';

import { useState, useMemo } from 'react';
import { useUser } from '@clerk/nextjs';
import { useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import ImageUploader, { type UploadedFile } from '@/components/ImageUploader';
import { analyzeSelfieAction, updateProfileBioAction } from '@/app/actions/wardrobe';
import { createTraceContext } from '@/lib/trace';

export default function ProfilePage() {
  const { isLoaded } = useUser();
  const profile = useQuery(api.profile.getProfile, isLoaded ? {} : 'skip');

  const [bioDraft, setBioDraft] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [analysisOverride, setAnalysisOverride] = useState<{ skinTone: string; hairColor: string } | null>(null);

  const bio = useMemo(() => bioDraft ?? profile?.bio ?? '', [bioDraft, profile]);
  const analysisResult = useMemo(() => {
    if (analysisOverride) return analysisOverride;
    if (profile?.skinTone || profile?.hairColor) {
      return {
        skinTone: profile.skinTone ?? 'Unknown',
        hairColor: profile.hairColor ?? 'Unknown',
      };
    }
    return null;
  }, [analysisOverride, profile]);
  const status = profile === undefined ? 'loading' : saveStatus;

  const handleSave = async () => {
    setSaveStatus('saving');
    setErrorMessage('');
    try {
      const trace = createTraceContext();
      await updateProfileBioAction({ bio, ...trace });
      setSaveStatus('success');
    } catch (e) {
      setSaveStatus('error');
      setErrorMessage(String(e));
    }
  };

  if (!isLoaded) return <div className="p-8">Loading...</div>;

  return (
    <div className="max-w-2xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-6">Your Style Profile</h1>

      <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Style Bio (Pro Feature)
          </label>
          <p className="text-sm text-gray-500 mb-2">
            Describe your personal style, fashion goals, and preferences. The AI will use this to personalize your analysis.
          </p>
          <textarea
            className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[150px]"
            placeholder="I love vintage aesthetic mixed with modern streetwear..."
            value={bio}
            onChange={(e) => setBioDraft(e.target.value)}
          />
        </div>

        {status === 'error' && (
          <div className="mb-4 text-red-600 text-sm">{errorMessage}</div>
        )}

        {status === 'success' && (
          <div className="mb-4 text-green-600 text-sm">Profile updated successfully!</div>
        )}

        <button
          onClick={handleSave}
          disabled={status === 'saving'}
          className="bg-black text-white px-6 py-2 rounded-md hover:bg-gray-800 disabled:opacity-50 transition-colors"
        >
          {status === 'saving' ? 'Saving...' : 'Save Profile'}
        </button>
      </div>

      <div className="mt-8 p-6 bg-gray-50 rounded-lg border border-gray-200">
        <h2 className="text-xl font-semibold mb-4">Selfie Analysis (Pro Feature)</h2>
        <p className="text-gray-600 mb-4">Upload a selfie to analyze your color season and fit.</p>

        <ImageUploader
          label="Upload a Selfie"
          allowMultiple={false}
          onUploadComplete={async (uploads: UploadedFile[]) => {
            if (uploads.length === 0) return;
            setSaveStatus('saving');
            try {
              const trace = createTraceContext();
              const res = await analyzeSelfieAction({ storageId: uploads[0].storageId, ...trace });
              setBioDraft(res.bio);
              setAnalysisOverride({
                skinTone: res.skin_tone,
                hairColor: res.hair_color
              });
              setSaveStatus('success');
            } catch (error) {
              console.error('selfie.analyze.failed', error);
              setSaveStatus('error');
              setErrorMessage("Failed to analyze selfie");
            }
          }}
        />

        {analysisResult && (
          <div className="mt-6 p-4 bg-white rounded border border-indigo-100 shadow-sm animate-in fade-in">
            <h3 className="font-semibold text-indigo-900 mb-2">Analysis Results</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Skin Tone</span>
                <p className="font-medium text-gray-900">{analysisResult.skinTone}</p>
              </div>
              <div>
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Hair Color</span>
                <p className="font-medium text-gray-900">{analysisResult.hairColor}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
