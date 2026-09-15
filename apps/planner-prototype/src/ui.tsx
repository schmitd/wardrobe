import type { ReactNode } from "react";
import { Image } from "expo-image";
import {
  Pressable,
  ScrollView,
  Text,
  View,
  useColorScheme,
  type ColorValue,
} from "react-native";
export function usePalette() {
  return useColorScheme() === "dark"
    ? {
        background: "#171518",
        surface: "#262329",
        ink: "#faf6f9",
        muted: "#b9afb9",
        line: "#443c45",
        accent: "#d5b6d5",
        onAccent: "#241426",
        wash: "#352b39",
      }
    : {
        background: "#f5f2f5",
        surface: "#ffffff",
        ink: "#241426",
        muted: "#706570",
        line: "#e4dfe5",
        accent: "#724e74",
        onAccent: "#ffffff",
        wash: "#ede5ef",
      };
}
export function Page({ children }: { children: ReactNode }) {
  const c = usePalette();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.background }}
      contentInsetAdjustmentBehavior="automatic"
      automaticallyAdjustKeyboardInsets
      keyboardDismissMode="interactive"
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ padding: 20, gap: 24, paddingBottom: 44 }}
    >
      {children}
    </ScrollView>
  );
}
export function Group({ children }: { children: ReactNode }) {
  const c = usePalette();
  return (
    <View
      style={{
        borderRadius: 16,
        borderCurve: "continuous",
        backgroundColor: c.surface,
        overflow: "hidden",
      }}
    >
      {children}
    </View>
  );
}
export function Caption({ children }: { children: ReactNode }) {
  const c = usePalette();
  return (
    <Text selectable style={{ fontSize: 14, lineHeight: 20, color: c.muted }}>
      {children}
    </Text>
  );
}
export function Section({
  title,
  children,
  footer,
}: {
  title?: string;
  children: ReactNode;
  footer?: string;
}) {
  const c = usePalette();
  return (
    <View style={{ gap: 8 }}>
      {title ? (
        <Text style={{ fontSize: 13, color: c.muted, marginLeft: 16 }}>
          {title.toUpperCase()}
        </Text>
      ) : null}
      {children}
      {footer ? (
        <View style={{ paddingHorizontal: 16 }}>
          <Caption>{footer}</Caption>
        </View>
      ) : null}
    </View>
  );
}
export function Symbol({
  name,
  color,
  size = 22,
}: {
  name: string;
  color?: ColorValue;
  size?: number;
}) {
  const c = usePalette();
  return (
    <Image
      source={`sf:${name}`}
      tintColor={typeof color === "string" ? color : c.accent}
      style={{ width: size, height: size }}
      accessibilityElementsHidden
    />
  );
}
export function Row({
  title,
  subtitle,
  symbol,
  value,
  onPress,
  trailing,
  last = false,
}: {
  title: string;
  subtitle?: string;
  symbol?: string;
  value?: string;
  onPress?: () => void;
  trailing?: ReactNode;
  last?: boolean;
}) {
  const c = usePalette();
  const content = (
    <>
      <View
        style={{
          minHeight: 58,
          paddingHorizontal: 16,
          paddingVertical: 12,
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
        }}
      >
        {symbol ? <Symbol name={symbol} /> : null}
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={{ color: c.ink, fontSize: 17 }}>{title}</Text>
          {subtitle ? (
            <Text style={{ color: c.muted, fontSize: 14, lineHeight: 19 }}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {value ? (
          <Text style={{ color: c.muted, fontSize: 16 }}>{value}</Text>
        ) : null}
        {trailing}
        {onPress ? (
          <Symbol name="chevron.right" color={c.muted} size={13} />
        ) : null}
      </View>
      {!last ? (
        <View
          style={{
            marginLeft: symbol ? 50 : 16,
            backgroundColor: c.line,
            height: 0.5,
          }}
        />
      ) : null}
    </>
  );
  return onPress ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={({ pressed }) => ({ opacity: pressed ? 0.55 : 1 })}
    >
      {content}
    </Pressable>
  ) : (
    <View>{content}</View>
  );
}
export function Primary({
  title,
  onPress,
  disabled = false,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const c = usePalette();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled }}
      style={({ pressed }) => ({
        backgroundColor: c.accent,
        opacity: disabled ? 0.4 : pressed ? 0.75 : 1,
        minHeight: 54,
        padding: 15,
        borderRadius: 16,
        borderCurve: "continuous",
        alignItems: "center",
        justifyContent: "center",
      })}
    >
      <Text
        style={{
          color: c.onAccent,
          fontSize: 17,
          fontWeight: "600",
          textAlign: "center",
        }}
      >
        {title}
      </Text>
    </Pressable>
  );
}
export function dateLabel(day: string) {
  return new Date(`${day}T12:00:00`).toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}
