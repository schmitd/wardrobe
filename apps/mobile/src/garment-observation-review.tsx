import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useAuth } from "@clerk/expo";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

import { promoteObservation, resolveObservation } from "@/api";
import { colors } from "@/theme";
import type { GarmentObservation } from "@/types";

const resolvedStatuses = new Set(["auto_matched", "confirmed", "promoted_new"]);

export function GarmentObservationReview({ observations }: { observations: GarmentObservation[] }) {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (input: { observationId: string; itemId?: string }) => input.itemId
      ? resolveObservation(getToken, input.observationId, input.itemId)
      : promoteObservation(getToken, input.observationId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["mobile-bootstrap"] }),
  });

  if (!observations.length) return null;
  return (
    <View style={{ borderTopWidth: 1, borderTopColor: colors.washStrong, paddingTop: 12, gap: 12 }}>
      <View style={{ gap: 3 }}><Text selectable style={{ color: colors.plum, fontSize: 11, fontWeight: "900", textTransform: "uppercase", letterSpacing: 0.7 }}>Detected pieces</Text><Text selectable style={{ color: colors.muted, fontSize: 12, lineHeight: 17 }}>Wardrobe asks only when a repeat match stays genuinely ambiguous.</Text></View>
      {mutation.error ? <Text selectable accessibilityRole="alert" style={{ color: colors.danger, fontSize: 12, fontWeight: "800" }}>{mutation.error.message}</Text> : null}
      {observations.map((observation) => {
        const resolved = resolvedStatuses.has(observation.resolutionStatus);
        const needsConfirmation = observation.resolutionStatus === "needs_confirmation";
        const pending = mutation.isPending && mutation.variables?.observationId === observation.id;
        return (
          <View key={observation.id} style={{ borderWidth: 1, borderColor: colors.washStrong, backgroundColor: colors.paper, padding: 10, gap: 10, borderRadius: 11, borderCurve: "continuous" }}>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Image source={observation.cropUrl ?? undefined} style={{ width: 62, height: 76, backgroundColor: colors.wash, borderRadius: 8 }} contentFit="cover" />
              <View style={{ flex: 1, gap: 4 }}><View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}><Text selectable numberOfLines={1} style={{ flex: 1, color: colors.ink, fontWeight: "900" }}>{observation.category}</Text>{resolved ? <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}><MaterialCommunityIcons name="check-circle" size={15} color={colors.success} /><Text style={{ color: colors.success, fontSize: 10, fontWeight: "900" }}>{observation.resolutionStatus === "promoted_new" ? "Added new" : "Recognized"}</Text></View> : null}{observation.resolutionStatus === "unresolved" ? <Text style={{ color: colors.muted, fontSize: 10, fontWeight: "900" }}>No repeat</Text> : null}</View><Text selectable numberOfLines={3} style={{ color: colors.muted, fontSize: 12, lineHeight: 17 }}>{observation.description}</Text></View>
            </View>
            {needsConfirmation ? <View style={{ gap: 8 }}>
              {observation.candidates.slice(0, 3).map((candidate) => <Pressable key={candidate.id} disabled={pending} onPress={() => mutation.mutate({ observationId: observation.id, itemId: candidate.id })} style={({ pressed }) => ({ minHeight: 58, flexDirection: "row", alignItems: "center", gap: 9, borderWidth: 1, borderColor: colors.washStrong, backgroundColor: pressed ? colors.wash : colors.surface, padding: 6, opacity: pending ? 0.55 : 1, borderRadius: 9, borderCurve: "continuous" })}><Image source={candidate.imageUrl ?? undefined} style={{ width: 44, height: 44, backgroundColor: colors.wash, borderRadius: 6 }} contentFit="cover" /><View style={{ flex: 1 }}><Text numberOfLines={1} style={{ color: colors.ink, fontSize: 12, fontWeight: "900" }}>{candidate.category ?? "Closet piece"}</Text><Text numberOfLines={1} style={{ color: colors.muted, fontSize: 11 }}>{candidate.description ?? "Previously saved"}</Text></View><Text style={{ color: colors.plum, fontSize: 11, fontWeight: "900", fontVariant: ["tabular-nums"] }}>{Math.round(candidate.score * 100)}%</Text></Pressable>)}
              <Pressable disabled={pending} onPress={() => mutation.mutate({ observationId: observation.id })} style={{ minHeight: 42, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, opacity: pending ? 0.55 : 1, borderRadius: 9, borderCurve: "continuous" }}>{pending ? <ActivityIndicator color={colors.ink} /> : <MaterialCommunityIcons name="plus" size={17} color={colors.ink} />}<Text style={{ color: colors.ink, fontSize: 12, fontWeight: "900" }}>This is a new closet item</Text></Pressable>
            </View> : null}
            {observation.resolutionStatus === "unresolved" ? <Pressable disabled={pending} onPress={() => mutation.mutate({ observationId: observation.id })} style={{ minHeight: 42, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, opacity: pending ? 0.55 : 1, borderRadius: 9, borderCurve: "continuous" }}>{pending ? <ActivityIndicator color={colors.ink} /> : <MaterialCommunityIcons name="plus" size={17} color={colors.ink} />}<Text style={{ color: colors.ink, fontSize: 12, fontWeight: "900" }}>Add as a new wardrobe piece</Text></Pressable> : null}
          </View>
        );
      })}
    </View>
  );
}
