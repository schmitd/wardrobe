import { ClerkProvider, useAuth } from "@clerk/expo";
import { tokenCache } from "@clerk/expo/token-cache";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { ActivityIndicator, View } from "react-native";

import { CaptureProvider } from "@/capture-context";
import { colors } from "@/theme";

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

function Navigation() {
  const { isLoaded, isSignedIn } = useAuth({ treatPendingAsSignedOut: false });

  if (!isLoaded) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.paper }}>
        <ActivityIndicator color={colors.plum} />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerStyle: { backgroundColor: colors.paper }, headerTintColor: colors.ink }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Protected guard={!isSignedIn}>
        <Stack.Screen name="sign-in" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Protected guard={Boolean(isSignedIn)}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="capture/index" options={{ headerShown: false, presentation: "fullScreenModal" }} />
        <Stack.Screen name="capture/review" options={{ title: "Review photo", presentation: "modal" }} />
        <Stack.Screen name="collection/new" options={{ title: "New collection", presentation: "formSheet", sheetGrabberVisible: true, sheetAllowedDetents: [0.72, 1] }} />
        <Stack.Screen name="collection/[id]" options={{ title: "Collection", headerBackButtonDisplayMode: "minimal" }} />
        <Stack.Screen name="item/[id]" options={{ title: "Closet piece", headerBackButtonDisplayMode: "minimal" }} />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: { queries: { staleTime: 20_000, retry: 2 } },
  }));

  if (!publishableKey) {
    throw new Error("Add EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY to the mobile environment.");
  }

  return (
    <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
      <QueryClientProvider client={queryClient}>
        <CaptureProvider>
          <StatusBar style="dark" />
          <Navigation />
        </CaptureProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}
