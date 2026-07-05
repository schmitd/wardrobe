'use client';

import { FormEvent, useMemo, useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import { Layers3, Plus } from 'lucide-react';
import { createTraceContext } from '@/lib/trace';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

const wardrobeKinds = ['style_locus', 'capsule', 'mood', 'season', 'trip', 'workwear'] as const;

export default function WardrobesPage() {
  const { isLoaded, isSignedIn } = useUser();
  const wardrobes = useQuery(api.wardrobes.listWardrobes, isLoaded && isSignedIn ? {} : 'skip');
  const createWardrobe = useMutation(api.wardrobes.createWardrobe);

  const [name, setName] = useState('');
  const [kind, setKind] = useState<(typeof wardrobeKinds)[number]>('style_locus');
  const [description, setDescription] = useState('');
  const [moodWords, setMoodWords] = useState('');
  const [status, setStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [error, setError] = useState('');

  const normalizedWardrobes = useMemo(() => wardrobes ?? [], [wardrobes]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!name.trim()) return;
    setStatus('saving');
    setError('');

    try {
      const trace = createTraceContext();
      await createWardrobe({
        name: name.trim(),
        kind,
        ...(description.trim() ? { description: description.trim() } : {}),
        moodWords: moodWords
          .split(',')
          .map((word) => word.trim())
          .filter(Boolean)
          .slice(0, 12),
        ...trace,
      });
      setName('');
      setDescription('');
      setMoodWords('');
      setStatus('success');
      setTimeout(() => setStatus('idle'), 2500);
    } catch (caught) {
      console.error('wardrobe_locus.create.failed', caught);
      setError(caught instanceof Error ? caught.message : 'Could not create wardrobe');
      setStatus('error');
    }
  };

  if (!isLoaded) {
    return <div className="p-8 text-sm font-semibold uppercase tracking-wide">Loading wardrobes...</div>;
  }

  if (!isSignedIn) {
    return (
      <main className="mx-auto w-full max-w-[1320px] px-4 py-8 lg:px-8">
        <Card className="rack-panel rounded-none py-0">
          <CardContent className="px-0">
            <h1 className="text-4xl font-black uppercase tracking-tight text-[#310A31]">Wardrobes</h1>
            <p className="mt-3 text-sm font-medium text-slate-700">Sign in to manage wardrobe loci.</p>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto grid w-full max-w-[1320px] gap-6 px-4 py-8 lg:grid-cols-[420px_1fr] lg:px-8">
      <section className="space-y-6">
        <Card className="rack-panel rounded-none py-0">
          <CardContent className="px-0">
            <Badge variant="outline" className="rounded-none border-2 border-black bg-white px-2 py-0 text-[10px] font-bold tracking-[0.2em] text-[#9C92A3]">
              Closet Loci
            </Badge>
            <h1 className="mt-3 text-4xl font-black uppercase tracking-tight text-[#310A31]">Wardrobes</h1>
          </CardContent>
        </Card>

        <Card className="rack-panel rounded-none py-0">
          <CardContent className="px-0">
            <div className="mb-4 flex items-center gap-2 text-[#310A31]">
              <Plus className="h-4 w-4" />
              <h2 className="text-lg font-black uppercase tracking-wide">New locus</h2>
            </div>
            <form className="space-y-4" onSubmit={submit}>
              <div>
                <Label className="text-xs font-black uppercase tracking-[0.16em] text-[#310A31]">Name</Label>
                <Input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="mt-2 rounded-none border-4 border-black bg-white"
                  placeholder="Winter work capsule"
                />
              </div>

              <div>
                <Label className="text-xs font-black uppercase tracking-[0.16em] text-[#310A31]">Kind</Label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {wardrobeKinds.map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setKind(option)}
                      className={`border-2 border-black px-3 py-2 text-[10px] font-black uppercase tracking-wide shadow-[3px_3px_0_#000] ${
                        kind === option ? 'bg-[#310A31] text-white' : 'bg-white text-[#310A31]'
                      }`}
                    >
                      {option.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <Label className="text-xs font-black uppercase tracking-[0.16em] text-[#310A31]">Mood words</Label>
                <Input
                  value={moodWords}
                  onChange={(event) => setMoodWords(event.target.value)}
                  className="mt-2 rounded-none border-4 border-black bg-white"
                  placeholder="tailored, warm, graphic"
                />
              </div>

              <div>
                <Label className="text-xs font-black uppercase tracking-[0.16em] text-[#310A31]">Intent</Label>
                <Textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  className="mt-2 h-28 rounded-none border-4 border-black bg-white"
                  placeholder="A compact set for cold office days..."
                />
              </div>

              {status === 'error' && (
                <p className="border-2 border-black bg-rose-100 p-3 text-sm font-semibold text-rose-700">{error}</p>
              )}
              {status === 'success' && (
                <p className="border-2 border-black bg-emerald-100 p-3 text-sm font-semibold text-emerald-900">Wardrobe saved.</p>
              )}

              <Button
                type="submit"
                disabled={status === 'saving' || !name.trim()}
                className="h-auto rounded-none border-4 border-black bg-[#310A31] px-5 py-3 text-xs font-black uppercase tracking-wide text-white shadow-[6px_6px_0_#000]"
              >
                {status === 'saving' ? 'Saving...' : 'Create wardrobe'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-black uppercase tracking-tight text-[#310A31]">Active loci</h2>
        <div className="grid gap-4 xl:grid-cols-2">
          {normalizedWardrobes.map((wardrobe) => (
            <article key={String(wardrobe._id)} className="border-4 border-black bg-white p-5 shadow-[6px_6px_0_#000]">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-[#310A31]">
                    <Layers3 className="h-4 w-4 shrink-0" />
                    <h3 className="truncate text-lg font-black uppercase tracking-wide">{wardrobe.name}</h3>
                  </div>
                  <Badge variant="outline" className="mt-3 rounded-none border-2 border-black bg-[#f3eef6]">
                    {wardrobe.kind.replace('_', ' ')}
                  </Badge>
                </div>
                <Badge variant="outline" className="rounded-none border-2 border-black bg-white">
                  {wardrobe.status}
                </Badge>
              </div>

              {wardrobe.description && (
                <p className="mt-4 text-sm font-semibold leading-relaxed text-slate-800">{wardrobe.description}</p>
              )}

              {wardrobe.moodWords && wardrobe.moodWords.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {wardrobe.moodWords.map((word) => (
                    <Badge key={word} variant="outline" className="rounded-none border-2 border-black bg-white text-[10px]">
                      {word}
                    </Badge>
                  ))}
                </div>
              )}
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
