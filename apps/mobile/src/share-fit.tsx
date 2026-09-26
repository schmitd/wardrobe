import { useAuth } from "@clerk/expo";
import { Directory, File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { useEffect, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { colors } from "@/theme";

const root = () => new Directory(Paths.cache, "wardrobe-fit-share");
const API = (
  process.env.EXPO_PUBLIC_WARDROBE_API_URL ??
  "https://wardrobe.davidcschmitt.com"
).replace(/\/$/, "");
export function clearFitShareCache() {
  const dir = root();
  if (dir.exists) dir.delete();
}
export function sweepFitShareCache() {
  const dir = root();
  if (!dir.exists) return;
  for (const entry of dir.list())
    if (
      entry instanceof File &&
      Date.now() - Number(entry.name.split("-")[0]) > 86_400_000
    )
      entry.delete();
}
export function ShareFit({ fitId }: { fitId: string }) {
  const { getToken, userId } = useAuth();
  const owner = useRef(userId);
  owner.current = userId;
  useEffect(
    () => () => {
      owner.current = null;
    },
    [],
  );
  const running = useRef(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const share = async () => {
    if (running.current || !userId) return;
    const account = userId;
    running.current = true;
    setBusy(true);
    setMessage("");
    let file: File | undefined;
    try {
      if (!(await Sharing.isAvailableAsync()))
        throw new Error("Image sharing is unavailable on this device.");
      const token = await getToken();
      if (!token) throw new Error("Sign in again to share this photo.");
      sweepFitShareCache();
      const directory = root();
      directory.create({ intermediates: true, idempotent: true });
      file = new File(
        directory,
        `${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`,
      );
      await File.downloadFileAsync(
        `${API}/api/fits/${encodeURIComponent(fitId)}/image`,
        file,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (owner.current !== account) {
        file.delete();
        return;
      }
      await Sharing.shareAsync(file.uri, {
        mimeType: "image/jpeg",
        UTI: "public.jpeg",
        dialogTitle: "Share your fit",
      });
      // Retain privately for delayed recipient reads; next-start sweep caps age.
    } catch (error) {
      if (file?.exists) file.delete();
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not prepare this photo. Please try again.",
      );
    } finally {
      running.current = false;
      setBusy(false);
    }
  };
  return (
    <View>
      <Pressable
        accessibilityRole="button"
        disabled={busy}
        onPress={() => void share()}
        style={{
          minHeight: 44,
          padding: 12,
          alignSelf: "flex-start",
          borderRadius: 12,
          borderWidth: 1,
          borderColor: colors.line,
        }}
      >
        <Text style={{ color: colors.ink, fontWeight: "700" }}>
          {busy ? "Preparing image…" : "Share fit"}
        </Text>
      </Pressable>
      {message && (
        <Text accessibilityRole="alert" style={{ color: colors.danger }}>
          {message}
        </Text>
      )}
    </View>
  );
}
