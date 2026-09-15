import { Stack } from "expo-router";
import { usePalette } from "../../../src/ui";
export default function FitsStack() {
  const c = usePalette();
  return (
    <Stack
      screenOptions={{
        title: "Fits",
        headerTintColor: c.accent,
        headerStyle: { backgroundColor: c.background },
        headerShadowVisible: false,
      }}
    />
  );
}
