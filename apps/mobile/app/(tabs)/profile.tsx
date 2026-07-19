import { useAuth, useUser } from "@clerk/expo";
import { Pressable, Text } from "react-native";

import { Intro, Page, Panel } from "@/screen";
import { colors } from "@/theme";
import { useWardrobe } from "@/use-wardrobe";

export default function Profile() {
  const { signOut } = useAuth();
  const { user } = useUser();
  const query = useWardrobe();
  const email = user?.primaryEmailAddress?.emailAddress ?? query.data?.currentUser?.email;
  return (
    <Page>
      <Intro eyebrow="Style memory" title={user?.firstName ? `${user.firstName}’s Wardrobe` : "Your Wardrobe"} body="The context carried across your rack, fits, collections, and try-ons." />
      <Panel tint={colors.wash}><Text selectable style={{ color: colors.ink, fontSize: 18, fontWeight: "900" }}>{user?.fullName ?? query.data?.currentUser?.name ?? "Wardrobe member"}</Text>{email ? <Text selectable style={{ color: colors.muted }}>{email}</Text> : null}</Panel>
      <Panel><Text selectable style={{ color: colors.plum, fontSize: 12, fontWeight: "900", textTransform: "uppercase" }}>Your style, in words</Text><Text selectable style={{ color: colors.ink, fontSize: 16, lineHeight: 24 }}>{query.data?.profile?.bio ?? "Add a fit check and the agent will begin building your style memory."}</Text></Panel>
      <Pressable onPress={() => void signOut()} style={{ alignSelf: "flex-start", borderColor: colors.line, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: colors.surface }}><Text style={{ color: colors.ink, fontWeight: "900" }}>Sign out</Text></Pressable>
    </Page>
  );
}
