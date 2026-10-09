"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { FolderHeart, Trash2 } from "lucide-react";
import { Button } from "./ui/button";

type Reference = { imageUrl: string | null; description: string | null; category: string | null };

export default function InspirationCard({ reference, removed = false, onChange }: {
  reference: Reference;
  removed?: boolean;
  onChange: (removed: boolean) => Promise<unknown>;
}) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const inFlight = useRef(false);
  const removeButton = useRef<HTMLButtonElement>(null);
  const wasConfirming = useRef(false);
  useEffect(() => {
    if (wasConfirming.current && !confirming) removeButton.current?.focus();
    wasConfirming.current = confirming;
  }, [confirming]);
  const change = async (next: boolean) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      await onChange(next);
      setConfirming(false);
    } catch {
      setError(next ? "Could not remove inspiration. Try again." : "Could not restore inspiration. Try again.");
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };
  return (
    <article data-private className="ph-no-capture overflow-hidden rounded-xl border border-[#d8c9dc] bg-white">
      <div className="relative aspect-square bg-[#eee7ee]">
        {reference.imageUrl ? <Image src={reference.imageUrl} alt={reference.description ?? "Saved inspiration"} fill sizes="(max-width: 640px) 45vw, 250px" className="object-contain" /> : <FolderHeart className="m-auto h-full w-10" aria-hidden="true" />}
      </div>
      <p className="p-3 text-sm">{reference.description ?? reference.category ?? "Saved reference"}</p>
      <div className="space-y-2 px-3 pb-3">
        {removed ? <Button type="button" variant="outline" className="min-h-11 w-full whitespace-normal" disabled={busy} onClick={() => void change(false)}>{busy ? "Restoring…" : "Restore"}</Button> : confirming ? (
          <div className="space-y-2" onKeyDown={event => {
            if (event.key === "Escape" && !busy) { setConfirming(false); setError(""); }
          }}>
            <p className="text-sm">Remove from this collection? You can restore it from Removed inspiration.</p>
            <Button autoFocus type="button" variant="outline" className="min-h-11 w-full whitespace-normal" disabled={busy} onClick={() => void change(true)}>{busy ? "Removing…" : "Remove inspiration"}</Button>
            <Button type="button" variant="ghost" className="min-h-11 w-full whitespace-normal" disabled={busy} onClick={() => { setConfirming(false); setError(""); }}>Cancel</Button>
          </div>
        ) : null}
        {!removed && <Button ref={removeButton} type="button" variant="ghost" className={`min-h-11 w-full whitespace-normal ${confirming ? "hidden" : ""}`} onClick={() => setConfirming(true)}><Trash2 aria-hidden="true" className="size-4" />Remove</Button>}
        {error && <p role="alert" className="text-sm">{error}</p>}
        {busy && <span role="status" className="sr-only">{removed ? "Restoring inspiration" : "Removing inspiration"}</span>}
      </div>
    </article>
  );
}
