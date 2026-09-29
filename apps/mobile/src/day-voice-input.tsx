import { useAuth } from "@clerk/expo";
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
} from "expo-audio";
import { File } from "expo-file-system";
import { useEffect, useRef, useState } from "react";
import { AppState, Pressable, Text, View } from "react-native";
import { transcribeDay } from "@/api";
import { colors } from "@/theme";

export function DayVoiceInput({
  onText,
  disabled = false,
  onBusyChange,
}: {
  onText: (text: string) => void;
  disabled?: boolean;
  onBusyChange?: (busy: boolean) => void;
}) {
  const { getToken } = useAuth();
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [phase, setPhase] = useState<
    "idle" | "starting" | "recording" | "transcribing"
  >("idle");
  const [message, setMessage] = useState("");
  const attempt = useRef(0);
  const starting = useRef(false);
  const request = useRef<AbortController | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentUri = useRef<string | null>(null);
  const erase = (uri: string | null) => {
    if (uri)
      try {
        new File(uri).delete();
      } catch {
        /* Already gone. */
      }
  };
  useEffect(() => {
    onBusyChange?.(phase !== "idle");
  }, [phase, onBusyChange]);
  const discard = async () => {
    attempt.current++;
    request.current?.abort();
    if (timer.current) clearTimeout(timer.current);
    try {
      await recorder.stop();
    } catch {
      /* Recording may already be stopped. */
    }
    erase(recorder.uri);
    erase(currentUri.current);
    currentUri.current = null;
    await setAudioModeAsync({ allowsRecording: false });
  };
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (next) => {
      if (next !== "active") {
        void discard().catch(() => {});
        setPhase("idle");
      }
    });
    return () => {
      subscription.remove();
      void discard().catch(() => {});
      onBusyChange?.(false);
    };
  }, [recorder, onBusyChange]);
  const finish = async (id: number) => {
    if (id !== attempt.current) return;
    if (timer.current) clearTimeout(timer.current);
    setPhase("transcribing");
    let uri: string | null = null;
    try {
      await recorder.stop();
      await setAudioModeAsync({ allowsRecording: false });
      uri = recorder.uri;
      currentUri.current = uri;
      if (id !== attempt.current || !uri) return;
      const file = new File(uri);
      if (!file.size || file.size > 2100000) throw Error("Invalid recording");
      const audio = await file.base64();
      if (id !== attempt.current) return;
      const controller = new AbortController();
      request.current = controller;
      const timeout = setTimeout(() => controller.abort(), 65000);
      let result: { text: string };
      try {
        result = await transcribeDay(getToken, audio, controller.signal);
      } finally {
        clearTimeout(timeout);
        if (request.current === controller) request.current = null;
      }
      if (id === attempt.current) onText(result.text);
    } catch {
      if (id === attempt.current)
        setMessage(
          "Could not transcribe. Try a shorter note or type your plans.",
        );
    } finally {
      erase(uri);
      currentUri.current = null;
      if (id === attempt.current) setPhase("idle");
    }
  };
  const start = async () => {
    if (disabled || phase !== "idle" || starting.current) return;
    starting.current = true;
    const id = ++attempt.current;
    setPhase("starting");
    setMessage("");
    try {
      const permission = await AudioModule.requestRecordingPermissionsAsync();
      if (id !== attempt.current || AppState.currentState !== "active") return;
      if (!permission.granted) throw Error("Denied");
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });
      await recorder.prepareToRecordAsync();
      if (id !== attempt.current || AppState.currentState !== "active") {
        await discard();
        return;
      }
      recorder.record();
      setPhase("recording");
      timer.current = setTimeout(() => void finish(id), 60000);
    } catch {
      if (id === attempt.current) {
        setMessage("Microphone unavailable. Allow access or type your plans.");
        setPhase("idle");
      }
      await setAudioModeAsync({ allowsRecording: false });
    } finally {
      starting.current = false;
      if (id !== attempt.current) setPhase("idle");
    }
  };
  const label =
    phase === "starting"
      ? "Opening microphone…"
      : phase === "recording"
        ? "Tap to finish"
        : phase === "transcribing"
          ? "Transcribing…"
          : "Tap to dictate";
  return (
    <View style={{ gap: 10, alignItems: "center" }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        disabled={
          phase === "starting" ||
          phase === "transcribing" ||
          (disabled && phase === "idle")
        }
        onPress={() =>
          phase === "recording" ? void finish(attempt.current) : void start()
        }
        style={{
          minHeight: 64,
          minWidth: 180,
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 32,
          backgroundColor: "#DCE66E",
          padding: 16,
        }}
      >
        <Text style={{ color: colors.ink, fontWeight: "800" }}>{label}</Text>
      </Pressable>
      <Text
        style={{ color: colors.muted, textAlign: "center", lineHeight: 20 }}
      >
        Finishing sends audio for transcription. Audio isn’t saved. Up to 60
        seconds.
      </Text>
      {phase !== "idle" && (
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            void discard().catch(() => {});
            setPhase("idle");
          }}
          style={{ minHeight: 44, padding: 12 }}
        >
          <Text style={{ color: colors.ink }}>Cancel dictation</Text>
        </Pressable>
      )}
      {message ? (
        <Text accessibilityLiveRegion="polite" style={{ color: colors.danger }}>
          {message}
        </Text>
      ) : null}
    </View>
  );
}
