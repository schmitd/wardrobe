'use client';

import posthog from 'posthog-js';
import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { BookmarkPlus, Check, Loader2, Link as LinkIcon } from 'lucide-react';
import { saveInspirationAction } from '@/app/actions/wardrobe';
import { createTraceContext } from '@/lib/trace';
import ImageUploader, { type UploadedFile } from '@/components/ImageUploader';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface InspirationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function InspirationDialog({ open, onOpenChange }: InspirationDialogProps) {
  const previewUrlRef = useRef<string | null>(null);
  const [upload, setUpload] = useState<UploadedFile | null>(null);
  const [sourceUrl, setSourceUrl] = useState('');
  const [note, setNote] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, []);

  const handleUpload = ([nextUpload]: UploadedFile[]) => {
    if (!nextUpload) return;
    if (previewUrlRef.current && previewUrlRef.current !== nextUpload.previewUrl) {
      URL.revokeObjectURL(previewUrlRef.current);
    }
    previewUrlRef.current = nextUpload.previewUrl ?? null;
    setUpload(nextUpload);
    setStatus(null);
  };

  const reset = () => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = null;
    setUpload(null);
    setSourceUrl('');
    setNote('');
    setStatus(null);
    setSaved(false);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && !isSaving) reset();
    onOpenChange(nextOpen);
  };

  const handleSave = async () => {
    if (!upload && !sourceUrl.trim()) {
      setStatus('Add a photo or paste the original link.');
      return;
    }

    setIsSaving(true);
    setStatus('Reading this reference and adding it to your style memory...');
    try {
      await saveInspirationAction({
        storageId: upload?.storageId,
        sourceUrl,
        note,
        ...createTraceContext(),
      });
      setSaved(true);
      setStatus('Saved to inspiration — your closet inventory is unchanged.');
      posthog.capture('inspiration_saved', {
        has_photo: Boolean(upload),
        has_source_url: Boolean(sourceUrl.trim()),
        has_note: Boolean(note.trim()),
      });
    } catch (error) {
      posthog.captureException(error);
      setStatus(error instanceof Error ? error.message : 'Could not save this inspiration.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto rounded-none border-4 border-black bg-[#f6f1f8] p-0 shadow-[10px_10px_0_#000] sm:max-w-2xl">
        <DialogHeader className="border-b-4 border-black bg-white px-5 py-5 text-left sm:px-7">
          <div className="flex items-center gap-2 text-[#310A31]">
            <BookmarkPlus className="h-5 w-5" />
            <p className="text-[10px] font-black uppercase tracking-[0.2em]">New reference</p>
          </div>
          <DialogTitle className="text-3xl font-black uppercase leading-tight text-[#310A31]">
            Save inspiration
          </DialogTitle>
          <DialogDescription className="max-w-xl font-medium text-slate-700">
            Add a photo, the original link, or both. It stays on your inspiration shelf until you decide it belongs in your closet.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 px-5 py-5 sm:px-7">
          {upload?.previewUrl ? (
            <div className="grid gap-4 border-4 border-black bg-white p-3 sm:grid-cols-[180px_1fr]">
              <Image
                src={upload.previewUrl}
                alt="Inspiration preview"
                width={720}
                height={540}
                unoptimized
                className="aspect-[4/3] h-full w-full border-2 border-black object-cover"
              />
              <div className="flex flex-col justify-center">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[#310A31]">Photo ready</p>
                <p className="mt-2 text-sm font-medium text-slate-700">{upload.file.name}</p>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setUpload(null)}
                  className="mt-4 w-fit rounded-none border-2 border-black text-xs font-black uppercase"
                >
                  Choose another
                </Button>
              </div>
            </div>
          ) : (
            <ImageUploader
              onUploadComplete={handleUpload}
              label="Add an inspiration photo"
              allowMultiple={false}
              enablePreview
            />
          )}

          <div className="relative flex items-center py-1" aria-hidden="true">
            <span className="h-0.5 flex-1 bg-black" />
            <span className="px-3 text-[10px] font-black uppercase tracking-[0.2em] text-[#6f5472]">and / or</span>
            <span className="h-0.5 flex-1 bg-black" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="inspiration-source" className="text-xs font-black uppercase tracking-wide text-[#310A31]">
              Original source
            </Label>
            <div className="relative">
              <LinkIcon className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-[#6f5472]" />
              <Input
                id="inspiration-source"
                type="url"
                inputMode="url"
                value={sourceUrl}
                onChange={(event) => setSourceUrl(event.target.value)}
                placeholder="https://shop.example.com/item"
                className="h-11 rounded-none border-2 border-black bg-white pl-10"
              />
            </div>
            <p className="text-xs font-medium text-slate-600">Keeping attribution makes this reference useful later.</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="inspiration-note" className="text-xs font-black uppercase tracking-wide text-[#310A31]">
              What caught your eye? <span className="font-medium normal-case tracking-normal text-slate-500">Optional</span>
            </Label>
            <Textarea
              id="inspiration-note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="The cropped shape and warm neutral palette..."
              className="min-h-24 rounded-none border-2 border-black bg-white"
            />
          </div>

          {status && (
            <div
              role="status"
              className={`flex items-start gap-2 border-2 border-black p-3 text-sm font-semibold ${
                saved ? 'bg-emerald-100 text-emerald-900' : 'bg-white text-[#310A31]'
              }`}
            >
              {isSaving ? <Loader2 className="mt-0.5 h-4 w-4 animate-spin" /> : saved ? <Check className="mt-0.5 h-4 w-4" /> : null}
              <span>{status}</span>
            </div>
          )}
        </div>

        <DialogFooter className="border-t-4 border-black bg-white px-5 py-4 sm:px-7">
          {saved ? (
            <Button
              type="button"
              onClick={() => handleOpenChange(false)}
              className="min-h-11 rounded-none border-2 border-black px-5 font-black uppercase shadow-[3px_3px_0_#000]"
            >
              Done
            </Button>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                disabled={isSaving}
                onClick={() => handleOpenChange(false)}
                className="min-h-11 rounded-none border-2 border-black px-5 font-black uppercase"
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={isSaving}
                onClick={handleSave}
                className="min-h-11 rounded-none border-2 border-black px-5 font-black uppercase shadow-[3px_3px_0_#000]"
              >
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <BookmarkPlus className="h-4 w-4" />}
                Save inspiration
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
