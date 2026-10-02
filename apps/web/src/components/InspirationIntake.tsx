'use client';

import Image from 'next/image';
import { useEffect, useId, useMemo, useState } from 'react';
import type { Doc } from '@convex/_generated/dataModel';
import { ImagePlus, Link2, Loader2, Plus, Save } from 'lucide-react';
import { saveInspirationAction } from '@/app/actions/wardrobe';
import ImageUploader, { type UploadedFile } from '@/components/ImageUploader';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { createTraceContext } from '@/lib/trace';
import { userFacingErrorMessage } from '@/lib/userFacingError';

type InspirationIntakeProps = {
  wardrobes: Doc<'wardrobes'>[];
  defaultWardrobeId?: string;
};

export default function InspirationIntake({ wardrobes, defaultWardrobeId }: InspirationIntakeProps) {
  const fieldId = useId();
  const [open, setOpen] = useState(false);
  const [wardrobeId, setWardrobeId] = useState(defaultWardrobeId ?? '');
  const [storageId, setStorageId] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [sourceLabel, setSourceLabel] = useState('');
  const [note, setNote] = useState('');
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const activeWardrobeId = wardrobeId || defaultWardrobeId || String(wardrobes[0]?._id ?? '');
  const selectedWardrobe = useMemo(
    () => wardrobes.find((wardrobe) => String(wardrobe._id) === activeWardrobeId),
    [activeWardrobeId, wardrobes]
  );

  const resetForm = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setWardrobeId(defaultWardrobeId ?? '');
    setStorageId('');
    setPreviewUrl('');
    setSourceUrl('');
    setSourceLabel('');
    setNote('');
    setStatus('idle');
    setMessage('');
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen && status === 'saved') resetForm();
    setOpen(nextOpen);
  };

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const onUpload = (uploads: UploadedFile[]) => {
    if (!uploads[0]) return;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setStorageId(uploads[0].storageId);
    setPreviewUrl(URL.createObjectURL(uploads[0].file));
    setMessage('');
    setStatus('idle');
  };

  const save = async () => {
    if (!activeWardrobeId) {
      setStatus('error');
      setMessage('Choose a wardrobe locus.');
      return;
    }
    if (!storageId && !sourceUrl.trim()) {
      setStatus('error');
      setMessage('Add a photo or a source URL.');
      return;
    }
    setStatus('saving');
    setMessage('');
    try {
      await saveInspirationAction({
        wardrobeId: activeWardrobeId,
        ...(storageId ? { storageId } : {}),
        ...(sourceUrl.trim() ? { sourceUrl: sourceUrl.trim() } : {}),
        ...(sourceLabel.trim() ? { sourceLabel: sourceLabel.trim() } : {}),
        ...(note.trim() ? { note: note.trim() } : {}),
        ...createTraceContext(),
      });
      setStatus('saved');
      setMessage(`Saved to ${selectedWardrobe?.name ?? 'your locus'} as inspiration, not owned inventory.`);
    } catch (error) {
      setStatus('error');
      setMessage(userFacingErrorMessage(error, 'Could not save inspiration.'));
    }
  };

  return (
    <>
      <Button
        type="button"
        onClick={() => setOpen(true)}
        disabled={wardrobes.length === 0}
        className="rounded-none border border-[var(--rack-line)] bg-[var(--rack-action)] px-4 text-[var(--rack-ink)] shadow-[2px_2px_0_var(--rack-panel-shadow)] hover:bg-[var(--rack-action-hover)]"
      >
        <Plus className="h-4 w-4" />
        Add inspiration
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-h-[92dvh] max-w-3xl overflow-y-auto rounded-none border border-[var(--rack-line)] bg-[var(--rack-paper)] p-5 shadow-[4px_4px_0_var(--rack-panel-shadow)] sm:p-7">
          <DialogHeader className="border-b border-[var(--rack-line)] pb-4 pr-8">
            <DialogTitle className="flex items-center gap-2 text-2xl font-extrabold text-[var(--rack-ink)]">
              <ImagePlus className="h-5 w-5" />
              Add inspiration
            </DialogTitle>
            <DialogDescription className="text-sm font-medium text-[var(--rack-ink-soft)]">
              Save an image, a source link, or both to a locus. Inspiration stays separate from the owned rack.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-5 md:grid-cols-[0.85fr_1.15fr]">
            <div>
              {previewUrl ? (
                <div className="space-y-3">
                  <Image src={previewUrl} alt="Inspiration preview" width={600} height={720} unoptimized className="aspect-[4/5] w-full border border-[var(--rack-line)] object-cover shadow-[3px_3px_0_var(--rack-panel-shadow)]" />
                  <Button type="button" variant="outline" onClick={() => { setStorageId(''); setPreviewUrl(''); }} className="w-full rounded-none border-[var(--rack-line)] bg-white text-[var(--rack-ink)]">
                    Choose another image
                  </Button>
                </div>
              ) : (
                <ImageUploader label="Add inspiration image" allowMultiple={false} enablePreview={false} onUploadComplete={onUpload} />
              )}
            </div>

            <div className="space-y-4">
              <div>
                <Label htmlFor={`${fieldId}-locus`} className="text-xs font-extrabold uppercase tracking-[0.12em] text-[var(--rack-ink)]">Locus</Label>
                <select id={`${fieldId}-locus`} value={activeWardrobeId} onChange={(event) => setWardrobeId(event.target.value)} className="mt-2 h-10 w-full border border-[var(--rack-line)] bg-white px-3 text-sm font-semibold text-[var(--rack-ink)]">
                  {wardrobes.map((wardrobe) => <option key={String(wardrobe._id)} value={String(wardrobe._id)}>{wardrobe.name}</option>)}
                </select>
              </div>

              <div>
                <Label htmlFor={`${fieldId}-url`} className="flex items-center gap-1 text-xs font-extrabold uppercase tracking-[0.12em] text-[var(--rack-ink)]"><Link2 className="h-3 w-3" /> Source URL</Label>
                <Input id={`${fieldId}-url`} type="url" value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} placeholder="https://shop.example/item" className="mt-2 rounded-none border-[var(--rack-line)] bg-white" />
              </div>

              <div>
                <Label htmlFor={`${fieldId}-source`} className="text-xs font-extrabold uppercase tracking-[0.12em] text-[var(--rack-ink)]">Source label</Label>
                <Input id={`${fieldId}-source`} value={sourceLabel} onChange={(event) => setSourceLabel(event.target.value)} placeholder="Designer, shop, saved post…" className="mt-2 rounded-none border-[var(--rack-line)] bg-white" />
              </div>

              <div>
                <Label htmlFor={`${fieldId}-note`} className="text-xs font-extrabold uppercase tracking-[0.12em] text-[var(--rack-ink)]">What belongs in the locus?</Label>
                <Textarea id={`${fieldId}-note`} value={note} onChange={(event) => setNote(event.target.value)} placeholder="The long line and muted palette are what I want to carry into this locus." className="mt-2 min-h-28 rounded-none border-[var(--rack-line)] bg-white" />
              </div>
            </div>
          </div>

          <div className="border-t border-[var(--rack-line)] pt-4">
            <div className="flex flex-wrap items-center gap-3">
              <Button type="button" onClick={save} disabled={status === 'saving' || status === 'saved'} className="rounded-none border border-[var(--rack-line)] bg-[var(--rack-action)] text-[var(--rack-ink)] shadow-[2px_2px_0_var(--rack-panel-shadow)] hover:bg-[var(--rack-action-hover)]">
                {status === 'saving' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {status === 'saving' ? 'Saving…' : status === 'saved' ? 'Saved as inspiration' : 'Save inspiration'}
              </Button>
              {message && <p role={status === 'error' ? 'alert' : 'status'} className={`text-sm font-semibold ${status === 'error' ? 'text-[var(--rack-danger)]' : 'text-[var(--rack-success)]'}`}>{message}</p>}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
