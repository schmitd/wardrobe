import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useAuth } from "@clerk/expo";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { Redirect, Stack, useLocalSearchParams } from "expo-router";
import { useMemo } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";

import { addCollectionItem, removeCollectionItem, saveInspiration } from "@/api";
import { uploadPhoto } from "@/photo-upload";
import { ErrorPanel, Loading, Panel } from "@/screen";
import { colors } from "@/theme";
import { useWardrobe } from "@/use-wardrobe";

const trace = () => `native-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export function CollectionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const collectionId = Array.isArray(id) ? id[0] : id;
  const { width } = useWindowDimensions();
  const { getToken, isSignedIn } = useAuth({ treatPendingAsSignedOut: false });
  const queryClient = useQueryClient();
  const query = useWardrobe();
  const collection = query.data?.wardrobes.find((entry) => entry._id === collectionId);
  const memberIds = useMemo(() => new Set(collection?.items.map((membership) => membership.item.id) ?? []), [collection]);
  const available = query.data?.items.filter((item) => !memberIds.has(item.id)) ?? [];
  const imageWidth = (Math.min(width, 720) - 52) / 2;

  const changeMembership = useMutation({
    mutationFn: (input: { itemId: string; remove?: boolean }) => input.remove
      ? removeCollectionItem(getToken, collectionId, input.itemId)
      : addCollectionItem(getToken, collectionId, input.itemId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["mobile-bootstrap"] }),
  });

  const addInspiration = useMutation({
    mutationFn: async (uri: string) => {
      const storageId = await uploadPhoto(getToken, uri);
      return saveInspiration(getToken, collectionId, storageId, trace());
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["mobile-bootstrap"] }),
  });

  const addInspirationPhoto = () => {
    addInspiration.reset();
    void ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.9, allowsEditing: false }).then((result) => {
      if (result.canceled || !result.assets[0]) return;
      addInspiration.mutate(result.assets[0].uri);
    });
  };

  if (!isSignedIn) return <Redirect href="/welcome" />;
  if (query.isLoading) return <Loading />;
  if (query.error) return <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: 20 }}><ErrorPanel message={query.error.message} retry={() => void query.refetch()} /></ScrollView>;
  if (!collection) return <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: 20 }}><ErrorPanel message="This collection could not be found." /></ScrollView>;

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: 20, paddingBottom: 80, gap: 24 }}>
      <Stack.Screen options={{ title: collection.name }} />
      <View style={{ gap: 7 }}><Text selectable style={{ color: colors.plum, fontSize: 12, fontWeight: "900", textTransform: "uppercase" }}>Your point of view</Text>{collection.description ? <Text selectable style={{ color: colors.muted, fontSize: 16, lineHeight: 23 }}>{collection.description}</Text> : <Text selectable style={{ color: colors.muted, fontSize: 16, lineHeight: 23 }}>Let the references and pieces describe this direction.</Text>}</View>

      <View style={{ gap: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 12 }}><View style={{ flex: 1 }}><Text selectable style={{ color: colors.ink, fontSize: 21, fontWeight: "900" }}>Inspiration</Text><Text selectable style={{ color: colors.muted, fontSize: 13, lineHeight: 19 }}>Visual references, never treated as owned.</Text></View><Pressable disabled={addInspiration.isPending} onPress={addInspirationPhoto} style={{ minHeight: 42, paddingHorizontal: 13, backgroundColor: colors.lime, borderColor: colors.line, borderWidth: 1, flexDirection: "row", alignItems: "center", gap: 7, borderRadius: 10, borderCurve: "continuous" }}>{addInspiration.isPending ? <ActivityIndicator color={colors.ink} /> : <MaterialCommunityIcons name="image-plus" size={19} color={colors.ink} />}<Text style={{ color: colors.ink, fontWeight: "900" }}>{addInspiration.isPending ? "Adding…" : "Add photo"}</Text></Pressable></View>
        {addInspiration.error ? <ErrorPanel message={addInspiration.error.message || "The inspiration photo could not be added."} retry={() => addInspiration.reset()} /> : null}
        {collection.inspirations.length ? <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>{collection.inspirations.map((item) => <View key={item.id} style={{ width: imageWidth, overflow: "hidden", borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, borderRadius: 12, borderCurve: "continuous" }}><Image source={item.imageUrl ?? undefined} style={{ width: "100%", aspectRatio: 1 }} contentFit="cover" /><View style={{ padding: 10, gap: 3 }}><Text selectable style={{ color: colors.plum, fontSize: 10, fontWeight: "900", textTransform: "uppercase" }}>Inspiration · not owned</Text><Text selectable numberOfLines={2} style={{ color: colors.ink, fontSize: 12, lineHeight: 16, fontWeight: "700" }}>{item.description ?? item.category ?? "Visual reference"}</Text></View></View>)}</View> : <Panel tint={colors.wash}><Text selectable style={{ color: colors.muted, lineHeight: 20 }}>Add a photo and let it speak for itself—mood-board style.</Text></Panel>}
      </View>

      <View style={{ gap: 12 }}><Text selectable style={{ color: colors.ink, fontSize: 21, fontWeight: "900" }}>In this collection</Text>{collection.items.length ? <View style={{ gap: 10 }}>{collection.items.map((membership) => <View key={membership._id} style={{ flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, padding: 9, borderRadius: 12, borderCurve: "continuous" }}><Image source={membership.item.imageUrl} style={{ width: 64, height: 64, backgroundColor: colors.wash, borderRadius: 8 }} contentFit="cover" /><View style={{ flex: 1, gap: 3 }}><Text selectable numberOfLines={1} style={{ color: colors.ink, fontWeight: "900" }}>{membership.item.category ?? "Closet piece"}</Text><Text selectable numberOfLines={1} style={{ color: colors.muted, fontSize: 12 }}>{membership.item.description ?? "Owned"}</Text></View><Pressable accessibilityLabel={`Remove ${membership.item.category ?? "piece"} from collection`} disabled={changeMembership.isPending} onPress={() => changeMembership.mutate({ itemId: membership.item.id, remove: true })} style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center" }}><MaterialCommunityIcons name="close" size={22} color={colors.danger} /></Pressable></View>)}</View> : <Text selectable style={{ color: colors.muted }}>No owned pieces here yet.</Text>}</View>

      {available.length ? <View style={{ gap: 12 }}><View><Text selectable style={{ color: colors.ink, fontSize: 21, fontWeight: "900" }}>Add from your rack</Text><Text selectable style={{ color: colors.muted, fontSize: 13 }}>Tap a piece to connect it to this collection.</Text></View><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>{available.map((item) => <Pressable key={item.id} disabled={changeMembership.isPending} onPress={() => changeMembership.mutate({ itemId: item.id })} style={{ width: 112, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, overflow: "hidden", borderRadius: 12, borderCurve: "continuous" }}><Image source={item.imageUrl} style={{ width: "100%", aspectRatio: 1 }} contentFit="cover" /><View style={{ padding: 8, gap: 3 }}><Text numberOfLines={1} style={{ color: colors.ink, fontSize: 12, fontWeight: "900" }}>{item.category ?? "Piece"}</Text><Text style={{ color: colors.plum, fontSize: 11, fontWeight: "800" }}>+ Add</Text></View></Pressable>)}</ScrollView></View> : null}
      {changeMembership.error ? <ErrorPanel message={changeMembership.error.message} /> : null}
    </ScrollView>
  );
}
