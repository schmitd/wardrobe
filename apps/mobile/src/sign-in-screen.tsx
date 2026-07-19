import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useAuth, useSignIn, useSignUp, useSSO } from "@clerk/expo";
import { Effect } from "effect";
import * as AuthSession from "expo-auth-session";
import { Redirect, useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors } from "@/theme";

WebBrowser.maybeCompleteAuthSession();

type EmailFlow = "sign_in" | "sign_up";
type Step = "choose" | "email" | "code";

type ClerkLikeError = {
  code?: string;
  longMessage?: string;
  message?: string;
};

const errorMessage = (error: unknown, fallback: string) => {
  if (typeof error !== "object" || error === null) return fallback;
  const clerkError = error as ClerkLikeError;
  return clerkError.longMessage || clerkError.message || fallback;
};

const isMissingAccount = (error: ClerkLikeError) =>
  error.code === "form_identifier_not_found" || error.code === "identifier_not_found";

export function SignInScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isSignedIn } = useAuth({ treatPendingAsSignedOut: false });
  const { startSSOFlow } = useSSO();
  const { signIn } = useSignIn();
  const { signUp } = useSignUp();
  const [step, setStep] = useState<Step>("choose");
  const [emailFlow, setEmailFlow] = useState<EmailFlow>("sign_in");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (Platform.OS !== "android") return;
    void WebBrowser.warmUpAsync();
    return () => { void WebBrowser.coolDownAsync(); };
  }, []);

  if (isSignedIn) return <Redirect href="/(tabs)/rack" />;

  const run = (task: () => Promise<void>, fallback: string) => {
    setBusy(true);
    setError(null);
    void Effect.runPromise(Effect.tryPromise({ try: task, catch: (cause) => cause }).pipe(
      Effect.match({
        onFailure: (cause) => { setError(errorMessage(cause, fallback)); setBusy(false); },
        onSuccess: () => { setBusy(false); },
      })
    ));
  };

  const continueWithGoogle = () => run(async () => {
    const redirectUrl = AuthSession.makeRedirectUri({ scheme: "wardrobe", path: "continue" });
    const result = await startSSOFlow({ strategy: "oauth_google", redirectUrl });
    if (!result.createdSessionId || !result.setActive) {
      if (result.authSessionResult?.type === "cancel" || result.authSessionResult?.type === "dismiss") return;
      throw new Error("Google sign-in did not finish. Please try again.");
    }
    await result.setActive({
      session: result.createdSessionId,
      navigate: async () => { router.replace("/(tabs)/rack"); },
    });
  }, "Google sign-in could not start. Please try again.");

  const sendCode = () => run(async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !normalizedEmail.includes("@")) {
      throw new Error("Enter a valid email address.");
    }

    const signInResult = await signIn.emailCode.sendCode({ emailAddress: normalizedEmail });
    if (!signInResult.error) {
      setEmailFlow("sign_in");
      setStep("code");
      return;
    }
    if (!isMissingAccount(signInResult.error)) throw signInResult.error;

    const createResult = await signUp.create({ emailAddress: normalizedEmail, transfer: true });
    if (createResult.error) throw createResult.error;
    const verificationResult = await signUp.verifications.sendEmailCode();
    if (verificationResult.error) throw verificationResult.error;
    setEmailFlow("sign_up");
    setStep("code");
  }, "We could not send a sign-in code. Please try again.");

  const verifyCode = () => run(async () => {
    const normalizedCode = code.replace(/\s/g, "");
    if (!normalizedCode) throw new Error("Enter the code from your email.");
    const result = emailFlow === "sign_in"
      ? await signIn.emailCode.verifyCode({ code: normalizedCode })
      : await signUp.verifications.verifyEmailCode({ code: normalizedCode });
    if (result.error) throw result.error;

    const finalizeResult = emailFlow === "sign_in"
      ? await signIn.finalize({ navigate: async () => { router.replace("/(tabs)/rack"); } })
      : await signUp.finalize({ navigate: async () => { router.replace("/(tabs)/rack"); } });
    if (finalizeResult.error) throw finalizeResult.error;
  }, "That code could not be verified. Check it and try again.");

  const reset = () => {
    setStep("choose");
    setCode("");
    setError(null);
    void signIn.reset();
    void signUp.reset();
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.paper }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ flexGrow: 1, paddingTop: Math.max(insets.top, 20), paddingBottom: Math.max(insets.bottom, 24), paddingHorizontal: 22 }}
      >
        <View style={{ flex: 1, justifyContent: "space-between", gap: 28 }}>
          <View style={{ gap: 28 }}>
            <View style={{ gap: 10, paddingTop: 12 }}>
              <View style={{ width: 46, height: 46, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.lime, alignItems: "center", justifyContent: "center" }}>
                <MaterialCommunityIcons name="tshirt-crew-outline" size={27} color={colors.ink} />
              </View>
              <Text selectable style={{ color: colors.ink, fontSize: 38, lineHeight: 41, fontWeight: "900", maxWidth: 330 }}>
                Your wardrobe, remembered.
              </Text>
              <Text selectable style={{ color: colors.muted, fontSize: 16, lineHeight: 24, maxWidth: 420 }}>
                Sign in to keep fits, pieces, and inspiration connected to the same style memory.
              </Text>
            </View>

            <View style={{ borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, padding: 18, gap: 16, shadowColor: colors.line, shadowOpacity: 0.14, shadowRadius: 0, shadowOffset: { width: 4, height: 4 }, elevation: 2 }}>
              {step === "choose" ? (
                <>
                  <Text selectable style={{ color: colors.ink, fontSize: 22, fontWeight: "900" }}>Come back to your closet</Text>
                  <Text selectable style={{ color: colors.muted, lineHeight: 21 }}>Use the same account as the web app. New here? Either option creates your account as part of the flow.</Text>
                  <Pressable
                    accessibilityRole="button"
                    disabled={busy}
                    onPress={continueWithGoogle}
                    style={({ pressed }) => ({ minHeight: 52, borderWidth: 1, borderColor: colors.line, backgroundColor: pressed ? colors.wash : "white", paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12, opacity: busy ? 0.65 : 1 })}
                  >
                    {busy ? <ActivityIndicator color={colors.ink} /> : <MaterialCommunityIcons name="google" size={22} color="#4285F4" />}
                    <Text style={{ color: colors.ink, fontSize: 16, fontWeight: "900" }}>{busy ? "Opening Google…" : "Continue with Google"}</Text>
                  </Pressable>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <View style={{ flex: 1, height: 1, backgroundColor: colors.washStrong }} />
                    <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "700" }}>OR</Text>
                    <View style={{ flex: 1, height: 1, backgroundColor: colors.washStrong }} />
                  </View>
                  <Pressable accessibilityRole="button" disabled={busy} onPress={() => { setStep("email"); setError(null); }} style={{ minHeight: 50, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.lime, alignItems: "center", justifyContent: "center" }}>
                    <Text style={{ color: colors.ink, fontSize: 16, fontWeight: "900" }}>Continue with email</Text>
                  </Pressable>
                </>
              ) : step === "email" ? (
                <>
                  <Text selectable style={{ color: colors.ink, fontSize: 22, fontWeight: "900" }}>Your email</Text>
                  <Text selectable style={{ color: colors.muted, lineHeight: 21 }}>We’ll send a one-time code. No password to remember.</Text>
                  <TextInput
                    accessibilityLabel="Email address"
                    autoCapitalize="none"
                    autoComplete="email"
                    autoCorrect={false}
                    editable={!busy}
                    keyboardType="email-address"
                    onChangeText={setEmail}
                    onSubmitEditing={sendCode}
                    placeholder="you@example.com"
                    placeholderTextColor="#8B758E"
                    returnKeyType="send"
                    style={{ minHeight: 52, borderWidth: 1, borderColor: colors.line, backgroundColor: "white", color: colors.ink, paddingHorizontal: 14, fontSize: 16 }}
                    value={email}
                  />
                  <Pressable disabled={busy} onPress={sendCode} style={{ minHeight: 50, backgroundColor: colors.lime, borderWidth: 1, borderColor: colors.line, alignItems: "center", justifyContent: "center", opacity: busy ? 0.65 : 1 }}>
                    {busy ? <ActivityIndicator color={colors.ink} /> : <Text style={{ color: colors.ink, fontSize: 16, fontWeight: "900" }}>Send code</Text>}
                  </Pressable>
                  <Pressable disabled={busy} onPress={reset} style={{ alignSelf: "center", padding: 8 }}><Text style={{ color: colors.plum, fontWeight: "800" }}>Back</Text></Pressable>
                </>
              ) : (
                <>
                  <Text selectable style={{ color: colors.ink, fontSize: 22, fontWeight: "900" }}>Check your email</Text>
                  <Text selectable style={{ color: colors.muted, lineHeight: 21 }}>Enter the code sent to {email.trim().toLowerCase()}.</Text>
                  <TextInput
                    accessibilityLabel="Verification code"
                    autoComplete="one-time-code"
                    editable={!busy}
                    keyboardType="number-pad"
                    maxLength={8}
                    onChangeText={setCode}
                    onSubmitEditing={verifyCode}
                    placeholder="123456"
                    placeholderTextColor="#8B758E"
                    returnKeyType="done"
                    style={{ minHeight: 56, borderWidth: 1, borderColor: colors.line, backgroundColor: "white", color: colors.ink, paddingHorizontal: 14, fontSize: 24, fontWeight: "800", letterSpacing: 5, textAlign: "center" }}
                    value={code}
                  />
                  <Pressable disabled={busy} onPress={verifyCode} style={{ minHeight: 50, backgroundColor: colors.lime, borderWidth: 1, borderColor: colors.line, alignItems: "center", justifyContent: "center", opacity: busy ? 0.65 : 1 }}>
                    {busy ? <ActivityIndicator color={colors.ink} /> : <Text style={{ color: colors.ink, fontSize: 16, fontWeight: "900" }}>Verify and continue</Text>}
                  </Pressable>
                  <Pressable disabled={busy} onPress={() => { setStep("email"); setCode(""); setError(null); }} style={{ alignSelf: "center", padding: 8 }}><Text style={{ color: colors.plum, fontWeight: "800" }}>Use a different email</Text></Pressable>
                </>
              )}

              {error ? <View accessibilityRole="alert" style={{ borderWidth: 1, borderColor: colors.danger, backgroundColor: "#F8E6EE", padding: 12 }}><Text selectable style={{ color: colors.danger, fontWeight: "800", lineHeight: 20 }}>{error}</Text></View> : null}
            </View>
          </View>

          <Text selectable style={{ color: colors.muted, fontSize: 12, lineHeight: 18, textAlign: "center", paddingHorizontal: 18 }}>
            By continuing, you agree to keep your private wardrobe connected to your account.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
