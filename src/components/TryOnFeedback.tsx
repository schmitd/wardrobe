import Image from 'next/image';
import { Shirt } from 'lucide-react';

export type TryOnFeedbackData = {
  memoryUsed?: boolean;
  similarItems: Array<{
    id: string;
    imageUrl: string | null;
    category: string | null;
    description: string | null;
    similarity: number;
  }>;
  evaluation: {
    score: number;
    verdict: 'strong_fit' | 'consider' | 'skip';
    explanation: string;
    closet_summary: string;
    considerations: string[];
  };
};

interface TryOnFeedbackProps {
  previewUrl: string;
  data: TryOnFeedbackData;
  priority?: boolean;
}

const verdictCopy = {
  strong_fit: { label: 'Strong closet fit', className: 'bg-emerald-200 text-emerald-950' },
  consider: { label: 'Worth considering', className: 'bg-amber-200 text-amber-950' },
  skip: { label: 'Probably skip', className: 'bg-rose-200 text-rose-950' },
} as const;

export default function TryOnFeedback({ previewUrl, data, priority = false }: TryOnFeedbackProps) {
  const verdict = verdictCopy[data.evaluation.verdict] ?? verdictCopy.consider;

  return (
    <div className="space-y-5">
      <section className="grid gap-4 border-4 border-black bg-white p-4 md:grid-cols-[220px_1fr] md:p-5">
        <Image
          src={previewUrl}
          alt="Try-on candidate"
          width={880}
          height={660}
          unoptimized={previewUrl.startsWith('blob:')}
          priority={priority}
          className="aspect-[4/3] h-full max-h-72 w-full border-2 border-black object-cover md:aspect-auto"
        />
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <span className={`border-2 border-black px-3 py-1 text-xs font-black uppercase ${verdict.className}`}>
              {verdict.label}
            </span>
            <span className="text-xs font-bold uppercase tracking-[0.16em] text-[#6f5472]">
              {data.memoryUsed ? 'Zep memory + closet evidence' : 'Closet evidence'}
            </span>
          </div>
          <div className="mt-4 flex items-end gap-3">
            <p className="text-6xl font-black leading-none text-[#310A31]">{data.evaluation.score}</p>
            <p className="pb-1 text-sm font-black uppercase tracking-wide text-[#310A31]">/ 100 fit</p>
          </div>
          <p className="mt-4 text-base font-semibold leading-relaxed text-slate-800">
            {data.evaluation.explanation}
          </p>
          <p className="mt-4 border-l-4 border-[#310A31] pl-3 text-sm font-medium text-slate-700">
            {data.evaluation.closet_summary}
          </p>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <article className="border-4 border-black bg-white p-4">
          <div className="flex items-center gap-2 text-[#310A31]">
            <Shirt className="h-5 w-5" />
            <h3 className="text-lg font-black uppercase">Closet anchors</h3>
          </div>
          <p className="mt-1 text-xs font-medium text-slate-600">
            Top vector matches are retained as evidence, not the whole recommendation.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {data.similarItems.slice(0, 3).map((item) => (
              <div key={item.id}>
                <div className="relative aspect-square overflow-hidden border-2 border-black bg-[#ece4f0]">
                  {item.imageUrl && (
                    <Image
                      src={item.imageUrl}
                      alt={item.description ?? item.category ?? 'Closet match'}
                      fill
                      sizes="(max-width: 640px) 40vw, 180px"
                      className="object-cover"
                    />
                  )}
                  <span className="absolute bottom-1 right-1 border-2 border-black bg-white px-1.5 py-0.5 text-[9px] font-black">
                    {Math.round(item.similarity * 100)}%
                  </span>
                </div>
                <p className="mt-2 truncate text-[10px] font-black uppercase text-[#310A31]">
                  {item.category ?? 'Closet item'}
                </p>
              </div>
            ))}
          </div>
        </article>

        <article className="border-4 border-black bg-[#ece4f0] p-4">
          <h3 className="text-lg font-black uppercase text-[#310A31]">Watch before you buy</h3>
          <ul className="mt-3 space-y-3">
            {data.evaluation.considerations.map((consideration) => (
              <li key={consideration} className="flex gap-2 text-sm font-medium leading-relaxed text-slate-800">
                <span aria-hidden="true" className="mt-2 h-2 w-2 flex-none bg-[#310A31]" />
                <span>{consideration}</span>
              </li>
            ))}
          </ul>
        </article>
      </section>
    </div>
  );
}
