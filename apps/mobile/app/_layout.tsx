import { ClerkProvider, useAuth } from "@clerk/expo";
import { tokenCache } from "@clerk/expo/token-cache";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { ActivityIndicator, View } from "react-native";

import { CaptureProvider } from "@/capture-context";
import { colors } from "@/theme";
import {
  AnalyticsObserver,
  AnalyticsErrorBoundary,
} from "@/analytics-provider";
import { PlannerProvider } from "@/planner-context";
import { isIOS } from "@/planner-ui";

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

function Navigation() {
  const { isLoaded, isSignedIn, userId } = useAuth({
    treatPendingAsSignedOut: false,
  });

  if (!isLoaded) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.paper,
        }}
      >
        <ActivityIndicator color={colors.plum} />
      </View>
    );
  }

  return (
    <PlannerProvider key={userId ?? "signed-out"}>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.paper },
          headerTintColor: colors.ink,
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Protected guard={!isSignedIn}>
          <Stack.Screen name="sign-in" options={{ headerShown: false }} />
        </Stack.Protected>
        <Stack.Protected guard={Boolean(isSignedIn)}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen
            name="capture/index"
            options={{ headerShown: false, presentation: "fullScreenModal" }}
          />
          <Stack.Screen
            name="capture/processing"
            options={{
              title: "Processing",
              presentation: "fullScreenModal",
              headerBackVisible: false,
            }}
          />
          <Stack.Screen
            name="account"
            options={{
              title: "Account",
              headerBackButtonDisplayMode: "minimal",
            }}
          />
          <Stack.Screen
            name="planner/day"
            options={{
              title: "Your outfit",
              headerBackButtonDisplayMode: "minimal",
            }}
          />
          {(["describe", "calendar", "week", "options", "swap"] as const).map(
            (name) => (
              <Stack.Screen
                key={name}
                name={`planner/${name}`}
                options={{
                  title: {
                    describe: "Describe your week",
                    calendar: "Google Calendar",
                    week: "Choose week",
                    options: "More options",
                    swap: "Swap a piece",
                  }[name],
                  presentation: isIOS ? "formSheet" : "modal",
                  sheetAllowedDetents: [0.85, 1],
                  sheetGrabberVisible: isIOS,
                  headerBackButtonDisplayMode: "minimal",
                }}
              />
            ),
          )}
          <Stack.Screen
            name="plan/new"
            options={{
              title: "New plan",
              headerBackButtonDisplayMode: "minimal",
            }}
          />
          <Stack.Screen
            name="plan/[id]"
            options={{ title: "Plan", headerBackButtonDisplayMode: "minimal" }}
          />
          <Stack.Screen
            name="collection/new"
            options={{
              title: "New plan",
              headerBackButtonDisplayMode: "minimal",
            }}
          />
          <Stack.Screen
            name="collection/[id]"
            options={{ title: "Plan", headerBackButtonDisplayMode: "minimal" }}
          />
          <Stack.Screen
            name="item/[id]"
            options={{
              title: "Closet piece",
              headerBackButtonDisplayMode: "minimal",
            }}
          />
        </Stack.Protected>
      </Stack>
    </PlannerProvider>
  );
}

export default function RootLayout() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 20_000, retry: 2 } },
      }),
  );

  if (!publishableKey) {
    throw new Error(
      "Add EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY to the mobile environment.",
    );
  }

  return (
    <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
      <QueryClientProvider client={queryClient}>
        <AnalyticsObserver />
        <AnalyticsErrorBoundary>
          <CaptureProvider>
            <StatusBar style="dark" />
            <Navigation />
          </CaptureProvider>
        </AnalyticsErrorBoundary>
      </QueryClientProvider>
    </ClerkProvider>
  );
}
