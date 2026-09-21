"use client";
import Image from "next/image";
import { useState } from "react";
import { localDate } from "@wardrobe/shared";
import DayPlanner from "./DayPlanner";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "./ui/dialog";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { useUser } from "@clerk/nextjs";

export default function WornOutfits() {
  const [reviewDate, setReviewDate] = useState<string | null>(null);
  const { isSignedIn } = useUser();
  const data = useQuery(api.planning.load, isSignedIn ? {} : "skip");
  const worn =
    data?.suggestions
      .filter((s) => s.status === "worn" || (s.status === "planned" && s.date < localDate()))
      .sort((a, b) => b.date.localeCompare(a.date)) ?? [];
  if (!worn.length) return null;
  return (
    <section className="space-y-4" aria-label="Saved outfit history">
      <h2 className="text-xl font-semibold">Your outfit history</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {worn.map((s) => (
          <article
            key={s._id}
            data-private
            className="rounded-2xl border bg-white p-4 text-[#241426]"
          >
            <p className="text-sm">
              {new Date(`${s.date}T12:00:00`).toLocaleDateString(undefined, {
                weekday: "short",
                month: "short",
                day: "numeric",
              })}{" "}
              · {s.status === "worn" ? "Worn" : "Planned · confirm what you wore"}
            </p>
            <h3 className="mt-2 font-semibold">{s.title}</h3>
            <div className="my-3 flex flex-wrap gap-2">
              {s.itemIds.map((id) => {
                const item = data?.items.find((i) => i.id === id);
                return item?.imageUrl ? (
                  <Image
                    key={id}
                    src={item.imageUrl}
                    alt={item.category}
                    width={64}
                    height={84}
                    unoptimized
                    className="h-21 w-16 object-contain"
                  />
                ) : null;
              })}
            </div>
            {s.status === "planned" && <Button variant="outline" onClick={() => setReviewDate(s.date)}>Review actual outfit</Button>}
            <details>
              <summary className="cursor-pointer text-sm">
                Outfit details
              </summary>
              <p className="mt-2 text-sm">{s.rationale}</p>
            </details>
          </article>
        ))}
      </div>
      <Dialog open={reviewDate !== null} onOpenChange={open => { if (!open) setReviewDate(null); }}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl"><DialogTitle>Review what you wore</DialogTitle><DialogDescription>Adjust the saved pieces, then confirm the actual outfit.</DialogDescription>{reviewDate && <DayPlanner historyDate={reviewDate} />}</DialogContent></Dialog>
    </section>
  );
}
