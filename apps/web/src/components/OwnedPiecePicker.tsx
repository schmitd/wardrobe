"use client";
import Image from "next/image";
import { useState } from "react";
import { outfitText } from "@/lib/outfitText";

type Piece = { id: string; category: string | null; description: string | null; imageUrl?: string | null };
/** Image-first choices inside the existing sheet, without an OS select layered over it. */
export default function OwnedPiecePicker({ items, disabled, onChoose }: {
  items: readonly Piece[]; disabled: boolean; onChoose: (id: string) => void;
}) {
  const [search, setSearch] = useState("");
  const visible = items.filter(item => `${item.category} ${item.description}`.toLowerCase().includes(search.toLowerCase()));
  return <section aria-label="Choose a piece" className="space-y-3" data-private>
    <label className="block text-sm">Find a piece<input type="search" value={search} onChange={event => setSearch(event.target.value)} className="mt-2 w-full rounded-lg border p-3" /></label>
    <div className="grid grid-cols-2 gap-3">
      {visible.map(item => <button key={item.id} type="button" disabled={disabled} onClick={() => onChoose(item.id)} className="overflow-hidden rounded-xl border border-[#d8c9dc] bg-white text-left disabled:opacity-50">
        <div className="relative aspect-square bg-[#f7f3f5]">{item.imageUrl ? <Image src={item.imageUrl} alt="" fill sizes="(max-width: 640px) 44vw, 240px" className="object-contain p-2" /> : <span className="grid h-full place-items-center text-sm">Photo unavailable</span>}</div>
        <div className="p-3"><strong className="block text-sm">{outfitText(item.category ?? "Piece", [item.id])}</strong><span className="line-clamp-2 text-xs text-[#685e70]">{outfitText(item.description ?? "", [item.id])}</span></div>
      </button>)}
    </div>
    {!visible.length && <p role="status">No matching pieces.</p>}
  </section>;
}
