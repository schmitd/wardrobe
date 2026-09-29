"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { LoaderCircle, Mic, Square } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function DayVoiceInput({
  onText,
  disabled = false,
  onBusyChange,
}: {
  onText: (text: string) => void;
  disabled?: boolean;
  onBusyChange?: (busy: boolean) => void;
}) {
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const request = useRef<AbortController | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attempt = useRef(0);
  const [phase, setPhase] = useState<
    "idle" | "starting" | "recording" | "transcribing"
  >("idle");
  const [error, setError] = useState("");
  useEffect(() => {
    onBusyChange?.(phase !== "idle");
  }, [phase, onBusyChange]);
  const release = useCallback(() => {
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, []);
  const discard = useCallback(() => {
    attempt.current++;
    request.current?.abort();
    if (recorder.current) {
      recorder.current.onstop = null;
      if (recorder.current.state === "recording") recorder.current.stop();
    }
    release();
  }, [release]);
  useEffect(() => {
    const hidden = () => {
      if (document.hidden) {
        discard();
        setPhase("idle");
      }
    };
    document.addEventListener("visibilitychange", hidden);
    return () => {
      discard();
      onBusyChange?.(false);
      document.removeEventListener("visibilitychange", hidden);
    };
  }, [onBusyChange, discard]);
  const transcribe = async (blob: Blob, id: number) => {
    if (id !== attempt.current) return;
    setPhase("transcribing");
    const controller = new AbortController();
    request.current = controller;
    try {
      if (!blob.size || blob.size > 2100000)
        throw new Error("Record a shorter note.");
      const audio = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      if (id !== attempt.current) return;
      const response = await fetch("/api/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audio, mimeType: blob.type, confirmed: true }),
        signal: AbortSignal.any([
          controller.signal,
          AbortSignal.timeout(65000),
        ]),
      });
      const result = await response.json();
      if (
        !response.ok ||
        typeof result.text !== "string" ||
        !result.text.trim()
      )
        throw new Error("No transcript");
      if (id === attempt.current) onText(result.text);
    } catch {
      if (id === attempt.current)
        setError(
          "Could not transcribe. Try a shorter recording or type your plans.",
        );
    } finally {
      if (id === attempt.current) {
        setPhase("idle");
        request.current = null;
      }
    }
  };
  const stop = () => {
    if (recorder.current?.state === "recording") {
      setPhase("transcribing");
      recorder.current.stop();
    }
    release();
  };
  const start = async () => {
    if (disabled || phase !== "idle") return;
    const id = ++attempt.current;
    setError("");
    setPhase("starting");
    try {
      if (
        !navigator.mediaDevices?.getUserMedia ||
        typeof MediaRecorder === "undefined"
      )
        throw new Error("Unavailable");
      const source = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (id !== attempt.current) {
        source.getTracks().forEach((track) => track.stop());
        return;
      }
      stream.current = source;
      const media = new MediaRecorder(source);
      recorder.current = media;
      const chunks: BlobPart[] = [];
      media.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data);
      };
      media.onstop = () => {
        void transcribe(
          new Blob(chunks, { type: media.mimeType.split(";")[0] }),
          id,
        );
      };
      media.onerror = () => {
        if (id === attempt.current) {
          discard();
          setPhase("idle");
          setError("Recording stopped. Try again or type your plans.");
        }
      };
      media.start();
      setPhase("recording");
      timer.current = setTimeout(stop, 60000);
    } catch {
      if (id === attempt.current) {
        release();
        setPhase("idle");
        setError(
          "Microphone unavailable. Allow microphone access or type your plans.",
        );
      }
    }
  };
  const label =
    phase === "starting"
      ? "Opening microphone…"
      : phase === "recording"
        ? "Tap to finish"
        : phase === "transcribing"
          ? "Transcribing…"
          : "Tap to dictate";
  return (
    <div className="text-center">
      <button
        type="button"
        className="planner-mic disabled:opacity-50"
        aria-label={label}
        aria-pressed={phase === "recording"}
        aria-describedby="dictation-privacy"
        disabled={
          phase === "starting" ||
          phase === "transcribing" ||
          (disabled && phase === "idle")
        }
        onClick={phase === "recording" ? stop : () => void start()}
      >
        {phase === "recording" ? (
          <Square className="size-6" />
        ) : phase === "idle" ? (
          <Mic className="size-7" />
        ) : (
          <LoaderCircle className="size-7 motion-safe:animate-spin" />
        )}
      </button>
      <p className="font-medium" role="status">
        {label}
      </p>
      <p
        id="dictation-privacy"
        className="mx-auto mt-2 max-w-72 text-xs text-[#685e70]"
      >
        Finishing sends audio for transcription. Audio isn’t saved. Up to 60
        seconds.
      </p>
      {phase !== "idle" && (
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            discard();
            setPhase("idle");
          }}
        >
          Cancel dictation
        </Button>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm text-[#B93267]">
          {error}
        </p>
      )}
    </div>
  );
}
