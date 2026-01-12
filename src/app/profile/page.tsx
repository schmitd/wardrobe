'use client';

import { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { updateBio, getBio } from '../actions';

export default function ProfilePage() {
  const { user, isLoaded } = useUser();
  const [bio, setBio] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'saving' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!isLoaded || !user) return;

    const fetchBio = async () => {
        try {
            const result = await getBio();
            // result is { success: boolean, bio?: string, error?: string }
            if (result.success && 'bio' in result && result.bio) {
                setBio(result.bio);
            }
        } catch (e) {
            console.error("Failed to fetch bio", e);
        } finally {
            setStatus('idle');
        }
    };
    fetchBio();
  }, [isLoaded, user]);

  const handleSave = async () => {
    setStatus('saving');
    setErrorMessage('');
    try {
      const result = await updateBio(bio);
      if (result.success) {
        setStatus('success');
      } else {
        setStatus('error');
        setErrorMessage('error' in result ? result.error : 'Failed to save');
      }
    } catch (e) {
      setStatus('error');
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
            onChange={(e) => setBio(e.target.value)}
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
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center text-gray-500">
              Upload feature coming soon...
          </div>
      </div>
    </div>
  );
}
