import { useAuth } from "@clerk/expo";
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";
import { File } from "expo-file-system";
import { useEffect, useRef, useState } from "react";
import { AppState, Pressable, Text, View } from "react-native";
import { transcribeDay } from "@/api";
import { colors } from "@/theme";

export function DayVoiceInput({ onText }: { onText: (text: string) => void }) {
  const { getToken } = useAuth();
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const state = useAudioRecorderState(recorder);
  const [uri, setUri] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const active = useRef(true);
  const currentUri = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const erase = (value: string | null) => {
    if (value) {
      try {
        new File(value).delete();
      } catch {
        /* Already gone */
      }
    }
  };
  const stop = async (discard = false) => {
    if (timer.current) clearTimeout(timer.current);
    try {
      await recorder.stop();
      const file = recorder.uri;
      currentUri.current = file;
      if (discard || !active.current) {
        erase(file);
        currentUri.current = null;
      } else setUri(file);
    } finally {
      await setAudioModeAsync({ allowsRecording: false });
    }
  };
  useEffect(() => {
    active.current = true;
    const subscription = AppState.addEventListener("change", (next) => {
      if (next !== "active") {
        void stop(true).catch(() => {});
        erase(currentUri.current);
        currentUri.current = null;
        setUri(null);
      }
    });
    return () => {
      active.current = false;
      subscription.remove();
      if (timer.current) clearTimeout(timer.current);
      erase(currentUri.current);
      void recorder
        .stop()
        .then(() => erase(recorder.uri))
        .catch(() => {});
      void setAudioModeAsync({ allowsRecording: false });
    };
  }, [recorder]);
  const start = async () => {
    setBusy(true);
    setMessage("");
    try {
      const permission = await AudioModule.requestRecordingPermissionsAsync();
      if (!permission.granted) {
        setMessage(
          "Microphone access was denied. You can still type or use keyboard dictation.",
        );
        return;
      }
      if (!active.current || AppState.currentState !== "active") return;
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });
      await recorder.prepareToRecordAsync();
      recorder.record();
      timer.current = setTimeout(
        () =>
          void stop().catch(() => setMessage("Could not finish recording.")),
        60000,
      );
    } catch {
      setMessage("Microphone unavailable. Type your day instead.");
    } finally {
      setBusy(false);
    }
  };
  const transcribe = async () => {
    if (!uri) return;
    setBusy(true);
    setMessage("");
    try {
      const file = new File(uri);
      if (file.size > 2100000) throw new Error("Too large");
      const result = await transcribeDay(getToken, await file.base64());
      if (active.current) {
        onText(result.text);
        setMessage(
          "Review and edit the transcript before requesting an outfit.",
        );
      }
    } catch {
      if (active.current)
        setMessage(
          "Could not transcribe. Try a shorter note or type your day.",
        );
    } finally {
      erase(uri);
      currentUri.current = null;
      if (active.current) {
        setUri(null);
        setBusy(false);
      }
    }
  };
  const button = (label: string, onPress: () => void) => (
    <Pressable
      disabled={busy}
      onPress={onPress}
      accessibilityRole="button"
      style={{
        minHeight: 44,
        borderWidth: 1,
        borderColor: colors.line,
        padding: 12,
        opacity: busy ? 0.5 : 1,
      }}
    >
      <Text style={{ color: colors.ink, fontWeight: "800" }}>{label}</Text>
    </Pressable>
  );
  return (
    <View style={{ gap: 10 }}>
      <Text style={{ color: colors.muted, lineHeight: 20 }}>
        Record up to 60 seconds. Transcribe sends audio to our AI provider;
        Wardrobe does not store it. Review the text before requesting an outfit.
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {!state.isRecording && !uri
          ? button("Dictate your day", () => void start())
          : null}
        {state.isRecording
          ? button(
              "Stop recording",
              () =>
                void stop().catch(() =>
                  setMessage("Could not finish recording."),
                ),
            )
          : null}
        {uri
          ? button(
              busy ? "Transcribing…" : "Transcribe recording",
              () => void transcribe(),
            )
          : null}
        {state.isRecording || uri
          ? button("Discard recording", () => {
              erase(uri);
              currentUri.current = null;
              setUri(null);
              if (state.isRecording) void stop(true).catch(() => {});
            })
          : null}
      </View>
      {state.isRecording ? (
        <Text accessibilityLiveRegion="polite" style={{ color: colors.danger }}>
          Recording… {Math.floor(state.durationMillis / 1000)}s
        </Text>
      ) : null}
      {message ? (
        <Text accessibilityLiveRegion="polite" style={{ color: colors.muted }}>
          {message}
        </Text>
      ) : null}
    </View>
  );
}
