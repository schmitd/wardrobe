import type { PropsWithChildren, ReactNode } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";

import { colors } from "@/theme";

export function Page({ children, refresh, refreshing = false }: PropsWithChildren<{ refresh?: () => void; refreshing?: boolean }>) {
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ padding: 20, paddingBottom: 112, gap: 20 }}
      refreshControl={undefined}
    >
      {refresh ? (
        <Pressable accessibilityRole="button" onPress={refresh} style={{ alignSelf: "flex-end", paddingVertical: 4 }}>
          <Text style={{ color: colors.plum, fontWeight: "800" }}>{refreshing ? "Refreshing…" : "Refresh"}</Text>
        </Pressable>
      ) : null}
      {children}
    </ScrollView>
  );
}

export function Intro({ eyebrow, title, body }: { eyebrow: string; title: string; body: string }) {
  return (
    <View style={{ gap: 7 }}>
      <Text selectable style={{ color: colors.plum, fontSize: 13, fontWeight: "800", letterSpacing: 0.7, textTransform: "uppercase" }}>{eyebrow}</Text>
      <Text selectable style={{ color: colors.ink, fontSize: 34, lineHeight: 38, fontWeight: "900" }}>{title}</Text>
      <Text selectable style={{ color: colors.muted, fontSize: 15, lineHeight: 22 }}>{body}</Text>
    </View>
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
