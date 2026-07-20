import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { CameraView, useCameraPermissions, type CameraType } from "expo-camera";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors } from "@/theme";
import type { CaptureIntent } from "@/types";

function IntentControl({ value, onChange }: { value: CaptureIntent; onChange: (intent: CaptureIntent) => void }) {
  return (
    <View accessibilityRole="radiogroup" style={{ flexDirection: "row", alignSelf: "center", borderRadius: 24, padding: 4, backgroundColor: "rgba(36,20,38,.76)" }}>
      {([[
        "my_wardrobe", "I own this"
      ], ["just_trying", "Just trying"]] as const).map(([intent, label]) => {
        const selected = intent === value;
        return <Pressable key={intent} accessibilityRole="radio" accessibilityState={{ checked: selected }} onPress={() => onChange(intent)} style={{ borderRadius: 20, paddingVertical: 10, paddingHorizontal: 18, backgroundColor: selected ? colors.lime : "transparent" }}><Text style={{ color: selected ? colors.ink : "white", fontWeight: "900" }}>{label}</Text></Pressable>;
      })}
    </View>
  );
}

export default function Capture() {
  const router = useRouter();
  const params = useLocalSearchParams<{ onboarding?: string }>();
  const onboarding = params.onboarding === "1";
  const camera = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>("front");
  const [intent, setIntent] = useState<CaptureIntent>("my_wardrobe");
  const [taking, setTaking] = useState(false);

  const review = (uri: string) => router.push({ pathname: "/capture/review", params: { uri, intent } });
  const takePhoto = () => {
    if (!camera.current || taking) return;
    setTaking(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    void camera.current.takePictureAsync({ quality: 0.86, skipProcessing: false }).then((photo) => review(photo.uri)).finally(() => setTaking(false));
  };
  const choosePhoto = () => {
    void ImagePicker.requestMediaLibraryPermissionsAsync().then((grant) => {
      if (!grant.granted) return null;
      return ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.9, allowsEditing: false });
    }).then((result) => { if (result && !result.canceled && result.assets[0]) review(result.assets[0].uri); });
  };

  if (!permission) return <View style={{ flex: 1, backgroundColor: "black", alignItems: "center", justifyContent: "center" }}><ActivityIndicator color="white" /></View>;
  if (!permission.granted) {
    return <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper, padding: 24, justifyContent: "center", gap: 18 }}><Text selectable style={{ color: colors.ink, fontSize: 30, fontWeight: "900" }}>Let Wardrobe use your camera</Text><Text selectable style={{ color: colors.muted, fontSize: 16, lineHeight: 24 }}>Take one full-body photo or a close photo of a piece. You can also choose an existing photo without camera access.</Text><Pressable onPress={() => void requestPermission()} style={{ backgroundColor: colors.lime, borderColor: colors.line, borderWidth: 1, padding: 15, alignItems: "center" }}><Text style={{ color: colors.ink, fontWeight: "900" }}>Allow camera</Text></Pressable><Pressable onPress={choosePhoto} style={{ borderColor: colors.line, borderWidth: 1, padding: 15, alignItems: "center" }}><Text style={{ color: colors.ink, fontWeight: "900" }}>Choose a photo</Text></Pressable><Pressable onPress={() => router.back()} style={{ alignItems: "center", padding: 10 }}><Text style={{ color: colors.muted, fontWeight: "800" }}>Cancel</Text></Pressable></SafeAreaView>;
  }

  return (
    <View style={{ flex: 1, backgroundColor: "black" }}>
      <CameraView ref={camera} style={StyleSheet.absoluteFill} facing={facing} mirror={facing === "front"} />
      <SafeAreaView pointerEvents="box-none" style={{ flex: 1, justifyContent: "space-between" }}>
        <View style={{ paddingHorizontal: 18, gap: 18 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Pressable accessibilityLabel="Close camera" onPress={() => router.back()} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(0,0,0,.55)", alignItems: "center", justifyContent: "center" }}><MaterialCommunityIcons name="close" size={27} color="white" /></Pressable>
            <Pressable accessibilityLabel="Flip camera" onPress={() => setFacing((current) => current === "front" ? "back" : "front")} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(0,0,0,.55)", alignItems: "center", justifyContent: "center" }}><MaterialCommunityIcons name="camera-flip-outline" size={25} color="white" /></Pressable>
          </View>
          <View style={{ alignSelf: "center", maxWidth: 330, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: "rgba(0,0,0,.58)", borderRadius: 8 }}><Text selectable style={{ color: "white", fontSize: 14, lineHeight: 20, textAlign: "center", fontWeight: "700" }}>{onboarding ? "Keep your whole outfit in frame and wear something that feels quintessentially you." : "Keep your whole outfit in frame, or move close for one piece. The agent will tell the difference."}</Text></View>
        </View>
        <View style={{ paddingHorizontal: 24, paddingBottom: 20, gap: 20 }}>
          {!onboarding ? <IntentControl value={intent} onChange={setIntent} /> : null}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Pressable accessibilityLabel="Choose from photos" onPress={choosePhoto} style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: "rgba(0,0,0,.62)", alignItems: "center", justifyContent: "center" }}><MaterialCommunityIcons name="image-outline" size={27} color="white" /></Pressable>
            <Pressable accessibilityLabel="Take photo" disabled={taking} onPress={takePhoto} style={{ width: 82, height: 82, borderRadius: 41, borderWidth: 5, borderColor: "white", alignItems: "center", justifyContent: "center" }}><View style={{ width: 62, height: 62, borderRadius: 31, backgroundColor: taking ? colors.washStrong : colors.lime }} /></Pressable>
            <View style={{ width: 52 }} />
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}
