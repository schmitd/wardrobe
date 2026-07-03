import { useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View, useWindowDimensions } from "react-native";
import { createWardrobeContextClient } from "@wardrobe/context-client";
import type { StyleFitRequest, StyleFitResponse } from "@wardrobe/shared";

const apiBaseUrl = process.env.EXPO_PUBLIC_WARDROBE_API_URL ?? "http://localhost:3000";
const apiToken = process.env.EXPO_PUBLIC_WARDROBE_API_TOKEN;

export default function HomeScreen() {
  const { width } = useWindowDimensions();
  const [imageUrl, setImageUrl] = useState("");
  const [pageUrl, setPageUrl] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [userContext, setUserContext] = useState("");
  const [result, setResult] = useState<StyleFitResponse | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const checkFit = async () => {
    setStatus("Checking fit...");
    setResult(null);
    try {
      const client = createWardrobeContextClient({ baseUrl: apiBaseUrl, token: apiToken });
      const input: StyleFitRequest = {
        imageUrl: imageUrl.trim() || undefined,
        pageUrl: pageUrl.trim() || undefined,
        title: title.trim() || undefined,
        description: description.trim() || undefined,
        userContext: userContext.trim() || undefined,
      };

      setResult(await client.checkStyleFit(input));
      setStatus(null);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Style check failed.");
    }
  };

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: 20, gap: 16 }}>
      <View style={{ gap: 8 }}>
        <Text selectable style={{ fontSize: width > 430 ? 32 : 28, fontWeight: "800", color: "#310A31" }}>
          Style fit check
        </Text>
        <Text selectable style={{ color: "#475569", lineHeight: 22 }}>
          Capture a shopping candidate and check it against the Wardrobe context layer.
        </Text>
      </View>

      <View style={{ gap: 10 }}>
        <Text selectable style={{ fontWeight: "700" }}>
          Product title
        </Text>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="Boxy denim overshirt"
          style={{ borderWidth: 2, borderColor: "#111827", padding: 12, borderRadius: 8 }}
        />
      </View>

      <View style={{ gap: 10 }}>
        <Text selectable style={{ fontWeight: "700" }}>
          Image URL
        </Text>
        <TextInput
          value={imageUrl}
          onChangeText={setImageUrl}
          placeholder="https://..."
          autoCapitalize="none"
          style={{ borderWidth: 2, borderColor: "#111827", padding: 12, borderRadius: 8 }}
        />
      </View>

      <View style={{ gap: 10 }}>
        <Text selectable style={{ fontWeight: "700" }}>
          Product page URL
        </Text>
        <TextInput
          value={pageUrl}
          onChangeText={setPageUrl}
          placeholder="https://..."
          autoCapitalize="none"
          style={{ borderWidth: 2, borderColor: "#111827", padding: 12, borderRadius: 8 }}
        />
      </View>

      <View style={{ gap: 10 }}>
        <Text selectable style={{ fontWeight: "700" }}>
          Product description
        </Text>
        <TextInput
          value={description}
          onChangeText={setDescription}
          placeholder="Fabric, silhouette, color, brand notes..."
          multiline
          textAlignVertical="top"
          style={{ borderWidth: 2, borderColor: "#111827", padding: 12, borderRadius: 8, minHeight: 92 }}
        />
      </View>

      <View style={{ gap: 10 }}>
        <Text selectable style={{ fontWeight: "700" }}>
          Wardrobe context
        </Text>
        <TextInput
          value={userContext}
          onChangeText={setUserContext}
          placeholder="Current closet goals, color season, preferred silhouettes..."
          multiline
          textAlignVertical="top"
          style={{ borderWidth: 2, borderColor: "#111827", padding: 12, borderRadius: 8, minHeight: 92 }}
        />
      </View>

      <Pressable
        onPress={checkFit}
        style={{ backgroundColor: "#310A31", padding: 14, borderRadius: 8, alignItems: "center" }}
      >
        <Text style={{ color: "white", fontWeight: "800" }}>Check fit</Text>
      </Pressable>

      {status ? <Text selectable>{status}</Text> : null}

      {result ? (
        <View style={{ gap: 10, borderWidth: 2, borderColor: "#111827", padding: 14, borderRadius: 8 }}>
          <Text selectable style={{ fontSize: 42, fontWeight: "900", color: "#310A31", fontVariant: ["tabular-nums"] }}>
            {result.score}%
          </Text>
          <Text selectable style={{ fontWeight: "800" }}>
            {result.verdict.replace("_", " ")}
          </Text>
          <Text selectable>{result.summary}</Text>
          {result.reasons.map((reason) => (
            <Text selectable key={reason}>
              - {reason}
            </Text>
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}
