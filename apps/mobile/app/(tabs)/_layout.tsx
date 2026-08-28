import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useAuth, useUser } from "@clerk/expo";
import { Image } from "expo-image";
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

function AccountButton() {
  const router = useRouter();
  const { user } = useUser();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Open account settings"
      onPress={() => router.push("/account")}
      style={{ width: 48, height: 44, alignItems: "center", justifyContent: "center" }}
    >
      {user?.imageUrl ? (
        <Image source={user.imageUrl} style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: colors.wash }} contentFit="cover" />
      ) : (
        <MaterialCommunityIcons name="account-circle-outline" size={30} color={colors.plum} />
      )}
    </Pressable>
  );
}

export default function TabLayout() {
  const router = useRouter();
  const { isSignedIn } = useAuth({ treatPendingAsSignedOut: false });
  if (!isSignedIn) return <Redirect href="/sign-in" />;
  return (
    <Tabs
      initialRouteName="wardrobe"
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
      <Tabs.Screen name="wardrobe" options={{ title: "Wardrobe", tabBarIcon: tabIcon("hanger", "hanger"), headerRight: () => <AccountButton /> }} />
      <Tabs.Screen
        name="capture-entry"
        options={{
          title: "Capture",
          headerShown: false,
          tabBarLabel: () => null,
          tabBarIcon: () => null,
          tabBarButton: () => (
            <View style={{ flex: 1, alignItems: "center" }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Capture a wardrobe photo"
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
              <Text style={{ marginTop: 4, color: colors.muted, fontSize: 11, fontWeight: "800" }}>Capture</Text>
            </View>
          ),
        }}
      />
      <Tabs.Screen name="fits" options={{ title: "Fits", tabBarIcon: tabIcon("calendar-blank-outline", "calendar"), headerRight: () => <AccountButton /> }} />
      <Tabs.Screen name="rack" options={{ href: null }} />
      <Tabs.Screen name="collections" options={{ href: null }} />
      <Tabs.Screen name="profile" options={{ href: null }} />
    </Tabs>
  );
}
