'use client';

import { uploadPhotoFile } from "@/services/photoUpload";

import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePaginatedQuery } from 'convex/react';
import { Effect, Result } from 'effect';
import { api } from '@convex/_generated/api';
import {
  completeGuestOnboardingAction,
  createWardrobeItemAction,
  getUploadUrlAction,
  updateProfileBioAction,
} from '@/app/actions/wardrobe';
import { createTraceContext } from '@/lib/trace';
import { clearGuestSnapshot, loadGuestSnapshot, saveGuestSnapshot, updateGuestSnapshotItem } from '@/lib/guestSnapshot';
import { dataUrlToFile } from '@/lib/imageClient';
import { userFacingErrorMessage } from '@/lib/userFacingError';
import { openCaptureMenu } from '@/lib/captureEvents';
import type { OptimisticWardrobeItem, WardrobeItem } from '@/types/wardrobe';

import HomeSectionBoundary from "./HomeSectionBoundary";
import { StyleLoading, CollectionsLoading } from "./WardrobeShell";
const StyleNotes = lazy(() => import("./StyleNotes"));
const CollectionsWorkspace = lazy(() => import("./CollectionsWorkspace"));
export default function SignedInHome({ownerId}:{ownerId:string}) {
  return <section className="space-y-6"><h1 className="sr-only">Wardrobe</h1>
    <HomeSectionBoundary title="Style notes" reloadOnRetry retryLabel="Retry style notes"><Suspense fallback={<StyleLoading />}><StyleNotes /></Suspense></HomeSectionBoundary>
    <HomeSectionBoundary title="Wardrobe" retryLabel="Retry wardrobe"><ClosetItems ownerId={ownerId} /></HomeSectionBoundary>
  </section>;
}
// Identity-keyed mounting resets private UI state and Convex pagination identity.
// The existing reactive query owns continuity; no second item/count cache.
function ClosetItems({ ownerId }: { ownerId: string }) {
  const closet = usePaginatedQuery(api.wardrobe.pageWardrobeItems, {}, { initialNumItems: 48 });
  const items = closet.status === 'LoadingFirstPage' ? undefined : closet.results;
  const [optimisticItems, setOptimisticItems] = useState<OptimisticWardrobeItem[]>([]);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importRetryAvailable, setImportRetryAvailable] = useState(false);
  const importOptimisticIdsRef = useRef(new Set<string>());
  const importedSnapshotRef = useRef<number | null>(null);
  const isImportingSnapshotRef = useRef(false);
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => { active.current = false; };
  }, []);

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

    const snapshot = loadGuestSnapshot(ownerId);
    if (!snapshot || snapshot.items.length === 0) return;
    if (snapshot.importOwnerId && snapshot.importOwnerId !== ownerId) return;
    if (importedSnapshotRef.current === snapshot.createdAt) return;

    importedSnapshotRef.current = snapshot.createdAt;
    saveGuestSnapshot({ ...snapshot, importOwnerId: ownerId });
    isImportingSnapshotRef.current = true;
    setImportError(null);
    setImportRetryAvailable(false);

    const queue = snapshot.items.map((item) => ({
      item,
      tempId: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
      ...createTraceContext(),
    }));
    importOptimisticIdsRef.current = new Set(queue.map(({ tempId }) => tempId));

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

    // Preserve the guest bio as the signed-in Style notes draft.
    try {
      const trace = createTraceContext();
      await updateProfileBioAction({ bio: snapshot.bio, source: 'guest_import', ...trace });
    } catch {
      // Non-blocking; the user can still edit/save in Style notes.
    }
    if (!active.current) { isImportingSnapshotRef.current = false; return; }

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
        if (!active.current) return;
        try {
          patchOptimisticItem(tempId, { status: 'processing' });
          let createdItemId = item.createdItemId;

          if (!createdItemId) {
            setImportStatus(`Uploading ${item.fileName}...`);
            const file = dataUrlToFile(item.dataUrl, item.fileName);
            const storageId = await uploadPhotoFile(file, getUploadUrlAction);
            if (!active.current) return;

            const created = await createWardrobeItemAction({
              storageId,
              clientFileName: file.name,
              contentType: file.type,
              traceId,
              traceparent,
            });

            createdItemId = created.id;
            if (loadGuestSnapshot(ownerId)?.createdAt === snapshot.createdAt) updateGuestSnapshotItem(item.id, { createdItemId }, ownerId);
            if (!active.current) return;
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

      if (!allItemsPrepared) {
        setImportError('Some photos could not be imported. Retry to finish adding your pieces.');
        setImportRetryAvailable(true);
        return;
      }
      if (!snapshot.sourceFit) {
        setImportError('Your original fit check is no longer available. Start with a new full-body photo.');
        return;
      }

      setImportStatus('Saving your closet and first fit check...');
      const completionOutcome = await Effect.runPromise(
        Effect.tryPromise({
          try: async () => {
            const file = dataUrlToFile(snapshot.sourceFit!.dataUrl, snapshot.sourceFit!.fileName);
            const storageId = await uploadPhotoFile(file, getUploadUrlAction);
            if (!active.current) throw new Error('Import interrupted.');
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
        }).pipe(Effect.result)
      );

      if (Result.isFailure(completionOutcome)) {
        const message = userFacingErrorMessage(
          completionOutcome.failure,
          'Your closet was saved, but onboarding needs another try.'
        );
        preparedItems.forEach(({ tempId }) => {
          patchOptimisticItem(tempId, { status: 'error', error: message });
        });
        setImportError(message);
        setImportRetryAvailable(true);
        return;
      }

      if (!completionOutcome.success.success) {
        for (const result of completionOutcome.success.results) {
          if (result.success) continue;
          const prepared = preparedItems.find(({ itemId }) => itemId === result.itemId);
          if (!prepared) continue;
          patchOptimisticItem(prepared.tempId, {
            status: 'error',
            error: userFacingErrorMessage(result.error, 'Analysis failed'),
          });
        }
        setImportError('Some pieces need another pass before the first fit can be saved.');
        setImportRetryAvailable(true);
        return;
      }

      const persisted = loadGuestSnapshot(ownerId);
      if (persisted?.createdAt === snapshot.createdAt && persisted.importOwnerId === ownerId) clearGuestSnapshot(ownerId, snapshot.createdAt);
    } catch (error) {
      setImportError(userFacingErrorMessage(error, 'Import could not finish. Please retry.'));
      setImportRetryAvailable(true);
    } finally {
      setImportStatus(null);
      isImportingSnapshotRef.current = false;
    }
  }, [ownerId, patchOptimisticItem]);

  const retryGuestImport = () => {
    if (isImportingSnapshotRef.current) return;
    // Retry only on explicit request. Saved IDs in the snapshot are reused.
    importedSnapshotRef.current = null;
    const previous = importOptimisticIdsRef.current;
    setOptimisticItems(items => items.filter(item => !previous.has(item.tempId)));
    void importGuestSnapshot();
  };

  useEffect(() => {
    void importGuestSnapshot();
  }, [importGuestSnapshot]);

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
          note: item.note,
          analysisStatus: item.analysisStatus,
          analysisError: item.analysisError ?? null,
          createdAt: item.createdAt,
        })),
    [hiddenServerIds, items]
  );

  return <section className="space-y-6">
    {importStatus && <div role="status" className="rack-panel rack-panel--shell px-5 py-4 text-sm font-semibold text-[#241426]">{importStatus}</div>}
    {importError && <div role="alert" className="rack-panel border-[var(--rack-danger)] bg-[var(--rack-danger-wash)] px-5 py-4 text-sm font-semibold text-[var(--rack-danger)]">
      {importError}
      {importRetryAvailable && <button type="button" disabled={Boolean(importStatus)} onClick={retryGuestImport} className="mt-3 block min-h-11 border border-current px-4 font-bold text-[#241426]">Retry import</button>}
    </div>}
    <HomeSectionBoundary title="Wardrobe module" retryLabel="Reload wardrobe" reloadOnRetry><Suspense fallback={<CollectionsLoading />}><CollectionsWorkspace
      loading={closet.status === "LoadingFirstPage"}
      loadMore={closet.status === "CanLoadMore" ? () => closet.loadMore(48) : undefined}
      items={displayItems}
      optimisticItems={filteredOptimisticItems}
      onAddPiece={openCaptureMenu}
      onRemoveOptimistic={handleRemoveOptimistic}
    /></Suspense></HomeSectionBoundary>
  </section>;
}
