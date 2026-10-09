"use client";

import { useEffect, useRef, useState } from "react";
import { ImagePlus, X } from "lucide-react";
import type { CaptureIntent } from "./CaptureMenu";

// Permission prompts cannot be aborted. Serialize requests across rapid reopen
// and Strict Mode so obsolete results stop before another request starts.
let pendingCameraRequest: Promise<MediaStream> | null = null;

export default function WebPhotoCamera({ onPhoto, onChoosePhotos, onClose, intent, onIntentChange }: {
  onPhoto: (photo: File) => void;
  onChoosePhotos: () => void;
  onClose: () => void;
  intent: CaptureIntent;
  onIntentChange: (intent: CaptureIntent) => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const capturing = useRef(false);
  const stop = useRef<() => void>(() => {});
  const [ready, setReady] = useState(false);
  const [encoding, setEncoding] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let obsolete = false;
    let stream: MediaStream | undefined;
    const preview = video.current;
    const release = () => {
      obsolete = true;
      capturing.current = false;
      const active = stream;
      stream = undefined;
      if (preview) preview.srcObject = null;
      active?.getTracks().forEach(track => track.stop());
    };
    stop.current = release;
    const leave = () => { release(); onClose(); };
    const background = () => { if (document.hidden) leave(); };
    document.addEventListener("visibilitychange", background);
    window.addEventListener("pagehide", leave);
    const start = async () => {
      try {
        if (pendingCameraRequest) await pendingCameraRequest.catch(() => {});
        if (obsolete) return;
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("Camera unavailable");
        const request = navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1600 }, height: { ideal: 1600 } },
        });
        pendingCameraRequest = request;
        let active: MediaStream;
        try { active = await request; }
        finally { if (pendingCameraRequest === request) pendingCameraRequest = null; }
        if (obsolete) { active.getTracks().forEach(track => track.stop()); return; }
        stream = active;
        if (preview) { preview.srcObject = active; await preview.play(); }
      } catch {
        if (!obsolete) {
          release();
          setReady(false);
          setError("Camera unavailable or access declined.");
        }
      }
    };
    void start();
    return () => {
      release();
      document.removeEventListener("visibilitychange", background);
      window.removeEventListener("pagehide", leave);
    };
  }, [onClose]);

  const close = () => { stop.current(); onClose(); };
  const choosePhotos = () => { stop.current(); onChoosePhotos(); };
  const dimensionsReady = () => {
    const source = video.current;
    if (source?.srcObject && source.videoWidth > 0 && source.videoHeight > 0) setReady(true);
  };
  const take = () => {
    const source = video.current;
    if (!source || !source.srcObject || !ready || !source.videoWidth || !source.videoHeight || capturing.current) return;
    capturing.current = true;
    setEncoding(true);
    // Match the centered object-fit:cover preview, including after rotation.
    const rect = source.getBoundingClientRect();
    if (!rect.width || !rect.height) { capturing.current = false; setEncoding(false); return; }
    const ratio = rect.width / rect.height;
    let width = source.videoWidth, height = source.videoHeight;
    if (width / height > ratio) width = height * ratio;
    else height = width / ratio;
    const scale = Math.min(1, 1600 / Math.max(width, height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const context = canvas.getContext("2d");
    if (!context) { capturing.current = false; setEncoding(false); setError("Photo unavailable."); stop.current(); return; }
    context.drawImage(source, (source.videoWidth - width) / 2, (source.videoHeight - height) / 2, width, height, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(blob => {
      if (!capturing.current) return;
      capturing.current = false;
      setEncoding(false);
      if (!blob) { stop.current(); setError("Photo unavailable."); return; }
      stop.current();
      onPhoto(new File([blob], "camera-photo.jpg", { type: "image/jpeg" }));
    }, "image/jpeg", 0.88);
  };

  return <div className="lint-camera" data-private>
    {!error && <video ref={video} autoPlay muted playsInline onLoadedData={dimensionsReady} onResize={dimensionsReady}
      aria-label="Camera preview" className="lint-camera-preview" />}
    <header className="lint-camera-header">
      <button type="button" aria-label="Close camera" className="lint-camera-icon" onClick={close}><X aria-hidden="true" /></button>
      {!error && <div className="lint-camera-mode" aria-label="Photo use">
        <button type="button" disabled={encoding} aria-pressed={intent === "my_wardrobe"} onClick={() => onIntentChange("my_wardrobe")}>My wardrobe</button>
        <button type="button" disabled={encoding} aria-pressed={intent === "just_trying"} onClick={() => onIntentChange("just_trying")}>Try on</button>
      </div>}
    </header>
    {error ? <div className="lint-camera-fallback"><p role="alert">{error}</p><button type="button" className="lint-camera-choose" onClick={choosePhotos}>Choose photo</button></div>
      : <>{!ready && <p role="status" className="lint-camera-waiting">Waiting for camera access…</p>}
        <footer className="lint-camera-controls">
          <button type="button" aria-label="Choose photos" className="lint-camera-icon" disabled={encoding} onClick={choosePhotos}><ImagePlus aria-hidden="true" /></button>
          <button type="button" aria-label="Take photo" className="lint-camera-shutter" disabled={!ready || encoding} onClick={take}><span /></button>
          <span className="lint-camera-controls-spacer" aria-hidden="true" />
        </footer></>}
  </div>;
}
