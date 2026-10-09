"use client";
import { useEffect, useRef, useState } from "react";
import { Button } from "./ui/button";

export default function WebPhotoCamera({ onPhoto, onChoosePhotos }: {
  onPhoto: (photo: File) => void; onChoosePhotos: () => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const capturing = useRef(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let stopped = false; let stream: MediaStream | undefined;
    const start = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("unsupported");
        const active = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: "environment" }, width: { ideal: 1600 }, height: { ideal: 1600 } } });
        if (stopped) { active.getTracks().forEach(track => track.stop()); return; }
        stream = active;
        if (video.current) { video.current.srcObject = active; await video.current.play(); }
      } catch {
        if (!stopped) setError("Camera unavailable or access declined. Choose photos instead, or try again after allowing camera access.");
      }
    };
    void start();
    return () => { stopped = true; capturing.current = false; stream?.getTracks().forEach(track => track.stop()); };
  }, []);
  const take = () => {
    const source = video.current;
    if (!source || !ready || !source.videoWidth || capturing.current) return;
    capturing.current = true;
    const scale = Math.min(1, 1600 / Math.max(source.videoWidth, source.videoHeight));
    const canvas = document.createElement("canvas");canvas.width = Math.round(source.videoWidth * scale);canvas.height = Math.round(source.videoHeight * scale);
    canvas.getContext("2d")?.drawImage(source, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(blob => { if (!capturing.current) return; capturing.current = false; if (blob) onPhoto(new File([blob], "camera-photo.jpg", { type: "image/jpeg" })); else setError("Photo unavailable. Please choose a photo instead."); }, "image/jpeg", 0.88);
  };
  return <div className="space-y-4">
    {!error && <video ref={video} autoPlay muted playsInline onLoadedData={() => setReady(true)} aria-label="Camera preview" className="max-h-[50vh] w-full rounded-xl bg-black object-contain" />}
    {error ? <p role="alert">{error}</p> : !ready && <p role="status">Waiting for camera access…</p>}
    <Button disabled={!ready || !!error} className="w-full" onClick={take}>Take photo</Button>
    <Button variant="outline" className="w-full" onClick={onChoosePhotos}>Choose photos</Button>
  </div>;
}
