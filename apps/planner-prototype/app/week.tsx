import DateTimePicker from "@react-native-community/datetimepicker";
import { Stack, router } from "expo-router";
import { useState } from "react";
import { usePlanner } from "../src/store";
import { localDay } from "../src/model";
import { Page, Primary, Caption, usePalette } from "../src/ui";
export default function Week() {
  const { state, dispatch } = usePlanner();
  const c = usePalette();
  const [date, setDate] = useState(new Date(`${state.week}T12:00:00`));
  return (
    <>
      <Page>
        <Caption>Choose the first day of your seven-day view.</Caption>
        <DateTimePicker
          value={date}
          mode="date"
          display="inline"
          accentColor={c.accent}
          onChange={(_, value) => {
            if (value) setDate(value);
          }}
        />
        <Primary
          title="Show this week"
          onPress={() => {
            dispatch({ type: "week", week: localDay(date) });
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
