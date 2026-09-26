"use client";
import { useEffect, useRef, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { Share2 } from "lucide-react";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "./ui/dialog";

export default function ShareFit({ fitId }: { fitId: string }) {
  const { user } = useUser();
  const owner = useRef(user?.id);
  owner.current = user?.id;
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState<{
    file: File;
    preview: string;
    owner: string;
    expiresAt: number;
  }>();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const preparing = useRef(false);
  const abort = useRef<AbortController | null>(null);
  useEffect(
    () => () => {
      if (ready) URL.revokeObjectURL(ready.preview);
    },
    [ready],
  );
  useEffect(
    () => () => {
      abort.current?.abort();
    },
    [user?.id, fitId],
  );
  const prepare = async () => {
    if (preparing.current || !user?.id) return;
    const controller = new AbortController();
    abort.current = controller;
    const account = user.id;
    preparing.current = true;
    setBusy(true);
    setOpen(true);
    setMessage("");
    setReady(undefined);
    try {
      const response = await fetch(
        `/api/fits/${encodeURIComponent(fitId)}/image?format=png`,
        { cache: "no-store", signal: controller.signal },
      );
      if (!response.ok)
        throw new Error("Could not load this photo. Please try again.");
      const file = new File([await response.blob()], "fit.png", {
        type: "image/png",
      });
      if (owner.current !== account || controller.signal.aborted) return;
      setReady({
        file,
        preview: URL.createObjectURL(file),
        owner: account,
        expiresAt: Date.now() + 60_000,
      });
    } catch (error) {
      if (!controller.signal.aborted)
        setMessage(
          error instanceof Error
            ? error.message
            : "Could not prepare the image.",
        );
    } finally {
      preparing.current = false;
      setBusy(false);
    }
  };
  const usable = () => {
    if (
      !ready ||
      ready.owner !== owner.current ||
      Date.now() > ready.expiresAt
    ) {
      setReady(undefined);
      setMessage("Prepare this image again before sharing.");
      return null;
    }
    return ready;
  };
  const share = async () => {
    const image = usable();
    if (!image || preparing.current) return;
    preparing.current = true;
    setBusy(true);
    setMessage("");
    try {
      await navigator.share({ files: [image.file] });
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError"))
        setMessage(
          "Sharing is unavailable here. Try Copy image or Download image.",
        );
    } finally {
      preparing.current = false;
      setBusy(false);
    }
  };
  const copy = async () => {
    const image = usable();
    if (!image) return;
    try {
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": image.file }),
      ]);
      setMessage("Image copied");
    } catch {
      setMessage(
        "Copying was not allowed. You can download the image instead.",
      );
    }
  };
  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => void prepare()}
        disabled={busy}
      >
        <Share2 aria-hidden className="h-4 w-4" />
        Share fit
      </Button>
      <Dialog
        open={open}
        onOpenChange={(value) => {
          setOpen(value);
          if (!value) {
            abort.current?.abort();
            setReady(undefined);
          }
        }}
      >
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogTitle>Share your fit</DialogTitle>
          <DialogDescription>
            Your photo, with its original framing. Images larger than 2048
            pixels are reduced for sharing.
          </DialogDescription>
          {busy && !ready && <p role="status">Preparing image…</p>}
          {ready && ready.owner === user?.id && (
            <>
              {/* Blob URLs are local, temporary image bytes, never public share links. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                data-private
                src={ready.preview}
                alt="Photo ready to share"
                className="max-h-[45dvh] w-full object-contain"
              />
              <div className="flex flex-wrap gap-2">
                {typeof navigator.canShare === "function" &&
                  navigator.canShare({ files: [ready.file] }) && (
                    <Button onClick={() => void share()} disabled={busy}>
                      Share image
                    </Button>
                  )}
                {typeof ClipboardItem !== "undefined" &&
                  "clipboard" in navigator &&
                  typeof navigator.clipboard.write === "function" && (
                    <Button
                      variant="outline"
                      onClick={() => void copy()}
                      disabled={busy}
                    >
                      Copy image
                    </Button>
                  )}
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => {
                    const image = usable();
                    if (!image) return;
                    const link = document.createElement("a");
                    link.href = image.preview;
                    link.download = "fit.png";
                    link.click();
                  }}
                >
                  Download image
                </Button>
              </div>
            </>
          )}
          {message && <p role="status">{message}</p>}
          {!ready && !busy && (
            <Button onClick={() => void prepare()}>Prepare image</Button>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
