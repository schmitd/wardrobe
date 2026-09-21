"use client";

import Image from "next/image";
import { useState } from "react";
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
  const add = useMutation(api.wardrobes.addItemToWardrobe);
  const remove = useMutation(api.wardrobes.removeItemFromWardrobe);
  const [draft, setDraft] = useState<string | null>(null);
  const [manage, setManage] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const note = draft ?? details?.note ?? item.note ?? "";
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
        className="item-details-drawer"
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
              src={item.imageUrl}
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
                const checked =
                  details?.collections.some((c) => c.id === collection._id) ??
                  false;
                return (
                  <label
                    key={collection._id}
                    className="flex min-h-11 items-center gap-3 px-2"
                    data-private
                  >
                    <input
                      type="checkbox"
                      disabled={busy || !details}
                      checked={checked}
                      onChange={() =>
                        void run(
                          () =>
                            checked
                              ? remove({ wardrobeId: collection._id, itemId })
                              : add({
                                  wardrobeId: collection._id,
                                  itemId,
                                  membershipKind: "owned",
                                  ...createTraceContext(),
                                }),
                          "Collections updated.",
                        )
                      }
                    />
                    {collection.name}
                  </label>
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
      </DialogContent>
    </Dialog>
  );
}
