import { Tabs } from "expo-router";
import { Symbol, usePalette } from "../../src/ui";
export default function Layout() {
  const c = usePalette();
  return (
    <Tabs
      initialRouteName="fits"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.accent,
        tabBarInactiveTintColor: c.muted,
        tabBarStyle: { backgroundColor: c.surface },
      }}
    >
      <Tabs.Screen
        name="wardrobe"
        options={{
          title: "Wardrobe",
          tabBarIcon: ({ color }) => <Symbol name="hanger" color={color} />,
        }}
      />
      <Tabs.Screen
        name="capture"
        options={{
          title: "Capture",
          tabBarIcon: ({ color }) => (
            <Symbol name="plus.circle.fill" color={color} size={34} />
          ),
        }}
      />
      <Tabs.Screen
        name="fits"
        options={{
          title: "Fits",
          tabBarIcon: ({ color }) => <Symbol name="calendar" color={color} />,
        }}
      />
    </Tabs>
  );
}
