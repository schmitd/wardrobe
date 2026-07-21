import { useAuth } from "@clerk/expo";
import { useQueryClient } from "@tanstack/react-query";
import { Cause, Effect, Exit, Option } from "effect";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";

import { routeCapture, runCaptureOperation, tryOn } from "@/api";
import { useCaptureResult } from "@/capture-context";
import { uploadPhoto } from "@/photo-upload";
import { ErrorPanel, Panel } from "@/screen";
import { colors } from "@/theme";
import type { CaptureIntent, CaptureRoute, CaptureScope, CompatibilityResult } from "@/types";

const trace = () => `native-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export default function CaptureReview() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { getToken, isSignedIn } = useAuth({ treatPendingAsSignedOut: false });
  const params = useLocalSearchParams<{ uri: string; intent: CaptureIntent }>();
  const uri = Array.isArray(params.uri) ? params.uri[0] : params.uri;
  const intent: CaptureIntent = params.intent === "just_trying" ? "just_trying" : "my_wardrobe";
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [storageId, setStorageId] = useState<string | null>(null);
  const [route, setRoute] = useState<CaptureRoute | null>(null);
  const [scopeOverride, setScopeOverride] = useState<CaptureScope | null>(null);
  const [complete, setComplete] = useState<"fit" | "piece" | "try_on" | null>(null);
  const { result, setResult } = useCaptureResult();
  const effectiveScope = scopeOverride ?? route?.scope;
  const verdict = useMemo(() => !result?.evaluation ? "A new direction" : result.evaluation.score >= 75 ? "Strong closet fit" : result.evaluation.score >= 50 ? "Useful with limits" : "Harder to integrate", [result]);

  const upload = () => Effect.gen(function* () {
    setStatus("Preparing your photo…");
    setStatus("Uploading securely…");
    return yield* Effect.tryPromise({ try: () => uploadPhoto(getToken, uri), catch: (cause) => cause instanceof Error ? cause : new Error("Upload failed. Please try again.") });
  });

  const commit = (id: string, scope: CaptureScope) => Effect.gen(function* () {
    const traceId = trace();
    if (intent === "just_trying") {
      setStatus("Reading your wardrobe, then finding useful anchors…");
      const feedback = yield* Effect.tryPromise({ try: () => tryOn(getToken, id), catch: (cause) => cause instanceof Error ? cause : new Error("Try-on feedback failed.") });
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
    setStatus("Adding one piece to your wardrobe…");
    yield* Effect.tryPromise({ try: () => runCaptureOperation(getToken, { operation: "add_piece", storageId: id, clientFileName: "native-capture.jpg", contentType: "image/jpeg", traceId }), catch: (cause) => cause instanceof Error ? cause : new Error("This piece could not be added.") });
    setComplete("piece");
  });

  const run = (effect: Effect.Effect<void, Error>) => {
    setError(null);
    void Effect.runPromiseExit(effect).then((exit) => {
      if (Exit.isFailure(exit)) {
        const failure = Option.getOrUndefined(Cause.failureOption(exit.cause));
        setError(failure?.message ?? "Could not save this photo right now. Please try again.");
      }
      else { void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); void queryClient.invalidateQueries({ queryKey: ["mobile-bootstrap"] }); }
      setStatus(null);
    });
  };

  const analyze = () => {
    if (!isSignedIn) {
      router.push({ pathname: "/sign-in", params: { returnUri: uri, returnIntent: intent } });
      return;
    }
    setResult(null);
    run(Effect.gen(function* () {
      const id = storageId ?? (yield* upload());
      setStorageId(id);
      setStatus("Deciding whether this is one piece or a full fit…");
      const detected = yield* Effect.tryPromise({ try: () => routeCapture(getToken, id, trace()), catch: (cause) => cause instanceof Error ? cause : new Error("Photo routing failed.") });
      setRoute(detected);
      if (detected.needsReview) { setStatus(null); return; }
      yield* commit(id, detected.scope);
    }));
  };

  const continueAfterReview = () => { if (storageId && effectiveScope) run(commit(storageId, effectiveScope)); };
  const done = () => router.replace(complete === "fit" || complete === "try_on" ? "/(tabs)/fits" : "/(tabs)/rack");

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: 18, paddingBottom: 48, gap: 16 }}>
      <Image source={uri} style={{ width: "100%", aspectRatio: 0.8, backgroundColor: colors.wash, borderColor: colors.line, borderWidth: 1 }} contentFit="cover" />
      <Panel tint={intent === "just_trying" ? colors.wash : colors.surface}>
        <Text selectable style={{ color: colors.plum, fontWeight: "900", textTransform: "uppercase", fontSize: 12 }}>{intent === "just_trying" ? "Just trying" : "I own this"}</Text>
        <Text selectable style={{ color: colors.ink, fontSize: 18, fontWeight: "900" }}>{intent === "just_trying" ? "Compare it with your closet" : "Let the agent place it"}</Text>
        <Text selectable style={{ color: colors.muted, lineHeight: 21 }}>{intent === "just_trying" ? "This stays out of your rack. You’ll get compatibility feedback and familiar closet anchors." : "The visual router will decide whether to add one piece or record a full fit."}</Text>
      </Panel>
      {route?.needsReview && !complete ? <Panel tint="#FFFCE9"><Text selectable style={{ color: colors.ink, fontSize: 18, fontWeight: "900" }}>A quick nudge</Text><Text selectable style={{ color: colors.muted, lineHeight: 21 }}>{route.rationale} What should this be treated as?</Text><View style={{ flexDirection: "row", gap: 10 }}>{([ ["single_piece", "One piece"], ["full_fit", "Full fit"] ] as const).map(([scope, label]) => <Pressable key={scope} onPress={() => setScopeOverride(scope)} style={{ flex: 1, borderColor: colors.line, borderWidth: 1, padding: 12, backgroundColor: effectiveScope === scope ? colors.lime : colors.surface, alignItems: "center" }}><Text style={{ color: colors.ink, fontWeight: "900" }}>{label}</Text></Pressable>)}</View><Pressable disabled={!effectiveScope} onPress={continueAfterReview} style={{ backgroundColor: colors.ink, padding: 14, alignItems: "center", opacity: effectiveScope ? 1 : 0.5 }}><Text style={{ color: "white", fontWeight: "900" }}>Continue</Text></Pressable></Panel> : null}
      {result && complete === "try_on" ? <View style={{ gap: 14 }}><Panel tint={!result.evaluation || result.evaluation.score >= 50 ? "#EDF5E9" : "#F8E6EE"}><View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" }}><View style={{ flex: 1 }}><Text selectable style={{ color: colors.plum, fontWeight: "900", fontSize: 12, textTransform: "uppercase" }}>Closet compatibility</Text><Text selectable style={{ color: colors.ink, fontSize: 23, fontWeight: "900", marginTop: 4 }}>{verdict}</Text></View>{result.evaluation ? <Text selectable style={{ color: colors.ink, fontSize: 38, fontWeight: "900" }}>{result.evaluation.score}<Text style={{ fontSize: 15 }}>/100</Text></Text> : null}</View><Text selectable style={{ color: colors.ink, lineHeight: 22 }}>{result.evaluation?.explanation ?? result.message ?? result.candidate.description}</Text></Panel>{result.similarItems.length ? <Panel><Text selectable style={{ color: colors.ink, fontWeight: "900" }}>Closet anchors</Text><View style={{ flexDirection: "row", gap: 9 }}>{result.similarItems.slice(0, 3).map((item) => <View key={item.id} style={{ flex: 1, gap: 5 }}><Image source={item.imageUrl} style={{ width: "100%", aspectRatio: 1, backgroundColor: colors.wash }} contentFit="cover" /><Text numberOfLines={1} style={{ color: colors.ink, fontWeight: "800", fontSize: 11 }}>{item.category ?? "Piece"}</Text></View>)}</View></Panel> : null}</View> : null}
      {complete && complete !== "try_on" ? <Panel tint="#EDF5E9"><Text selectable style={{ color: colors.success, fontSize: 20, fontWeight: "900" }}>{complete === "fit" ? "Fit recorded" : "Piece added"}</Text><Text selectable style={{ color: colors.ink }}>{complete === "fit" ? "The agent is connecting detected garments to pieces it already remembers." : "It is now part of your rack and style memory."}</Text></Panel> : null}
      {error ? <ErrorPanel message={error} /> : null}
      {!route && !complete ? <Pressable disabled={Boolean(status)} onPress={analyze} style={{ backgroundColor: colors.lime, borderColor: colors.line, borderWidth: 1, padding: 15, alignItems: "center", opacity: status ? 0.7 : 1 }}>{status ? <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}><ActivityIndicator color={colors.ink} /><Text style={{ color: colors.ink, fontWeight: "900" }}>{status}</Text></View> : <Text style={{ color: colors.ink, fontWeight: "900" }}>{!isSignedIn ? "Sign in to save this fit" : intent === "just_trying" ? "Try it with my wardrobe" : "Add to Wardrobe"}</Text>}</Pressable> : null}
      {status && route ? <View style={{ flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 10, padding: 14 }}><ActivityIndicator color={colors.plum} /><Text selectable style={{ flex: 1, color: colors.muted, fontWeight: "800" }}>{status}</Text></View> : null}
      {complete ? <Pressable onPress={done} style={{ backgroundColor: colors.ink, padding: 15, alignItems: "center" }}><Text style={{ color: "white", fontWeight: "900" }}>Done</Text></Pressable> : null}
      {!status && !complete ? <Pressable onPress={() => router.back()} style={{ alignItems: "center", padding: 10 }}><Text style={{ color: colors.muted, fontWeight: "800" }}>Retake or choose another</Text></Pressable> : null}
    </ScrollView>
  );
}
