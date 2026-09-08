import { useAuth } from "@clerk/expo";
import { useQueryClient } from "@tanstack/react-query";
import { Cause, Effect, Exit, Option } from "effect";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";

import { routeCapture, runCaptureOperation, tryOn } from "@/api";
import { useCaptureResult } from "@/capture-context";
import { uploadPhoto } from "@/photo-upload";
import { ErrorPanel, Panel } from "@/screen";
import { colors } from "@/theme";
import type { CaptureIntent, CaptureScope } from "@/types";
import { track, trackFailure } from "@/analytics";
import { createTraceId } from "@/trace";

const makeTraceId = createTraceId;

export default function CaptureProcessing() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { getToken } = useAuth({ treatPendingAsSignedOut: false });
  const params = useLocalSearchParams<{ uri?: string; intent?: CaptureIntent; onboarding?: string }>();
  const uri = Array.isArray(params.uri) ? params.uri[0] : params.uri;
  const intent: CaptureIntent = params.intent === "just_trying" ? "just_trying" : "my_wardrobe";
  const onboarding = params.onboarding === "1";
  const traceId = useRef(makeTraceId()).current;
  const storageId = useRef<string | null>(null);
  const started = useRef(false);
  const attempt = useRef(0);
  const stage = useRef("upload");
  const [status, setStatus] = useState("Preparing your photo…");
  const [error, setError] = useState<string | null>(null);
  const [complete, setComplete] = useState<"fit" | "piece" | "try_on" | null>(null);
  const { result, setResult } = useCaptureResult();
  const verdict = useMemo(() => !result?.evaluation ? "A new direction" : result.evaluation.score >= 75 ? "Strong closet fit" : result.evaluation.score >= 50 ? "Useful with limits" : "Harder to integrate", [result]);

  const upload = (sourceUri: string) => Effect.gen(function* () {
    setStatus("Uploading securely…");
    return yield* Effect.tryPromise({ try: () => uploadPhoto(getToken, sourceUri), catch: (cause) => cause instanceof Error ? cause : new Error("Upload failed. Please try again.") });
  });

  const commit = (id: string, scope: CaptureScope) => Effect.gen(function* () {
    stage.current = "commit";
    if (intent === "just_trying") {
      setStatus("Reading your wardrobe and finding useful anchors…");
      const feedback = yield* Effect.tryPromise({ try: () => tryOn(getToken, id, traceId), catch: (cause) => cause instanceof Error ? cause : new Error("Try-on feedback failed.") });
      setResult(feedback);
      setComplete("try_on");
      return;
    }
    if (scope === "full_fit") {
      setStatus("Recording your fit and recognizing familiar pieces…");
      yield* Effect.tryPromise({ try: () => runCaptureOperation(getToken, { operation: "record_fit", storageId: id, traceId }), catch: (cause) => cause instanceof Error ? cause : new Error("This fit could not be recorded.") });
      setComplete("fit");
      return;
    }
    setStatus("Adding this piece to your wardrobe…");
    yield* Effect.tryPromise({ try: () => runCaptureOperation(getToken, { operation: "add_piece", storageId: id, clientFileName: "native-capture.jpg", contentType: "image/jpeg", traceId }), catch: (cause) => cause instanceof Error ? cause : new Error("This piece could not be added.") });
    setComplete("piece");
  });

  const analyze = () => {
    if (!uri) {
      setError("This capture is no longer available. Return to the camera and try again.");
      setStatus("");
      return;
    }
    setResult(null);
    attempt.current += 1;
    const attemptStarted = Date.now();
    track("native_capture_started", { intent, onboarding, trace_id: traceId, attempt: attempt.current });
    stage.current = storageId.current ? "route" : "upload";
    setError(null);
    setStatus(storageId.current ? "Placing your photo…" : "Preparing your photo…");
    const workflow = Effect.gen(function* () {
      const id = storageId.current ?? (yield* upload(uri));
      storageId.current = id;
      stage.current = "route";
      setStatus("Deciding whether this is one piece or a full fit…");
      const detected = yield* Effect.tryPromise({ try: () => routeCapture(getToken, id, traceId), catch: (cause) => cause instanceof Error ? cause : new Error("Photo routing failed.") });
      track("native_capture_routed", { intent, scope: detected.scope, confidence: detected.confidence, needs_review: detected.needsReview, trace_id: traceId });
      yield* commit(id, detected.scope);
    });
    void Effect.runPromiseExit(workflow).then((exit) => {
      if (Exit.isFailure(exit)) {
        track("native_capture_failed", { intent, stage: stage.current, attempt: attempt.current, duration_ms: Date.now() - attemptStarted, trace_id: traceId });
        trackFailure(stage.current, { trace_id: traceId, intent });
        const failure = Option.getOrUndefined(Cause.failureOption(exit.cause));
        setError(failure?.message ?? "Could not save this photo right now. Please try again.");
      } else {
        track("native_capture_completed", { intent, onboarding, attempt: attempt.current, duration_ms: Date.now() - attemptStarted, trace_id: traceId });
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        void queryClient.invalidateQueries({ queryKey: ["mobile-bootstrap"] });
      }
      setStatus("");
    });
  };

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    analyze();
  }, []);

  const done = () => router.replace(complete === "fit" || complete === "try_on" ? "/(tabs)/fits" : "/(tabs)/wardrobe");

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ flexGrow: 1, padding: 18, paddingBottom: 48, gap: 16, justifyContent: complete || error ? "flex-start" : "center" }}>
      {!complete && !error ? (
        <View accessibilityRole="progressbar" style={{ alignItems: "center", gap: 18, paddingVertical: 36 }}>
          <ActivityIndicator size="large" color={colors.plum} />
          <Text selectable style={{ color: colors.ink, fontSize: 24, fontWeight: "900", textAlign: "center" }}>Wardrobe is looking</Text>
          <Text selectable style={{ color: colors.muted, lineHeight: 22, textAlign: "center", maxWidth: 330 }}>{status}</Text>
        </View>
      ) : null}

      {result && complete === "try_on" ? <View style={{ gap: 14 }}><Panel tint={!result.evaluation || result.evaluation.score >= 50 ? "#EDF5E9" : "#F8E6EE"}><View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" }}><View style={{ flex: 1 }}><Text selectable style={{ color: colors.plum, fontWeight: "900", fontSize: 12, textTransform: "uppercase" }}>Closet compatibility</Text><Text selectable style={{ color: colors.ink, fontSize: 23, fontWeight: "900", marginTop: 4 }}>{verdict}</Text></View>{result.evaluation ? <Text selectable style={{ color: colors.ink, fontSize: 38, fontWeight: "900" }}>{result.evaluation.score}<Text style={{ fontSize: 15 }}>/100</Text></Text> : null}</View><Text selectable style={{ color: colors.ink, lineHeight: 22 }}>{result.evaluation?.explanation ?? result.message ?? result.candidate.description}</Text></Panel>{result.similarItems.length ? <Panel><Text selectable style={{ color: colors.ink, fontWeight: "900" }}>Wardrobe anchors</Text><View style={{ flexDirection: "row", gap: 9 }}>{result.similarItems.slice(0, 3).map((item) => <View key={item.id} style={{ flex: 1, gap: 5 }}><Image source={item.imageUrl} style={{ width: "100%", aspectRatio: 1, backgroundColor: colors.wash }} contentFit="cover" /><Text numberOfLines={1} style={{ color: colors.ink, fontWeight: "800", fontSize: 11 }}>{item.category ?? "Piece"}</Text></View>)}</View></Panel> : null}</View> : null}
      {complete && complete !== "try_on" ? <Panel tint="#EDF5E9"><Text selectable style={{ color: colors.success, fontSize: 20, fontWeight: "900" }}>{complete === "fit" ? "Fit recorded" : "Piece added"}</Text><Text selectable style={{ color: colors.ink }}>{complete === "fit" ? "Wardrobe is connecting detected garments to pieces it already remembers." : "It is now part of your wardrobe and style memory."}</Text></Panel> : null}
      {error ? <ErrorPanel message={error} /> : null}
      {error ? <Pressable onPress={analyze} style={{ backgroundColor: colors.lime, borderColor: colors.line, borderWidth: 1, padding: 15, alignItems: "center" }}><Text style={{ color: colors.ink, fontWeight: "900" }}>Try again</Text></Pressable> : null}
      {complete ? <Pressable onPress={done} style={{ backgroundColor: colors.ink, padding: 15, alignItems: "center" }}><Text style={{ color: "white", fontWeight: "900" }}>Done</Text></Pressable> : null}
      {error ? <Pressable onPress={() => router.replace({ pathname: "/capture", params: { onboarding: onboarding ? "1" : undefined } })} style={{ alignItems: "center", padding: 10 }}><Text style={{ color: colors.muted, fontWeight: "800" }}>Return to camera</Text></Pressable> : null}
    </ScrollView>
  );
}
