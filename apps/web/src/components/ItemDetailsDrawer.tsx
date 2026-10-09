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
  const saveLabels = useMutation(api.wardrobe.saveLabels);
  const [labelDraft, setLabelDraft] = useState<{category: string; tags: string; wearPolicy: "after_each_wear" | "rewear" | "check"; ready: boolean} | null>(null);
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
    ...new Set([details?.category ?? item.category, ...(details?.styleTags ?? item.styleTags ?? [])].filter(Boolean)),
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
      {view === "labels" && <form id="item-label-editor" className="space-y-4" data-private onSubmit={event => { event.preventDefault(); const value = labelDraft ?? { category: details?.category ?? item.category ?? "", tags: (details?.styleTags ?? item.styleTags ?? []).join(", "), wearPolicy: details?.wearPolicy ?? "check", ready: false }; void run(async () => { await saveLabels({ itemId, category: value.category, styleTags: value.tags.split(","), wearPolicy: value.wearPolicy, readyToWear: value.ready }); setLabelDraft(null); }, "Labels saved."); }}>
        <label className="block space-y-2">Category<input aria-label="Category" maxLength={80} disabled={busy || !details} className="w-full rounded-lg border p-3" value={labelDraft?.category ?? details?.category ?? item.category ?? ""} onChange={event => setLabelDraft(current => ({ category: event.target.value, tags: current?.tags ?? (details?.styleTags ?? item.styleTags ?? []).join(", "), wearPolicy: current?.wearPolicy ?? details?.wearPolicy ?? "check", ready: current?.ready ?? false }))} /></label>
        <label className="block space-y-2">Labels, separated by commas<input aria-label="Labels, separated by commas" maxLength={1200} disabled={busy || !details} className="w-full rounded-lg border p-3" value={labelDraft?.tags ?? (details?.styleTags ?? item.styleTags ?? []).join(", ")} onChange={event => setLabelDraft(current => ({ category: current?.category ?? details?.category ?? item.category ?? "", tags: event.target.value, wearPolicy: current?.wearPolicy ?? details?.wearPolicy ?? "check", ready: current?.ready ?? false }))} /></label>
        <fieldset><legend className="mb-2 text-sm">Between wears</legend><div className="space-y-2">{([{value:"check",label:"I’ll check before wearing again"},{value:"after_each_wear",label:"Wash or prepare after each wear"},{value:"rewear",label:"Usually suitable to rewear"}] as const).map(option => <button key={option.value} type="button" disabled={busy || !details} aria-pressed={(labelDraft?.wearPolicy ?? details?.wearPolicy ?? "check") === option.value} className={`min-h-11 w-full rounded-lg border p-3 text-left ${(labelDraft?.wearPolicy ?? details?.wearPolicy ?? "check") === option.value ? "bg-[#E4FF91]" : "bg-white"}`} onClick={() => setLabelDraft(current => ({ category: current?.category ?? details?.category ?? item.category ?? "", tags: current?.tags ?? (details?.styleTags ?? item.styleTags ?? []).join(", "), wearPolicy: option.value, ready: current?.ready ?? false }))}>{option.label}</button>)}</div></fieldset>
        <label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={labelDraft?.ready ?? false} disabled={busy || !details} onChange={event => setLabelDraft(current => ({ category: current?.category ?? details?.category ?? item.category ?? "", tags: current?.tags ?? (details?.styleTags ?? item.styleTags ?? []).join(", "), wearPolicy: current?.wearPolicy ?? details?.wearPolicy ?? "check", ready: event.target.checked }))} />I’ve checked this piece; it’s ready to wear.</label>
        <Button type="submit" disabled={busy || !details} className="w-full">{busy ? "Saving…" : "Save labels"}</Button>
      </form>}
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
      {view === "remove" && <fieldset className="space-y-3" data-private><legend>Reason for removing this piece</legend>{["Disliked item style", "Item damaged/lost", "Poor fit", "Other"].map(reason => <button key={reason} type="button" disabled={busy} aria-pressed={removeReason === reason} onClick={() => setRemoveReason(reason)} className={`min-h-11 w-full rounded-lg border p-3 text-left ${removeReason === reason ? "bg-[#E4FF91]" : "bg-white"}`}>{reason}</button>)}</fieldset>}
    </TaskSheet>
  );
}
