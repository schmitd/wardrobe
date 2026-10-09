"use client";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";

/** A pending session is not evidence that the visitor is signed out. */
export default function AuthEntry({ ready, children }: { ready: boolean; children: ReactNode }) {
  const [continueAsGuest, setContinueAsGuest] = useState(false);
  const [delayed, setDelayed] = useState(false);
  useEffect(() => {
    if (ready) return;
    const timer = setTimeout(() => setDelayed(true), 8000);
    return () => clearTimeout(timer);
  }, [ready]);
  if (ready || continueAsGuest) return children;
  return <section className="rack-panel space-y-4" aria-label="Restoring your session">
    <p role="status">{delayed ? "Sign-in is taking longer than expected. You can retry or continue as a guest." : "Restoring your session…"}</p>
    <Link className="underline" href="/sign-in">Sign in</Link>
    <button type="button" className="underline" onClick={() => setContinueAsGuest(true)}>Continue as guest</button>
    {delayed && <button type="button" className="underline" onClick={() => window.location.reload()}>Retry sign-in</button>}
  </section>;
}
