"use client";

import Image from "next/image";
import { useState } from "react";
import { Trash2 } from "lucide-react";
import { deleteWardrobeItemAction } from "@/app/actions/wardrobe";
import { userFacingErrorMessage } from "@/lib/userFacingError";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import type { WardrobeItem } from "@/types/wardrobe";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "./ui/dialog";
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
  const restorePhoto = useMutation(api.garmentPreviewData.restore);
  const [draft, setDraft] = useState<string | null>(null);
  const [manage, setManage] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [removeReason, setRemoveReason] = useState("Disliked item style");
  const [removing, setRemoving] = useState(false);
  const note = draft ?? details?.note ?? item.note ?? "";
  const removeItem = async () => {
    setBusy(true);
    setRemoving(true);
    setError("");
    setMessage("");
    try {
      await deleteWardrobeItemAction({ itemId: item.id, reason: removeReason, ...createTraceContext() });
      onClose();
    } catch (cause) {
      setError(userFacingErrorMessage(cause, "Could not remove this piece. Try again."));
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
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent
        className="item-details-drawer ph-no-capture"
        onEscapeKeyDown={(event) => {
          if (confirmRemove) {
            event.preventDefault();
            if (!busy) setConfirmRemove(false);
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
      >
        <div className="flex items-center gap-4 pr-6" data-private>
          <div className="relative h-24 w-20 shrink-0 bg-[var(--rack-wash)]">
            <Image
              src={preview?.imageUrl ?? item.imageUrl}
              alt=""
              fill
              sizes="80px"
              className="object-contain"
            />
          </div>
          <div>
            <DialogTitle>{item.category ?? "Your piece"}</DialogTitle>
            <DialogDescription className="mt-2 line-clamp-3">
              {item.description ||
                "Keep the details that make this piece yours."}
            </DialogDescription>
          </div>
        </div>
        {(preview?.enabled || preview?.status === "ready") && (
          <section aria-label="Catalog preview" className="space-y-2">
            <h3 className="font-semibold">Catalog preview</h3>
            <p className="text-sm text-[#685e70]">AI removes the background and reconstructs hidden parts. Your original photo is kept.</p>
            {(preview.status === "queued" || preview.status === "processing") ? (
              <p role="status" className="text-sm">Creating preview…</p>
            ) : preview.status !== "ready" && (
              <Button variant="outline" disabled={busy || item.analysisStatus !== "ready"} onClick={() => void run(async () => {
                const queued = await generatePreview({ itemId });
                if (!queued) throw new Error("Preview unavailable");
                posthog.capture("wardrobe_preview_changed", { operation: "requested", surface: "wardrobe" });
              }, "Preview requested.")}>Create catalog preview</Button>
            )}
            {["ready", "queued", "processing"].includes(preview.status) && (
              <Button variant="ghost" disabled={busy} onClick={() => void run(async () => {
                await restorePhoto({ itemId });
                posthog.capture("wardrobe_preview_changed", { operation: "restored", surface: "wardrobe" });
              }, "Original photo restored.")}>Use original photo</Button>
            )}
            {preview.status === "skipped" && <p className="text-sm">This photo cannot produce a reliable preview. Try a clearer, closer photo.</p>}
            {preview.status === "error" && <p className="text-sm">The preview could not be completed. Your original photo is still shown.</p>}
          </section>
        )}
        <section aria-label="Item labels">
          <h3 className="font-semibold">Labels</h3>
          <div data-private className="mt-2 flex flex-wrap gap-2">
            {[
              ...new Set(
                [item.category, ...(item.styleTags ?? [])].filter(Boolean),
              ),
            ].map((label) => (
              <span
                key={label}
                className="border border-[#d8c9dc] bg-[#f7f3f5] px-3 py-1 text-sm"
              >
                {label}
              </span>
            ))}
            {!item.category && !item.styleTags?.length && (
              <p className="text-sm">Labels will appear after analysis.</p>
            )}
          </div>
        </section>
        <section aria-label="Item collections">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Collections</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setManage(!manage)}
            >
              {manage ? "Done" : "Manage"}
            </Button>
          </div>
          <p data-private className="text-sm text-[#685e70]">
            {details === undefined
              ? "Loading collections…"
              : details?.collections.map((c) => c.name).join(" · ") ||
                "Not in a collection yet"}
          </p>
          {details?.truncated && (
            <p className="text-sm">Showing the first 100 memberships.</p>
          )}
          {manage && (
            <div className="mt-3 max-h-48 space-y-1 overflow-y-auto rounded-lg border p-2">
              {choices.results.map((collection) => {
                return (
                  <CollectionChoice
                    key={collection._id}
                    collection={collection}
                    itemId={itemId}
                    busy={busy}
                    run={run}
                  />
                );
              })}
              {!choices.results.length && (
                <p className="p-2 text-sm">
                  Create a collection from the Wardrobe rail first.
                </p>
              )}
              {choices.status === "CanLoadMore" && (
                <Button variant="ghost" onClick={() => choices.loadMore(30)}>
                  More collections
                </Button>
              )}
            </div>
          )}
        </section>
        <label className="space-y-2 font-semibold">
          My note
          <textarea
            aria-label="My note"
            data-private
            maxLength={2000}
            rows={3}
            className="w-full rounded-lg border border-[#b6aabb] bg-white p-3 text-sm font-normal"
            placeholder="Sleeves run long. Great with the cream trousers…"
            value={note}
            disabled={busy || !details}
            onChange={(e) => {
              setDraft(e.target.value);
              setMessage("");
            }}
          />
        </label>
        <Button
          className="rack-primary-action min-w-32 justify-self-end"
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
          Save note
        </Button>
        {message && (
          <p role="status" className="text-sm">
            {message}
          </p>
        )}
        {error && (
          <p role="alert" className="text-sm text-[#B93267]">
            {error}
          </p>
        )}
        <section aria-label="Remove piece" className="border-t border-[#d8c9dc] pt-4">
          {confirmRemove ? (
            <div className="space-y-3">
              <h3 className="font-semibold">Remove this piece from your wardrobe?</h3>
              <label className="block space-y-2 text-sm">
                Reason for removing this piece
                <select
                  data-private
                  value={removeReason}
                  disabled={busy}
                  onChange={(event) => setRemoveReason(event.target.value)}
                  className="block min-h-11 w-full rounded-md border border-[#b6aabb] bg-white px-3"
                >
                  <option value="Disliked item style">Disliked style</option>
                  <option value="Item damaged/lost">Damaged or lost</option>
                  <option value="Poor fit">Poor fit</option>
                  <option value="Other">Other</option>
                </select>
              </label>
              <div className="flex justify-end gap-3">
                <Button variant="outline" disabled={busy} onClick={() => setConfirmRemove(false)}>Cancel</Button>
                <Button variant="destructive" disabled={busy} onClick={() => void removeItem()}>
                  {removing ? "Removing…" : "Remove piece"}
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="ghost" disabled={busy} className="text-[#B93267]" onClick={() => setConfirmRemove(true)}>
              <Trash2 aria-hidden="true" className="size-4" /> Remove from wardrobe
            </Button>
          )}
        </section>
      </DialogContent>
    </Dialog>
  );
}
