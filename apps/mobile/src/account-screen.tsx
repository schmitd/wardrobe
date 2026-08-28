import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useAuth, useUser } from "@clerk/expo";
import { useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";

import { Page, Panel } from "@/screen";
import { colors } from "@/theme";
import { useWardrobe } from "@/use-wardrobe";

export function AccountScreen() {
  const { signOut } = useAuth();
  const { user } = useUser();
  const router = useRouter();
  const queryClient = useQueryClient();
  const query = useWardrobe();
  const name = user?.fullName ?? query.data?.currentUser?.name ?? "Wardrobe member";
  const email = user?.primaryEmailAddress?.emailAddress ?? query.data?.currentUser?.email;

  return (
    <Page refresh={() => void query.refetch()} refreshing={query.isRefetching}>
      <Panel tint={colors.wash}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
          {user?.imageUrl ? (
            <Image source={user.imageUrl} style={{ width: 58, height: 58, borderRadius: 29, backgroundColor: colors.surface }} contentFit="cover" />
          ) : (
            <View style={{ width: 58, height: 58, borderRadius: 29, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface }}>
              <MaterialCommunityIcons name="account" size={30} color={colors.plum} />
            </View>
          )}
          <View style={{ flex: 1, gap: 3 }}>
            <Text selectable style={{ color: colors.ink, fontSize: 19, fontWeight: "900" }}>{name}</Text>
            {email ? <Text selectable style={{ color: colors.muted }}>{email}</Text> : null}
          </View>
        </View>
      </Panel>
      <View style={{ gap: 6 }}>
        <Text selectable style={{ color: colors.ink, fontSize: 20, fontWeight: "900" }}>Account</Text>
        <Text selectable style={{ color: colors.muted, lineHeight: 20 }}>Your style and fit context now live with your wardrobe.</Text>
      </View>
      <Pressable
        onPress={() => { void signOut().then(() => { queryClient.clear(); router.replace("/sign-in"); }); }}
        style={{ alignSelf: "flex-start", borderColor: colors.line, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: colors.surface, borderRadius: 10, borderCurve: "continuous" }}
      >
        <Text style={{ color: colors.ink, fontWeight: "900" }}>Sign out</Text>
      </Pressable>
    </Page>
  );
}
