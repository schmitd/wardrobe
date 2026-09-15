import { router, Stack } from "expo-router";
import { Text } from "react-native";
import { usePlanner } from "../src/store";
import { Caption, Page, usePalette } from "../src/ui";
export default function Why() {
  const { state } = usePlanner();
  const c = usePalette();
  return (
    <>
      <Page>
        <Text selectable style={{ color: c.ink, fontSize: 20, lineHeight: 29 }}>
          The selected pieces keep the palette cohesive and the outfit easy to
          wear.
        </Text>
        <Caption>Context used</Caption>
        <Text selectable style={{ color: c.ink, fontSize: 17, lineHeight: 25 }}>
          {state.outfits[state.day]?.description ||
            "An everyday outfit from your wardrobe."}
        </Text>
        <Caption>
          Sample explanation, not a live AI response. Weather was not checked.
        </Caption>
      </Page>
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button onPress={() => router.back()}>
          Done
        </Stack.Toolbar.Button>
      </Stack.Toolbar>
    </>
  );
}
