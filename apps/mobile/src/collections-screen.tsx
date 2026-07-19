import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { Link } from "expo-router";
import { Pressable, Text, View } from "react-native";

import { ErrorPanel, Loading, Page, Panel } from "@/screen";
import { colors } from "@/theme";
import { useWardrobe } from "@/use-wardrobe";

export function CollectionsScreen() {
  const query = useWardrobe();
  return (
    <Page refresh={() => void query.refetch()} refreshing={query.isRefetching}>
      <View style={{ gap: 7 }}>
        <Text selectable style={{ color: colors.plum, fontSize: 13, fontWeight: "800", letterSpacing: 0.7, textTransform: "uppercase" }}>Your point of view</Text>
        <Text selectable style={{ color: colors.muted, fontSize: 15, lineHeight: 22 }}>Keep owned pieces beside visual references that are shaping your next move.</Text>
      </View>
      {query.isLoading ? <Loading /> : query.error ? <ErrorPanel message={query.error.message} retry={() => void query.refetch()} /> : null}
      {query.data?.wardrobes.length === 0 ? (
        <Panel tint={colors.wash}>
          <MaterialCommunityIcons name="cards-outline" size={30} color={colors.plum} />
          <Text selectable style={{ color: colors.ink, fontSize: 20, fontWeight: "900" }}>Start with a direction</Text>
          <Text selectable style={{ color: colors.muted, lineHeight: 21 }}>A phrase, a trip, or a feeling is enough. Add references and closet pieces as the idea takes shape.</Text>
          <Link href="/collection/new" asChild><Pressable style={{ alignSelf: "flex-start", backgroundColor: colors.lime, borderColor: colors.line, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 12 }}><Text style={{ color: colors.ink, fontWeight: "900" }}>Create collection</Text></Pressable></Link>
        </Panel>
      ) : null}
      <View style={{ gap: 12 }}>
        {query.data?.wardrobes.map((collection) => (
          <Link key={collection._id} href={{ pathname: "/collection/[id]", params: { id: collection._id } }} asChild>
            <Pressable style={({ pressed }) => ({ borderColor: colors.line, borderWidth: 1, backgroundColor: pressed ? colors.wash : colors.surface, padding: 17, gap: 9, borderRadius: 14, borderCurve: "continuous", boxShadow: "2px 3px 0 rgba(67,40,63,.15)" })}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <Text selectable numberOfLines={1} style={{ flex: 1, color: colors.ink, fontSize: 21, fontWeight: "900" }}>{collection.name}</Text>
                <MaterialCommunityIcons name="chevron-right" size={25} color={colors.plum} />
              </View>
              {collection.description ? <Text selectable style={{ color: colors.muted, lineHeight: 21 }}>{collection.description}</Text> : null}
              <Text selectable style={{ color: colors.plum, fontSize: 12, fontWeight: "800" }}>{collection.items.length} owned · {collection.inspirations.length} inspiration</Text>
            </Pressable>
          </Link>
        ))}
      </View>
    </Page>
  );
}
