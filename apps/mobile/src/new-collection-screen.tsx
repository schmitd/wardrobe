import { useAuth } from "@clerk/expo";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Redirect, useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { createCollection } from "@/api";
import { ErrorPanel } from "@/screen";
import { colors } from "@/theme";

const trace = () => `native-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export function NewCollectionScreen() {
  const { getToken, isSignedIn } = useAuth({ treatPendingAsSignedOut: false });
  const queryClient = useQueryClient();
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const mutation = useMutation({
    mutationFn: () => createCollection(getToken, { name, ...(description.trim() ? { description } : {}), traceId: trace() }),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ["mobile-bootstrap"] });
      router.replace({ pathname: "/plan/[id]", params: { id: result.id } });
    },
  });

  if (!isSignedIn) return <Redirect href="/sign-in" />;
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.paper }} behavior={process.env.EXPO_OS === "ios" ? "padding" : undefined}>
      <ScrollView contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, gap: 20 }}>
        <View style={{ gap: 8 }}><Text selectable style={{ color: colors.plum, fontSize: 13, fontWeight: "900", textTransform: "uppercase" }}>A point of view</Text><Text selectable style={{ color: colors.muted, fontSize: 15, lineHeight: 22 }}>Name the direction. The photos can do most of the explaining afterward.</Text></View>
        <View style={{ gap: 8 }}><Text selectable style={{ color: colors.ink, fontWeight: "900" }}>Name</Text><TextInput accessibilityLabel="Plan name" autoFocus editable={!mutation.isPending} placeholder="Quietly tailored" placeholderTextColor="#8B758E" value={name} onChangeText={setName} style={{ minHeight: 52, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, color: colors.ink, paddingHorizontal: 14, fontSize: 16, borderRadius: 10, borderCurve: "continuous" }} /></View>
        <View style={{ gap: 8 }}><Text selectable style={{ color: colors.ink, fontWeight: "900" }}>Optional note</Text><TextInput accessibilityLabel="Plan note" editable={!mutation.isPending} multiline placeholder="A softer weekday uniform" placeholderTextColor="#8B758E" value={description} onChangeText={setDescription} style={{ minHeight: 104, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, color: colors.ink, padding: 14, fontSize: 16, lineHeight: 22, textAlignVertical: "top", borderRadius: 10, borderCurve: "continuous" }} /></View>
        {mutation.error ? <ErrorPanel message={mutation.error.message} /> : null}
        <Pressable disabled={!name.trim() || mutation.isPending} onPress={() => mutation.mutate()} style={{ minHeight: 52, backgroundColor: colors.lime, borderColor: colors.line, borderWidth: 1, alignItems: "center", justifyContent: "center", opacity: !name.trim() || mutation.isPending ? 0.55 : 1, borderRadius: 10, borderCurve: "continuous" }}>{mutation.isPending ? <ActivityIndicator color={colors.ink} /> : <Text style={{ color: colors.ink, fontWeight: "900", fontSize: 16 }}>Create plan</Text>}</Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
