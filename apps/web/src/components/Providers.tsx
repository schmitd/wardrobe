"use client";

import { ConvexProviderWithClerk } from "convex/react-clerk";
import { useAuth } from "@clerk/nextjs";
import { convex } from "@/lib/convex";
import { GuestChoiceProvider } from "./GuestChoice";
import AppIdentityScope from "./AppIdentityScope";
import PostHogIdentify from "@/components/PostHogIdentify";

export default function Providers({ children }: { children: React.ReactNode }) {
  const { isLoaded, userId, sessionId } = useAuth();
  const owner = isLoaded ? `${userId ?? "guest"}:${sessionId ?? "none"}` : "pending";
  return (
    <GuestChoiceProvider><ConvexProviderWithClerk key={owner} client={convex} useAuth={useAuth}>
      <PostHogIdentify />
      <AppIdentityScope>{children}</AppIdentityScope>
    </ConvexProviderWithClerk></GuestChoiceProvider>
  );
}
