"use client";
import { revealDecodedImage } from "@/lib/revealDecodedImage";
import Image from "next/image";
import { useState } from "react";
import { localDate } from "@wardrobe/shared";
import DayPlanner from "./DayPlanner";
import { HISTORY_GRID, HISTORY_CARD, HISTORY_PHOTOS, HISTORY_TITLE, HISTORY_META } from "./LayoutGeometry";
import { HistoryLoading } from "./FitsLoading";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "./ui/dialog";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { useUser } from "@clerk/nextjs";

export default function WornOutfits({ visible = true }: { visible?: boolean } = {}) {
  const [reviewDate, setReviewDate] = useState<string | null>(null);
  const { isSignedIn } = useUser();
  const data = useQuery(api.planning.load, isSignedIn ? {} : "skip");
  const worn =
    data?.suggestions
      .filter((s) => s.status === "worn" || (s.status === "planned" && s.date < localDate()))
      .sort((a, b) => b.date.localeCompare(a.date)) ?? [];
  if (data === undefined) return <HistoryLoading />;
  if (!worn.length) return <section className="space-y-4" aria-label="Saved outfit history"><h2 className="text-xl font-semibold">Your outfit history</h2><p>No saved outfits yet.</p></section>;
  return (
    <section className="space-y-4" aria-label="Saved outfit history">
      <h2 className="text-xl font-semibold">Your outfit history</h2>
      <div className={HISTORY_GRID}>
        {worn.map((s) => (
          <article
            key={s._id}
            data-history-card
            data-private
            className={HISTORY_CARD}
          >
            <p className={HISTORY_META}>
              {new Date(`${s.date}T12:00:00`).toLocaleDateString(undefined, {
                weekday: "short",
                month: "short",
                day: "numeric",
              })}{" "}
              · {s.status === "worn" ? "Worn" : "Planned · confirm what you wore"}
            </p>
            <h3 className={HISTORY_TITLE}>{s.title}</h3>
            <div className={HISTORY_PHOTOS}>
              {s.itemIds.map((id) => {
                const item = data?.items.find((i) => i.id === id);
                return item?.imageUrl ? (
                  <Image
                    onLoad={revealDecodedImage}
                    key={id}
                    src={item.imageUrl}
                    alt={item.category}
                    width={64}
                    height={84}
                    unoptimized
                    className="h-21 w-16 shrink-0 object-contain"
                  />
                ) : null;
              })}
            </div>
            <div className="min-h-11">{s.status === "planned" && <Button variant="outline" onClick={() => setReviewDate(s.date)}>Review actual outfit</Button>}</div>
            <details>
              <summary className="cursor-pointer text-sm">
                Outfit details
              </summary>
              <p className="mt-2 text-sm">{s.rationale}</p>
            </details>
          </article>
        ))}
      </div>
      <Dialog open={visible && reviewDate !== null} onOpenChange={open => { if (!open) setReviewDate(null); }}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl"><DialogTitle>Review what you wore</DialogTitle><DialogDescription>Adjust the saved pieces, then confirm the actual outfit.</DialogDescription>{reviewDate && <DayPlanner historyDate={reviewDate} />}</DialogContent></Dialog>
    </section>
  );
}
