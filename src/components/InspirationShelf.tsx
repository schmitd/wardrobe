'use client';

import { ArrowUpRight, Bookmark } from 'lucide-react';
import Image from 'next/image';
import type { InspirationItem } from '@/types/wardrobe';
import { Badge } from '@/components/ui/badge';

interface InspirationShelfProps {
  items: InspirationItem[];
}

export default function InspirationShelf({ items }: InspirationShelfProps) {
  if (items.length === 0) return null;

  return (
    <section aria-labelledby="inspiration-heading" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#6f5472]">
            Separate from your closet
          </p>
          <h2 id="inspiration-heading" className="mt-1 text-2xl font-black uppercase text-[#310A31]">
            Inspiration shelf
          </h2>
        </div>
        <Badge className="rounded-none border-2 border-black bg-[#c6b9cd] text-[#310A31]">
          {items.length} saved
        </Badge>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <article key={item.id} className="border-4 border-black bg-white p-3 shadow-[6px_6px_0_#000]">
            <div className="relative aspect-[4/3] overflow-hidden border-2 border-black bg-[#ece4f0]">
              {item.imageUrl ? (
                <Image
                  src={item.imageUrl}
                  alt={item.description ?? item.category ?? 'Saved inspiration'}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  className="object-cover"
                />
              ) : (
                <div className="grid h-full place-items-center px-5 text-center">
                  <Bookmark className="mb-3 h-8 w-8 text-[#310A31]" />
                  <p className="text-sm font-black uppercase text-[#310A31]">
                    {item.note ?? 'Saved link inspiration'}
                  </p>
                </div>
              )}
              <span className="absolute left-2 top-2 border-2 border-black bg-[#f8d95b] px-2 py-1 text-[9px] font-black uppercase tracking-[0.16em]">
                Inspiration
              </span>
            </div>

            <div className="mt-3">
              <p className="text-sm font-black uppercase text-[#310A31]">
                {item.category ?? 'Reference'}
              </p>
              <p className="mt-1 line-clamp-2 text-xs font-medium leading-relaxed text-slate-700">
                {item.description ?? item.note}
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {(item.styleTags ?? []).slice(0, 3).map((tag) => (
                  <Badge key={tag} variant="outline" className="rounded-none border-2 border-black text-[9px] uppercase">
                    {tag}
                  </Badge>
                ))}
              </div>
              {item.sourceUrl && (
                <a
                  href={item.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex min-h-11 items-center gap-2 text-xs font-black uppercase tracking-wide text-[#310A31] underline underline-offset-4"
                >
                  View source <ArrowUpRight className="h-3.5 w-3.5" />
                </a>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
