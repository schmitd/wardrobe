"use client";

import { useEffect, useRef, useState } from "react";
import { ImagePlus, SwitchCamera, X } from "lucide-react";
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
  const captureGeneration = useRef(0);
  const previousDevice = useRef<string | undefined>(undefined);
  const switched = useRef(false);
  const stop = useRef<() => void>(() => {});
  const [facing, setFacing] = useState<"environment" | "user">("environment");
  const [mirrored, setMirrored] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [ready, setReady] = useState(false);
  const [encoding, setEncoding] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setReady(false);
    setEncoding(false);
    setError("");
    setNotice("");
    setMirrored(false);
    let obsolete = false;
    let stream: MediaStream | undefined;
    const preview = video.current;
    const release = () => {
      obsolete = true;
      captureGeneration.current++;
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
          video: { facingMode: { ideal: facing }, width: { ideal: 1600 }, height: { ideal: 1200 } },
        });
        pendingCameraRequest = request;
        let active: MediaStream;
        try { active = await request; }
        finally { if (pendingCameraRequest === request) pendingCameraRequest = null; }
        if (obsolete) { active.getTracks().forEach(track => track.stop()); return; }
        stream = active;
        // Mirror only a confirmed front-facing preview. Saved photos keep scene
        // orientation, including text on garments and mirror-selfie scenes.
        const settings = active.getVideoTracks()[0]?.getSettings();
        setMirrored(settings?.facingMode === "user");
        if (switched.current && ((settings?.facingMode && settings.facingMode !== facing) || (settings?.deviceId && settings.deviceId === previousDevice.current))) {
          setNotice("Requested camera unavailable. Using the available camera.");
        }
        if (switched.current && !settings?.facingMode && !settings?.deviceId) setNotice("Camera view could not be confirmed. Using the available camera.");
        previousDevice.current = settings?.deviceId;
        active.getVideoTracks()[0]?.addEventListener("ended", () => { if (!obsolete) { release(); setReady(false); setError("Camera unavailable or access declined."); } }, { once: true });
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
  }, [onClose, facing, attempt]);

  const close = () => { stop.current(); onClose(); };
  const choosePhotos = () => { stop.current(); onChoosePhotos(); };
  const dimensionsReady = () => {
    const source = video.current;
    if (source?.srcObject && (source.srcObject as MediaStream).getVideoTracks()[0]?.readyState === "live" && source.readyState >= 2 && source.videoWidth > 0 && source.videoHeight > 0) setReady(true);
  };
  const take = () => {
    const source = video.current;
    if (!source || !source.srcObject || !ready || source.readyState < 2 || (source.srcObject as MediaStream).getVideoTracks()[0]?.readyState !== "live" || !source.videoWidth || !source.videoHeight || capturing.current) return;
    capturing.current = true;
    const generation = ++captureGeneration.current;
    setEncoding(true);
    // Preserve the complete camera frame: viewport-shaped cover cropping can
    // look like zoom, especially for full-body selfies on tall screens.
    const width = source.videoWidth, height = source.videoHeight;
    const scale = Math.min(1, 1600 / Math.max(width, height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const context = canvas.getContext("2d");
    if (!context) { capturing.current = false; setEncoding(false); setError("Photo unavailable."); stop.current(); return; }
    context.drawImage(source, 0, 0, width, height, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(blob => {
      if (!capturing.current || generation !== captureGeneration.current) return;
      capturing.current = false;
      setEncoding(false);
      if (!blob) { stop.current(); setError("Photo unavailable."); return; }
      stop.current();
      onPhoto(new File([blob], "camera-photo.jpg", { type: "image/jpeg" }));
    }, "image/jpeg", 0.88);
  };

  return <div className="lint-camera" data-private>
    <video ref={video} autoPlay muted playsInline onLoadedData={dimensionsReady} onResize={dimensionsReady}
      aria-label="Camera preview" className="lint-camera-preview" data-mirrored={mirrored} hidden={Boolean(error)} />
    <header className="lint-camera-header">
      <button type="button" aria-label="Close camera" className="lint-camera-icon" onClick={close}><X aria-hidden="true" /></button>
      {!error && <div className="lint-camera-mode" aria-label="Photo use">
        <button type="button" disabled={encoding} aria-pressed={intent === "my_wardrobe"} onClick={() => onIntentChange("my_wardrobe")}>My wardrobe</button>
        <button type="button" disabled={encoding} aria-pressed={intent === "just_trying"} onClick={() => onIntentChange("just_trying")}>Try on</button>
      </div>}
    </header>
    {error ? <div className="lint-camera-fallback"><p role="alert">{error}</p><button type="button" className="lint-camera-choose" onClick={() => setAttempt(value => value + 1)}>Retry camera</button><button type="button" className="lint-camera-choose" onClick={choosePhotos}>Choose photo</button></div>
      : <>{!ready && <p role="status" className="lint-camera-waiting">Waiting for camera access…</p>}
        {notice && <p role="status" className="lint-camera-waiting">{notice}</p>}
        <footer className="lint-camera-controls">
          <button type="button" aria-label="Choose photos" className="lint-camera-icon" disabled={encoding} onClick={choosePhotos}><ImagePlus aria-hidden="true" /></button>
          <button type="button" aria-label="Take photo" className="lint-camera-shutter" disabled={!ready || encoding} onClick={take}><span /></button>
          <button type="button" aria-label="Switch camera" className="lint-camera-icon" disabled={!ready || encoding} onClick={() => { switched.current = true; stop.current(); setReady(false); setFacing(value => value === "environment" ? "user" : "environment"); }}><SwitchCamera aria-hidden="true" /></button>
        </footer></>}
  </div>;
}
