'use client';

import { useEffect, useMemo, useState } from 'react';
import { SignInButton, SignedOut, useAuth } from '@clerk/nextjs';
import { Plus, Sparkles } from 'lucide-react';
import { useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import AddItemSection from '@/components/AddItemSection';
import GuestClosetDemo from '@/components/GuestClosetDemo';
import QuickCompareAction from '@/components/QuickCompareAction';
import WardrobeGrid from '@/components/WardrobeGrid';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import type { OptimisticWardrobeItem, WardrobeItem } from '@/types/wardrobe';

export default function Home() {
  const { isSignedIn } = useAuth();
  const uploadInputId = 'rack-upload-input';
  const compareInputId = 'rack-compare-input';
  const items = useQuery(api.wardrobe.listWardrobeItems, isSignedIn ? {} : 'skip');
  const [optimisticItems, setOptimisticItems] = useState<OptimisticWardrobeItem[]>([]);

  const { filteredOptimisticItems, removedOptimisticItems } = useMemo(() => {
    if (!items) {
      return { filteredOptimisticItems: optimisticItems, removedOptimisticItems: [] };
    }
    const existingIds = new Set(items.map((item) => String(item.id)));
    const removed = optimisticItems.filter(
      (item) => item.serverId && existingIds.has(String(item.serverId))
    );
    const filtered = optimisticItems.filter(
      (item) => !item.serverId || !existingIds.has(String(item.serverId))
    );
    return { filteredOptimisticItems: filtered, removedOptimisticItems: removed };
  }, [items, optimisticItems]);

  useEffect(() => {
    for (const item of removedOptimisticItems) {
      URL.revokeObjectURL(item.imageUrl);
    }
  }, [removedOptimisticItems]);

  const handleOptimisticAdd = (newItems: OptimisticWardrobeItem[]) => {
    setOptimisticItems((prev) => [...newItems, ...prev]);
  };

  const handleOptimisticUpdate = (tempId: string, patch: Partial<OptimisticWardrobeItem>) => {
    setOptimisticItems((prev) =>
      prev.map((item) => (item.tempId === tempId ? { ...item, ...patch } : item))
    );
  };

  const displayItems = useMemo<WardrobeItem[]>(
    () =>
      (items ?? [])
        .filter((item): item is typeof item & { imageUrl: string } => item.imageUrl !== null)
        .map((item) => ({
          id: String(item.id),
          imageUrl: item.imageUrl,
          category: item.category ?? null,
          description: item.description ?? null,
          styleTags: item.styleTags ?? null,
          analysisStatus: item.analysisStatus,
          analysisError: item.analysisError ?? null,
          createdAt: item.createdAt,
        })),
    [items]
  );

  const triggerInput = (inputId: string, fallback?: string) => {
    const input = document.getElementById(inputId) as HTMLInputElement | null;
    if (input) {
      input.click();
      return;
    }
    if (fallback) {
      document.getElementById(fallback)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  return (
    <main className="relative min-h-screen pb-32">
      <div className="mx-auto w-full max-w-[1320px] space-y-6 px-6 pb-16 pt-10 sm:px-8 lg:px-10">
        <section className="space-y-6">
          <Card className="rack-panel rounded-none py-0">
            <CardHeader className="px-0">
              <Badge
                variant="outline"
                className="w-fit rounded-none border-2 border-black bg-white px-2 py-0 text-[10px] font-bold tracking-[0.2em] text-[#9C92A3]"
              >
                Season Rack
              </Badge>
              <CardTitle className="mt-2 text-3xl font-black uppercase text-[#310A31] md:text-5xl">
                {isSignedIn ? 'Your closet in motion' : 'Try your closet companion'}
              </CardTitle>
              <p className="mt-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-600">
                {isSignedIn ? 'Signed in · your closet is saved' : 'Guest mode · first batch is free'}
              </p>
              <p className="mt-3 max-w-2xl text-sm font-medium leading-relaxed text-slate-800 md:text-base">
                {isSignedIn
                  ? 'Upload pieces, compare new finds, and keep your wardrobe aligned with your style goals.'
                  : 'Upload your first batch of closet photos. We analyze the pieces, draft your style profile, and help you decide what to add next.'}
              </p>
            </CardHeader>
          </Card>

          {isSignedIn ? (
            <>
              <AddItemSection
                onOptimisticAdd={handleOptimisticAdd}
                onOptimisticUpdate={handleOptimisticUpdate}
                uploaderInputId={uploadInputId}
              />
              <WardrobeGrid items={displayItems} optimisticItems={filteredOptimisticItems} />
              <QuickCompareAction inputId={compareInputId} />
            </>
          ) : (
            <GuestClosetDemo uploaderInputId={uploadInputId} />
          )}
        </section>
      </div>

      <div className="fixed bottom-6 right-4 z-30 flex flex-col gap-3 sm:right-8">
        <Button
          type="button"
          onClick={() => triggerInput(uploadInputId, 'rack-uploader')}
          className="rack-fab rounded-none border-2 border-black"
        >
          <Plus className="h-4 w-4" />
          <span>Add to closet</span>
        </Button>
        <Button
          type="button"
          onClick={() => triggerInput(isSignedIn ? compareInputId : uploadInputId, 'rack-uploader')}
          variant="outline"
          className="rack-fab rack-fab-secondary rounded-none border-2 border-black"
        >
          <Sparkles className="h-4 w-4" />
          <span>{isSignedIn ? 'Check fit' : 'Try check'}</span>
        </Button>
      </div>

      <SignedOut>
        <div className="fixed bottom-6 left-4 z-30 sm:left-8">
          <SignInButton mode="modal" forceRedirectUrl="/" fallbackRedirectUrl="/">
            <Button className="rounded-full border-2 border-black bg-white px-4 py-2 text-xs font-black uppercase tracking-wide text-[#310A31] shadow-[4px_4px_0_#000]">
              Sign in
            </Button>
          </SignInButton>
        </div>
      </SignedOut>
    </main>
  );
}
