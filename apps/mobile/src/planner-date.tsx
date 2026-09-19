import DateTimePicker, {
  DateTimePickerAndroid,
} from "@react-native-community/datetimepicker";
import { localDate, shiftDay } from "@wardrobe/shared";
import { PlannerButton, isIOS } from "./planner-ui";
export function PlannerDate({
  value,
  onChange,
  label = "Choose date",
  inline = false,
  allowPast = false,
}: {
  value: string;
  onChange: (date: string) => void;
  label?: string;
  inline?: boolean;
  allowPast?: boolean;
}) {
  const date = new Date(`${value}T12:00:00`);
  const minimumDate = new Date(`${shiftDay(localDate(), allowPast ? -366 : 0)}T00:00:00`);
  const maximumDate = new Date(`${shiftDay(localDate(), 360)}T23:59:59`);
  return isIOS ? (
    <DateTimePicker
      accessibilityLabel={label}
      value={date}
      minimumDate={minimumDate}
      maximumDate={maximumDate}
      mode="date"
      display={inline ? "inline" : "compact"}
      onChange={(_, next) => {
        if (next) onChange(localDate(next));
      }}
    />
  ) : (
    <PlannerButton
      secondary
      title={`${label}: ${date.toLocaleDateString()}`}
      onPress={() =>
        DateTimePickerAndroid.open({
          value: date,
          minimumDate,
          maximumDate,
          mode: "date",
          onChange: (event, next) => {
            if (event.type === "set" && next) onChange(localDate(next));
          },
        })
      }
    />
  );
}
