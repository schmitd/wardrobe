import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useAuth } from "@clerk/expo";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { Redirect, Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";

import { deleteItem } from "@/api";
import { ErrorPanel, Loading, Panel } from "@/screen";
import { colors } from "@/theme";
import { useWardrobe } from "@/use-wardrobe";

const reasons = ["Disliked item style", "Item damaged/lost", "Poor fit", "Other"];
const trace = () => `native-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export function ItemDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const itemId = Array.isArray(id) ? id[0] : id;
  const { getToken, isSignedIn } = useAuth({ treatPendingAsSignedOut: false });
  const router = useRouter();
  const queryClient = useQueryClient();
  const query = useWardrobe();
  const item = query.data?.items.find((entry) => entry.id === itemId);
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState(reasons[0]);
  const mutation = useMutation({
    mutationFn: () => deleteItem(getToken, itemId, reason, trace()),
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ["mobile-bootstrap"] }); router.back(); },
  });

  if (!isSignedIn) return <Redirect href="/sign-in" />;
  if (query.isLoading) return <Loading />;
  if (!item) return <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: 20 }}><ErrorPanel message="This piece could not be found." /></ScrollView>;
  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: 20, paddingBottom: 70, gap: 18 }}>
      <Stack.Screen options={{ title: item.category ?? "Closet piece" }} />
      <Image source={item.imageUrl} style={{ width: "100%", aspectRatio: 0.82, backgroundColor: colors.wash, borderWidth: 1, borderColor: colors.line, borderRadius: 16 }} contentFit="cover" />
      <View style={{ gap: 8 }}><Text selectable style={{ color: colors.ink, fontSize: 25, fontWeight: "900" }}>{item.category ?? "Closet piece"}</Text><Text selectable style={{ color: colors.muted, fontSize: 15, lineHeight: 23 }}>{item.description ?? "The agent is still learning this piece."}</Text>{item.styleTags?.length ? <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>{item.styleTags.map((tag) => <Text key={tag} selectable style={{ color: colors.plum, backgroundColor: colors.wash, paddingHorizontal: 9, paddingVertical: 5, fontSize: 11, fontWeight: "800", borderRadius: 99 }}>{tag}</Text>)}</View> : null}</View>
      {item.analysisStatus === "error" ? <ErrorPanel message={item.analysisError ?? "Analysis needs another pass."} /> : null}
      {!confirming ? <Pressable onPress={() => setConfirming(true)} style={{ minHeight: 48, borderWidth: 1, borderColor: colors.danger, backgroundColor: colors.surface, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 10, borderCurve: "continuous" }}><MaterialCommunityIcons name="trash-can-outline" size={20} color={colors.danger} /><Text style={{ color: colors.danger, fontWeight: "900" }}>Remove from wardrobe</Text></Pressable> : <Panel tint="#F8E6EE"><Text selectable style={{ color: colors.ink, fontSize: 18, fontWeight: "900" }}>Remove this piece?</Text><Text selectable style={{ color: colors.muted, lineHeight: 20 }}>This updates your wardrobe memory. Choose the closest reason.</Text><View style={{ gap: 7 }}>{reasons.map((entry) => <Pressable key={entry} disabled={mutation.isPending} onPress={() => setReason(entry)} style={{ minHeight: 42, borderWidth: 1, borderColor: colors.line, backgroundColor: reason === entry ? colors.lime : colors.surface, paddingHorizontal: 12, justifyContent: "center", borderRadius: 9, borderCurve: "continuous" }}><Text style={{ color: colors.ink, fontWeight: "800" }}>{entry.replace("Item ", "")}</Text></Pressable>)}</View>{mutation.error ? <ErrorPanel message={mutation.error.message} /> : null}<View style={{ flexDirection: "row", gap: 9 }}><Pressable disabled={mutation.isPending} onPress={() => setConfirming(false)} style={{ flex: 1, minHeight: 46, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", borderRadius: 9, borderCurve: "continuous" }}><Text style={{ color: colors.ink, fontWeight: "900" }}>Cancel</Text></Pressable><Pressable disabled={mutation.isPending} onPress={() => mutation.mutate()} style={{ flex: 1, minHeight: 46, backgroundColor: colors.ink, alignItems: "center", justifyContent: "center", opacity: mutation.isPending ? 0.6 : 1, borderRadius: 9, borderCurve: "continuous" }}>{mutation.isPending ? <ActivityIndicator color="white" /> : <Text style={{ color: "white", fontWeight: "900" }}>Remove</Text>}</Pressable></View></Panel>}
    </ScrollView>
  );
}
