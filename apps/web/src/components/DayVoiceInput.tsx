"use client";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

export default function DayVoiceInput({
  onText,
}: {
  onText: (text: string) => void;
}) {
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelled = useRef(false);
  const [recording, setRecording] = useState(false);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const stop = () => {
    if (recorder.current?.state === "recording") recorder.current.stop();
    stream.current?.getTracks().forEach((t) => t.stop());
    if (timer.current) clearTimeout(timer.current);
    setRecording(false);
  };
  const cancel = () => {
    cancelled.current = true;
    stop();
    setBlob(null);
  };
  useEffect(() => {
    const hidden = () => {
      if (document.hidden) cancel();
    };
    document.addEventListener("visibilitychange", hidden);
    return () => {
      cancelled.current = true;
      stream.current?.getTracks().forEach((t) => t.stop());
      if (recorder.current?.state === "recording") recorder.current.stop();
      if (timer.current) clearTimeout(timer.current);
      document.removeEventListener("visibilitychange", hidden);
    };
  }, []);
  const start = async () => {
    setError("");
    setBusy(true);
    cancelled.current = false;
    try {
      if (
        !navigator.mediaDevices?.getUserMedia ||
        typeof MediaRecorder === "undefined"
      )
        throw new Error(
          "Voice recording is unavailable in this browser. You can type or use keyboard dictation.",
        );
      const source = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (cancelled.current) {
        source.getTracks().forEach((t) => t.stop());
        return;
      }
      stream.current = source;
      const media = new MediaRecorder(source);
      recorder.current = media;
      const chunks: BlobPart[] = [];
      media.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data);
      };
      media.onstop = () => {
        if (!cancelled.current)
          setBlob(new Blob(chunks, { type: media.mimeType.split(";")[0] }));
      };
      media.start();
      setRecording(true);
      timer.current = setTimeout(stop, 60000);
    } catch {
      setError(
        "Microphone unavailable. Allow microphone access or type your day instead.",
      );
    } finally {
      setBusy(false);
    }
  };
  const transcribe = async () => {
    if (!blob) return;
    setBusy(true);
    setError("");
    try {
      if (blob.size > 2100000) throw new Error("Record a shorter note.");
      const audio = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      const response = await fetch("/api/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audio, mimeType: blob.type, confirmed: true }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      onText(result.text);
      setBlob(null);
    } catch {
      setError(
        "Could not transcribe. Try a shorter recording or type your day.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-2">
      <p className="text-sm">
        Record up to 60 seconds. “Transcribe” sends audio to our AI provider;
        Wardrobe does not store it. Review and edit the text before getting an
        outfit.
      </p>
      <div className="flex flex-wrap gap-2">
        {!recording && !blob && (
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={start}
          >
            Dictate your day
          </Button>
        )}
        {recording && (
          <Button type="button" onClick={stop}>
            Stop recording
          </Button>
        )}
        {blob && (
          <Button type="button" disabled={busy} onClick={transcribe}>
            {busy ? "Transcribing…" : "Transcribe recording"}
          </Button>
        )}
        {(recording || blob) && (
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={cancel}
          >
            Discard recording
          </Button>
        )}
      </div>
      {recording && <p role="status">Recording… Stops after 60 seconds.</p>}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
