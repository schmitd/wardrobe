import { Image } from "expo-image";
import { Link, useRouter } from "expo-router";
import { Pressable, Text, View, useWindowDimensions } from "react-native";

import { ErrorPanel, Loading, Page, Panel } from "@/screen";
import { colors } from "@/theme";
import { useWardrobe } from "@/use-wardrobe";

export default function Rack() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const query = useWardrobe();
  const itemWidth = (Math.min(width, 720) - 52) / 2;

  return (
    <Page refresh={() => void query.refetch()} refreshing={query.isRefetching}>
      <View style={{ gap: 7 }}><Text selectable style={{ color: colors.plum, fontSize: 13, fontWeight: "900", textTransform: "uppercase" }}>Your closet</Text><Text selectable style={{ color: colors.muted, fontSize: 15, lineHeight: 22 }}>Pieces you own, arranged as a visual memory instead of a list to maintain.</Text></View>
      {query.isLoading ? <Loading /> : query.error ? <ErrorPanel message={query.error.message} retry={() => void query.refetch()} /> : null}
      {query.data?.items.length === 0 ? (
        <Panel tint={colors.wash}><Text selectable style={{ color: colors.ink, fontSize: 20, fontWeight: "900" }}>Start with what you wore.</Text><Text selectable style={{ color: colors.muted, lineHeight: 21 }}>One full-body fit check is enough for the agent to begin recognizing the pieces in your wardrobe.</Text><Pressable onPress={() => router.push("/capture")} style={{ alignSelf: "flex-start", backgroundColor: colors.lime, borderColor: colors.line, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 12 }}><Text style={{ color: colors.ink, fontWeight: "900" }}>Add a fit check</Text></Pressable></Panel>
      ) : (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
          {query.data?.items.map((item) => (
            <Link key={item.id} href={{ pathname: "/item/[id]", params: { id: item.id } }} asChild><Pressable style={({ pressed }) => ({ width: itemWidth, overflow: "hidden", borderColor: colors.line, borderWidth: 1, backgroundColor: pressed ? colors.wash : colors.surface, borderRadius: 12, borderCurve: "continuous" })}>
              <Image source={item.imageUrl} style={{ width: "100%", aspectRatio: 0.84, backgroundColor: colors.wash }} contentFit="cover" transition={180} />
              <View style={{ padding: 10, gap: 4 }}><Text numberOfLines={1} style={{ color: colors.ink, fontWeight: "900" }}>{item.category ?? "Closet piece"}</Text><Text numberOfLines={2} style={{ color: colors.muted, fontSize: 12, lineHeight: 16 }}>{item.description ?? (item.analysisStatus === "ready" ? "Part of your wardrobe" : "Learning this piece…")}</Text></View>
            </Pressable></Link>
          ))}
        </View>
      )}
    </Page>
  );
}
