const apiKey = process.env.ZEP_KEY;
const apiBaseUrl = process.env.ZEP_API_BASE_URL ?? "https://api.getzep.com/api/v2";
const COMPATIBILITY_CONTEXT_CHAR_LIMIT = 2800;
const SIGNAL_LIMIT = 8;

const COMPATIBILITY_ONTOLOGY = [
  "preference_positive (likes, favorites, repeat wears)",
  "preference_negative (dislikes, regrets, discards, returns)",
  "lifecycle_event (donated, sold, archived, replaced)",
  "style_constraint (occasion, weather, fit-comfort, maintenance)",
];

const negativePreferencePattern =
  /\b(dislike|disliked|hate|hated|avoid|avoided|regret|returned|donated|discarded|clash|itchy|uncomfortable)\b/i;
const positivePreferencePattern =
  /\b(love|loved|favorite|favourite|kept|keeper|versatile|works well|complimented|go-to)\b/i;
const lifecycleEventPattern =
  /\b(discarded|donated|sold|returned|archived|replaced|removed)\b/i;
const styleConstraintPattern =
  /\b(occasion|event|office|work|formal|casual|season|winter|summer|rain|travel|laundry|dry clean|fit|comfort)\b/i;

type ZepEntityEdge = {
  uuid: string;
  fact: string;
  score?: number;
  relevance?: number;
};

type ZepEntityNode = {
  uuid: string;
  name: string;
  summary: string;
  score?: number;
  relevance?: number;
};

type ZepEpisode = {
  uuid: string;
  content: string;
  score?: number;
  relevance?: number;
};

type ZepGraphSearchResults = {
  edges?: ZepEntityEdge[];
  nodes?: ZepEntityNode[];
  episodes?: ZepEpisode[];
};

type ZepThreadContextResponse = {
  context?: string;
};

const sessionThreadId = (userId: string) => `session_${userId}_main`;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const trimText = (text: string | null | undefined) => {
  if (!text) return "";
  return text.replace(/\s+/g, " ").trim();
};

const weightFromRankSignals = (score?: number, relevance?: number) => {
  const scored = typeof score === "number" && Number.isFinite(score) ? score : 0.45;
  const relevant = typeof relevance === "number" && Number.isFinite(relevance) ? relevance : scored;
  return clamp((scored + relevant) / 2, 0, 1);
};

const dedupeByUuid = <T extends { uuid: string }>(items: readonly T[]) => {
  const map = new Map<string, T>();
  for (const item of items) {
    if (!map.has(item.uuid)) {
      map.set(item.uuid, item);
    }
  }
  return [...map.values()];
};

const classifyInfluenceKind = (text: string) => {
  if (negativePreferencePattern.test(text)) return "preference_negative";
  if (positivePreferencePattern.test(text)) return "preference_positive";
  if (lifecycleEventPattern.test(text)) return "lifecycle_event";
  if (styleConstraintPattern.test(text)) return "style_constraint";
  return null;
};

const truncateText = (text: string, maxChars = 220) =>
  text.length > maxChars ? `${text.slice(0, maxChars - 3)}...` : text;

const limitContext = (text: string | null): string | null => {
  if (!text) return null;
  const compact = text.trim();
  if (!compact) return null;
  return compact.length > COMPATIBILITY_CONTEXT_CHAR_LIMIT
    ? `${compact.slice(0, COMPATIBILITY_CONTEXT_CHAR_LIMIT - 3)}...`
    : compact;
};

const zepFetch = async <T>(
  path: string,
  options: { method: "GET" | "POST" | "PATCH"; body?: unknown; allowNotFound?: boolean },
): Promise<T | null> => {
  if (!apiKey) return null;

  const url = `${apiBaseUrl.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
  const response = await fetch(url, {
    method: options.method,
    headers: {
      Authorization: `Api-Key ${apiKey}`,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (response.status === 404 && options.allowNotFound) {
    return null;
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(
      `Zep API request failed (${response.status} ${response.statusText}) ${path}: ${errorText}`.trim(),
    );
  }

  return (await response.json()) as T;
};

const ensureThread = async (threadId: string, userId: string) => {
  try {
    await zepFetch("threads", {
      method: "POST",
      body: {
        threadId,
        userId,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("400") || message.includes("409")) return;
    throw error;
  }
};

const addThreadMessage = async (
  userId: string,
  message: string,
  metadata: Record<string, unknown>,
) => {
  if (!apiKey) return;

  const threadId = sessionThreadId(userId);

  try {
    await zepFetch(`threads/${encodeURIComponent(threadId)}/messages`, {
      method: "POST",
      body: {
        messages: [
          {
            role: "user",
            content: message,
            metadata,
          },
        ],
      },
    });
  } catch (error) {
    const messageText = error instanceof Error ? error.message : String(error);
    if (!messageText.includes("404")) throw error;

    await ensureThread(threadId, userId);
    await zepFetch(`threads/${encodeURIComponent(threadId)}/messages`, {
      method: "POST",
      body: {
        messages: [
          {
            role: "user",
            content: message,
            metadata,
          },
        ],
      },
    });
  }
};

const composeGraphContext = (
  edges: readonly ZepEntityEdge[],
  nodes: readonly ZepEntityNode[],
  episodes: readonly ZepEpisode[],
) => {
  const parts: string[] = [];

  if (edges.length > 0) {
    parts.push(
      `Facts:\n${edges
        .slice(0, 12)
        .map((edge, index) => `${index + 1}. ${trimText(edge.fact)}`)
        .join("\n")}`,
    );
  }

  if (nodes.length > 0) {
    parts.push(
      `Entities:\n${nodes
        .slice(0, 8)
        .map((node, index) => `${index + 1}. ${trimText(node.name)} - ${trimText(node.summary)}`)
        .join("\n")}`,
    );
  }

  if (episodes.length > 0) {
    parts.push(
      `Episodes:\n${episodes
        .slice(0, 8)
        .map((episode, index) => `${index + 1}. ${trimText(episode.content)}`)
        .join("\n")}`,
    );
  }

  return parts.join("\n\n");
};

export type CompatibilityContextInput = {
  candidateCategory?: string | null;
  candidateDescription: string;
  candidateStyleTags: readonly string[];
  similarItems: readonly { category: string | null; description: string | null }[];
  dissimilarItems: readonly { category: string | null; description: string | null }[];
};

export type ZepInfluenceSignal = {
  kind: string;
  signal: string;
  weight: number;
};

export type CompatibilityContextResult = {
  context: string | null;
  influenceSignals: ZepInfluenceSignal[];
  ontology: string[];
};

const buildGraphQuery = (input: CompatibilityContextInput) => {
  const candidate = [
    input.candidateCategory ? `category ${input.candidateCategory}` : "",
    input.candidateDescription,
    input.candidateStyleTags.length > 0
      ? `style tags ${input.candidateStyleTags.join(", ")}`
      : "",
  ]
    .filter((part) => part.trim().length > 0)
    .join(". ");

  const similar = input.similarItems
    .map((item) => trimText(item.description) || trimText(item.category))
    .filter((item) => item.length > 0)
    .slice(0, 5)
    .join("; ");

  const dissimilar = input.dissimilarItems
    .map((item) => trimText(item.description) || trimText(item.category))
    .filter((item) => item.length > 0)
    .slice(0, 3)
    .join("; ");

  return [
    candidate,
    similar ? `closest wardrobe items: ${similar}` : "",
    dissimilar ? `clashing wardrobe items: ${dissimilar}` : "",
    "preferences dislikes discards comfort occasion constraints",
  ]
    .filter((part) => part.trim().length > 0)
    .join(". ");
};

const makeSignal = (input: { kind: string; signal: string; weight: number }) => ({
  kind: input.kind,
  signal: truncateText(input.signal),
  weight: clamp(input.weight, 0, 1),
});

const extractInfluenceSignals = (input: {
  edges: readonly ZepEntityEdge[];
  episodes: readonly ZepEpisode[];
  nodes: readonly ZepEntityNode[];
}) => {
  const collected: ZepInfluenceSignal[] = [];

  for (const edge of input.edges) {
    const text = trimText(edge.fact);
    if (!text) continue;

    const kind = classifyInfluenceKind(text);
    if (!kind) continue;

    collected.push(
      makeSignal({
        kind,
        signal: text,
        weight: weightFromRankSignals(edge.score, edge.relevance),
      }),
    );
  }

  for (const episode of input.episodes) {
    const text = trimText(episode.content);
    if (!text) continue;

    const kind = classifyInfluenceKind(text);
    if (!kind) continue;

    collected.push(
      makeSignal({
        kind,
        signal: text,
        weight: weightFromRankSignals(episode.score, episode.relevance),
      }),
    );
  }

  for (const node of input.nodes) {
    const text = trimText(node.summary) || trimText(node.name);
    if (!text) continue;

    const kind = classifyInfluenceKind(text);
    if (!kind) continue;

    collected.push(
      makeSignal({
        kind,
        signal: text,
        weight: weightFromRankSignals(node.score, node.relevance),
      }),
    );
  }

  const deduped = new Map<string, ZepInfluenceSignal>();
  for (const signal of collected) {
    const key = `${signal.kind}:${signal.signal.toLowerCase()}`;
    const existing = deduped.get(key);
    if (!existing || signal.weight > existing.weight) {
      deduped.set(key, signal);
    }
  }

  return [...deduped.values()]
    .sort((a, b) => b.weight - a.weight)
    .slice(0, SIGNAL_LIMIT);
};

const searchGraph = async (
  userId: string,
  query: string,
  scope: "edges" | "nodes" | "episodes",
  limit: number,
) => {
  try {
    return await zepFetch<ZepGraphSearchResults>("graph/search", {
      method: "POST",
      body: {
        userId,
        query,
        scope,
        limit,
      },
    });
  } catch (error) {
    console.warn(`zep.getCompatibilityContext.${scope}.failed`, {
      userId,
      message: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
};

export const getCompatibilityContext = async (
  userId: string,
  input: CompatibilityContextInput,
): Promise<CompatibilityContextResult> => {
  if (!apiKey) {
    return {
      context: null,
      influenceSignals: [],
      ontology: [...COMPATIBILITY_ONTOLOGY],
    };
  }

  const query = buildGraphQuery(input);

  const [threadContextResponse, edgeResult, nodeResult, episodeResult] = await Promise.all([
    zepFetch<ZepThreadContextResponse>(
      `threads/${encodeURIComponent(sessionThreadId(userId))}/context?mode=basic`,
      { method: "GET", allowNotFound: true },
    ).catch((error) => {
      console.warn("zep.getCompatibilityContext.thread.failed", {
        userId,
        message: error instanceof Error ? error.message : String(error),
      });
      return null;
    }),
    searchGraph(userId, query, "edges", 12),
    searchGraph(userId, query, "nodes", 8),
    searchGraph(userId, query, "episodes", 8),
  ]);

  const edges = dedupeByUuid([
    ...(edgeResult?.edges ?? []),
    ...(nodeResult?.edges ?? []),
    ...(episodeResult?.edges ?? []),
  ]);
  const nodes = dedupeByUuid([
    ...(edgeResult?.nodes ?? []),
    ...(nodeResult?.nodes ?? []),
    ...(episodeResult?.nodes ?? []),
  ]);
  const episodes = dedupeByUuid([
    ...(edgeResult?.episodes ?? []),
    ...(nodeResult?.episodes ?? []),
    ...(episodeResult?.episodes ?? []),
  ]);

  const graphContext =
    edges.length > 0 || nodes.length > 0 || episodes.length > 0
      ? composeGraphContext(edges, nodes, episodes)
      : null;
  const mergedContext = limitContext(
    [threadContextResponse?.context ?? null, graphContext]
      .filter((value) => value && value.trim().length > 0)
      .join("\n\n"),
  );

  return {
    context: mergedContext,
    influenceSignals: extractInfluenceSignals({ edges, episodes, nodes }),
    ontology: [...COMPATIBILITY_ONTOLOGY],
  };
};

export const addWardrobeItemsMemory = async (
  userId: string,
  items: {
    category?: string | null;
    description?: string | null;
    styleTags?: readonly string[] | null;
  }[],
) => {
  if (!apiKey) return;

  const itemDescriptions = items
    .map(
      (item) =>
        `- ${item.category ?? "Item"}: ${item.description ?? ""} (Style: ${(item.styleTags ?? []).join(", ")})`,
    )
    .join("\n");

  const message = `I just added the following items to my wardrobe:\n${itemDescriptions}`;

  try {
    await addThreadMessage(userId, message, { type: "batch_upload", count: items.length });
  } catch (error) {
    console.error("zep.addWardrobeItemsMemory.failed", {
      userId,
      count: items.length,
      message,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

export const deleteWardrobeItemMemory = async (
  userId: string,
  description: string,
  reason: string,
) => {
  if (!apiKey) return;

  const message = `I removed an item from my wardrobe: "${description}". Reason: ${reason}.`;
  try {
    await addThreadMessage(userId, message, { type: "item_deletion", reason });
  } catch (error) {
    console.error("zep.deleteWardrobeItemMemory.failed", {
      userId,
      reason,
      message,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

export const updateProfileMemory = async (
  userId: string,
  profile: { bio?: string | null; skinTone?: string | null; hairColor?: string | null },
) => {
  if (!apiKey) return;

  const metadata = {
    bio: profile.bio ?? undefined,
    skin_tone: profile.skinTone ?? undefined,
    hair_color: profile.hairColor ?? undefined,
  };

  try {
    await zepFetch(`users/${encodeURIComponent(userId)}`, {
      method: "PATCH",
      body: {
        metadata,
      },
    });
  } catch (error) {
    console.error("zep.updateProfileMemory.user.failed", {
      userId,
      metadata,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  const message = `My profile details:\nBio: ${profile.bio ?? "N/A"}\nSkin Tone: ${profile.skinTone ?? "N/A"}\nHair Color: ${profile.hairColor ?? "N/A"}`;

  try {
    await addThreadMessage(userId, message, { type: "profile_update" });
  } catch (error) {
    console.error("zep.updateProfileMemory.failed", {
      userId,
      metadata,
      message,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
