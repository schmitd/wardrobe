"use client";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { useGuestChoice } from "./GuestChoice";
import WardrobeShell from "./WardrobeShell";
export default function AuthEntry({ready,children,guest=children,phase="session",accountAvailable=false}:{ready:boolean;children:ReactNode;guest?:ReactNode;phase?:"session"|"backend"|"unavailable";accountAvailable?:boolean}) {
  const choice = useGuestChoice();
  const [delayedPhase,setDelayedPhase] = useState<string|null>(null);
  const delayed = delayedPhase === phase;
  useEffect(()=>{
    if(ready || choice.guest) return;
    const timer=setTimeout(()=>setDelayedPhase(phase),8000);
    return ()=>clearTimeout(timer);
  },[ready,choice.guest,phase]);
  if(choice.guest) return <>
    <section className="home-auth-recovery" aria-label="Guest mode"><p>You&apos;re browsing as a guest.</p>
      <div className="home-auth-actions">{accountAvailable ? <button type="button" onClick={choice.useAccount}>Use my wardrobe</button> : <Link href="/sign-in">Sign in</Link>}</div>
    </section>{guest}
  </>;
  if(ready) return children;
  const unavailable=phase === "unavailable";
  return <>
    {(delayed || unavailable) && <section className="home-auth-recovery" aria-label="Session recovery">
      <p role={unavailable ? "alert" : "status"}>{unavailable ? "Your session is signed in, but wardrobe access could not be confirmed." : phase === "backend" ? "Connecting to your wardrobe is taking longer than expected." : "Sign-in is taking longer than expected."}</p>
      <div className="home-auth-actions"><button type="button" onClick={()=>window.location.reload()}>{phase === "session" ? "Retry sign-in" : "Retry connection"}</button>
        <Link href="/sign-in">Sign in</Link><button type="button" onClick={choice.chooseGuest}>Continue as guest</button></div>
    </section>}
    <WardrobeShell />
  </>;
}
