"use client";
import Link from "next/link";
import { SignIn, useAuth } from "@clerk/nextjs";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function SignInPage() {
  const { isLoaded, isSignedIn } = useAuth();
  const router = useRouter();
  useEffect(() => { if (isLoaded && isSignedIn) router.replace("/"); }, [isLoaded, isSignedIn, router]);
  return <main className="mx-auto space-y-4 p-6">
    <h1 className="text-2xl font-bold">Sign in to Lint</h1>
    {!isLoaded && <p role="status">Loading sign-in. If it does not open, retry this page. Your guest draft stays in this browser tab.</p>}
    <SignIn routing="path" path="/sign-in" forceRedirectUrl="/" fallbackRedirectUrl="/" />
    <Link href="/" className="underline">Return to guest wardrobe</Link>
  </main>;
}
