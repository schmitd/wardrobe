"use client";
import Image from "next/image";
import { useState } from "react";
import {
  localDate,
  type WearOutfit,
  type PlanningOperation,
} from "@wardrobe/shared";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "./ui/dialog";
import { useQuery, usePaginatedQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { useUser } from "@clerk/nextjs";
import { planningRequest } from "@/lib/planning-client";

const dateLabel = (date: string) =>
  new Date(`${date}T12:00:00`).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

export default function WornOutfits() {
  const { isSignedIn } = useUser();
  const data = useQuery(api.planning.load, isSignedIn ? {} : "skip");
  const pendingPage = usePaginatedQuery(
    api.wear.pendingPlans,
    isSignedIn ? { through: localDate() } : "skip",
    { initialNumItems: 20 },
  );
  const wears = useQuery(api.wear.list, isSignedIn ? {} : "skip");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [editing, setEditing] = useState<WearOutfit | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const run = async (input: PlanningOperation) => {
    if (busy) return false;
    setBusy(true);
    setMessage("");
    try {
      await planningRequest(input);
      return true;
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not save. Try again.",
      );
      return false;
    } finally {
      setBusy(false);
    }
  };
  const pending = pendingPage.results.filter((plan) => !plan.notWornAt);
  const manual =
    wears
      ?.filter((row) => row.photos.length === 0)
      .sort((a, b) => (b.localDate ?? "").localeCompare(a.localDate ?? "")) ??
    [];
  return (
    <section className="space-y-4" aria-label="Outfit diary">
      {message && (
        <p role="alert" className="text-sm text-[#a32856]">
          {message}
        </p>
      )}
      {pending.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-xl font-semibold">Still unconfirmed</h2>
          <p className="text-sm text-[#685e70]">
            Your plans stay here until you record what you wore.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {pending.map((plan) => (
              <article
                key={plan.id}
                data-private
                className="rounded-2xl border border-[#ddd3df] bg-[#faf7fb] p-4"
              >
                <p className="text-xs font-semibold text-[#735079]">
                  {dateLabel(plan.date)} · Planned
                </p>
                <h3 className="mt-1 font-semibold">{plan.title}</h3>
                <div className="my-3 flex flex-wrap gap-2">
                  {plan.itemIds.map((id) => {
                    const item = plan.pieces.find((i) => i.id === id);
                    return item?.imageUrl ? (
                      <Image
                        key={id}
                        src={item.imageUrl}
                        alt={item.category}
                        width={52}
                        height={64}
                        unoptimized
                        className="h-16 w-13 rounded-lg bg-white object-contain"
                      />
                    ) : null;
                  })}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    disabled={busy}
                    onClick={() =>
                      void run({
                        operation: "planning_worn",
                        id: plan.id,
                        expectedRevision: plan.revision,
                      })
                    }
                  >
                    Wore it
                  </Button>
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() => {
                      setEditing({
                        id: plan.id,
                        revision: plan.revision,
                        planId: plan.id,
                        localDate: plan.date,
                        itemIds: plan.itemIds,
                        pieces: [],
                        photos: [],
                        unresolvedCount: 0,
                        coverage: "partial",
                        outcome: "unconfirmed",
                        canUndoManual: false,
                        recordedAt: Date.now(),
                      });
                      setSelected(plan.itemIds);
                      setSearch("");
                    }}
                  >
                    Wore something else
                  </Button>
                  <Button
                    variant="ghost"
                    disabled={busy}
                    onClick={() =>
                      void run({
                        operation: "planning_not_worn",
                        id: plan.id,
                        expectedRevision: plan.revision,
                      })
                    }
                  >
                    Didn’t wear this
                  </Button>
                </div>
              </article>
            ))}
          </div>
        </div>
      )}
      {pendingPage.results
        .filter((plan) => plan.notWornAt)
        .map((plan) => (
          <article key={plan.id} data-private className="rounded-xl border p-4">
            <p>{dateLabel(plan.date)} · Didn’t wear this</p>
            <p className="font-semibold">{plan.title}</p>
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() =>
                void run({
                  operation: "planning_clear_response",
                  id: plan.id,
                  expectedRevision: plan.revision,
                })
              }
            >
              Edit response
            </Button>
          </article>
        ))}
      {data?.suggestions
        .filter((plan) => plan.status === "worn" && !plan.wearOccurrenceId)
        .map((plan) => (
          <article
            key={plan._id}
            data-private
            className="rounded-xl border p-4"
          >
            <p>{dateLabel(plan.date)} · Previously recorded</p>
            <p className="font-semibold">{plan.title}</p>
            <p className="text-sm text-[#685e70]">
              Saved before photo evidence tracking.
            </p>
          </article>
        ))}
      {pendingPage.status === "CanLoadMore" && (
        <Button variant="outline" onClick={() => pendingPage.loadMore(20)}>
          Load earlier plans
        </Button>
      )}
      {manual.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-xl font-semibold">Recorded outfits</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {manual.map((wear) => (
              <article
                key={wear.id}
                data-private
                className="rounded-2xl border bg-white p-4"
              >
                <p className="text-xs font-semibold text-[#735079]">
                  {wear.localDate
                    ? dateLabel(wear.localDate)
                    : "Wear date unknown"}{" "}
                  · Confirmed by you
                </p>
                <div className="my-3 flex flex-wrap gap-2">
                  {wear.pieces.map((piece) => (
                    <div key={piece.id} className="w-16 text-center">
                      {piece.imageUrl && (
                        <Image
                          src={piece.imageUrl}
                          alt={piece.category}
                          width={64}
                          height={80}
                          unoptimized
                          className="h-20 w-16 object-contain"
                        />
                      )}
                      <p className="text-xs">{piece.category}</p>
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() => {
                      setEditing(wear);
                      setSelected(wear.itemIds);
                      setSearch("");
                    }}
                  >
                    Edit actual outfit
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
                      Undo confirmation
                    </Button>
                  )}
                </div>
              </article>
            ))}
          </div>
        </div>
      )}
      <Dialog
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open && !busy) setEditing(null);
        }}
      >
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
          <DialogTitle>What did you wear?</DialogTitle>
          <DialogDescription>
            Select the actual pieces. Your original plan stays in your history.
          </DialogDescription>
          <input
            aria-label="Find a piece"
            className="w-full rounded-xl border p-3"
            placeholder="Find a piece…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div data-private className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {data?.items
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
                    setSelected((current) =>
                      current.includes(item.id)
                        ? current.filter((id) => id !== item.id)
                        : [...current, item.id],
                    )
                  }
                  className={`rounded-xl border-2 p-2 text-center ${selected.includes(item.id) ? "border-[#735079] bg-[#f1e8f3]" : "border-transparent bg-[#f7f5f8]"}`}
                >
                  {item.imageUrl ? (
                    <Image
                      src={item.imageUrl}
                      alt={item.description || item.category}
                      width={120}
                      height={132}
                      unoptimized
                      className="h-28 w-full object-contain"
                    />
                  ) : (
                    <div className="h-28 content-center text-sm">No photo</div>
                  )}
                  <span className="text-sm font-semibold">{item.category}</span>
                  {selected.includes(item.id) && (
                    <span className="block text-xs text-[#735079]">
                      Selected
                    </span>
                  )}
                </button>
              ))}
          </div>
          <Button
            disabled={busy || !selected.length || selected.length > 12}
            onClick={async () => {
              if (!editing) return;
              const isPlan = editing.id === editing.planId;
              const saved = await run(
                isPlan
                  ? {
                      operation: "planning_worn",
                      id: editing.id,
                      expectedRevision: editing.revision,
                      itemIds: selected,
                    }
                  : {
                      operation: "wear_update",
                      id: editing.id,
                      expectedRevision: editing.revision,
                      action: "correct",
                      itemIds: selected,
                    },
              );
              if (saved) setEditing(null);
            }}
          >
            Save actual outfit
          </Button>
        </DialogContent>
      </Dialog>
    </section>
  );
}
