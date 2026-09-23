import { useAuth } from "@clerk/expo";
import {
  useQuery,
  useInfiniteQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { Image } from "expo-image";
import { useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { PostHogMaskView } from "posthog-react-native";
import {
  localDate,
  type PlanningOperation,
  type WearOutfit,
  type PendingWearPage,
} from "@wardrobe/shared";
import { planningRequest } from "@/api";
import { usePlanner } from "@/planner-context";
import { Panel } from "@/screen";
import { colors } from "@/theme";

const button = {
  minHeight: 44,
  padding: 12,
  borderRadius: 12,
  borderWidth: 1,
  borderColor: colors.line,
  justifyContent: "center" as const,
  alignItems: "center" as const,
};
function useWearDiary() {
  const { getToken, userId, isSignedIn } = useAuth();
  const client = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const query = useQuery({
    queryKey: ["wear-diary", userId],
    queryFn: () =>
      planningRequest<WearOutfit[]>(getToken, { operation: "wear_list" }),
    enabled: Boolean(isSignedIn),
  });
  const pending = useInfiniteQuery({
    queryKey: ["wear-pending", userId, localDate()],
    enabled: Boolean(isSignedIn),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      planningRequest<PendingWearPage>(getToken, {
        operation: "wear_pending",
        through: localDate(),
        cursor: pageParam,
      }),
    getNextPageParam: (last) => (last.isDone ? undefined : last.continueCursor),
  });
  const run = async (operation: PlanningOperation) => {
    if (busy) return false;
    setBusy(true);
    setMessage("");
    try {
      await planningRequest(getToken, operation);
      await Promise.all([
        client.invalidateQueries({ queryKey: ["wear-diary"] }),
        client.invalidateQueries({ queryKey: ["wear-pending"] }),
        client.invalidateQueries({ queryKey: ["day-planning"] }),
        client.invalidateQueries({ queryKey: ["mobile-bootstrap"] }),
      ]);
      return true;
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not save this outfit.",
      );
      return false;
    } finally {
      setBusy(false);
    }
  };
  return { ...query, pending, run, busy, message };
}

export function WearDiary({ photoWearId }: { photoWearId?: string } = {}) {
  const diary = useWearDiary();
  const planner = usePlanner();
  const [edit, setEdit] = useState<{
    id: string;
    revision: number;
    isPlan: boolean;
  } | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const plans = photoWearId
    ? []
    : (diary.pending.data?.pages
        .flatMap((page) => page.page)
        .filter((plan) => !plan.notWornAt) ?? []);
  const manual =
    diary.data?.filter((wear) =>
      photoWearId ? wear.id === photoWearId : wear.photos.length === 0,
    ) ?? [];
  return (
    <PostHogMaskView>
      <View style={{ gap: 12 }}>
        {diary.message ? (
          <Text accessibilityRole="alert" style={{ color: colors.danger }}>
            {diary.message}
          </Text>
        ) : null}
        {plans.length > 0 && (
          <Text style={{ fontSize: 20, fontWeight: "800", color: colors.ink }}>
            Still unconfirmed
          </Text>
        )}
        {plans.map((plan) => (
          <Panel key={plan.id} tint={colors.wash}>
            <Text style={{ color: colors.muted }}>{plan.date} · Planned</Text>
            <Text
              style={{ color: colors.ink, fontSize: 18, fontWeight: "700" }}
            >
              {plan.title}
            </Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {plan.itemIds.map((id) => {
                const item = plan.pieces.find((piece) => piece.id === id);
                return item?.imageUrl ? (
                  <Image
                    key={id}
                    source={item.imageUrl}
                    style={{ width: 48, height: 64 }}
                    contentFit="contain"
                  />
                ) : null;
              })}
            </View>
            <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
              <Pressable
                disabled={diary.busy}
                onPress={() =>
                  void diary.run({
                    operation: "planning_worn",
                    id: plan.id,
                    expectedRevision: plan.revision,
                  })
                }
                style={{ ...button, backgroundColor: colors.lime }}
              >
                <Text style={{ color: colors.ink, fontWeight: "800" }}>
                  Wore it
                </Text>
              </Pressable>
              <Pressable
                disabled={diary.busy}
                onPress={() => {
                  setEdit({
                    id: plan.id,
                    revision: plan.revision,
                    isPlan: true,
                  });
                  setSelected(plan.itemIds);
                  setSearch("");
                }}
                style={button}
              >
                <Text style={{ color: colors.ink }}>Wore something else</Text>
              </Pressable>
              <Pressable
                disabled={diary.busy}
                style={button}
                onPress={() =>
                  void diary.run({
                    operation: "planning_not_worn",
                    id: plan.id,
                    expectedRevision: plan.revision,
                  })
                }
              >
                <Text style={{ color: colors.ink }}>Didn’t wear this</Text>
              </Pressable>
            </View>
          </Panel>
        ))}
        {!photoWearId &&
          diary.pending.data?.pages
            .flatMap((page) => page.page)
            .filter((plan) => plan.notWornAt)
            .map((plan) => (
              <Panel key={plan.id}>
                <Text style={{ color: colors.ink }}>
                  {plan.date} · Didn’t wear this
                </Text>
                <Text style={{ color: colors.ink }}>{plan.title}</Text>
                <Pressable
                  style={button}
                  disabled={diary.busy}
                  onPress={() =>
                    void diary.run({
                      operation: "planning_clear_response",
                      id: plan.id,
                      expectedRevision: plan.revision,
                    })
                  }
                >
                  <Text style={{ color: colors.ink }}>Edit response</Text>
                </Pressable>
              </Panel>
            ))}
        {!photoWearId && diary.pending.hasNextPage && (
          <Pressable
            style={button}
            onPress={() => void diary.pending.fetchNextPage()}
          >
            <Text style={{ color: colors.ink }}>Load earlier plans</Text>
          </Pressable>
        )}
        {manual.map((wear) => (
          <Panel key={wear.id}>
            <Text style={{ color: colors.muted }}>
              {wear.localDate ?? "Wear date unknown"} ·{" "}
              {wear.photos.length ? "From your fit photo" : "Confirmed by you"}
            </Text>
            <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
              {wear.pieces.map((piece) => (
                <View key={piece.id} style={{ width: 60 }}>
                  {piece.imageUrl && (
                    <Image
                      source={piece.imageUrl}
                      style={{ width: 60, height: 74 }}
                      contentFit="contain"
                    />
                  )}
                  <Text style={{ color: colors.ink, fontSize: 11 }}>
                    {piece.category}
                  </Text>
                </View>
              ))}
            </View>
            <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
              <Pressable
                disabled={diary.busy}
                onPress={() => {
                  setEdit({
                    id: wear.id,
                    revision: wear.revision,
                    isPlan: false,
                  });
                  setSelected(wear.itemIds);
                  setSearch("");
                }}
                style={button}
              >
                <Text style={{ color: colors.ink }}>Edit actual outfit</Text>
              </Pressable>
              {wear.canUndoManual && (
                <Pressable
                  disabled={diary.busy}
                  onPress={() =>
                    void diary.run({
                      operation: "wear_update",
                      id: wear.id,
                      expectedRevision: wear.revision,
                      action: "undo_manual",
                    })
                  }
                  style={button}
                >
                  <Text style={{ color: colors.ink }}>Undo confirmation</Text>
                </Pressable>
              )}
            </View>
          </Panel>
        ))}
        <Modal
          visible={Boolean(edit)}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => {
            if (!diary.busy) setEdit(null);
          }}
        >
          <PostHogMaskView style={{ flex: 1 }}>
            <ScrollView
              contentContainerStyle={{
                padding: 20,
                paddingTop: 30,
                paddingBottom: 50,
                gap: 14,
              }}
            >
              <Text
                style={{ fontSize: 24, fontWeight: "800", color: colors.ink }}
              >
                What did you wear?
              </Text>
              <Text style={{ color: colors.muted }}>
                Choose the actual pieces. Your original plan stays in your
                history.
              </Text>
              <TextInput
                accessibilityLabel="Find a piece"
                value={search}
                onChangeText={setSearch}
                placeholder="Find a piece…"
                style={{ ...button, color: colors.ink }}
              />
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {planner.data?.items
                  .filter((piece) =>
                    `${piece.category} ${piece.description}`
                      .toLowerCase()
                      .includes(search.toLowerCase()),
                  )
                  .map((piece) => (
                    <Pressable
                      key={piece.id}
                      accessibilityRole="checkbox"
                      accessibilityState={{
                        checked: selected.includes(piece.id),
                      }}
                      onPress={() =>
                        setSelected((ids) =>
                          ids.includes(piece.id)
                            ? ids.filter((id) => id !== piece.id)
                            : [...ids, piece.id],
                        )
                      }
                      style={{
                        width: "30%",
                        borderWidth: 2,
                        borderColor: selected.includes(piece.id)
                          ? colors.plum
                          : colors.line,
                        borderRadius: 12,
                        padding: 8,
                        backgroundColor: selected.includes(piece.id)
                          ? colors.wash
                          : colors.surface,
                      }}
                    >
                      {piece.imageUrl && (
                        <Image
                          source={piece.imageUrl}
                          style={{ width: "100%", height: 100 }}
                          contentFit="contain"
                        />
                      )}
                      <Text style={{ color: colors.ink, fontWeight: "600" }}>
                        {piece.category}
                      </Text>
                    </Pressable>
                  ))}
              </View>
              {diary.message && (
                <Text style={{ color: colors.danger }}>{diary.message}</Text>
              )}
              <Pressable
                disabled={
                  diary.busy || !selected.length || selected.length > 12
                }
                style={{ ...button, backgroundColor: colors.lime }}
                onPress={async () => {
                  if (!edit) return;
                  const saved = await diary.run(
                    edit.isPlan
                      ? {
                          operation: "planning_worn",
                          id: edit.id,
                          expectedRevision: edit.revision,
                          itemIds: selected,
                        }
                      : {
                          operation: "wear_update",
                          id: edit.id,
                          expectedRevision: edit.revision,
                          action: "correct",
                          itemIds: selected,
                        },
                  );
                  if (saved) setEdit(null);
                }}
              >
                <Text style={{ color: colors.ink, fontWeight: "800" }}>
                  Save actual outfit
                </Text>
              </Pressable>
              <Pressable
                disabled={diary.busy}
                style={button}
                onPress={() => setEdit(null)}
              >
                <Text style={{ color: colors.ink }}>Cancel</Text>
              </Pressable>
            </ScrollView>
          </PostHogMaskView>
        </Modal>
      </View>
    </PostHogMaskView>
  );
}

export function FitWearEvidence({ fitId }: { fitId: string }) {
  const diary = useWearDiary();
  const planner = usePlanner();
  const wear = diary.data?.find((row) =>
    row.photos.some((photo) => photo.id === fitId),
  );
  const [date, setDate] = useState("");
  const [editing, setEditing] = useState(false);
  if (!wear) return null;
  const candidates =
    !wear.planId && wear.localDate
      ? (planner.data?.suggestions.filter(
          (plan) =>
            plan.date === wear.localDate &&
            ["planned", "worn"].includes(plan.status) &&
            !plan.notWornAt &&
            plan.itemIds.some((id) => wear.itemIds.includes(id)),
        ) ?? [])
      : [];
  return (
    <PostHogMaskView>
      <View style={{ gap: 8 }}>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Text style={{ color: colors.ink, fontWeight: "700" }}>
            {wear.localDate
              ? `Worn ${wear.localDate}`
              : "When did you wear this?"}
          </Text>
          <Pressable
            onPress={() => {
              setDate(wear.localDate ?? localDate());
              setEditing(!editing);
            }}
            style={button}
          >
            <Text style={{ color: colors.ink }}>
              {wear.localDate ? "Edit date" : "Set date"}
            </Text>
          </Pressable>
        </View>
        {(editing || !wear.localDate) && (
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TextInput
              accessibilityLabel="Wear date in YYYY-MM-DD format"
              value={date || localDate()}
              onChangeText={setDate}
              style={{ ...button, flex: 1, color: colors.ink }}
            />
            <Pressable
              disabled={diary.busy}
              style={button}
              onPress={async () => {
                if (
                  await diary.run({
                    operation: "wear_update",
                    id: wear.id,
                    expectedRevision: wear.revision,
                    action: "set_date",
                    localDate: date || localDate(),
                  })
                )
                  setEditing(false);
              }}
            >
              <Text style={{ color: colors.ink }}>Save date</Text>
            </Pressable>
          </View>
        )}
        <Text style={{ color: colors.muted, fontSize: 12 }}>
          {wear.unresolvedCount
            ? `${wear.unresolvedCount} pieces need a closer look. Identified pieces are recorded as worn.`
            : wear.itemIds.length
              ? "Identified pieces recorded as worn."
              : "Photo saved. No pieces are currently counted as worn."}
          {wear.planId &&
            ` ${wear.outcome === "confirmed_as_planned" ? "Matches your plan." : "Plan linked."}`}
        </Text>
        {candidates.map((plan) => (
          <Pressable
            key={plan.id}
            style={button}
            disabled={diary.busy}
            onPress={() =>
              void diary.run({
                operation: "wear_update",
                id: wear.id,
                expectedRevision: wear.revision,
                action: "attach_plan",
                planId: plan.id,
                expectedPlanRevision: plan.planRevision ?? 0,
              })
            }
          >
            <Text style={{ color: colors.ink }}>
              This was my {plan.title} outfit
            </Text>
          </Pressable>
        ))}
        {wear.planId && (
          <Pressable
            style={button}
            disabled={diary.busy}
            onPress={() =>
              void diary.run({
                operation: "wear_update",
                id: wear.id,
                expectedRevision: wear.revision,
                action: "detach_plan",
              })
            }
          >
            <Text style={{ color: colors.ink }}>Unlink plan</Text>
          </Pressable>
        )}
        <Pressable
          style={button}
          disabled={diary.busy}
          onPress={() =>
            void diary.run({
              operation: "wear_update",
              id: wear.id,
              expectedRevision: wear.revision,
              action:
                wear.photos.find((photo) => photo.id === fitId)
                  ?.countsAsWear === false
                  ? "restore_photo"
                  : "retract_photo",
              fitId,
            })
          }
        >
          <Text style={{ color: colors.ink }}>
            {wear.photos.find((photo) => photo.id === fitId)?.countsAsWear ===
            false
              ? "Count this photo as wear"
              : "Don’t count this photo as wear"}
          </Text>
        </Pressable>
        {wear.canUndoManual && (
          <Pressable
            style={button}
            disabled={diary.busy}
            onPress={() =>
              void diary.run({
                operation: "wear_update",
                id: wear.id,
                expectedRevision: wear.revision,
                action: "undo_manual",
              })
            }
          >
            <Text style={{ color: colors.ink }}>Undo manual confirmation</Text>
          </Pressable>
        )}
        {diary.message && (
          <Text style={{ color: colors.danger }}>{diary.message}</Text>
        )}
        <WearDiary photoWearId={wear.id} />
      </View>
    </PostHogMaskView>
  );
}
