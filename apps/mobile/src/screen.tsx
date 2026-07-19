import type { PropsWithChildren, ReactNode } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";

import { colors } from "@/theme";

export function Page({ children, refresh, refreshing = false }: PropsWithChildren<{ refresh?: () => void; refreshing?: boolean }>) {
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ padding: 20, paddingBottom: 112, gap: 20 }}
      refreshControl={refresh ? <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.plum} colors={[colors.plum]} /> : undefined}
    >
      {children}
    </ScrollView>
  );
}

export function Panel({ children, tint = colors.surface }: PropsWithChildren<{ tint?: string }>) {
  return <View style={{ gap: 10, backgroundColor: tint, borderColor: colors.line, borderWidth: 1, padding: 16 }}>{children}</View>;
}

export function Loading({ label = "Remembering your wardrobe…" }: { label?: string }) {
  return <View style={{ minHeight: 220, alignItems: "center", justifyContent: "center", gap: 12 }}><ActivityIndicator color={colors.plum} /><Text selectable style={{ color: colors.muted }}>{label}</Text></View>;
}

export function ErrorPanel({ message, retry }: { message: string; retry?: () => void }) {
  return <Panel tint="#F8E6EE"><Text selectable style={{ color: colors.danger, fontWeight: "800" }}>{message}</Text>{retry ? <Pressable onPress={retry}><Text style={{ color: colors.plum, fontWeight: "900" }}>Try again</Text></Pressable> : null}</Panel>;
}
