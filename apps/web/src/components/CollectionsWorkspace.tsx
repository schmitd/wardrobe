"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { useMutation, usePaginatedQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import type { WardrobeItem } from "@/types/wardrobe";
import { Pencil, Plus } from "lucide-react";
import CollectionEnsemble from "./CollectionEnsemble";
import WardrobeGrid, { type WardrobeGridProps } from "./WardrobeGrid";
import ItemDetailsDrawer from "./ItemDetailsDrawer";
import InspirationIntake from "./InspirationIntake";
import InspirationCard from "./InspirationCard";
import { Button } from "./ui/button";
import TaskSheet from "./TaskSheet";
import { createTraceContext } from "@/lib/trace";
import posthog from "posthog-js";

export default function CollectionsWorkspace({
  loadMore,
  loading,
  ...grid
}: WardrobeGridProps & { loadMore?: () => void; loading?: boolean }) {
  const collections = usePaginatedQuery(
    api.wardrobe.pageCollections,
    {},
    { initialNumItems: 12 },
  );
  const [showRemoved, setShowRemoved] = useState(false);
  const removed = usePaginatedQuery(api.wardrobe.pageCollections, showRemoved ? { archived: true } : "skip", { initialNumItems: 12 });
  const archive = useMutation(api.wardrobe.archiveCollection);
  const [selectedId, setSelectedId] = useState<Id<"wardrobes"> | null>(null);
  const selected = collections.results.find((c) => c._id === selectedId);
  const [tab, setTab] = useState<"pieces" | "inspiration">("pieces");
  const pieces = usePaginatedQuery(
    api.wardrobe.pagePieces,
    selectedId ? { wardrobeId: selectedId } : "skip",
    { initialNumItems: 24 },
  );
  const inspirations = usePaginatedQuery(
    api.wardrobe.pageInspiration,
    selectedId && tab === "inspiration" ? { wardrobeId: selectedId } : "skip",
    { initialNumItems: 24 },
  );
  const [showRemovedInspiration, setShowRemovedInspiration] = useState(false);
  const removedInspiration = usePaginatedQuery(api.wardrobe.pageInspiration, selectedId && tab === "inspiration" && showRemovedInspiration ? { wardrobeId: selectedId, removed: true } : "skip", { initialNumItems: 24 });
  const recoveryButton = useRef<HTMLButtonElement>(null);
  const setInspirationRemoved = useMutation(api.wardrobe.setInspirationRemoved);
  const changeInspiration = async (wardrobeId: Id<"wardrobes">, membershipId: Id<"wardrobeMemberships">, removed: boolean) => {
    await setInspirationRemoved({ wardrobeId, membershipId, removed });
    posthog.capture("inspiration_membership_changed", { operation: removed ? "removed" : "restored", surface: "wardrobe" });
    if (removed) setShowRemovedInspiration(true);
    recoveryButton.current?.focus();
  };
  const [item, setItem] = useState<WardrobeItem | null>(null);
  const [modal, setModal] = useState<"create" | "edit" | "add" | "remove" | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [collectionRecoveryError, setCollectionRecoveryError] = useState("");
  const create = useMutation(api.wardrobes.createWardrobe);
  const update = useMutation(api.wardrobes.updateWardrobe);
  const add = useMutation(api.wardrobes.addItemToWardrobe);
  const run = async (work: () => Promise<unknown>) => {
    setBusy(true);
    setError("");
    try {
      await work();
    } catch {
      setError("Could not save this change. Please try again.");
    } finally {
      setBusy(false);
    }
  };
  const restoreCollection = async (wardrobeId: Id<"wardrobes">) => {
    setBusy(true);
    setCollectionRecoveryError("");
    try {
      await archive({ wardrobeId, archived: false });
    } catch {
      setCollectionRecoveryError("Could not restore this collection. Please try again.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <section
      id="collections"
      aria-label="Wardrobe collections"
      className="ph-no-capture space-y-5"
    >
      <div>
        <Button variant="ghost" onClick={() => setShowRemoved(value => !value)}>{showRemoved ? "Hide removed collections" : "Removed collections"}</Button>
        {showRemoved && <section aria-label="Removed collections" className="space-y-2">{collectionRecoveryError && <p role="alert" className="text-sm">{collectionRecoveryError}</p>}{removed.results.map(collection => <div key={collection._id} className="flex items-center justify-between gap-3 rounded-lg border p-3" data-private><span>{collection.name}</span><Button variant="outline" disabled={busy} onClick={() => void restoreCollection(collection._id)}>Restore</Button></div>)}{removed.status === "CanLoadMore" && <Button variant="outline" onClick={() => removed.loadMore(12)}>More removed collections</Button>}{removed.status === "Exhausted" && !removed.results.length && <p>No removed collections.</p>}</section>}
        <h2 className="mb-3 text-sm font-semibold text-[#56345c]">
          Collections
        </h2>
        <nav className="collection-rail" aria-label="Collections">
          <button
            type="button"
            className="collection-shortcut"
            aria-pressed={!selectedId}
            onClick={() => {
              setSelectedId(null);
              setTab("pieces");
            }}
          >
            <CollectionEnsemble pieces={grid.items} all />
            <span>All pieces</span>
          </button>
          {collections.results.map((c) => (
            <button
              type="button"
              key={c._id}
              className="collection-shortcut"
              aria-pressed={selectedId === c._id}
              onClick={() => {
                setSelectedId(c._id);
                setTab("pieces");
              }}
              data-private
            >
              <CollectionEnsemble pieces={c.previews} />
              <span className="line-clamp-2">{c.name}</span>
            </button>
          ))}
          <button
            type="button"
            className="collection-shortcut"
            onClick={() => {
              setName("");
              setDescription("");
              setModal("create");
              setError("");
            }}
          >
            <span className="collection-orb collection-orb--new">
              <Plus aria-hidden="true" />
            </span>
            <span>New collection</span>
          </button>
          {collections.status === "CanLoadMore" && (
            <button
              type="button"
              className="collection-shortcut"
              onClick={() => collections.loadMore(12)}
            >
              <span className="collection-orb">…</span>
              <span>More</span>
            </button>
          )}
        </nav>
      </div>
      <div className="collection-heading">
        <h2 className="truncate text-2xl font-bold" data-private>
          {selected?.name ?? (selectedId ? "Collection" : "All pieces")}
        </h2>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Edit collection"
          className={selected ? "" : "invisible"}
          tabIndex={selected ? 0 : -1}
          onClick={() => {
            if (selected) {
              setName(selected.name);
              setDescription(selected.description ?? "");
              setError("");
              setModal("edit");
            }
          }}
        >
          <Pencil className="size-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          aria-label="Add from wardrobe"
          className={selectedId ? "" : "invisible"}
          tabIndex={selectedId ? 0 : -1}
          onClick={() => {
            setModal("add");
            setError("");
          }}
        >
          <Plus />
        </Button>
      </div>
      <div
        className="flex h-11 border-b border-[#d8c9dc]"
        aria-label="Collection views"
      >
        {(["pieces", "inspiration"] as const).map((t) => (
          <button
            key={t}
            type="button"
            aria-pressed={tab === t}
            onClick={() => setTab(t)}
            className={`min-h-11 border-b-2 px-5 text-sm font-semibold capitalize ${t === "inspiration" && !selectedId ? "invisible" : ""} ${tab === t ? "border-[#241426] text-[#241426]" : "border-transparent text-[#685e70]"}`}
            tabIndex={t === "inspiration" && !selectedId ? -1 : 0}
          >
            {t}
          </button>
        ))}
      </div>
      {tab === "pieces" ? (
        <>
          {(selectedId ? pieces.status === "LoadingFirstPage" : loading) ? (
            <p role="status" className="min-h-64">
              Loading pieces…
            </p>
          ) : selectedId && pieces.results.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#b6aabb] p-6">
              <p className="font-semibold">No pieces yet.</p>
            </div>
          ) : (
            <WardrobeGrid
              {...grid}
              items={selectedId ? pieces.results : grid.items}
              optimisticItems={selectedId ? [] : grid.optimisticItems}
              collectionLabel={selected?.name}
              onOpenItem={setItem}
            />
          )}
          {selectedId
            ? pieces.status === "CanLoadMore" && (
                <Button variant="outline" onClick={() => pieces.loadMore(24)}>
                  More collection pieces
                </Button>
              )
            : loadMore && (
                <Button variant="outline" onClick={loadMore}>
                  Load more pieces
                </Button>
              )}
        </>
      ) : (
        <div className="space-y-4">
          {selectedId && (
            <InspirationIntake
              collectionId={selectedId}
              collectionName={selected?.name ?? "Collection"}
            />
          )}
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
            {selectedId && inspirations.results.map(reference => (
              <InspirationCard key={reference.membershipId} reference={reference} onChange={removed => changeInspiration(selectedId, reference.membershipId, removed)} />
            ))}
          </div>
          {inspirations.status === "LoadingFirstPage" && (
            <p role="status">Loading inspiration…</p>
          )}
          {inspirations.results.length === 0 &&
            inspirations.status !== "LoadingFirstPage" && (
              <p className="rounded-xl border border-dashed p-6 text-sm">
                {inspirations.status === "CanLoadMore"
                  ? "No references on this page. Load more to keep browsing."
                  : "Save a photo to begin your moodboard."}
              </p>
            )}
          {inspirations.status === "CanLoadMore" && (
            <Button variant="outline" onClick={() => inspirations.loadMore(24)}>
              More inspiration
            </Button>
          )}
          <Button ref={recoveryButton} type="button" variant="ghost" className="min-h-11" aria-expanded={showRemovedInspiration} onClick={() => setShowRemovedInspiration(value => !value)}>{showRemovedInspiration ? "Hide removed inspiration" : "Removed inspiration"}</Button>
          {showRemovedInspiration && <section aria-label="Removed inspiration" className="space-y-3">
            <p role="status" className="text-sm">Removed inspiration stays here so you can restore it to this collection.</p>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">{selectedId && removedInspiration.results.map(reference => <InspirationCard key={reference.membershipId} reference={reference} removed onChange={removed => changeInspiration(selectedId, reference.membershipId, removed)} />)}</div>
            {removedInspiration.status === "LoadingFirstPage" && <p role="status">Loading removed inspiration…</p>}
            {removedInspiration.status === "Exhausted" && !removedInspiration.results.length && <p>No removed inspiration.</p>}
            {removedInspiration.status === "CanLoadMore" && <Button variant="outline" onClick={() => removedInspiration.loadMore(24)}>More removed inspiration</Button>}
          </section>}

        </div>
      )}
      {item && (
        <ItemDetailsDrawer
          key={item.id}
          item={item}
          onClose={() => setItem(null)}
        />
      )}
      <TaskSheet
        open={modal !== null}
        onOpenChange={(open) => {
          if (!open && !busy) setModal(null);
        }}
        title={
          modal === "create"
            ? "New collection"
            : modal === "edit"
              ? "Edit collection"
              : modal === "remove" ? "Remove collection" : "Add from your wardrobe"
        }
        footer={
          <>
            <div
              className="task-sheet-status"
              role={error ? "alert" : "status"}
            >
              {error || (busy ? "Saving…" : "")}
            </div>
            {modal === "remove" && selectedId ? <Button className="w-full" disabled={busy} onClick={() => void run(async () => { await archive({ wardrobeId: selectedId, archived: true }); setSelectedId(null); setModal(null); setShowRemoved(true); })}>Remove collection</Button> : modal !== "add" ? (
              <Button
                form="collection-editor"
                className="rack-primary-action w-full"
                disabled={busy || !name.trim()}
                type="submit"
              >
                {busy
                  ? "Saving…"
                  : modal === "edit"
                    ? "Save collection"
                    : "Create collection"}
              </Button>
            ) : (
              <Button
                variant="outline"
                className="w-full"
                disabled={busy}
                onClick={() => setModal(null)}
              >
                Done
              </Button>
            )}
          </>
        }
      >
        {modal === "remove" ? <p>Your pieces and photos stay in your wardrobe. This collection can be restored from Removed collections.</p> : modal !== "add" ? (
          <form
            id="collection-editor"
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                if (modal === "edit" && selectedId)
                  await update({
                    wardrobeId: selectedId,
                    name: name.trim(),
                    description: description.trim(),
                    ...createTraceContext(),
                  });
                else {
                  const result = await create({
                    name: name.trim(),
                    description: description.trim(),
                    kind: "locus",
                    ...createTraceContext(),
                  });
                  setSelectedId(result.id);
                }
                posthog.capture("wardrobe_collection_changed", {
                  operation: modal === "edit" ? "updated" : "created",
                  surface: "wardrobe",
                });
                setTab("pieces");
                setName("");
                setDescription("");
                setModal(null);
              });
            }}
          >
            {modal === "edit" && <Button type="button" variant="ghost" disabled={busy} onClick={() => setModal("remove")}>Remove collection</Button>}
            <label className="block space-y-2">
              Collection name
              <input
                aria-label="Collection name"
                data-private
                required
                maxLength={100}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Work edit"
                className="w-full rounded-lg border p-3"
              />
            </label>
            <label className="block space-y-2">
              What belongs here?
              <textarea
                aria-label="What belongs here?"
                data-private
                maxLength={1000}
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Relaxed tailoring for client meetings"
                className="w-full rounded-lg border p-3"
              />
            </label>
          </form>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              {grid.items.map((piece) => (
                <button
                  type="button"
                  key={piece.id}
                  disabled={
                    busy ||
                    pieces.results.some((member) => member.id === piece.id)
                  }
                  onClick={() =>
                    void run(async () => {
                      if (selectedId) {
                        await add({
                          wardrobeId: selectedId,
                          itemId: piece.id as Id<"wardrobeItems">,
                          membershipKind: "owned",
                          ...createTraceContext(),
                        });
                        posthog.capture("wardrobe_collection_changed", {
                          operation: "piece_added",
                          surface: "wardrobe",
                        });
                      }
                      setModal(null);
                    })
                  }
                  className="rounded-lg border p-2 text-left hover:bg-[#f1eaf4] disabled:opacity-50"
                  aria-label={`Add ${piece.category ?? "piece"} to collection`}
                  data-private
                >
                  <div className="relative h-32">
                    <Image
                      src={piece.imageUrl}
                      alt=""
                      fill
                      sizes="160px"
                      className="object-contain"
                    />
                  </div>
                  <span className="block p-2 text-sm font-semibold">
                    {piece.category ?? "Piece"}
                    {pieces.results.some(
                      (member) => member.id === piece.id,
                    ) && (
                      <span className="block text-xs font-normal">
                        Already included
                      </span>
                    )}
                  </span>
                </button>
              ))}
            </div>
            {loadMore && (
              <Button variant="outline" onClick={loadMore}>
                Load more wardrobe pieces
              </Button>
            )}
          </>
        )}
      </TaskSheet>
    </section>
  );
}
