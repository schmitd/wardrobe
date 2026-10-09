"use client";
import { useAuth } from "@clerk/nextjs";
import type { ReactNode } from "react";
import { NotificationProvider } from "./Notifications";

/** One account owns private capture, notices, drafts and retained Home UI. */
export default function AppIdentityScope({ children }: { children: ReactNode }) {
  const { isLoaded, userId } = useAuth();
  const owner = isLoaded ? userId ?? "guest" : "pending";
  return <NotificationProvider key={owner}>{children}</NotificationProvider>;
}
