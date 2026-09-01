import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import PrototypeReview from '@/components/PrototypeReview';

export default function ReviewPage() {
  return (
    <main className="flex-1 pb-16">
      <div className="mx-auto w-full max-w-[1180px] px-5 py-8 sm:px-8">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#6f5472]">Non-persistent review fixture</p>
            <h1 className="mt-2 text-4xl font-black uppercase text-[#310A31] sm:text-5xl">Try-on + inspiration</h1>
            <p className="mt-3 max-w-2xl text-sm font-medium leading-relaxed text-slate-700">
              Explore the proposed result, intake, and shelf states. Nothing on this page uploads or changes closet data.
            </p>
          </div>
          <Link
            href="/"
            className="inline-flex min-h-11 items-center gap-2 border-2 border-black bg-white px-4 text-xs font-black uppercase text-[#310A31] shadow-[3px_3px_0_#000]"
          >
            <ArrowLeft className="h-4 w-4" /> Back to wardrobe
          </Link>
        </div>
        <PrototypeReview />
      </div>
    </main>
  );
}
