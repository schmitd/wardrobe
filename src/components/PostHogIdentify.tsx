"use client";

import { useEffect, useRef } from "react";
import { useUser } from "@clerk/nextjs";
import posthog from "posthog-js";

export default function PostHogIdentify() {
  const { user, isLoaded } = useUser();
  const identifiedUserId = useRef<string | null>(null);

  useEffect(() => {
    if (!isLoaded) return;

    if (user) {
      const primaryEmail = user.primaryEmailAddress?.emailAddress;
      posthog.identify(user.id, {
        email: primaryEmail,
        name: user.fullName,
      });
      identifiedUserId.current = user.id;
    } else if (identifiedUserId.current) {
      posthog.reset();
      identifiedUserId.current = null;
    }
  }, [isLoaded, user]);

  return null;
}
