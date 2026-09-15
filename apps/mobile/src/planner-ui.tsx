import { Image } from "expo-image";
import {
  Pressable,
  ScrollView,
  Text,
  View,
  useColorScheme,
} from "react-native";
import type { ReactNode } from "react";
import MaterialIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { PostHogMaskView } from "posthog-react-native";
import type { PlanningData } from "@wardrobe/shared";
export const isIOS = process.env.EXPO_OS === "ios";
export function usePlannerColors() {
  return useColorScheme() === "dark"
    ? {
        bg: "#17151a",
        surface: "#252229",
        ink: "#f7f1f8",
        muted: "#c6bbca",
        accent: "#d4b4dc",
        onAccent: "#34203d",
        line: "#514956",
      }
    : {
        bg: isIOS ? "#f6f2f7" : "#fdf7ff",
        surface: "#ffffff",
        ink: "#211a26",
        muted: "#685e70",
        accent: "#735079",
        onAccent: "#ffffff",
        line: "#ddd5e1",
      };
}
export function PlannerPage({ children }: { children: ReactNode }) {
  const c = usePlannerColors();
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      automaticallyAdjustKeyboardInsets
      keyboardShouldPersistTaps="handled"
      style={{ flex: 1, backgroundColor: c.bg }}
      contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 16 }}
    >
      {children}
    </ScrollView>
  );
}
export function PlannerButton({
  title,
  onPress,
  disabled,
  secondary,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  secondary?: boolean;
}) {
  const c = usePlannerColors();
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      android_ripple={{ color: "#d2bfd9" }}
      style={{
        minHeight: 50,
        padding: 14,
        borderRadius: isIOS ? 14 : 28,
        backgroundColor: secondary ? c.surface : c.accent,
        borderWidth: secondary ? 1 : 0,
        borderColor: c.line,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <Text
        style={{
          color: secondary ? c.accent : c.onAccent,
          textAlign: "center",
          fontWeight: "600",
          fontSize: 17,
        }}
      >
        {title}
      </Text>
    </Pressable>
  );
}
export function PlannerGroup({ children }: { children: ReactNode }) {
  const c = usePlannerColors();
  return (
    <View
      style={{
        borderRadius: isIOS ? 16 : 20,
        overflow: "hidden",
        backgroundColor: c.surface,
      }}
    >
      {children}
    </View>
  );
}
export function PlannerText({
  children,
  title,
}: {
  children: ReactNode;
  title?: boolean;
}) {
  const c = usePlannerColors();
  return (
    <Text
      selectable
      style={{
        color: title ? c.ink : c.muted,
        fontSize: title ? 20 : 15,
        fontWeight: title ? "600" : "400",
        lineHeight: title ? 28 : 22,
      }}
    >
      {children}
    </Text>
  );
}
export function PlannerRow({
  title,
  subtitle,
  onPress,
  trailing,
}: {
  title: string;
  subtitle?: string;
  onPress?: () => void;
  trailing?: ReactNode;
}) {
  const c = usePlannerColors();
  const content = (
    <>
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={{ color: c.ink, fontSize: 17 }}>{title}</Text>
        {subtitle ? (
          <Text style={{ color: c.muted, fontSize: 14 }}>{subtitle}</Text>
        ) : null}
      </View>
      {trailing ??
        (onPress ? (
          <MaterialIcons name="chevron-right" size={22} color={c.muted} />
        ) : null)}
    </>
  );
  return onPress ? (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      android_ripple={{ color: c.line }}
      style={{
        minHeight: 56,
        padding: 16,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        borderBottomWidth: 0.5,
        borderColor: c.line,
      }}
    >
      {content}
    </Pressable>
  ) : (
    <View
      style={{
        minHeight: 56,
        padding: 16,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
      }}
    >
      {content}
    </View>
  );
}
export function PieceImages({
  ids,
  data,
  size = 38,
}: {
  ids: string[];
  data: PlanningData;
  size?: number;
}) {
  const c = usePlannerColors();
  return (
    <PostHogMaskView style={{ flexDirection: "row", gap: 4, flexWrap: "wrap" }}>
      {ids.slice(0, 4).map((id) => {
        const item = data.items.find((i) => i.id === id);
        return item?.imageUrl ? (
          <Image
            key={id}
            source={item.imageUrl}
            accessibilityLabel={item.category}
            contentFit="contain"
            style={{
              width: size,
              height: size * 1.3,
              backgroundColor: c.surface,
              borderRadius: 4,
            }}
          />
        ) : (
          <View
            key={id}
            style={{
              width: size,
              height: size * 1.3,
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <MaterialIcons name="hanger" color={c.muted} size={24} />
          </View>
        );
      })}
    </PostHogMaskView>
  );
}
