import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useAuth, useUser } from "@clerk/expo";
import { useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, Switch, Text, View } from "react-native";
import { analytics } from "@/analytics";
import { nativeReplayAvailable } from "@/replay-privacy";
import { readReplayConsent, setReplayConsent } from "@/replay-consent";

import { Page, Panel } from "@/screen";
import { colors } from "@/theme";
import { useWardrobe } from "@/use-wardrobe";

export function AccountScreen() {
  const { signOut } = useAuth();
  const { user } = useUser();
  const router = useRouter();
  const queryClient = useQueryClient();
  const query = useWardrobe();
  const [analyticsEnabled, setAnalyticsEnabled] = useState(!analytics.optedOut);
  const [analyticsError, setAnalyticsError] = useState(false);
  const [replayEnabled, setReplayEnabled] = useState(false);
  const [preferencePending, setPreferencePending] = useState(false);
  useEffect(() => { void readReplayConsent().then(setReplayEnabled).catch(() => undefined); }, []);
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
        onPress={() => { void setReplayConsent(false).catch(() => undefined).then(() => signOut()).then(() => { queryClient.clear(); router.replace("/sign-in"); }); }}
        style={{ alignSelf: "flex-start", borderColor: colors.line, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: colors.surface, borderRadius: 10, borderCurve: "continuous" }}
      >
        <Text style={{ color: colors.ink, fontWeight: "900" }}>Sign out</Text>
      </Pressable>
      <Panel>
        <Text style={{ color: colors.ink, fontWeight: "900" }}>Help improve Wardrobe</Text>
        <Text style={{ color: colors.muted, lineHeight: 20 }}>Share usage events and sanitized errors with PostHog. Session recordings are a separate choice below. Essential server reliability logs remain enabled.</Text>
        <Switch accessibilityLabel="Share usage analytics" disabled={preferencePending} value={analyticsEnabled} onValueChange={(enabled) => {
          setAnalyticsError(false);
          setPreferencePending(true);
          void (async () => {
            if (enabled) await analytics.optIn();
            else { await analytics.optOut(); await setReplayConsent(false); setReplayEnabled(false); }
            setAnalyticsEnabled(enabled);
          })().catch(() => setAnalyticsError(true)).finally(() => setPreferencePending(false));
        }} />
        <Text style={{ color: colors.ink, fontWeight: "900" }}>Share masked session recordings</Text>
        <Text style={{ color: colors.muted, lineHeight: 20 }}>Help us see navigation and layout problems. Recordings mask photos, camera previews, text, and inputs before upload. Audio, console logs, and network contents are not recorded. Off by default; requires usage analytics.</Text>
        {!nativeReplayAvailable ? <Text style={{ color: colors.muted }}>Recordings are not available in this build while privacy masking is being verified.</Text> : null}
        <Switch accessibilityLabel="Share masked session recordings" disabled={!nativeReplayAvailable || !analyticsEnabled || preferencePending} value={nativeReplayAvailable && analyticsEnabled && replayEnabled} onValueChange={(enabled) => {
          setAnalyticsError(false);
          setPreferencePending(true);
          void setReplayConsent(enabled).then(() => setReplayEnabled(enabled)).catch(() => setAnalyticsError(true)).finally(() => setPreferencePending(false));
        }} />
        {analyticsError ? <Text accessibilityRole="alert">Could not save this preference. Please try again.</Text> : null}
      </Panel>
    </Page>
  );
}
