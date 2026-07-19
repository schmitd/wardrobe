import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useAuth, useUser } from "@clerk/expo";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";

import { analyzeSelfie, updateBio } from "@/api";
import { uploadPhoto } from "@/photo-upload";
import { ErrorPanel, Page, Panel } from "@/screen";
import { colors } from "@/theme";
import { useWardrobe } from "@/use-wardrobe";

const trace = () => `native-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export function ProfileScreen() {
  const { signOut, getToken } = useAuth();
  const { user } = useUser();
  const queryClient = useQueryClient();
  const router = useRouter();
  const query = useWardrobe();
  const [bio, setBio] = useState("");
  const [saved, setSaved] = useState(false);
  const email = user?.primaryEmailAddress?.emailAddress ?? query.data?.currentUser?.email;

  useEffect(() => { if (query.data?.profile?.bio !== undefined) setBio(query.data.profile?.bio ?? ""); }, [query.data?.profile?.bio]);

  const bioMutation = useMutation({
    mutationFn: () => updateBio(getToken, bio, trace()),
    onSuccess: async () => { setSaved(true); await queryClient.invalidateQueries({ queryKey: ["mobile-bootstrap"] }); },
  });
  const selfieMutation = useMutation({
    mutationFn: async (uri: string) => analyzeSelfie(getToken, await uploadPhoto(getToken, uri, 1400), trace()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["mobile-bootstrap"] }),
  });

  const chooseSelfie = () => {
    void ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.9, allowsEditing: false }).then((result) => {
      if (!result.canceled && result.assets[0]) selfieMutation.mutate(result.assets[0].uri);
    });
  };

  const profile = query.data?.profile;
  const attributes = [
    ["Skin tone", profile?.skinTone],
    ["Complexion", profile?.complexion],
    ["Hair color", profile?.hairColor],
    ["Color season", profile?.colorSeason],
  ].filter((entry): entry is [string, string] => Boolean(entry[1]));

  return (
    <Page refresh={() => void query.refetch()} refreshing={query.isRefetching}>
      <View style={{ gap: 7 }}><Text selectable style={{ color: colors.plum, fontSize: 13, fontWeight: "900", textTransform: "uppercase" }}>Style memory</Text><Text selectable style={{ color: colors.muted, fontSize: 15, lineHeight: 22 }}>The context carried across your rack, fits, collections, and try-ons.</Text></View>
      <Panel tint={colors.wash}><Text selectable style={{ color: colors.ink, fontSize: 18, fontWeight: "900" }}>{user?.fullName ?? query.data?.currentUser?.name ?? "Wardrobe member"}</Text>{email ? <Text selectable style={{ color: colors.muted }}>{email}</Text> : null}</Panel>

      <View style={{ gap: 10 }}>
        <View style={{ gap: 4 }}><Text selectable style={{ color: colors.ink, fontSize: 20, fontWeight: "900" }}>Your style, in words</Text><Text selectable style={{ color: colors.muted, fontSize: 13, lineHeight: 19 }}>The agent maintains this from your wardrobe. Your edits remain the anchor.</Text></View>
        <TextInput accessibilityLabel="Style bio" multiline onChangeText={(value) => { setBio(value); setSaved(false); }} placeholder="Neutral layers, tailored fits, and statement outerwear…" placeholderTextColor="#8B758E" style={{ minHeight: 150, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, color: colors.ink, padding: 14, fontSize: 15, lineHeight: 22, textAlignVertical: "top", borderRadius: 12, borderCurve: "continuous" }} value={bio} />
        {bioMutation.error ? <ErrorPanel message={bioMutation.error.message} /> : null}
        {saved ? <Text selectable accessibilityRole="alert" style={{ color: colors.success, fontWeight: "800" }}>Style profile updated.</Text> : null}
        <Pressable disabled={bioMutation.isPending} onPress={() => bioMutation.mutate()} style={{ minHeight: 50, backgroundColor: colors.lime, borderWidth: 1, borderColor: colors.line, alignItems: "center", justifyContent: "center", opacity: bioMutation.isPending ? 0.6 : 1, borderRadius: 10, borderCurve: "continuous" }}>{bioMutation.isPending ? <ActivityIndicator color={colors.ink} /> : <Text style={{ color: colors.ink, fontWeight: "900" }}>Save profile</Text>}</Pressable>
      </View>

      <View style={{ gap: 12 }}>
        <View style={{ gap: 4 }}><View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}><MaterialCommunityIcons name="shimmer" size={20} color={colors.plum} /><Text selectable style={{ color: colors.ink, fontSize: 20, fontWeight: "900" }}>Color and fit profile</Text></View><Text selectable style={{ color: colors.muted, fontSize: 13, lineHeight: 19 }}>A clear face photo can refresh color notes. It stays separate from your rack.</Text></View>
        {query.data?.latestSelfie?.url ? <Image source={query.data.latestSelfie.url} style={{ width: "100%", aspectRatio: 0.9, backgroundColor: colors.wash, borderWidth: 1, borderColor: colors.line, borderRadius: 14 }} contentFit="cover" /> : null}
        {attributes.length ? <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>{attributes.map(([label, value]) => <View key={label} style={{ width: "47%", borderWidth: 1, borderColor: colors.washStrong, backgroundColor: colors.surface, padding: 12, gap: 3, borderRadius: 10, borderCurve: "continuous" }}><Text selectable style={{ color: colors.muted, fontSize: 11, fontWeight: "800" }}>{label}</Text><Text selectable style={{ color: colors.ink, fontWeight: "900" }}>{value}</Text></View>)}</View> : null}
        {selfieMutation.error ? <ErrorPanel message={selfieMutation.error.message} /> : null}
        <Pressable disabled={selfieMutation.isPending} onPress={chooseSelfie} style={{ minHeight: 48, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, opacity: selfieMutation.isPending ? 0.6 : 1, borderRadius: 10, borderCurve: "continuous" }}>{selfieMutation.isPending ? <ActivityIndicator color={colors.plum} /> : <MaterialCommunityIcons name="image-outline" size={20} color={colors.plum} />}<Text style={{ color: colors.ink, fontWeight: "900" }}>{selfieMutation.isPending ? "Reading color notes…" : query.data?.latestSelfie ? "Replace face photo" : "Choose face photo"}</Text></Pressable>
      </View>

      <Pressable onPress={() => { void signOut().then(() => { queryClient.clear(); router.replace("/welcome"); }); }} style={{ alignSelf: "flex-start", borderColor: colors.line, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: colors.surface, borderRadius: 10, borderCurve: "continuous" }}><Text style={{ color: colors.ink, fontWeight: "900" }}>Sign out</Text></Pressable>
    </Page>
  );
}
