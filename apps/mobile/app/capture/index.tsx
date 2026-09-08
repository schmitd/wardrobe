import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { CameraView, useCameraPermissions, type CameraType } from "expo-camera";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { readLastCameraFacing, rememberCameraFacing } from "@/camera-preferences";
import { colors } from "@/theme";
import type { CaptureIntent } from "@/types";
import { useVolumeShutter } from "@/use-volume-shutter";
import { track, trackFailure } from "@/analytics";

function IntentControl({ value, onChange }: { value: CaptureIntent; onChange: (intent: CaptureIntent) => void }) {
  return (
    <View accessibilityRole="radiogroup" style={{ flexDirection: "row", alignSelf: "center", borderRadius: 24, padding: 4, backgroundColor: "rgba(36,20,38,.76)" }}>
      {([["my_wardrobe", "I own this"], ["just_trying", "Just trying"]] as const).map(([intent, label]) => {
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
  const operationLocked = useRef(false);
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>(onboarding ? "front" : "back");
  const [lensPreferenceLoaded, setLensPreferenceLoaded] = useState(false);
  const [intent, setIntent] = useState<CaptureIntent>("my_wardrobe");
  const [cameraReady, setCameraReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { width, height } = useWindowDimensions();
  const previewWidth = Math.min(width, height * 0.75);
  const previewHeight = previewWidth * 4 / 3;

  useEffect(() => {
    void readLastCameraFacing(onboarding ? "front" : "back").then((savedFacing) => {
      setFacing(savedFacing);
      setLensPreferenceLoaded(true);
    });
  }, [onboarding]);

  useEffect(() => {
    if (permission?.status === "undetermined") void requestPermission();
  }, [permission?.status, requestPermission]);

  useEffect(() => {
    if (permission) track("native_camera_permission_observed", { permission: permission.status, can_ask_again: permission.canAskAgain, onboarding });
  }, [permission?.status, permission?.canAskAgain, onboarding]);

  const processPhoto = useCallback((uri: string) => {
    router.replace({ pathname: "/capture/processing", params: { uri, intent, onboarding: onboarding ? "1" : undefined } });
  }, [intent, onboarding, router]);

  const takePhoto = useCallback(async () => {
    if (!camera.current || !cameraReady || operationLocked.current) return;
    operationLocked.current = true;
    setBusy(true);
    setError(null);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const photo = await camera.current.takePictureAsync({ quality: 0.86, skipProcessing: false });
      if (!photo?.uri) throw new Error("The camera did not return a photo.");
      track("native_photo_selected", { source: "camera", intent, onboarding });
      processPhoto(photo.uri);
    } catch {
      trackFailure("camera");
      operationLocked.current = false;
      setBusy(false);
      setError("That photo could not be taken. Check camera access and try again.");
    }
  }, [cameraReady, processPhoto]);

  useVolumeShutter(Boolean(permission?.granted && lensPreferenceLoaded), () => void takePhoto());

  const choosePhoto = useCallback(async () => {
    if (operationLocked.current) return;
    operationLocked.current = true;
    setBusy(true);
    setError(null);
    try {
      // The system photo picker grants access only to what the user chooses; no
      // broad camera-roll permission is needed for image-only selection.
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.9,
        allowsEditing: false,
        selectionLimit: 1,
      });
      if (!result.canceled && result.assets[0]) {
        track("native_photo_selected", { source: "library", intent, onboarding });
        processPhoto(result.assets[0].uri);
        return;
      }
      track("native_photo_selection_cancelled", { source: "library" });
    } catch {
      trackFailure("picker");
      setError("Photos could not be opened. You can try again or check access in Settings.");
    }
    operationLocked.current = false;
    setBusy(false);
  }, [processPhoto]);

  useEffect(() => {
    // Android can recreate MainActivity while its system picker is open. Recover
    // that selection instead of dropping the user's capture.
    if (process.env.EXPO_OS !== "android") return;
    void ImagePicker.getPendingResultAsync().then((pending) => {
      if (!pending || "code" in pending || pending.canceled || !pending.assets[0] || operationLocked.current) return;
      operationLocked.current = true;
      processPhoto(pending.assets[0].uri);
    }).catch(() => undefined);
  }, [processPhoto]);

  const flipCamera = () => {
    if (operationLocked.current) return;
    setCameraReady(false);
    setFacing((current) => {
      const next = current === "front" ? "back" : "front";
      void rememberCameraFacing(next);
      return next;
    });
  };

  if (!permission) return <View style={{ flex: 1, backgroundColor: "black", alignItems: "center", justifyContent: "center" }}><ActivityIndicator color="white" /></View>;
  if (!permission.granted) {
    const allowCamera = permission.canAskAgain
      ? () => void requestPermission()
      : () => void Linking.openSettings();
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper, padding: 24, justifyContent: "center", gap: 18 }}>
        <Text selectable style={{ color: colors.ink, fontSize: 30, fontWeight: "900" }}>Let Wardrobe use your camera</Text>
        <Text selectable style={{ color: colors.muted, fontSize: 16, lineHeight: 24 }}>Take one full-body photo or a close photo of a piece. You can also choose an existing photo without granting broad library access.</Text>
        <Pressable onPress={allowCamera} style={{ backgroundColor: colors.lime, borderColor: colors.line, borderWidth: 1, padding: 15, alignItems: "center" }}><Text style={{ color: colors.ink, fontWeight: "900" }}>{permission.canAskAgain ? "Allow camera" : "Open Settings"}</Text></Pressable>
        <Pressable disabled={busy} onPress={() => void choosePhoto()} style={{ borderColor: colors.line, borderWidth: 1, padding: 15, alignItems: "center", opacity: busy ? 0.6 : 1 }}><Text style={{ color: colors.ink, fontWeight: "900" }}>Choose a photo</Text></Pressable>
        {error ? <Text selectable style={{ color: colors.danger, lineHeight: 21 }}>{error}</Text> : null}
        <Pressable onPress={() => router.back()} style={{ alignItems: "center", padding: 10 }}><Text style={{ color: colors.muted, fontWeight: "800" }}>Cancel</Text></Pressable>
      </SafeAreaView>
    );
  }

  if (!lensPreferenceLoaded) return <View style={{ flex: 1, backgroundColor: "black", alignItems: "center", justifyContent: "center" }}><ActivityIndicator color="white" /></View>;

  return (
    <View style={{ flex: 1, backgroundColor: "black", alignItems: "center", justifyContent: "center" }}>
      <CameraView
        ref={camera}
        style={{ width: previewWidth, height: previewHeight }}
        facing={facing}
        mirror={facing === "front"}
        onCameraReady={() => setCameraReady(true)}
        onMountError={() => setError("The camera could not start. Try again, choose a photo, or check access in Settings.")}
      />
      <SafeAreaView pointerEvents="box-none" style={{ position: "absolute", inset: 0, justifyContent: "space-between" }}>
        <View style={{ paddingHorizontal: 18, gap: 18 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Pressable accessibilityLabel="Close camera" onPress={() => router.back()} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(0,0,0,.55)", alignItems: "center", justifyContent: "center" }}><MaterialCommunityIcons name="close" size={27} color="white" /></Pressable>
            <Pressable accessibilityLabel={`Use ${facing === "front" ? "rear" : "front"} camera`} disabled={busy} onPress={flipCamera} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(0,0,0,.55)", alignItems: "center", justifyContent: "center", opacity: busy ? 0.6 : 1 }}><MaterialCommunityIcons name="camera-flip-outline" size={25} color="white" /></Pressable>
          </View>
          <View style={{ alignSelf: "center", maxWidth: 330, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: "rgba(0,0,0,.58)", borderRadius: 8 }}><Text selectable style={{ color: "white", fontSize: 14, lineHeight: 20, textAlign: "center", fontWeight: "700" }}>{onboarding ? "Keep your whole outfit in frame and wear something that feels quintessentially you." : "Keep your whole outfit in frame, or move close for one piece. Wardrobe will tell the difference."}</Text></View>
        </View>
        <View style={{ paddingHorizontal: 24, paddingBottom: 20, gap: 14 }}>
          {error ? <View style={{ alignSelf: "center", maxWidth: 340, padding: 12, borderRadius: 8, backgroundColor: "rgba(0,0,0,.72)", gap: 8 }}><Text selectable style={{ color: "white", lineHeight: 20, textAlign: "center" }}>{error}</Text><Pressable onPress={() => void Linking.openSettings()}><Text style={{ color: colors.lime, fontWeight: "900", textAlign: "center" }}>Open Settings</Text></Pressable></View> : null}
          {!onboarding ? <IntentControl value={intent} onChange={setIntent} /> : null}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Pressable accessibilityLabel="Choose from photos" disabled={busy} onPress={() => void choosePhoto()} style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: "rgba(0,0,0,.62)", alignItems: "center", justifyContent: "center", opacity: busy ? 0.6 : 1 }}><MaterialCommunityIcons name="image-outline" size={27} color="white" /></Pressable>
            <Pressable accessibilityLabel="Take photo. You can also use either volume button." disabled={busy || !cameraReady} onPress={() => void takePhoto()} style={{ width: 82, height: 82, borderRadius: 41, borderWidth: 5, borderColor: "white", alignItems: "center", justifyContent: "center", opacity: cameraReady ? 1 : 0.6 }}><View style={{ width: 62, height: 62, borderRadius: 31, backgroundColor: busy ? colors.washStrong : colors.lime }} /></Pressable>
            <View style={{ width: 52 }} />
          </View>
          <Text selectable style={{ color: "rgba(255,255,255,.82)", fontSize: 12, fontWeight: "700", textAlign: "center" }}>Tap the shutter or press either volume button</Text>
        </View>
      </SafeAreaView>
    </View>
  );
}
