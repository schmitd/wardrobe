import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useAuth } from "@clerk/expo";
import { Link, Redirect } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";

import { colors } from "@/theme";

export function WelcomeScreen() {
  const { isSignedIn } = useAuth({ treatPendingAsSignedOut: false });
  if (isSignedIn) return <Redirect href="/(tabs)/rack" />;
  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ flexGrow: 1, padding: 22, paddingBottom: 34, justifyContent: "space-between", gap: 32, backgroundColor: colors.paper }}>
      <View style={{ gap: 28, paddingTop: 24 }}>
        <View style={{ gap: 11 }}><View style={{ width: 48, height: 48, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.lime, alignItems: "center", justifyContent: "center", borderRadius: 12, borderCurve: "continuous" }}><MaterialCommunityIcons name="tshirt-crew-outline" size={28} color={colors.ink} /></View><Text selectable style={{ color: colors.ink, fontSize: 39, lineHeight: 42, fontWeight: "900" }}>Create your dream wardrobe.</Text><Text selectable style={{ color: colors.muted, fontSize: 16, lineHeight: 24 }}>Find your style based on what you already wear. Start with one full-body photo and the agent will pick out the pieces, define your look, and help you perfect your wardrobe.</Text></View>
        <View style={{ borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, padding: 18, gap: 12, borderRadius: 16, borderCurve: "continuous", boxShadow: "3px 4px 0 rgba(67,40,63,.16)" }}><Text selectable style={{ color: colors.plum, fontSize: 12, fontWeight: "900", textTransform: "uppercase" }}>First, one full-body fit check</Text><Text selectable style={{ color: colors.ink, fontSize: 23, lineHeight: 27, fontWeight: "900" }}>Wear something that feels like you.</Text><Text selectable style={{ color: colors.muted, fontSize: 14, lineHeight: 21 }}>Keep your whole outfit in frame. Take a new selfie or choose one from your camera roll; you’ll sign in only when you’re ready to save it.</Text><Link href={{ pathname: "/capture", params: { onboarding: "1" } }} asChild><Pressable style={{ minHeight: 54, marginTop: 4, backgroundColor: colors.lime, borderWidth: 1, borderColor: colors.line, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9, borderRadius: 11, borderCurve: "continuous" }}><MaterialCommunityIcons name="camera-outline" size={22} color={colors.ink} /><Text style={{ color: colors.ink, fontSize: 16, fontWeight: "900" }}>Start with a fit check</Text></Pressable></Link></View>
      </View>
      <View style={{ alignItems: "center", gap: 7 }}><Text selectable style={{ color: colors.muted, fontSize: 13 }}>Already have a wardrobe?</Text><Link href="/sign-in" asChild><Pressable style={{ padding: 9 }}><Text style={{ color: colors.plum, fontWeight: "900" }}>Sign in</Text></Pressable></Link></View>
    </ScrollView>
  );
}
