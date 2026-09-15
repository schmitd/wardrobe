import { useRef } from "react";
import { Stack, router } from "expo-router";
import {
  Button,
  Keyboard,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { interpretWeek, sampleDay } from "../src/model";
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
export default function Dictate() {
  const { state, dispatch } = usePlanner();
  const c = usePalette();
  const input = useRef<TextInput>(null);
  const parsed = interpretWeek(state.description, state.week);
  const review = state.review.length ? state.review : parsed.notes;
  const unresolved = parsed.unresolved && !state.review.length;
  const editable = review.filter(
    (n) => !state.outfits[n.day] || state.outfits[n.day].status === "suggested",
  );
  return (
    <>
      <Page>
        <Group>
          <TextInput
            ref={input}
            accessibilityLabel="Your week transcript"
            value={state.description}
            multiline
            maxLength={4000}
            onChangeText={(text) => dispatch({ type: "description", text })}
            placeholder="Wednesday is a meeting. Friday is dinner. Sunday we’re hiking…"
            placeholderTextColor={c.muted}
            style={{
              minHeight: 136,
              padding: 16,
              color: c.ink,
              fontSize: 19,
              lineHeight: 27,
              textAlignVertical: "top",
            }}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Dictate with keyboard"
            onPress={() => input.current?.focus()}
            style={{
              minHeight: 50,
              padding: 12,
              flexDirection: "row",
              justifyContent: "center",
              gap: 8,
            }}
          >
            <Symbol name="mic" size={19} />
            <Text style={{ color: c.accent, fontSize: 16 }}>
              Type or use keyboard dictation
            </Text>
          </Pressable>
        </Group>
        {review.length ? (
          <Section title="Interpreted days">
            <Group>
              {review.map((n, index) => (
                <Row
                  key={index}
                  title={dateLabel(n.day)}
                  subtitle={n.text}
                  value={
                    state.outfits[n.day] &&
                    state.outfits[n.day].status !== "suggested"
                      ? "Kept"
                      : undefined
                  }
                  onPress={() => {
                    Keyboard.dismiss();
                    dispatch({ type: "review", notes: review });
                    router.push({
                      pathname: "/edit-day",
                      params: { index: String(index) },
                    });
                  }}
                  last={index === review.length - 1}
                />
              ))}
            </Group>
          </Section>
        ) : null}
        {unresolved && state.description ? (
          <Caption>
            Name the weekdays you mean, then check the dates below. This preview
            won’t guess an ambiguous date.
          </Caption>
        ) : null}
        <Primary
          title={
            editable.length
              ? `Suggest outfits for ${editable.length} ${editable.length === 1 ? "day" : "days"}`
              : "Suggest outfits"
          }
          disabled={!editable.length || unresolved}
          onPress={() => {
            Keyboard.dismiss();
            dispatch({ type: "generate", days: review });
            router.back();
          }}
        />
        <Caption>
          Other days stay unchanged.
          {review.length > editable.length
            ? " Planned and worn outfits will be kept."
            : ""}
        </Caption>
        {!state.description ? (
          <Group>
            <Row
              title="Try a sample dictation"
              subtitle="Preview a meeting, dinner and hike."
              onPress={() => dispatch({ type: "description", text: sampleDay })}
              last
            />
          </Group>
        ) : null}
        <Caption>
          Prototype: keyboard dictation supplies editable text. Suggestions use
          sample rules, not a live AI request.
        </Caption>
      </Page>
      <Stack.Screen
        options={{
          headerLeft: () => (
            <Button
              title="Cancel"
              color={c.accent}
              onPress={() => {
                Keyboard.dismiss();
                router.back();
              }}
            />
          ),
          headerRight: () => (
            <Button
              title="Calendar"
              color={c.accent}
              onPress={() => {
                Keyboard.dismiss();
                router.push("/calendar");
              }}
            />
          ),
        }}
      />
    </>
  );
}
