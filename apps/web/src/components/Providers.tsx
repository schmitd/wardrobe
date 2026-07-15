"use client";

import { ConvexProviderWithClerk } from "convex/react-clerk";
import { useAuth } from "@clerk/nextjs";
import { convex } from "@/lib/convex";
import PostHogIdentify from "@/components/PostHogIdentify";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
      <PostHogIdentify />
      {children}
    </ConvexProviderWithClerk>
  );
}
