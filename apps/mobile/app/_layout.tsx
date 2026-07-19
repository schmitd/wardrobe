import { ClerkProvider, useAuth } from "@clerk/expo";
import { resourceCache } from "@clerk/expo/resource-cache";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

import { CaptureProvider } from "@/capture-context";
import { clerkTokenCache, clearClerkBootstrapState } from "@/clerk-token-cache";
import { colors } from "@/theme";

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

function Navigation({ resetAuth }: { resetAuth: () => void }) {
  const { isLoaded } = useAuth({ treatPendingAsSignedOut: false });
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (isLoaded) {
      setTimedOut(false);
      return;
    }
    const timeout = setTimeout(() => setTimedOut(true), 8_000);
    return () => clearTimeout(timeout);
  }, [isLoaded]);

  if (!isLoaded) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 14, padding: 28, backgroundColor: colors.paper }}>
        {timedOut ? (
          <>
            <Text selectable style={{ color: colors.ink, fontSize: 25, lineHeight: 29, fontWeight: "900", textAlign: "center" }}>Wardrobe could not finish signing in.</Text>
            <Text selectable style={{ color: colors.muted, fontSize: 15, lineHeight: 22, textAlign: "center" }}>Reset the saved session on this device, then connect again.</Text>
            <Pressable accessibilityRole="button" onPress={resetAuth} style={{ minHeight: 50, marginTop: 6, paddingHorizontal: 22, backgroundColor: colors.lime, borderColor: colors.line, borderWidth: 1, alignItems: "center", justifyContent: "center", borderRadius: 10, borderCurve: "continuous" }}>
              <Text style={{ color: colors.ink, fontSize: 16, fontWeight: "900" }}>Reset sign-in</Text>
            </Pressable>
          </>
        ) : (
          <>
            <ActivityIndicator color={colors.plum} />
            <Text selectable style={{ color: colors.muted, fontWeight: "800" }}>Connecting your wardrobe…</Text>
          </>
        )}
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerStyle: { backgroundColor: colors.paper }, headerTintColor: colors.ink }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="welcome" options={{ headerShown: false }} />
      <Stack.Screen name="sign-in" options={{ headerShown: false, presentation: "fullScreenModal" }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="capture/index" options={{ headerShown: false, presentation: "fullScreenModal" }} />
      <Stack.Screen name="capture/review" options={{ title: "Review photo", presentation: "modal" }} />
      <Stack.Screen name="collection/new" options={{ title: "New collection", presentation: "formSheet", sheetGrabberVisible: true, sheetAllowedDetents: [0.72, 1] }} />
      <Stack.Screen name="collection/[id]" options={{ title: "Collection", headerBackButtonDisplayMode: "minimal" }} />
      <Stack.Screen name="item/[id]" options={{ title: "Closet piece", headerBackButtonDisplayMode: "minimal" }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [authGeneration, setAuthGeneration] = useState(0);
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: { queries: { staleTime: 20_000, retry: 2 } },
  }));

  if (!publishableKey) {
    throw new Error("Add EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY to the mobile environment.");
  }

  const resetAuth = () => {
    void clearClerkBootstrapState().then(() => {
      queryClient.clear();
      setAuthGeneration((generation) => generation + 1);
    });
  };

  return (
    <ClerkProvider key={authGeneration} publishableKey={publishableKey} tokenCache={clerkTokenCache} __experimental_resourceCache={resourceCache}>
      <QueryClientProvider client={queryClient}>
        <CaptureProvider>
          <StatusBar style="dark" />
          <Navigation resetAuth={resetAuth} />
        </CaptureProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}
