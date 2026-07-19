import { Image } from "expo-image";
import { Text, View } from "react-native";

import { ErrorPanel, Intro, Loading, Page, Panel } from "@/screen";
import { colors } from "@/theme";
import { useWardrobe } from "@/use-wardrobe";

const keyFor = (value: Date | number) => new Date(value).toISOString().slice(0, 10);

export default function Fits() {
  const query = useWardrobe();
  const daily = (query.data?.fitChecks ?? []).filter((fit) => fit.type === "daily_fit_check");
  const byDay = new Map(daily.map((fit) => [keyFor(fit.createdAt), fit]));
  const days = Array.from({ length: 84 }, (_, index) => { const day = new Date(); day.setHours(12, 0, 0, 0); day.setDate(day.getDate() - (83 - index)); return day; });

  return (
    <Page refresh={() => void query.refetch()} refreshing={query.isRefetching}>
      <Intro eyebrow="Outfit memory" title="Fits" body="A visual record of what you wore, what repeated, and what your wardrobe is becoming." />
      {query.isLoading ? <Loading /> : query.error ? <ErrorPanel message={query.error.message} retry={() => void query.refetch()} /> : null}
      <Panel>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" }}><View><Text selectable style={{ color: colors.ink, fontSize: 20, fontWeight: "900" }}>Your recent rhythm</Text><Text selectable style={{ color: colors.muted, marginTop: 3 }}>Last 12 weeks</Text></View><Text selectable style={{ color: colors.plum, fontWeight: "800" }}>{daily.length} fits</Text></View>
        <View accessibilityLabel="Daily fit calendar" style={{ marginTop: 8, flexDirection: "row", flexWrap: "wrap", gap: 4 }}>
          {days.map((day) => { const fit = byDay.get(keyFor(day)); return <View key={keyFor(day)} accessibilityLabel={`${day.toLocaleDateString()}: ${fit ? "fit recorded" : "no fit"}`} style={{ width: "7.4%", aspectRatio: 1, borderColor: fit ? colors.line : colors.washStrong, borderWidth: 1, backgroundColor: fit ? colors.lime : colors.paper }}>{fit?.imageUrl ? <Image source={fit.imageUrl} style={{ width: "100%", height: "100%" }} contentFit="cover" /> : null}</View>; })}
        </View>
      </Panel>
      <View style={{ gap: 14 }}>
        <Text selectable style={{ color: colors.ink, fontSize: 20, fontWeight: "900" }}>Recent fits</Text>
        {(query.data?.fitChecks ?? []).map((fit) => <View key={fit._id} style={{ borderColor: colors.line, borderWidth: 1, backgroundColor: colors.surface, overflow: "hidden" }}>{fit.imageUrl ? <Image source={fit.imageUrl} style={{ width: "100%", aspectRatio: 1.15, backgroundColor: colors.wash }} contentFit="cover" /> : null}<View style={{ padding: 14, gap: 6 }}><Text selectable style={{ color: colors.plum, fontWeight: "900", fontSize: 12, textTransform: "uppercase" }}>{fit.type === "try_on" ? "Try on" : "Fit check"} · {new Date(fit.createdAt).toLocaleDateString()}</Text><Text selectable style={{ color: colors.ink, lineHeight: 20 }}>{fit.transcription ?? fit.description ?? "This fit is still being read."}</Text>{fit.items.length > 0 ? <Text selectable style={{ color: colors.muted, fontSize: 12 }}>{fit.items.length} piece{fit.items.length === 1 ? "" : "s"} detected</Text> : null}</View></View>)}
      </View>
    </Page>
  );
}
