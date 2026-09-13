import { useAuth } from "@clerk/expo";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  localDate,
  type OutfitSuggestion,
  type PlanningData,
  type PlanningOperation,
} from "@wardrobe/shared";
import { Image } from "expo-image";
import * as WebBrowser from "expo-web-browser";
import { useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { PostHogMaskView } from "posthog-react-native";
import { planningRequest } from "@/api";
import { DayVoiceInput } from "@/day-voice-input";
import { ErrorPanel, Panel } from "@/screen";
import { colors } from "@/theme";

function Button({
  label,
  onPress,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={{
        minHeight: 44,
        padding: 12,
        borderColor: colors.line,
        borderWidth: 1,
        borderRadius: 8,
        backgroundColor: colors.wash,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <Text style={{ color: colors.ink, fontWeight: "800" }}>{label}</Text>
    </Pressable>
  );
}
const inputStyle = {
  borderWidth: 1,
  borderColor: colors.line,
  backgroundColor: colors.surface,
  color: colors.ink,
  padding: 12,
  fontSize: 16,
  minHeight: 48,
  borderRadius: 8,
};

export function DayPlanner() {
  const { getToken, isSignedIn } = useAuth();
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["day-planning"],
    queryFn: () =>
      planningRequest<PlanningData>(getToken, { operation: "planning_load" }),
    enabled: Boolean(isSignedIn),
  });
  const data = query.data;
  const [date, setDate] = useState(localDate());
  const [description, setDescription] = useState("");
  const [planId, setPlanId] = useState("");
  const [useCalendar, setUseCalendar] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [editing, setEditing] = useState<OutfitSuggestion | null>(null);
  const [pieces, setPieces] = useState<string[]>([]);
  const [dismissing, setDismissing] = useState<string | null>(null);
  const [reason, setReason] = useState("Not my style");
  const run = async (operation: PlanningOperation) => {
    setBusy(true);
    setMessage("");
    try {
      await planningRequest(getToken, operation);
      await client.invalidateQueries({ queryKey: ["day-planning"] });
      setEditing(null);
      setDismissing(null);
      setMessage(
        operation.operation === "planning_generate"
          ? "Suggestion ready. Review it below before accepting."
          : "Outfit updated.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not update outfit.",
      );
    } finally {
      setBusy(false);
    }
  };
  const dates = Array.from({ length: 14 }, (_, i) => {
    const day = new Date();
    day.setDate(day.getDate() + i);
    return localDate(day);
  });
  const edit = (s: OutfitSuggestion) => {
    setEditing(s);
    setPieces(s.itemIds.filter((id) => data?.items.some((i) => i.id === id)));
  };
  return (
    <View style={{ gap: 16 }}>
      <Panel>
        <Text style={{ color: colors.ink, fontSize: 24, fontWeight: "900" }}>
          Dress for your day
        </Text>
        <Text style={{ color: colors.muted, lineHeight: 21 }}>
          Describe your activities, get an outfit from pieces you own, then make
          it yours.
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8 }}
        >
          {dates.map((d, i) => (
            <Button
              key={d}
              label={`${date === d ? "✓ " : ""}${i === 0 ? "Today" : new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { weekday: "short", day: "numeric" })}`}
              onPress={() => setDate(d)}
            />
          ))}
        </ScrollView>
        <Text style={{ color: colors.ink, fontWeight: "800" }}>
          Date (YYYY-MM-DD, or enter a later date)
        </Text>
        <TextInput
          accessibilityLabel="Outfit date"
          value={date}
          onChangeText={setDate}
          maxLength={10}
          style={inputStyle}
          autoCorrect={false}
        />
        <Text style={{ color: colors.ink, fontWeight: "800" }}>Your day</Text>
        <TextInput
          accessibilityLabel="Describe your day"
          multiline
          value={description}
          onChangeText={setDescription}
          maxLength={4000}
          placeholder="Office, a lunch walk, then dinner with friends…"
          placeholderTextColor={colors.muted}
          style={{ ...inputStyle, minHeight: 112, textAlignVertical: "top" }}
        />
        <DayVoiceInput
          onText={(text) =>
            setDescription((current) =>
              [current, text].filter(Boolean).join("\n").slice(0, 4000),
            )
          }
        />
        <Text style={{ color: colors.ink, fontWeight: "800" }}>
          Optional Plan
        </Text>
        <PostHogMaskView>
          <ScrollView horizontal contentContainerStyle={{ gap: 8 }}>
            <Button
              label={planId ? "No Plan" : "✓ No Plan"}
              onPress={() => setPlanId("")}
            />
            {data?.plans.map((p) => (
              <Button
                key={p.id}
                label={`${planId === p.id ? "✓ " : ""}${p.name}`}
                onPress={() => setPlanId(p.id)}
              />
            ))}
          </ScrollView>
        </PostHogMaskView>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Switch
            accessibilityLabel="Use Google Calendar for this date"
            value={useCalendar && Boolean(data?.calendarEnabled)}
            disabled={!data?.calendarEnabled}
            onValueChange={setUseCalendar}
          />
          <Text style={{ flex: 1, color: colors.ink }}>
            Use Google Calendar for this date
          </Text>
        </View>
        <Text style={{ color: colors.muted, lineHeight: 20 }}>
          Optional read-only calendars. Connect and select calendars in your
          browser using the same Wardrobe account, then return here. Only the
          date you request is read. Event context goes to the AI provider, never
          analytics.
        </Text>
        <Button
          label={
            data?.calendarEnabled
              ? "Manage Google calendars"
              : "Connect Google Calendar"
          }
          onPress={() =>
            void WebBrowser.openBrowserAsync(
              "https://wardrobe.davidcschmitt.com/fits?view=plans&calendar=connect",
            )
              .then(() => query.refetch())
              .catch(() =>
                setMessage(
                  "Open Wardrobe in your browser to connect Google Calendar.",
                ),
              )
          }
        />
        <Button
          label="Refresh calendar connection"
          onPress={() => void query.refetch()}
        />
        {data?.calendarEnabled ? (
          <Button
            label="Disconnect and delete calendar-derived outfits"
            disabled={busy}
            onPress={() =>
              Alert.alert(
                "Disconnect Google Calendar?",
                "This deletes all calendar-derived recommendations, including planned and worn entries. Other wardrobe data and Google sign-in stay intact. You can also revoke permission in your Google Account.",
                [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "Disconnect and delete",
                    style: "destructive",
                    onPress: () => {
                      setUseCalendar(false);
                      void run({ operation: "calendar_disconnect" });
                    },
                  },
                ],
              )
            }
          />
        ) : null}
        <Text style={{ color: colors.muted, lineHeight: 20 }}>
          Review AI suggestions, dress codes and weather. Wardrobe retains your
          latest 100 recommendations.
        </Text>
        <Button
          label={busy ? "Working…" : "Recommend an outfit"}
          disabled={busy || !data}
          onPress={() =>
            void run({
              operation: "planning_generate",
              date,
              description,
              timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
              useCalendar: useCalendar && Boolean(data?.calendarEnabled),
              ...(planId ? { planId } : {}),
            })
          }
        />
      </Panel>
      {query.error ? (
        <ErrorPanel
          message="Could not load outfit planning."
          retry={() => void query.refetch()}
        />
      ) : null}
      {message ? (
        <Text
          accessibilityLiveRegion="polite"
          style={{ color: colors.plum, fontWeight: "700" }}
        >
          {message}
        </Text>
      ) : null}
      <Text style={{ color: colors.ink, fontSize: 20, fontWeight: "900" }}>
        Suggested, planned and worn
      </Text>
      {data?.suggestions.length === 0 ? (
        <Text style={{ color: colors.muted }}>
          Your first outfit suggestion will appear here.
        </Text>
      ) : null}
      {data?.suggestions.map((s) => (
        <Panel key={s.id}>
          <PostHogMaskView style={{ gap: 10 }}>
            <Text
              style={{
                color: colors.plum,
                textTransform: "capitalize",
                fontWeight: "800",
              }}
            >
              {s.status} · {s.date}
            </Text>
            <Text
              style={{ color: colors.ink, fontSize: 20, fontWeight: "900" }}
            >
              {s.title}
            </Text>
            <Text style={{ color: colors.ink, lineHeight: 22 }}>
              {s.rationale}
            </Text>
            {s.itemIds.map((id) => {
              const item = data.items.find((i) => i.id === id);
              return (
                <View
                  key={id}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  {item?.imageUrl ? (
                    <Image
                      source={item.imageUrl}
                      style={{ width: 56, height: 64 }}
                      contentFit="cover"
                    />
                  ) : null}
                  <Text style={{ color: colors.ink, flex: 1 }}>
                    {item
                      ? `${item.category}: ${item.description}`
                      : "Piece no longer in your wardrobe"}
                  </Text>
                </View>
              );
            })}
            {s.missing.length ? (
              <Text style={{ color: colors.muted }}>
                To complete or adapt: {s.missing.join(" · ")}
              </Text>
            ) : null}
            <Text style={{ color: colors.muted, fontSize: 12 }}>
              Context: {s.context.join(" · ")}
            </Text>
          </PostHogMaskView>
          {s.status === "suggested" || s.status === "planned" ? (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {s.status === "suggested" ? (
                <Button
                  label="Accept outfit"
                  disabled={busy || !s.itemIds.length}
                  onPress={() =>
                    void run({ operation: "planning_accept", id: s.id })
                  }
                />
              ) : (
                <Button
                  label="Record what I wore"
                  disabled={busy}
                  onPress={() => edit(s)}
                />
              )}
              <Button
                label="Edit / swap pieces"
                disabled={busy}
                onPress={() => edit(s)}
              />
              <Button
                label="Dismiss"
                disabled={busy}
                onPress={() => setDismissing(s.id)}
              />
            </View>
          ) : null}
          {editing?.id === s.id ? (
            <View style={{ gap: 10 }}>
              <Text style={{ color: colors.ink, fontWeight: "800" }}>
                Choose 1–12 pieces{" "}
                {s.status === "planned"
                  ? "you will wear — or actually wore"
                  : "for this outfit"}
              </Text>
              <PostHogMaskView>
                <ScrollView
                  style={{ maxHeight: 300 }}
                  nestedScrollEnabled
                  contentContainerStyle={{ gap: 8 }}
                >
                  {data.items.map((i) => (
                    <Pressable
                      key={i.id}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: pieces.includes(i.id) }}
                      onPress={() =>
                        setPieces((current) =>
                          current.includes(i.id)
                            ? current.filter((id) => id !== i.id)
                            : [...current, i.id].slice(0, 12),
                        )
                      }
                      style={{
                        padding: 10,
                        borderWidth: 1,
                        borderColor: colors.line,
                        backgroundColor: pieces.includes(i.id)
                          ? colors.lime
                          : colors.surface,
                      }}
                    >
                      <Text style={{ color: colors.ink }}>
                        {pieces.includes(i.id) ? "✓ " : ""}
                        {i.category}: {i.description}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </PostHogMaskView>
              <Button
                label="Save pieces"
                disabled={busy || !pieces.length}
                onPress={() =>
                  void run({
                    operation: "planning_edit",
                    id: s.id,
                    itemIds: pieces,
                  })
                }
              />
              {s.status === "planned" ? (
                <Button
                  label="Confirm worn"
                  disabled={busy || !pieces.length}
                  onPress={() =>
                    void run({
                      operation: "planning_worn",
                      id: s.id,
                      itemIds: pieces,
                    })
                  }
                />
              ) : null}
              <Button label="Cancel edit" onPress={() => setEditing(null)} />
            </View>
          ) : null}
          {dismissing === s.id ? (
            <View style={{ gap: 8 }}>
              <Text style={{ color: colors.ink }}>Why dismiss?</Text>
              {[
                "Not my style",
                "Wrong for the occasion",
                "Pieces unavailable",
                "Weather mismatch",
                "Other",
              ].map((r) => (
                <Button
                  key={r}
                  label={`${reason === r ? "✓ " : ""}${r}`}
                  onPress={() => setReason(r)}
                />
              ))}
              <Button
                label="Dismiss outfit"
                disabled={busy}
                onPress={() =>
                  void run({ operation: "planning_dismiss", id: s.id, reason })
                }
              />
              <Button label="Keep outfit" onPress={() => setDismissing(null)} />
            </View>
          ) : null}
        </Panel>
      ))}
    </View>
  );
}
