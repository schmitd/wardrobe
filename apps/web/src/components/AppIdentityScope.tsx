"use client";
import { useAuth } from "@clerk/nextjs";
import {useConvexAuth} from "convex/react";
import {useGuestChoice} from "./GuestChoice";
import type { ReactNode } from "react";
import { NotificationProvider } from "./Notifications";

/** One account owns private capture, notices, drafts and retained Home UI. */
export default function AppIdentityScope({ children }: { children: ReactNode }) {
  const { isLoaded, userId } = useAuth();
  const backend=useConvexAuth();
  const choice=useGuestChoice();
  const owner = isLoaded ? userId ?? "guest" : "pending";
  const scope = `${owner}:${userId ? backend.isLoading ? "connecting" : backend.isAuthenticated ? "confirmed" : "unavailable" : "anonymous"}:${choice.guest ? "guest-choice" : "account"}`;
  return <NotificationProvider key={scope}>{children}</NotificationProvider>;
}
