import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useAuth } from "@clerk/expo";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";

import { updateBio } from "@/api";
import { ErrorPanel } from "@/screen";
import { styleContextNote } from "@/style-context";
import { colors } from "@/theme";
import type { MobileBootstrap } from "@/types";

const trace = () => `native-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export function StyleMemory({ profile }: { profile: MobileBootstrap["profile"] }) {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [bio, setBio] = useState(profile?.bio ?? "");
  const [saved, setSaved] = useState(false);
  const inferredNote = styleContextNote(profile);

  useEffect(() => {
    if (!editing) setBio(profile?.bio ?? "");
  }, [editing, profile?.bio]);

  const mutation = useMutation({
    mutationFn: () => updateBio(getToken, bio.trim(), trace()),
    onSuccess: async () => {
      setSaved(true);
      setEditing(false);
      await queryClient.invalidateQueries({ queryKey: ["mobile-bootstrap"] });
    },
  });

  return (
    <View style={{ borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, padding: 16, gap: 12, borderRadius: 14, borderCurve: "continuous" }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 8 }}>
          <MaterialCommunityIcons name="shimmer" size={20} color={colors.plum} />
          <Text selectable style={{ color: colors.ink, fontSize: 18, fontWeight: "900" }}>Style notes</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={editing ? "Close style notes editor" : "Edit style notes"}
          accessibilityState={{ expanded: editing }}
          onPress={() => { setSaved(false); setEditing((value) => !value); }}
          style={{ minHeight: 40, minWidth: 48, alignItems: "center", justifyContent: "center" }}
        >
          <Text style={{ color: colors.plum, fontWeight: "900" }}>{editing ? "Close" : "Edit"}</Text>
        </Pressable>
      </View>

      {editing ? (
        <View style={{ gap: 10 }}>
          <Text selectable style={{ color: colors.muted, fontSize: 13, lineHeight: 19 }}>Add the fit preferences and context you want Wardrobe to remember.</Text>
          <TextInput
            accessibilityLabel="Style notes"
            multiline
            onChangeText={(value) => { setBio(value); setSaved(false); }}
            placeholder="Relaxed tailoring, easy layers, no itchy fabrics…"
            placeholderTextColor="#8B758E"
            style={{ minHeight: 104, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper, color: colors.ink, padding: 13, fontSize: 15, lineHeight: 21, textAlignVertical: "top", borderRadius: 10, borderCurve: "continuous" }}
            value={bio}
          />
          {mutation.error ? <ErrorPanel message={mutation.error.message} /> : null}
          <Pressable
            disabled={mutation.isPending}
            onPress={() => mutation.mutate()}
            style={{ minHeight: 46, backgroundColor: colors.lime, borderWidth: 1, borderColor: colors.line, alignItems: "center", justifyContent: "center", opacity: mutation.isPending ? 0.6 : 1, borderRadius: 10, borderCurve: "continuous" }}
          >
            {mutation.isPending ? <ActivityIndicator color={colors.ink} /> : <Text style={{ color: colors.ink, fontWeight: "900" }}>Save notes</Text>}
          </Pressable>
        </View>
      ) : (
        <View style={{ gap: 8 }}>
          <Text selectable style={{ color: profile?.bio ? colors.ink : colors.muted, lineHeight: 21 }}>
            {profile?.bio || "Add a short note about how you like clothes to look and feel."}
          </Text>
          {inferredNote ? <Text selectable style={{ color: colors.muted, fontSize: 13, lineHeight: 19 }}>{inferredNote}</Text> : null}
          {saved ? <Text selectable accessibilityRole="alert" style={{ color: colors.success, fontSize: 13, fontWeight: "800" }}>Notes updated.</Text> : null}
        </View>
      )}
    </View>
  );
}
