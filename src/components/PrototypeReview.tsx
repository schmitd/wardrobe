'use client';

import { useState } from 'react';
import Image from 'next/image';
import { BookmarkPlus, Check, Link as LinkIcon, Sparkles } from 'lucide-react';
import InspirationShelf from '@/components/InspirationShelf';
import TryOnFeedback, { type TryOnFeedbackData } from '@/components/TryOnFeedback';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { InspirationItem } from '@/types/wardrobe';

type ReviewView = 'try-on' | 'intake' | 'shelf';

const tryOnFixture: TryOnFeedbackData = {
  memoryUsed: true,
  evaluation: {
    score: 82,
    verdict: 'strong_fit',
    explanation:
      'The clean tee works with your tailored casual base and gives the rust jacket a quieter layer. It repeats a silhouette you already wear without duplicating a statement piece.',
    closet_summary: 'This fills a dependable light-layer gap and creates at least three easy outfits.',
    considerations: [
      'Check that the fabric is opaque enough to wear without another base layer.',
      'A slightly boxier cut will work better with the higher-rise trousers in your closet.',
    ],
  },
  similarItems: [
    {
      id: 'jacket',
      imageUrl: '/review/closet-jacket.jpg',
      category: 'Rust bomber',
      description: 'A lightweight rust bomber jacket.',
      similarity: 0.88,
    },
    {
      id: 'jeans',
      imageUrl: '/review/closet-jeans.jpg',
      category: 'Dark denim',
      description: 'Dark straight-leg jeans.',
      similarity: 0.83,
    },
    {
      id: 'trousers',
      imageUrl: '/review/closet-trousers.jpg',
      category: 'Olive trousers',
      description: 'Slim olive trousers for everyday wear.',
      similarity: 0.79,
    },
  ],
};

const inspirationFixture: InspirationItem[] = [
  {
    id: 'inspiration-1',
    imageUrl: '/review/closet-jacket.jpg',
    sourceUrl: 'https://unsplash.com/',
    note: 'Warm color, easy cropped layer.',
    category: 'Bomber jacket',
    description: 'A warm rust bomber with a clean, minimal shape.',
    styleTags: ['warm neutral', 'cropped', 'casual layer'],
    createdAt: Date.now(),
  },
];

const tabClass = (active: boolean) =>
  `min-h-11 rounded-none border-2 border-black px-4 text-xs font-black uppercase tracking-wide ${
    active ? 'bg-[#310A31] text-white shadow-[3px_3px_0_#000]' : 'bg-white text-[#310A31]'
  }`;

export default function PrototypeReview() {
  const [view, setView] = useState<ReviewView>('try-on');

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2" aria-label="Prototype views">
        <Button className={tabClass(view === 'try-on')} onClick={() => setView('try-on')}>
          Try-on result
        </Button>
        <Button className={tabClass(view === 'intake')} onClick={() => setView('intake')}>
          Inspiration intake
        </Button>
        <Button className={tabClass(view === 'shelf')} onClick={() => setView('shelf')}>
          Inspiration shelf
        </Button>
      </div>

      {view === 'try-on' && (
        <section className="border-4 border-black bg-[#f6f1f8] shadow-[10px_10px_0_#000]">
          <header className="border-b-4 border-black bg-white px-5 py-5 sm:px-7">
            <div className="flex items-center gap-2 text-[#310A31]">
              <Sparkles className="h-5 w-5" />
              <p className="text-[10px] font-black uppercase tracking-[0.2em]">Closet try-on</p>
            </div>
            <h2 className="mt-2 text-3xl font-black uppercase text-[#310A31]">Does it earn a place?</h2>
            <p className="mt-2 max-w-2xl text-sm font-medium text-slate-700">
              Feedback only: this candidate has not been added to the closet.
            </p>
          </header>
          <div className="p-5 sm:p-7">
            <TryOnFeedback previewUrl="/review/candidate-shirt.jpg" data={tryOnFixture} priority />
          </div>
          <footer className="flex flex-wrap justify-end gap-2 border-t-4 border-black bg-white p-4 sm:px-7">
            <Button variant="outline" className="min-h-11 rounded-none border-2 border-black font-black uppercase">
              <BookmarkPlus className="h-4 w-4" /> Save as inspiration
            </Button>
            <Button className="min-h-11 rounded-none border-2 border-black font-black uppercase shadow-[3px_3px_0_#000]">
              Done
            </Button>
          </footer>
        </section>
      )}

      {view === 'intake' && (
        <section className="mx-auto max-w-2xl border-4 border-black bg-[#f6f1f8] shadow-[10px_10px_0_#000]">
          <header className="border-b-4 border-black bg-white px-5 py-5 sm:px-7">
            <div className="flex items-center gap-2 text-[#310A31]">
              <BookmarkPlus className="h-5 w-5" />
              <p className="text-[10px] font-black uppercase tracking-[0.2em]">New reference</p>
            </div>
            <h2 className="mt-2 text-3xl font-black uppercase text-[#310A31]">Save inspiration</h2>
            <p className="mt-2 text-sm font-medium text-slate-700">
              A photo, original link, or both. It remains separate from closet inventory.
            </p>
          </header>
          <div className="space-y-5 px-5 py-5 sm:px-7">
            <div className="grid gap-4 border-4 border-black bg-white p-3 sm:grid-cols-[180px_1fr]">
              <Image
                src="/review/closet-jacket.jpg"
                alt="Rust bomber inspiration"
                width={720}
                height={540}
                className="aspect-[4/3] h-full w-full border-2 border-black object-cover"
              />
              <div className="flex flex-col justify-center">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[#310A31]">Photo ready</p>
                <p className="mt-2 text-sm font-medium text-slate-700">rust-bomber-reference.jpg</p>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="review-source" className="text-xs font-black uppercase tracking-wide text-[#310A31]">
                Original source
              </Label>
              <div className="relative">
                <LinkIcon className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-[#6f5472]" />
                <Input
                  id="review-source"
                  readOnly
                  value="https://shop.example.com/rust-bomber"
                  className="h-11 rounded-none border-2 border-black bg-white pl-10"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="review-note" className="text-xs font-black uppercase tracking-wide text-[#310A31]">
                What caught your eye?
              </Label>
              <Textarea
                id="review-note"
                readOnly
                value="The warm rust color and cropped shape would sharpen my everyday layers."
                className="min-h-24 rounded-none border-2 border-black bg-white"
              />
            </div>
            <div className="flex items-center gap-2 border-2 border-black bg-emerald-100 p-3 text-sm font-semibold text-emerald-900">
              <Check className="h-4 w-4" />
              Saved to inspiration — closet inventory is unchanged.
            </div>
          </div>
          <footer className="flex justify-end border-t-4 border-black bg-white p-4 sm:px-7">
            <Button className="min-h-11 rounded-none border-2 border-black font-black uppercase shadow-[3px_3px_0_#000]">
              <BookmarkPlus className="h-4 w-4" /> Save inspiration
            </Button>
          </footer>
        </section>
      )}

      {view === 'shelf' && (
        <div className="border-4 border-black bg-[#f6f1f8] p-5 shadow-[8px_8px_0_#000] sm:p-7">
          <InspirationShelf items={inspirationFixture} />
        </div>
      )}

      <p className="text-xs font-medium text-slate-600">
        Review photography is from Unsplash and is used only as non-persistent prototype data.
      </p>
    </div>
  );
}
