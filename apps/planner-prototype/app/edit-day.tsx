import DateTimePicker from "@react-native-community/datetimepicker";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { TextInput } from "react-native";
import { localDay } from "../src/model";
import { usePlanner } from "../src/store";
import { Group, Page, Primary, Row, usePalette } from "../src/ui";
export default function EditDay() {
  const { index } = useLocalSearchParams<{ index: string }>();
  const { state, dispatch } = usePlanner();
  const c = usePalette();
  const n = state.review[Number(index)];
  const [date, setDate] = useState(
    new Date(`${n?.day ?? state.week}T12:00:00`),
  );
  const [text, setText] = useState(n?.text ?? "");
  return (
    <>
      <Page>
        <Group>
          <Row
            title="Day"
            last
            trailing={
              <DateTimePicker
                value={date}
                mode="date"
                display="compact"
                onChange={(_, d) => {
                  if (d) setDate(d);
                }}
              />
            }
          />
        </Group>
        <Group>
          <TextInput
            accessibilityLabel="Day context"
            multiline
            value={text}
            onChangeText={setText}
            style={{ minHeight: 120, padding: 16, color: c.ink, fontSize: 18 }}
          />
        </Group>
        <Primary
          title="Save context"
          disabled={!text.trim()}
          onPress={() => {
            dispatch({
              type: "review",
              notes: state.review.map((row, i) =>
                i === Number(index) ? { day: localDay(date), text } : row,
              ),
            });
            router.back();
          }}
        />
      </Page>
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button onPress={() => router.back()}>
          Cancel
        </Stack.Toolbar.Button>
      </Stack.Toolbar>
    </>
  );
}
