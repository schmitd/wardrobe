"use client";
import { lazy, Suspense } from "react";
import { useAuth } from "@clerk/nextjs";
import { useConvexAuth } from "convex/react";
import AuthEntry from "./AuthEntry";
import WardrobeShell from "./WardrobeShell";
import HomeSectionBoundary from "./HomeSectionBoundary";
const SignedInHome = lazy(() => import("./SignedInHome"));
const GuestClosetDemo = lazy(() => import("./GuestClosetDemo"));
export default function HomeWorkspace() {
  const {isLoaded,isSignedIn,userId} = useAuth();
  const auth = useConvexAuth();
  const ready = isLoaded && (!isSignedIn || (!auth.isLoading && auth.isAuthenticated));
  const phase = !isLoaded ? "session" : auth.isLoading ? "backend" : "unavailable";
  const guest = <HomeSectionBoundary title="Guest demo" reloadOnRetry retryLabel="Retry guest demo"><Suspense fallback={<WardrobeShell />}><GuestClosetDemo uploaderInputId="rack-upload-input" /></Suspense></HomeSectionBoundary>;
  return <main className="relative min-h-screen pb-28 md:pb-16">
    <div className="mx-auto w-full max-w-[1320px] space-y-6 px-4 pb-16 pt-6 sm:px-6 sm:pt-8 lg:px-10 lg:pt-10">
      <AuthEntry ready={ready} phase={phase} accountAvailable={Boolean(ready && isSignedIn && userId)} guest={guest}>
        {ready && isSignedIn && userId ? <HomeSectionBoundary key={userId} title="Wardrobe" reloadOnRetry retryLabel="Retry wardrobe"><Suspense fallback={<WardrobeShell />}><SignedInHome ownerId={userId} /></Suspense></HomeSectionBoundary> : guest}
      </AuthEntry>
    </div>
  </main>;
}
