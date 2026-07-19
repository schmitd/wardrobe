import { Text, View } from "react-native";

import { ErrorPanel, Intro, Loading, Page, Panel } from "@/screen";
import { colors } from "@/theme";
import { useWardrobe } from "@/use-wardrobe";

export default function Collections() {
  const query = useWardrobe();
  return (
    <Page refresh={() => void query.refetch()} refreshing={query.isRefetching}>
      <Intro eyebrow="Your point of view" title="Collections" body="Keep owned pieces beside visual references that are shaping your next move." />
      {query.isLoading ? <Loading /> : query.error ? <ErrorPanel message={query.error.message} retry={() => void query.refetch()} /> : null}
      <View style={{ gap: 12 }}>
        {query.data?.wardrobes.length === 0 ? <Panel tint={colors.wash}><Text selectable style={{ color: colors.ink, fontWeight: "900" }}>No collections yet</Text><Text selectable style={{ color: colors.muted, lineHeight: 21 }}>Create your first collection on web for now. Native editing and mood-board capture are next in the release sequence.</Text></Panel> : null}
        {query.data?.wardrobes.map((collection) => <Panel key={collection._id} tint={colors.surface}><Text selectable style={{ color: colors.ink, fontSize: 20, fontWeight: "900" }}>{collection.name}</Text>{collection.description ? <Text selectable style={{ color: colors.muted, lineHeight: 21 }}>{collection.description}</Text> : null}{collection.moodWords?.length ? <Text selectable style={{ color: colors.plum, fontSize: 12, fontWeight: "800" }}>{collection.moodWords.join(" · ")}</Text> : null}</Panel>)}
      </View>
    </Page>
  );
}
