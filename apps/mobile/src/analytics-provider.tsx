import { useAuth } from "@clerk/expo";
import { useSegments } from "expo-router";
import { Component, useEffect, useRef, type PropsWithChildren } from "react";
import { AppState, Text, View } from "react-native";
import { analytics, releaseProperties, track, trackFailure } from "./analytics";
import { screenName } from "./analytics-core";

export function AnalyticsObserver() {
  const { isLoaded, userId } = useAuth();
  const segments = useSegments();
  const screen = screenName(segments);
  const identity = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (!isLoaded) return;
    try {
      if (userId) analytics.identify(userId); // Same opaque Clerk ID as web; no name/email.
      else if (identity.current !== null) {
        const optedOut = analytics.optedOut;
        analytics.reset();
        if (optedOut) void analytics.optOut().catch(() => undefined);
      }
      identity.current = userId ?? null;
    } catch { /* best effort */ }
  }, [isLoaded, userId]);
  useEffect(() => {
    try { void analytics.screen(screen, releaseProperties()).catch(() => undefined); } catch { /* best effort */ }
  }, [screen]);
  useEffect(() => {
    track("native_app_opened");
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") track("native_app_resumed");
      if (state === "background") void analytics.flush().catch(() => undefined);
    });
    return () => subscription.remove();
  }, []);
  return null;
}

export class AnalyticsErrorBoundary extends Component<PropsWithChildren, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { trackFailure("render"); }
  render() {
    if (this.state.failed) return <View style={{ flex: 1, justifyContent: "center", padding: 24 }}><Text>Wardrobe could not display this screen. Please close and reopen the app.</Text></View>;
    return this.props.children;
  }
}
