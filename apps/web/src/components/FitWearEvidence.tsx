"use client";
import Image from "next/image";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { useState } from "react";
import { localDate, type PlanningOperation } from "@wardrobe/shared";
import { planningRequest } from "@/lib/planning-client";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
import { Button } from "./ui/button";

export default function FitWearEvidence({ fitId }: { fitId: string }) {
  const wears = useQuery(api.wear.list, {});
  const plans = useQuery(api.planning.load, {});
  const wear = wears?.find((row) =>
    row.photos.some((photo) => photo.id === fitId),
  );
  const [selected, setSelected] = useState<string[]>([]);
  const [editing, setEditing] = useState(false);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [date, setDate] = useState("");
  const [editDate, setEditDate] = useState(false);
  const run = async (input: PlanningOperation) => {
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      await planningRequest(input);
      setEditDate(false);
      setEditing(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  };
  if (!wear) return null;
  const candidates =
    !wear.planId && wear.localDate
      ? (plans?.suggestions.filter(
          (plan) =>
            plan.date === wear.localDate &&
            (plan.status === "planned" || plan.status === "worn") &&
            !plan.notWornAt &&
            plan.itemIds.some((id) => wear.itemIds.includes(id)),
        ) ?? [])
      : [];
  return (
    <div data-private className="mt-3 space-y-3 border-t border-[#e5dbe8] pt-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">
          {wear.localDate
            ? `Worn ${new Date(`${wear.localDate}T12:00:00`).toLocaleDateString()}`
            : "When did you wear this?"}
        </p>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setDate(wear.localDate ?? localDate());
            setEditDate(!editDate);
          }}
        >
          {wear.localDate ? "Edit date" : "Set date"}
        </Button>
      </div>
      {(editDate || !wear.localDate) && (
        <div className="flex flex-wrap gap-2">
          <input
            aria-label="Wear date"
            type="date"
            value={date || localDate()}
            max={localDate()}
            onChange={(e) => setDate(e.target.value)}
            className="min-h-11 rounded-lg border p-2"
          />
          <Button
            disabled={busy}
            onClick={() =>
              void run({
                operation: "wear_update",
                id: wear.id,
                expectedRevision: wear.revision,
                action: "set_date",
                localDate: date || localDate(),
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
              })
            }
          >
            Save date
          </Button>
        </div>
      )}
      {wear.pieces.length > 0 && (
        <div
          className="flex flex-wrap gap-2"
          aria-label="Identified worn pieces"
        >
          {wear.pieces.map((piece) => (
            <div key={piece.id} className="w-14 text-center">
              {piece.imageUrl && (
                <Image
                  src={piece.imageUrl}
                  alt={piece.category}
                  width={56}
                  height={64}
                  unoptimized
                  className="h-16 w-14 rounded-lg bg-[#f7f5f8] object-contain"
                />
              )}
              <p className="text-xs">{piece.category}</p>
            </div>
          ))}
        </div>
      )}
      <p className="text-xs text-[#685e70]">
        {wear.unresolvedCount
          ? `${wear.unresolvedCount} ${wear.unresolvedCount === 1 ? "piece needs" : "pieces need"} a closer look. Identified pieces are already recorded as worn.`
          : wear.itemIds.length
            ? "Identified pieces recorded as worn."
            : "Photo saved. No pieces are currently counted as worn."}
        {wear.planId &&
          ` ${wear.outcome === "confirmed_as_planned" ? "Matches your plan." : wear.outcome === "worn_differently" ? "Actual outfit differs from the plan." : "Your plan is still unconfirmed."}`}
      </p>
      {candidates.map((plan) => (
        <Button
          key={plan._id}
          variant="outline"
          disabled={busy}
          onClick={() =>
            void run({
              operation: "wear_update",
              id: wear.id,
              expectedRevision: wear.revision,
              action: "attach_plan",
              planId: plan._id,
              expectedPlanRevision: plan.planRevision ?? 0,
            })
          }
        >
          This was my {plan.title} outfit
        </Button>
      ))}
      <Button
        variant="outline"
        disabled={busy}
        onClick={() => {
          setSelected(wear.itemIds);
          setSearch("");
          setEditing(true);
        }}
      >
        Edit actual outfit
      </Button>
      <Dialog
        open={editing}
        onOpenChange={(open) => {
          if (!busy) setEditing(open);
        }}
      >
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogTitle>What did you wear?</DialogTitle>
          <DialogDescription>
            Choose the actual pieces. Your original plan and photo stay in
            history.
          </DialogDescription>
          <input
            aria-label="Find a piece"
            placeholder="Find a piece…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded-lg border p-3"
          />
          <div data-private className="grid grid-cols-3 gap-2">
            {plans?.items
              .filter((item) =>
                `${item.category} ${item.description}`
                  .toLowerCase()
                  .includes(search.toLowerCase()),
              )
              .map((item) => (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={selected.includes(item.id)}
                  onClick={() =>
                    setSelected((ids) =>
                      ids.includes(item.id)
                        ? ids.filter((id) => id !== item.id)
                        : [...ids, item.id],
                    )
                  }
                  className={`rounded-xl border-2 p-2 ${selected.includes(item.id) ? "border-[#735079] bg-[#f1e8f3]" : "border-transparent bg-[#f7f5f8]"}`}
                >
                  {item.imageUrl && (
                    <Image
                      src={item.imageUrl}
                      alt={item.description || item.category}
                      width={120}
                      height={132}
                      unoptimized
                      className="h-28 w-full object-contain"
                    />
                  )}
                  <span className="text-sm font-semibold">{item.category}</span>
                </button>
              ))}
          </div>
          <Button
            disabled={busy || !selected.length || selected.length > 12}
            onClick={() =>
              void run({
                operation: "wear_update",
                id: wear.id,
                expectedRevision: wear.revision,
                action: "correct",
                itemIds: selected,
              })
            }
          >
            Save actual outfit
          </Button>
        </DialogContent>
      </Dialog>
      {wear.planId && (
        <Button
          variant="ghost"
          disabled={busy}
          onClick={() =>
            void run({
              operation: "wear_update",
              id: wear.id,
              expectedRevision: wear.revision,
              action: "detach_plan",
            })
          }
        >
          Unlink plan
        </Button>
      )}
      <Button
        variant="ghost"
        disabled={busy}
        onClick={() =>
          void run({
            operation: "wear_update",
            id: wear.id,
            expectedRevision: wear.revision,
            action:
              wear.photos.find((photo) => photo.id === fitId)?.countsAsWear ===
              false
                ? "restore_photo"
                : "retract_photo",
            fitId,
          })
        }
      >
        {wear.photos.find((photo) => photo.id === fitId)?.countsAsWear === false
          ? "Count this photo as wear"
          : "Don’t count this photo as wear"}
      </Button>
      {wear.canUndoManual && (
        <Button
          variant="ghost"
          disabled={busy}
          onClick={() =>
            void run({
              operation: "wear_update",
              id: wear.id,
              expectedRevision: wear.revision,
              action: "undo_manual",
            })
          }
        >
          Undo manual confirmation
        </Button>
      )}
      {message && (
        <p role="alert" className="text-sm text-[#a32856]">
          {message}
        </p>
      )}
    </div>
  );
}
