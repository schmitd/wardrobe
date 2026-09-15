"use client";
import Image from "next/image";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { useUser } from "@clerk/nextjs";

export default function WornOutfits() {
  const { isSignedIn } = useUser();
  const data = useQuery(api.planning.load, isSignedIn ? {} : "skip");
  const worn =
    data?.suggestions
      .filter((s) => s.status === "worn")
      .sort((a, b) => b.date.localeCompare(a.date)) ?? [];
  if (!worn.length) return null;
  return (
    <section className="space-y-4" aria-label="Outfits you wore">
      <h2 className="text-xl font-semibold">Outfits you wore</h2>
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
              · Worn
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
            <details>
              <summary className="cursor-pointer text-sm">
                Outfit details
              </summary>
              <p className="mt-2 text-sm">{s.rationale}</p>
            </details>
          </article>
        ))}
      </div>
    </section>
  );
}
