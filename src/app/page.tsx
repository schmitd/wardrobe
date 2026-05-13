'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SignInButton, SignedOut, useAuth } from '@clerk/nextjs';
import { Plus, Sparkles } from 'lucide-react';
import { useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import AddItemSection from '@/components/AddItemSection';
import GuestClosetDemo from '@/components/GuestClosetDemo';
import QuickCompareAction from '@/components/QuickCompareAction';
import WardrobeGrid from '@/components/WardrobeGrid';
import {
  createWardrobeItemAction,
  getUploadUrlAction,
  seedWardrobeItemFromGuestAction,
  updateProfileBioAction,
} from '@/app/actions/wardrobe';
import { createTraceContext } from '@/lib/trace';
import { loadGuestSnapshot, removeGuestSnapshotItem, updateGuestSnapshotItem } from '@/lib/guestSnapshot';
import { dataUrlToFile } from '@/lib/imageClient';
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
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const importedSnapshotRef = useRef<number | null>(null);
  const isImportingSnapshotRef = useRef(false);

  const { filteredOptimisticItems, hiddenServerIds, removedOptimisticItems } = useMemo(() => {
    if (!items) {
      return { filteredOptimisticItems: optimisticItems, hiddenServerIds: new Set<string>(), removedOptimisticItems: [] };
    }
    const byId = new Map(items.map((item) => [String(item.id), item]));
    const isTerminal = (status: string) => status === 'ready' || status === 'error';

    const removed = optimisticItems.filter((item) => {
      if (!item.serverId) return false;
      const serverItem = byId.get(String(item.serverId));
      return Boolean(serverItem && isTerminal(serverItem.analysisStatus));
    });

    const filtered = optimisticItems.filter((item) => {
      if (!item.serverId) return true;
      const serverItem = byId.get(String(item.serverId));
      if (!serverItem) return true;
      return !isTerminal(serverItem.analysisStatus);
    });

    const hiddenIds = new Set(
      filtered
        .map((item) => item.serverId)
        .filter((id): id is string => Boolean(id))
        .map(String)
    );
    return { filteredOptimisticItems: filtered, hiddenServerIds: hiddenIds, removedOptimisticItems: removed };
  }, [items, optimisticItems]);

  useEffect(() => {
    if (removedOptimisticItems.length === 0) return;
    const removedIds = new Set(removedOptimisticItems.map((item) => item.tempId));

    for (const item of removedOptimisticItems) {
      URL.revokeObjectURL(item.imageUrl);
    }

    setOptimisticItems((prev) => prev.filter((item) => !removedIds.has(item.tempId)));
  }, [removedOptimisticItems]);

  const patchOptimisticItem = useCallback((tempId: string, patch: Partial<OptimisticWardrobeItem>) => {
    setOptimisticItems((prev) =>
      prev.map((entry) => (entry.tempId === tempId ? { ...entry, ...patch } : entry))
    );
  }, []);

  const importGuestSnapshot = useCallback(async () => {
    if (isImportingSnapshotRef.current) return;

    const snapshot = loadGuestSnapshot();
    if (!snapshot || snapshot.items.length === 0) return;
    if (importedSnapshotRef.current === snapshot.createdAt) return;

    importedSnapshotRef.current = snapshot.createdAt;
    isImportingSnapshotRef.current = true;

    const queue = snapshot.items.map((item) => ({
      item,
      tempId: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
      ...createTraceContext(),
    }));

    setOptimisticItems((prev) => [
      ...queue.map(({ item, tempId }) => ({
        tempId,
        imageUrl: item.dataUrl,
        status: (item.createdItemId ? 'processing' : 'uploading') as OptimisticWardrobeItem['status'],
        createdAt: Date.now(),
        category: item.category,
        description: item.description,
        styleTags: item.styleTags,
        serverId: item.createdItemId,
      })),
      ...prev,
    ]);

    setImportStatus(`Importing ${queue.length} item${queue.length === 1 ? '' : 's'} from guest demo...`);

    // Preserve the guest bio as the signed-in profile draft.
    try {
      const trace = createTraceContext();
      await updateProfileBioAction({ bio: snapshot.bio, ...trace });
    } catch {
      // Non-blocking; the user can still edit/save on Profile.
    }

    try {
      for (const { item, tempId, traceId, traceparent } of queue) {
        try {
          patchOptimisticItem(tempId, { status: 'processing' });
          let createdItemId = item.createdItemId;

          if (!createdItemId) {
            setImportStatus(`Uploading ${item.fileName}...`);
            const file = dataUrlToFile(item.dataUrl, item.fileName);
            const uploadUrl = await getUploadUrlAction();
            const uploadResponse = await fetch(uploadUrl, { method: 'POST', body: file });
            if (!uploadResponse.ok) throw new Error(`Upload failed: ${uploadResponse.statusText}`);
            const { storageId } = await uploadResponse.json();
            if (!storageId) throw new Error('Upload response missing storageId');

            const created = await createWardrobeItemAction({
              storageId,
              clientFileName: file.name,
              contentType: file.type,
              traceId,
              traceparent,
            });

            createdItemId = created.id;
            updateGuestSnapshotItem(item.id, { createdItemId });
            patchOptimisticItem(tempId, { status: 'processing', serverId: createdItemId });
          }

          if (!createdItemId) {
            throw new Error('Import failed to create wardrobe item');
          }

          const seeded = await seedWardrobeItemFromGuestAction({
            itemId: createdItemId,
            category: item.category,
            description: item.description,
            styleTags: item.styleTags,
            traceId,
            traceparent,
          });

          if (!seeded.success) {
            patchOptimisticItem(tempId, {
              status: 'error',
              error: seeded.error ?? 'Processing failed',
            });
            continue;
          }

          // Remove imported items from the guest snapshot so backing out of auth or refreshing
          // doesn't re-import duplicates.
          removeGuestSnapshotItem(item.id);
        } catch (error) {
          patchOptimisticItem(tempId, {
            status: 'error',
            error: error instanceof Error ? error.message : 'Import failed',
          });
        }
      }
    } finally {
      setImportStatus(null);
      isImportingSnapshotRef.current = false;
    }
  }, [patchOptimisticItem]);

  useEffect(() => {
    if (!isSignedIn) return;
    void importGuestSnapshot();
  }, [importGuestSnapshot, isSignedIn]);

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
        .filter((item) => !hiddenServerIds.has(String(item.id)))
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
    [hiddenServerIds, items]
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

          {importStatus && (
            <div className="rack-panel rounded-none border-4 border-black bg-white px-5 py-4 text-sm font-semibold uppercase tracking-wide text-[#310A31]">
              {importStatus}
            </div>
          )}

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
