import { router, Stack } from "expo-router";
import { Alert, Text } from "react-native";
import { sampleDay } from "../src/model";
import { usePlanner } from "../src/store";
import {
  Caption,
  Group,
  Page,
  Row,
  Section,
  Symbol,
  usePalette,
} from "../src/ui";
export default function Options() {
  const { state, dispatch } = usePlanner();
  const c = usePalette();
  return (
    <>
      <Page>
        <Section
          title="Use a saved Plan"
          footer="Optional inspiration. You don’t need a Plan to get dressed."
        >
          <Group>
            {[null, "Everyday", "Weekend away"].map((plan, i) => (
              <Row
                key={plan ?? "none"}
                title={plan ?? "No Plan"}
                trailing={
                  state.plan === plan ? <Symbol name="checkmark" /> : null
                }
                onPress={() => {
                  dispatch({ type: "plan-context", plan });
                  router.back();
                }}
                last={i === 2}
              />
            ))}
          </Group>
        </Section>
        <Section title="Design preview">
          <Group>
            <Row
              title="Try a sample dictation"
              onPress={() => {
                dispatch({ type: "description", text: sampleDay });
                router.replace("/dictate");
              }}
            />
            <Row
              title="Preview Calendar sign-in"
              onPress={() => {
                dispatch({ type: "connect", calendars: [] });
                router.replace("/calendar");
              }}
            />
            <Row
              title="Suggest the visible week"
              onPress={() => {
                dispatch({ type: "generate" });
                router.back();
              }}
            />
            <Row
              title="Reset this preview"
              onPress={() =>
                Alert.alert(
                  "Reset the prototype?",
                  "This clears only the local sample draft and outfit. Your real Wardrobe is unchanged.",
                  [
                    { text: "Cancel", style: "cancel" },
                    {
                      text: "Reset",
                      style: "destructive",
                      onPress: () => {
                        dispatch({ type: "reset" });
                        router.back();
                      },
                    },
                  ],
                )
              }
              last
            />
          </Group>
        </Section>
        <Text
          selectable
          style={{ color: c.ink, fontSize: 17, fontWeight: "600" }}
        >
          Native controls. Sample content.
        </Text>
        <Caption>
          This isolated prototype uses a real iOS date picker, navigation and
          sheets. Calendar sign-in and recommendations are simulated. Nothing is
          sent to Google, AI, Wardrobe, or analytics. Drafts stay on this
          simulator.
        </Caption>
        <Caption>
          Before release: wire these screens to the existing planning API and
          Google callback, preserve masked analytics, and verify the new native
          date-picker module in a compatible binary.
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
