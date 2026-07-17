'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useQuery } from 'convex/react';
import { Effect, Either } from 'effect';
import { api } from '@convex/_generated/api';
import AddItemSection from '@/components/AddItemSection';
import GuestClosetDemo from '@/components/GuestClosetDemo';
import WardrobeGrid from '@/components/WardrobeGrid';
import {
  completeGuestOnboardingAction,
  createWardrobeItemAction,
  getUploadUrlAction,
  updateProfileBioAction,
} from '@/app/actions/wardrobe';
import { createTraceContext } from '@/lib/trace';
import { clearGuestSnapshot, loadGuestSnapshot, updateGuestSnapshotItem } from '@/lib/guestSnapshot';
import { dataUrlToFile } from '@/lib/imageClient';
import { userFacingErrorMessage } from '@/lib/userFacingError';
import { openCaptureMenu } from '@/lib/captureEvents';
import type { OptimisticWardrobeItem, WardrobeItem } from '@/types/wardrobe';

export default function Home() {
  const { isSignedIn } = useAuth();
  const uploadInputId = 'rack-upload-input';
  const items = useQuery(api.wardrobe.listWardrobeItems, isSignedIn ? {} : 'skip');
  const [optimisticItems, setOptimisticItems] = useState<OptimisticWardrobeItem[]>([]);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
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
    setImportError(null);

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
      await updateProfileBioAction({ bio: snapshot.bio, source: 'guest_import', ...trace });
    } catch {
      // Non-blocking; the user can still edit/save on Profile.
    }

    let allItemsPrepared = true;
    const preparedItems: Array<{
      item: (typeof queue)[number]['item'];
      tempId: string;
      itemId: string;
      traceId: string;
      traceparent: string;
    }> = [];
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
          preparedItems.push({
            item,
            tempId,
            itemId: String(createdItemId),
            traceId,
            traceparent,
          });
        } catch (error) {
          allItemsPrepared = false;
          patchOptimisticItem(tempId, {
            status: 'error',
            error: userFacingErrorMessage(error, 'Import failed'),
          });
        }
      }

      if (!allItemsPrepared) return;
      if (!snapshot.sourceFit) {
        setImportError('Your original fit check is no longer available. Start with a new full-body photo.');
        return;
      }

      setImportStatus('Saving your closet and first fit check...');
      const completionOutcome = await Effect.runPromise(
        Effect.tryPromise({
          try: async () => {
            const file = dataUrlToFile(snapshot.sourceFit!.dataUrl, snapshot.sourceFit!.fileName);
            const uploadUrl = await getUploadUrlAction();
            const uploadResponse = await fetch(uploadUrl, { method: 'POST', body: file });
            if (!uploadResponse.ok) throw new Error(`Upload failed: ${uploadResponse.statusText}`);
            const { storageId } = await uploadResponse.json();
            if (!storageId) throw new Error('Upload response missing storageId');
            const trace = createTraceContext();
            return completeGuestOnboardingAction({
              items: preparedItems.map(({ item, itemId, traceId, traceparent }) => ({
                itemId,
                category: item.category,
                description: item.description,
                styleTags: item.styleTags,
                ...(item.boundingBox ? { boundingBox: item.boundingBox } : {}),
                ...(item.confidence !== undefined ? { confidence: item.confidence } : {}),
                traceId,
                traceparent,
              })),
              sourceFit: {
                storageId,
                transcription: snapshot.sourceFit!.transcription,
              },
              ...trace,
            });
          },
          catch: (error) => error,
        }).pipe(Effect.either)
      );

      if (Either.isLeft(completionOutcome)) {
        const message = userFacingErrorMessage(
          completionOutcome.left,
          'Your closet was saved, but onboarding needs another try.'
        );
        preparedItems.forEach(({ tempId }) => {
          patchOptimisticItem(tempId, { status: 'error', error: message });
        });
        setImportError(message);
        return;
      }

      if (!completionOutcome.right.success) {
        for (const result of completionOutcome.right.results) {
          if (result.success) continue;
          const prepared = preparedItems.find(({ itemId }) => itemId === result.itemId);
          if (!prepared) continue;
          patchOptimisticItem(prepared.tempId, {
            status: 'error',
            error: userFacingErrorMessage(result.error, 'Analysis failed'),
          });
        }
        setImportError('Some pieces need another pass before the first fit can be saved.');
        return;
      }

      clearGuestSnapshot();
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

  const handleRemoveOptimistic = (tempId: string) => {
    setOptimisticItems((prev) => {
      const item = prev.find((entry) => entry.tempId === tempId);
      if (item?.imageUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(item.imageUrl);
      }
      return prev.filter((entry) => entry.tempId !== tempId);
    });
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

  return (
    <main className="relative min-h-screen pb-28 md:pb-16">
      <div className="mx-auto w-full max-w-[1320px] space-y-6 px-4 pb-16 pt-6 sm:px-6 sm:pt-8 lg:px-10 lg:pt-10">
        <section className="space-y-6">
          {importStatus && (
            <div className="rack-panel rack-panel--shell rounded-none px-5 py-4 text-sm font-semibold text-[#241426]">
              {importStatus}
            </div>
          )}
          {importError && (
            <div role="alert" className="rack-panel rounded-none border-[var(--rack-danger)] bg-[var(--rack-danger-wash)] px-5 py-4 text-sm font-semibold text-[var(--rack-danger)]">
              {importError}
            </div>
          )}

          {isSignedIn ? (
            <>
              <AddItemSection
                onOptimisticAdd={handleOptimisticAdd}
                onOptimisticUpdate={handleOptimisticUpdate}
                uploaderInputId={uploadInputId}
              />
              <WardrobeGrid
                items={displayItems}
                optimisticItems={filteredOptimisticItems}
                onAddPiece={openCaptureMenu}
                onRemoveOptimistic={handleRemoveOptimistic}
              />
            </>
          ) : (
            <GuestClosetDemo uploaderInputId={uploadInputId} />
          )}
        </section>
      </div>

    </main>
  );
}
