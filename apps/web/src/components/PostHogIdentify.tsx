"use client";

import { useEffect, useRef } from "react";
import { useUser } from "@clerk/nextjs";
import posthog from "posthog-js";

export default function PostHogIdentify() {
  const { isLoaded, isSignedIn, user } = useUser();
  const identifiedUserId = useRef<string | null>(null);

  useEffect(() => {
    if (!isLoaded) return;

    if (isSignedIn && user) {
      posthog.identify(user.id, {
        email: user.primaryEmailAddress?.emailAddress,
        name: user.fullName,
      });
      identifiedUserId.current = user.id;
      return;
    }

    // Preserve the initial anonymous session. Reset only when an identified user
    // actually signs out so the next visitor cannot inherit their identity.
    if (identifiedUserId.current) {
      posthog.reset();
      identifiedUserId.current = null;
    }
  }, [isLoaded, isSignedIn, user]);

  return null;
}
