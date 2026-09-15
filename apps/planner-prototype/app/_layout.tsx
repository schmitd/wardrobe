import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Store } from "../src/store";
import { usePalette } from "../src/ui";
export default function Layout() {
  const c = usePalette();
  return (
    <Store>
      <StatusBar style="auto" />
      <Stack
        screenOptions={{
          headerTintColor: c.accent,
          headerStyle: { backgroundColor: c.background },
          headerShadowVisible: false,
          headerBackButtonDisplayMode: "minimal",
          contentStyle: { backgroundColor: c.background },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="dictate"
          options={{
            title: "Describe your week",
            presentation: "formSheet",
            sheetAllowedDetents: [0.85, 1],
            sheetGrabberVisible: true,
          }}
        />
        <Stack.Screen
          name="edit-day"
          options={{
            title: "Edit day context",
            presentation: "formSheet",
            sheetAllowedDetents: [0.75, 1],
            sheetGrabberVisible: true,
          }}
        />
        <Stack.Screen
          name="week"
          options={{
            title: "Choose week",
            presentation: "formSheet",
            sheetAllowedDetents: [0.75, 1],
            sheetGrabberVisible: true,
          }}
        />
        <Stack.Screen name="outfit" options={{ title: "Your outfit" }} />
        <Stack.Screen
          name="calendar"
          options={{
            title: "Google Calendar",
            presentation: "formSheet",
            sheetAllowedDetents: [0.75, 1],
            sheetGrabberVisible: true,
          }}
        />
        <Stack.Screen
          name="options"
          options={{
            title: "More options",
            presentation: "formSheet",
            sheetAllowedDetents: [0.75, 1],
            sheetGrabberVisible: true,
          }}
        />
        <Stack.Screen
          name="swap"
          options={{
            title: "Swap a piece",
            presentation: "formSheet",
            sheetAllowedDetents: [0.5, 1],
            sheetGrabberVisible: true,
          }}
        />
        <Stack.Screen
          name="why"
          options={{
            title: "Why this outfit",
            presentation: "formSheet",
            sheetAllowedDetents: [0.5, 1],
            sheetGrabberVisible: true,
          }}
        />
      </Stack>
    </Store>
  );
}
