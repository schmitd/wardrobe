"use client";

import { useEffect, useRef, useState } from "react";
import { Download } from "lucide-react";

type InstallPrompt = Event & {
  prompt: () => Promise<unknown>;
  userChoice?: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/** Chromium supplies eligibility; unsupported browsers receive no app funnel. */
export default function InstallLint() {
  const prompt = useRef<InstallPrompt | null>(null);
  const [available, setAvailable] = useState(false);
  useEffect(() => {
    const display = window.matchMedia("(display-mode: standalone)");
    const installed = () => display.matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
    const hide = () => { prompt.current = null; setAvailable(false); };
    const receive = (event: Event) => {
      if (installed() || typeof (event as InstallPrompt).prompt !== "function") return;
      event.preventDefault();
      prompt.current = event as InstallPrompt;
      setAvailable(true);
    };
    const mode = () => { if (installed()) hide(); };
    window.addEventListener("beforeinstallprompt", receive);
    window.addEventListener("appinstalled", hide);
    display.addEventListener?.("change", mode);
    return () => {
      window.removeEventListener("beforeinstallprompt", receive);
      window.removeEventListener("appinstalled", hide);
      display.removeEventListener?.("change", mode);
      prompt.current = null;
    };
  }, []);
  const install = async () => {
    const event = prompt.current;
    if (!event) return;
    // Each retained event is single-use. Call prompt in this original click.
    prompt.current = null;
    setAvailable(false);
    try { await event.prompt(); await event.userChoice; }
    catch { /* The browser retains its own menu installation controls. */ }
  };
  if (!available) return null;
  return <button type="button" onClick={() => void install()} className="inline-flex min-h-11 items-center gap-1.5 text-xs font-semibold text-[#241426] underline underline-offset-4">
    <Download className="h-4 w-4" aria-hidden="true" />Install Lint
  </button>;
}
