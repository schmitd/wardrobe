import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Modal, Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors } from "@/theme";
import type { CaptureIntent } from "@/types";

export function AddOutfitButton({ onSelect }: { onSelect: (intent: CaptureIntent) => void }) {
  const anchor = useRef<View>(null);
  const firstAction = useRef<View>(null);
  const nextIntent = useRef<CaptureIntent | undefined>(undefined);
  const progress = useRef(new Animated.Value(0)).current;
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [reduceMotion, setReduceMotion] = useState(false);
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const menuWidth = Math.min(280, width - 24);

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const listener = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => listener.remove();
  }, []);

  useEffect(() => { setPosition(null); progress.setValue(0); }, [width, height, progress]);

  const animate = (toValue: number, done?: () => void) => {
    Animated.timing(progress, { toValue, duration: reduceMotion ? 0 : toValue ? 180 : 120, useNativeDriver: true }).start(({ finished }) => { if (finished) done?.(); });
  };
  const finishSelection = () => {
    const intent = nextIntent.current;
    nextIntent.current = undefined;
    if (intent) onSelect(intent);
  };
  const close = (intent?: CaptureIntent) => animate(0, () => {
    nextIntent.current = intent;
    setPosition(null);
    // iOS must dismiss this modal before presenting the full-screen camera.
    if (process.env.EXPO_OS !== "ios") finishSelection();
  });
  const rotation = progress.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "45deg"] });
  const buttonStyle = { width: 62, height: 62, borderRadius: 31, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.lime, alignItems: "center" as const, justifyContent: "center" as const, boxShadow: "3px 4px 0 rgba(36,20,38,0.16)" };
  const icon = <Animated.View style={{ transform: [{ rotate: rotation }] }}><MaterialCommunityIcons name="plus" size={35} color={colors.ink} /></Animated.View>;

  return (
    <>
      <View ref={anchor} collapsable={false} style={{ marginTop: -22 }} accessibilityElementsHidden={Boolean(position)} importantForAccessibility={position ? "no-hide-descendants" : "auto"}>
        <Pressable accessibilityRole="button" accessibilityLabel="Add outfit" accessibilityState={{ expanded: Boolean(position) }} onPress={() => anchor.current?.measureInWindow((x, y) => setPosition({ x, y }))} style={buttonStyle}>
          {icon}
        </Pressable>
      </View>
      <Modal transparent visible={Boolean(position)} animationType="none" statusBarTranslucent navigationBarTranslucent onShow={() => animate(1, () => { if (firstAction.current) AccessibilityInfo.sendAccessibilityEvent(firstAction.current, "focus"); })} onRequestClose={() => close()} onDismiss={finishSelection}>
        <View style={{ flex: 1 }} accessibilityViewIsModal onAccessibilityEscape={() => close()}>
          <Pressable accessible={false} onPress={() => close()} style={{ position: "absolute", inset: 0 }} />
          {position && <>
            <Animated.View style={{ position: "absolute", left: Math.min(Math.max(12, position.x + 31 - menuWidth / 2), width - menuWidth - 12), bottom: height - position.y + 12, width: menuWidth, maxHeight: Math.max(100, position.y - insets.top - 24), padding: 5, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper, boxShadow: "3px 4px 0 rgba(36,20,38,0.16)", opacity: progress, transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [reduceMotion ? 0 : 12, 0] }) }] }}>
              <ScrollView bounces={false}>
                {([
                  ["my_wardrobe", "Add owned outfit", "tshirt-crew-outline"],
                  ["just_trying", "Try on outfit", "text-search"],
                ] as const).map(([intent, label, name]) => <Pressable key={intent} ref={intent === "my_wardrobe" ? firstAction : undefined} accessibilityRole="button" accessibilityLabel={label} onPress={() => close(intent)} style={({ pressed }) => ({ minHeight: 52, flexDirection: "row", alignItems: "center", gap: 12, padding: 12, backgroundColor: pressed ? colors.wash : "transparent" })}>
                  <MaterialCommunityIcons name={name} size={21} color={colors.ink} />
                  <Text style={{ flexShrink: 1, color: colors.ink, fontSize: 16, fontWeight: "700" }}>{label}</Text>
                </Pressable>)}
              </ScrollView>
            </Animated.View>
            <Pressable accessibilityRole="button" accessibilityLabel="Close add menu" onPress={() => close()} style={{ ...buttonStyle, position: "absolute", left: position.x, top: position.y }}>{icon}</Pressable>
          </>}
        </View>
      </Modal>
    </>
  );
}
