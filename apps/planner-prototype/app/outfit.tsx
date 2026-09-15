import { router, Stack } from "expo-router";
import { Text, View } from "react-native";
import { wardrobe, calendarEvent } from "../src/model";
import { GarmentImage, OutfitStrip } from "../src/garment-image";
import { usePlanner } from "../src/store";
import {
  Caption,
  Group,
  Page,
  Primary,
  Row,
  Section,
  Symbol,
  dateLabel,
  usePalette,
} from "../src/ui";
export default function Outfit() {
  const { state, dispatch } = usePlanner();
  const c = usePalette();
  const outfit = state.outfits[state.day];
  const event = calendarEvent(state.day, state);
  if (!outfit)
    return (
      <Page>
        <Caption>No suggestion for {dateLabel(state.day)} yet.</Caption>
        <Primary
          title="Suggest an outfit"
          onPress={() =>
            dispatch({
              type: "generate",
              days: [{ day: state.day, text: state.notes[state.day] || "" }],
            })
          }
        />
      </Page>
    );
  return (
    <>
      <Stack.Screen
        options={{ title: dateLabel(outfit.day), headerBackTitle: "Plans" }}
      />
      <Page>
        {event ? (
          <View
            style={{ flexDirection: "row", gap: 8, justifyContent: "center" }}
          >
            <Symbol name="calendar" size={17} />
            <Caption>{event}</Caption>
          </View>
        ) : null}
        {state.notes[state.day] ? (
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Symbol name="mic" size={17} />
            <Caption>{state.notes[state.day]}</Caption>
          </View>
        ) : null}
        <View
          style={{
            alignItems: "center",
            backgroundColor: "#fff",
            borderRadius: 16,
            paddingVertical: 18,
          }}
        >
          <OutfitStrip pieces={outfit.pieces} size={100} />
        </View>
        <View style={{ gap: 8 }}>
          {outfit.status !== "suggested" ? (
            <Text
              selectable
              style={{ color: c.ink, fontSize: 23, fontWeight: "600" }}
            >
              {outfit.status === "planned"
                ? "Your outfit is planned."
                : "Added to your fit diary."}
            </Text>
          ) : null}
          <Text
            selectable
            style={{ color: c.muted, fontSize: 17, lineHeight: 25 }}
          >
            {/hik|home|free/i.test(outfit.description)
              ? "Easy layers and comfortable shoes for a relaxed day."
              : "Relaxed enough for the day. Put-together for dinner."}
          </Text>
        </View>
        <Group>
          {outfit.pieces.map((id, i) => {
            const piece = wardrobe.find((p) => p.id === id)!;
            return (
              <View
                key={id}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingLeft: 12,
                }}
              >
                <GarmentImage id={id} width={40} height={54} />
                <View style={{ flex: 1 }}>
                  <Row
                    title={piece.name}
                    subtitle={piece.detail}
                    value={outfit.status === "worn" ? undefined : "Swap"}
                    onPress={
                      outfit.status === "worn"
                        ? undefined
                        : () =>
                            router.push({
                              pathname: "/swap",
                              params: { piece: id },
                            })
                    }
                    last={i === 2}
                  />
                </View>
              </View>
            );
          })}
        </Group>
        {outfit.status === "suggested" ? (
          <Primary
            title="Plan this outfit"
            onPress={() => dispatch({ type: "accept" })}
          />
        ) : outfit.status === "planned" ? (
          <Primary
            title="I wore this"
            onPress={() => dispatch({ type: "worn" })}
          />
        ) : null}
        <Group>
          {outfit.status === "suggested" ? (
            <Row
              title="Another suggestion"
              onPress={() => dispatch({ type: "another" })}
            />
          ) : null}
          <Row
            title="Why this outfit?"
            symbol="text.alignleft"
            onPress={() => router.push("/why")}
            last
          />
        </Group>
        <Caption>
          Design preview · sample pieces and suggestion. Planning and actually
          wearing an outfit remain separate.
        </Caption>
      </Page>
    </>
  );
}
