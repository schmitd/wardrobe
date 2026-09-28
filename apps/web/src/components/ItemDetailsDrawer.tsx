"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { ChevronRight, Trash2 } from "lucide-react";
import { deleteWardrobeItemAction } from "@/app/actions/wardrobe";
import { userFacingErrorMessage } from "@/lib/userFacingError";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import type { WardrobeItem } from "@/types/wardrobe";
import { Button } from "./ui/button";
import TaskSheet from "./TaskSheet";
import { createTraceContext } from "@/lib/trace";
import posthog from "posthog-js";

function CollectionChoice({
  collection,
  itemId,
  busy,
  run,
}: {
  collection: { _id: Id<"wardrobes">; name: string };
  itemId: Id<"wardrobeItems">;
  busy: boolean;
  run: (work: () => Promise<unknown>, success: string) => Promise<void>;
}) {
  const add = useMutation(api.wardrobes.addItemToWardrobe);
  const remove = useMutation(api.wardrobes.removeItemFromWardrobe);
  const checked = useQuery(api.wardrobe.itemCollectionMembership, {
    itemId,
    wardrobeId: collection._id,
  });
  return (
    <label className="flex min-h-11 items-center gap-3 px-2" data-private>
      <input
        type="checkbox"
        disabled={busy || checked === undefined}
        checked={checked ?? false}
        onChange={() =>
          void run(async () => {
            await (checked
              ? remove({ wardrobeId: collection._id, itemId })
              : add({
                  wardrobeId: collection._id,
                  itemId,
                  membershipKind: "owned",
                  ...createTraceContext(),
                }));
            posthog.capture("wardrobe_collection_changed", {
              operation: checked ? "piece_removed" : "piece_added",
              surface: "wardrobe",
            });
          }, "Collections updated.")
        }
      />
      {collection.name}
    </label>
  );
}

export default function ItemDetailsDrawer({
  item,
  onClose,
}: {
  item: WardrobeItem;
  onClose: () => void;
}) {
  const itemId = item.id as Id<"wardrobeItems">;
  const details = useQuery(api.wardrobe.itemDetails, { itemId });
  const choices = usePaginatedQuery(
    api.mobile.plans,
    {},
    { initialNumItems: 30 },
  );
  const saveNote = useMutation(api.wardrobe.saveNote);
  const preview = useQuery(api.garmentPreviewData.status, { itemId });
  const generatePreview = useMutation(api.garmentPreviewData.request);
  const [draft, setDraft] = useState<string | null>(null);
  const [view, setView] = useState<
    "overview" | "labels" | "collections" | "note" | "remove"
  >("overview");
  const detailHeading = useRef<HTMLHeadingElement>(null);
  const returnTo = useRef<string | null>(null);
  const visited = useRef(false);
  useEffect(() => {
    if (!visited.current) {
      visited.current = true;
      return;
    }
    if (view === "overview")
      document
        .querySelector<HTMLButtonElement>(
          `[data-piece-detail="${returnTo.current}"]`,
        )
        ?.focus();
    else detailHeading.current?.focus();
  }, [view]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [removeReason, setRemoveReason] = useState("");
  const [removing, setRemoving] = useState(false);
  const note = draft ?? details?.note ?? item.note ?? "";
  const removeItem = async () => {
    setBusy(true);
    setRemoving(true);
    setError("");
    setMessage("");
    try {
      await deleteWardrobeItemAction({
        itemId: item.id,
        reason: removeReason,
        ...createTraceContext(),
      });
      onClose();
    } catch (cause) {
      setError(
        userFacingErrorMessage(
          cause,
          "Could not remove this piece. Try again.",
        ),
      );
    } finally {
      setBusy(false);
      setRemoving(false);
    }
  };
  const run = async (work: () => Promise<unknown>, success: string) => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await work();
      setMessage(success);
    } catch {
      setError("Could not save this change. Please try again.");
    } finally {
      setBusy(false);
    }
  };
  const labels = [
    ...new Set([item.category, ...(item.styleTags ?? [])].filter(Boolean)),
  ];
  const collectionNames =
    details === undefined
      ? "Loading collections…"
      : details?.collections.map((c) => c.name).join(" · ") ||
        "Not in a collection yet";
  const titles = {
    overview: "Your piece",
    labels: "Labels",
    collections: "Collections",
    note: "My note",
    remove: "Remove piece",
  };
  const back = () => {
    setView("overview");
    setError("");
    setMessage("");
  };
  const openDetail = (next: typeof view) => {
    returnTo.current = next;
    setView(next);
    setMessage("");
    setError("");
  };
  return (
    <TaskSheet
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
      title={titles[view]}
      className="ph-no-capture"
      onEscapeKeyDown={(event) => {
        if (view !== "overview" || busy) {
          event.preventDefault();
          if (!busy) back();
        }
      }}
      onCloseAutoFocus={(event) => {
        event.preventDefault();
        (
          document.querySelector<HTMLButtonElement>(
            `[data-piece-open="${item.id}"]`,
          ) ??
          document.querySelector<HTMLButtonElement>(
            '[aria-label="Collections"] button[aria-pressed="true"]',
          )
        )?.focus();
      }}
      hero={
        <div className="flex h-28 items-center gap-5" data-private>
          <div className="relative h-28 w-24 shrink-0">
            <Image
              src={preview?.imageUrl ?? item.imageUrl}
              alt={item.category ?? "Your piece"}
              fill
              sizes="96px"
              className="object-contain"
            />
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold">{item.category ?? "Your piece"}</h3>
            <p className="mt-2 line-clamp-3 text-sm text-[#685e70]">
              {item.description}
            </p>
          </div>
        </div>
      }
      footer={
        <>
          <div className="task-sheet-status">
            {error ? (
              <p role="alert" className="text-[#B93267]">
                {error}
              </p>
            ) : (
              <p role="status">{message}</p>
            )}
          </div>
          {view === "note" ? (
            <div className="flex gap-3">
              <Button variant="outline" disabled={busy} onClick={back}>
                Back
              </Button>
              <Button
                className="rack-primary-action flex-1"
                disabled={busy || !details || note === details.note}
                onClick={() =>
                  void run(async () => {
                    await saveNote({ itemId, note });
                    setDraft(note.trim());
                    posthog.capture("wardrobe_item_note_saved", {
                      character_count: note.length,
                      surface: "wardrobe",
                    });
                  }, "Note saved.")
                }
              >
                {busy ? "Saving…" : "Save note"}
              </Button>
            </div>
          ) : view === "remove" ? (
            <div className="flex gap-3">
              <Button variant="outline" disabled={busy} onClick={back}>
                Cancel
              </Button>
              <Button
                className="flex-1"
                variant="destructive"
                disabled={busy || !removeReason}
                onClick={() => void removeItem()}
              >
                {removing ? "Removing…" : "Remove piece"}
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              className="w-full"
              disabled={busy}
              onClick={view === "overview" ? onClose : back}
            >
              {view === "overview" ? "Done" : "Back to piece"}
            </Button>
          )}
        </>
      }
    >
      {view !== "overview" && (
        <h3
          ref={detailHeading}
          tabIndex={-1}
          className="mb-4 font-semibold outline-none"
        >
          {view === "collections"
            ? "Keep this piece in"
            : view === "remove"
              ? "Remove this piece from your wardrobe?"
              : titles[view]}
        </h3>
      )}
      {view === "overview" && (
        <>
          {(
            [
              [
                "labels",
                "Labels",
                labels.join(", ") || "Labels will appear after analysis.",
              ],
              ["collections", "Collections", collectionNames],
              ["note", "My note", note || "Add a note"],
            ] as const
          ).map(([next, title, summary]) => (
            <button
              key={next}
              type="button"
              className="task-sheet-row"
              data-piece-detail={next}
              onClick={() => openDetail(next)}
            >
              <span>
                <span className="font-semibold">{title}</span>
                <small data-private className="line-clamp-2">
                  {summary}
                </small>
              </span>
              <ChevronRight className="size-5 shrink-0" aria-hidden="true" />
            </button>
          ))}
          {preview?.enabled && preview.status !== "ready" && (
            <section
              aria-label="Photo status"
              className="mt-5 space-y-2 text-sm"
            >
              {preview.status === "queued" ||
              preview.status === "processing" ? (
                <p role="status">Preparing photo…</p>
              ) : (
                <>
                  {preview.status === "skipped" && (
                    <p>Try a clearer photo of this piece.</p>
                  )}
                  {preview.status === "error" && (
                    <p>Couldn’t prepare this photo.</p>
                  )}
                  {preview.status !== "skipped" && (
                    <Button
                      variant="outline"
                      disabled={busy || item.analysisStatus !== "ready"}
                      onClick={() =>
                        void run(async () => {
                          if (!(await generatePreview({ itemId })))
                            throw new Error("Photo unavailable");
                          posthog.capture("wardrobe_preview_changed", {
                            operation: "requested",
                            surface: "wardrobe",
                          });
                        }, "")
                      }
                    >
                      {preview.status === "error"
                        ? "Try again"
                        : "Prepare photo"}
                    </Button>
                  )}
                </>
              )}
            </section>
          )}
          <Button
            variant="ghost"
            className="mt-6 text-[#B93267]"
            disabled={busy}
            data-piece-detail="remove"
            onClick={() => openDetail("remove")}
          >
            <Trash2 aria-hidden="true" className="size-4" />
            Remove from wardrobe
          </Button>
        </>
      )}
      {view === "labels" && (
        <section
          aria-label="Item labels"
          data-private
          className="flex flex-wrap gap-2"
        >
          {labels.map((label) => (
            <span
              key={label}
              className="border border-[#d8c9dc] bg-[#f7f3f5] px-3 py-2 text-sm"
            >
              {label}
            </span>
          ))}
          {!labels.length && <p>Labels will appear after analysis.</p>}
        </section>
      )}
      {view === "collections" && (
        <section
          aria-label="Item collections"
          className="divide-y divide-[#eee6f0]"
        >
          {choices.results.map((collection) => (
            <CollectionChoice
              key={collection._id}
              collection={collection}
              itemId={itemId}
              busy={busy}
              run={run}
            />
          ))}
          {!choices.results.length && (
            <p className="py-3 text-sm">
              {choices.status === "LoadingFirstPage"
                ? "Loading collections…"
                : "Create a collection from the Wardrobe rail first."}
            </p>
          )}
          {choices.status === "CanLoadMore" && (
            <Button variant="ghost" onClick={() => choices.loadMore(30)}>
              More collections
            </Button>
          )}
          {details?.truncated && (
            <p className="text-sm">
              The overview shows the first 100 memberships.
            </p>
          )}
        </section>
      )}
      {view === "note" && (
        <textarea
          aria-label="My note"
          data-private
          maxLength={2000}
          rows={6}
          className="w-full resize-none rounded-lg border border-[#b6aabb] bg-white p-3 text-sm"
          placeholder="Sleeves run long. Great with the cream trousers…"
          value={note}
          disabled={busy || !details}
          onChange={(event) => {
            setDraft(event.target.value);
            setMessage("");
          }}
        />
      )}
      {view === "remove" && (
        <label className="block space-y-2 text-sm">
          Reason for removing this piece
          <select
            data-private
            value={removeReason}
            disabled={busy}
            onChange={(event) => setRemoveReason(event.target.value)}
            className="block min-h-11 w-full rounded-md border border-[#b6aabb] bg-white px-3"
          >
            <option value="">Choose a reason…</option>
            <option value="Disliked item style">Disliked style</option>
            <option value="Item damaged/lost">Damaged or lost</option>
            <option value="Poor fit">Poor fit</option>
            <option value="Other">Other</option>
          </select>
        </label>
      )}
    </TaskSheet>
  );
}
