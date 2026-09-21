"use client";

import Image from "next/image";
import { useState } from "react";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import type { WardrobeItem } from "@/types/wardrobe";
import { FolderHeart, Grid2X2, Plus } from "lucide-react";
import WardrobeGrid, { type WardrobeGridProps } from "./WardrobeGrid";
import ItemDetailsDrawer from "./ItemDetailsDrawer";
import InspirationIntake from "./InspirationIntake";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "./ui/dialog";
import { createTraceContext } from "@/lib/trace";

export default function CollectionsWorkspace({
  loadMore,
  loading,
  ...grid
}: WardrobeGridProps & { loadMore?: () => void; loading?: boolean }) {
  const collections = usePaginatedQuery(
    api.mobile.plans,
    {},
    { initialNumItems: 30 },
  );
  const [selectedId, setSelectedId] = useState<Id<"wardrobes"> | null>(null);
  const selected = collections.results.find((c) => c._id === selectedId);
  const [tab, setTab] = useState<"pieces" | "inspiration">("pieces");
  const pieces = usePaginatedQuery(
    api.wardrobe.pagePieces,
    selectedId ? { wardrobeId: selectedId } : "skip",
    { initialNumItems: 24 },
  );
  const inspirations = useQuery(
    api.candidates.listInspirationByWardrobe,
    selectedId && tab === "inspiration" ? { wardrobeId: selectedId } : "skip",
  );
  const [item, setItem] = useState<WardrobeItem | null>(null);
  const [modal, setModal] = useState<"create" | "add" | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const create = useMutation(api.wardrobes.createWardrobe);
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
      className="space-y-5"
    >
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
          <span className="collection-orb">
            <Grid2X2 aria-hidden="true" />
          </span>
          <span>All pieces</span>
        </button>
        {collections.results.map((c, index) => (
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
            <span className={`collection-orb collection-orb--${index % 3}`}>
              <FolderHeart aria-hidden="true" />
            </span>
            <span className="line-clamp-2">{c.name}</span>
          </button>
        ))}
        <button
          type="button"
          className="collection-shortcut"
          onClick={() => {
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
            onClick={() => collections.loadMore(30)}
          >
            <span className="collection-orb">…</span>
            <span>More</span>
          </button>
        )}
      </nav>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold" data-private>
            {selected?.name ?? (selectedId ? "Collection" : "All pieces")}
          </h2>
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
                Give this collection a starting point.
              </p>
              <p className="mt-1 text-sm text-[#685e70]">
                Add pieces you own or switch to Inspiration to save an idea.
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
          <p className="text-sm text-[#685e70]">
            Saved ideas and references. These aren’t treated as pieces you own.
          </p>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
            {inspirations?.map((reference) => (
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
          {inspirations?.length === 0 && (
            <p className="rounded-xl border border-dashed p-6 text-sm">
              Save a photo to begin your moodboard.
            </p>
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
        <DialogContent className="max-h-[85dvh] overflow-y-auto">
          <DialogTitle>
            {modal === "create" ? "New collection" : "Add from your wardrobe"}
          </DialogTitle>
          <DialogDescription>
            {modal === "create"
              ? "Collect pieces and inspiration around a mood, occasion, or everyday routine."
              : "Choose pieces to include. Your whole wardrobe stays available."}
          </DialogDescription>
          {modal === "create" ? (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                void run(async () => {
                  const result = await create({
                    name: name.trim(),
                    description: description.trim(),
                    kind: "locus",
                    ...createTraceContext(),
                  });
                  setSelectedId(result.id);
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
                  data-private
                  maxLength={1000}
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Relaxed tailoring for client meetings"
                  className="w-full rounded-lg border p-3"
                />
              </label>
              <Button disabled={busy || !name.trim()} type="submit">
                {busy ? "Creating…" : "Create collection"}
              </Button>
            </form>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                {grid.items.map((piece) => (
                  <button
                    type="button"
                    key={piece.id}
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        if (selectedId)
                          await add({
                            wardrobeId: selectedId,
                            itemId: piece.id as Id<"wardrobeItems">,
                            membershipKind: "owned",
                            ...createTraceContext(),
                          });
                        setModal(null);
                      })
                    }
                    className="rounded-lg border p-2 text-left hover:bg-[#f1eaf4]"
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
