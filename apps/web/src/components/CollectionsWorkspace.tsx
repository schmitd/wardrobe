"use client";

import Image from "next/image";
import { useState } from "react";
import { useMutation, usePaginatedQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import type { WardrobeItem } from "@/types/wardrobe";
import { FolderHeart, Pencil, Plus } from "lucide-react";
import CollectionEnsemble from "./CollectionEnsemble";
import WardrobeGrid, { type WardrobeGridProps } from "./WardrobeGrid";
import ItemDetailsDrawer from "./ItemDetailsDrawer";
import InspirationIntake from "./InspirationIntake";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "./ui/dialog";
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
  const [item, setItem] = useState<WardrobeItem | null>(null);
  const [modal, setModal] = useState<"create" | "edit" | "add" | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
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
  return (
    <section
      id="collections"
      aria-label="Wardrobe collections"
      className="ph-no-capture space-y-5"
    >
      <div>
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold" data-private>
              {selected?.name ?? (selectedId ? "Collection" : "All pieces")}
            </h2>
            {selected && (
              <Button
                variant="ghost"
                size="icon"
                aria-label="Edit collection"
                onClick={() => {
                  setName(selected.name);
                  setDescription(selected.description ?? "");
                  setError("");
                  setModal("edit");
                }}
              >
                <Pencil className="size-4" />
              </Button>
            )}
          </div>
          {selected?.description && (
            <p
              data-private
              className="mt-1 line-clamp-2 text-sm text-[#685e70]"
            >
              {selected.description}
            </p>
          )}
        </div>
        {selectedId && (
          <Button
            variant="outline"
            onClick={() => {
              setModal("add");
              setError("");
            }}
          >
            <Plus />
            Add from wardrobe
          </Button>
        )}
      </div>
      {selectedId && (
        <div
          className="flex border-b border-[#d8c9dc]"
          aria-label="Collection views"
        >
          {(["pieces", "inspiration"] as const).map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={tab === t}
              onClick={() => setTab(t)}
              className={`min-h-11 border-b-2 px-5 text-sm font-semibold capitalize ${tab === t ? "border-[#241426] text-[#241426]" : "border-transparent text-[#685e70]"}`}
            >
              {t}
            </button>
          ))}
        </div>
      )}
      {tab === "pieces" ? (
        <>
          {(selectedId ? pieces.status === "LoadingFirstPage" : loading) ? (
            <p role="status">Loading pieces…</p>
          ) : selectedId && pieces.results.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#b6aabb] p-6">
              <p className="font-semibold">
                No pieces yet.
              </p>
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
            {inspirations.results.map((reference) => (
              <article
                key={reference._id}
                data-private
                className="overflow-hidden rounded-xl border border-[#d8c9dc] bg-white"
              >
                <div className="relative aspect-square bg-[#eee7ee]">
                  {reference.imageUrl ? (
                    <Image
                      src={reference.imageUrl}
                      alt={reference.description ?? "Saved inspiration"}
                      fill
                      sizes="(max-width: 640px) 45vw, 250px"
                      className="object-contain"
                    />
                  ) : (
                    <FolderHeart className="m-auto h-full w-10" />
                  )}
                </div>
                <p className="p-3 text-sm">
                  {reference.description ??
                    reference.category ??
                    "Saved reference"}
                </p>
              </article>
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
        </div>
      )}
      {item && (
        <ItemDetailsDrawer
          key={item.id}
          item={item}
          onClose={() => setItem(null)}
        />
      )}
      <Dialog
        open={modal !== null}
        onOpenChange={(open) => {
          if (!open && !busy) setModal(null);
        }}
      >
        <DialogContent aria-describedby={undefined} className="ph-no-capture max-h-[85dvh] overflow-y-auto">
          <DialogTitle>
            {modal === "create"
              ? "New collection"
              : modal === "edit"
                ? "Edit collection"
                : "Add from your wardrobe"}
          </DialogTitle>
          {modal !== "add" ? (
            <form
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
              <Button className="rack-primary-action" disabled={busy || !name.trim()} type="submit">
                {busy
                  ? "Saving…"
                  : modal === "edit"
                    ? "Save collection"
                    : "Create collection"}
              </Button>
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
          {error && (
            <p role="alert" className="text-sm text-[#B93267]">
              {error}
            </p>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
