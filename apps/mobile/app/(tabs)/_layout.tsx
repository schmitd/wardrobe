import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useAuth } from "@clerk/expo";
import { Redirect, Tabs, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { Pressable, Text, View, type ColorValue } from "react-native";

import { colors } from "@/theme";

const tabIcon = (name: keyof typeof MaterialCommunityIcons.glyphMap, focusedName: keyof typeof MaterialCommunityIcons.glyphMap) =>
  ({ focused, color }: { focused: boolean; color: ColorValue }) => (
    <View style={{ width: 64, alignItems: "center", paddingTop: 8, borderTopColor: colors.plum, borderTopWidth: focused ? 3 : 0 }}>
      <MaterialCommunityIcons name={focused ? focusedName : name} size={25} color={color} />
    </View>
  );

export default function TabLayout() {
  const router = useRouter();
  const { isSignedIn } = useAuth({ treatPendingAsSignedOut: false });
  if (!isSignedIn) return <Redirect href="/welcome" />;
  return (
    <Tabs
      initialRouteName="rack"
      screenOptions={{
        headerStyle: { backgroundColor: colors.paper },
        headerTintColor: colors.ink,
        headerTitleStyle: { fontWeight: "900" },
        tabBarActiveTintColor: colors.plum,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.washStrong, height: 82, paddingTop: 0 },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "800", marginBottom: 7 },
      }}
    >
      <Tabs.Screen name="rack" options={{ title: "Rack", tabBarIcon: tabIcon("hanger", "hanger") }} />
      <Tabs.Screen name="fits" options={{ title: "Fits", tabBarIcon: tabIcon("calendar-blank-outline", "calendar") }} />
      <Tabs.Screen
        name="capture-entry"
        options={{
          title: "Add",
          headerShown: false,
          tabBarLabel: () => null,
          tabBarIcon: () => null,
          tabBarButton: () => (
            <View style={{ flex: 1, alignItems: "center" }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Add a wardrobe photo"
                onPress={() => { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push("/capture"); }}
                style={({ pressed }) => ({
                  width: 62,
                  height: 62,
                  marginTop: -22,
                  borderRadius: 31,
                  borderWidth: 2,
                  borderColor: colors.line,
                  backgroundColor: pressed ? "#CED95E" : colors.lime,
                  alignItems: "center",
                  justifyContent: "center",
                  shadowColor: colors.line,
                  shadowOpacity: 0.24,
                  shadowRadius: 4,
                  shadowOffset: { width: 0, height: 3 },
                  elevation: 6,
                })}
              >
                <MaterialCommunityIcons name="plus" size={35} color={colors.ink} />
              </Pressable>
              <Text style={{ marginTop: 4, color: colors.muted, fontSize: 11, fontWeight: "800" }}>Add</Text>
            </View>
          ),
        }}
      />
      <Tabs.Screen name="collections" options={{ title: "Collections", tabBarIcon: tabIcon("cards-outline", "cards"), headerRight: () => <Pressable accessibilityLabel="Create collection" onPress={() => router.push("/collection/new")} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}><MaterialCommunityIcons name="plus" size={25} color={colors.plum} /></Pressable> }} />
      <Tabs.Screen name="profile" options={{ title: "You", tabBarIcon: tabIcon("account-outline", "account") }} />
    </Tabs>
  );
}
