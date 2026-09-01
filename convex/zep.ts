"use node";

import { ZepClient } from "@getzep/zep-cloud";

const apiKey = process.env.ZEP_KEY;
const zepClient = apiKey ? new ZepClient({ apiKey }) : null;

const ensureClient = () => {
  if (!zepClient) {
    throw new Error("ZEP_KEY is not set");
  }
  return zepClient;
};

const knownUsers = new Set<string>();
const knownThreads = new Set<string>();

const isNotFound = (error: unknown) =>
  typeof error === "object" &&
  error !== null &&
  "statusCode" in error &&
  error.statusCode === 404;

const ensureZepUser = async (client: ZepClient, userId: string) => {
  if (knownUsers.has(userId)) return;

  try {
    await client.user.get(userId);
  } catch (error) {
    if (!isNotFound(error)) throw error;
    await client.user.add({ userId });
  }
  knownUsers.add(userId);
};

const ensureMainThread = async (client: ZepClient, userId: string) => {
  const threadId = `session_${userId}_main`;
  if (knownThreads.has(threadId)) return threadId;

  await ensureZepUser(client, userId);
  try {
    await client.thread.get(threadId, { limit: 1 });
  } catch (error) {
    if (!isNotFound(error)) throw error;
    await client.thread.create({ threadId, userId });
  }
  knownThreads.add(threadId);
  return threadId;
};

export const addWardrobeItemsMemory = async (
  userId: string,
  items: { category?: string | null; description?: string | null; styleTags?: string[] | null }[]
) => {
  if (!apiKey) return;

  const itemDescriptions = items
    .map((item) =>
      `- ${item.category ?? "Item"}: ${item.description ?? ""} (Style: ${(item.styleTags ?? []).join(", ")})`
    )
    .join("\n");

  const message = `I just added the following items to my wardrobe:\n${itemDescriptions}`;
  const client = ensureClient();

  try {
    const threadId = await ensureMainThread(client, userId);
    await client.thread.addMessages(threadId, {
      messages: [
        {
          role: "user",
          content: message,
          metadata: { type: "batch_upload", count: items.length },
        },
      ],
    });
  } catch (error) {
    console.error("zep.addWardrobeItemsMemory.failed", {
      userId,
      count: items.length,
      message,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
};

export const addInspirationMemory = async (
  userId: string,
  inspiration: {
    inspirationId: string;
    sourceUrl?: string | null;
    note?: string | null;
    category?: string | null;
    description?: string | null;
    styleTags?: string[] | null;
  }
) => {
  if (!apiKey) return;

  const client = ensureClient();
  await ensureZepUser(client, userId);
  await client.graph.add({
    userId,
    type: "json",
    sourceDescription: "Wardrobe inspiration saved by the user",
    data: JSON.stringify({
      event: "inspiration_saved",
      membership: "inspiration",
      ...inspiration,
    }),
  });
};

export const addTryOnMemory = async (
  userId: string,
  tryOn: {
    category: string;
    description: string;
    styleTags: string[];
    score: number;
    verdict?: string | null;
    explanation: string;
    closetAnchors: string[];
  }
) => {
  if (!apiKey) return;

  const client = ensureClient();
  await ensureZepUser(client, userId);
  await client.graph.add({
    userId,
    type: "json",
    sourceDescription: "Temporary try-on compatibility result",
    data: JSON.stringify({
      event: "try_on_evaluated",
      membership: "temporary_candidate",
      savedToCloset: false,
      ...tryOn,
    }),
  });
};

export const searchStyleMemory = async (userId: string, query: string) => {
  if (!apiKey) return null;

  const client = ensureClient();
  await ensureZepUser(client, userId);
  const results = await client.graph.search({
    userId,
    query,
    limit: 8,
    scope: "edges",
  });

  const facts = (results.edges ?? []).map((edge) => edge.fact).filter(Boolean);
  const summaries = (results.nodes ?? []).map((node) => node.summary).filter(Boolean);
  const context = [...facts, ...summaries].slice(0, 10).join("\n");
  return context || null;
};

export const deleteWardrobeItemMemory = async (
  userId: string,
  description: string,
  reason: string
) => {
  if (!apiKey) return;

  const client = ensureClient();
  const message = `I removed an item from my wardrobe: "${description}". Reason: ${reason}.`;
  const threadId = await ensureMainThread(client, userId);

  await client.thread.addMessages(threadId, {
    messages: [
      {
        role: "user",
        content: message,
        metadata: { type: "item_deletion", reason },
      },
    ],
  });
};

export const updateProfileMemory = async (
  userId: string,
  profile: { bio?: string | null; skinTone?: string | null; hairColor?: string | null }
) => {
  if (!apiKey) return;

  const client = ensureClient();
  await ensureZepUser(client, userId);

  const metadata = {
    bio: profile.bio ?? undefined,
    skin_tone: profile.skinTone ?? undefined,
    hair_color: profile.hairColor ?? undefined,
  };

  const existingUser = await client.user.get(userId);
  const previousMetadata =
    typeof existingUser === "object" &&
    existingUser !== null &&
    "metadata" in existingUser &&
    typeof existingUser.metadata === "object" &&
    existingUser.metadata !== null
      ? { ...existingUser.metadata }
      : {};

  await client.user.update(userId, {
    metadata: {
      ...metadata,
    },
  });

  const message = `My profile details:\nBio: ${profile.bio ?? "N/A"}\nSkin Tone: ${profile.skinTone ?? "N/A"}\nHair Color: ${profile.hairColor ?? "N/A"}`;

  try {
    const threadId = await ensureMainThread(client, userId);
    await client.thread.addMessages(threadId, {
      messages: [
        {
          role: "user",
          content: message,
          metadata: { type: "profile_update" },
        },
      ],
    });
  } catch (error) {
    try {
      await client.user.update(userId, {
        metadata: {
          ...previousMetadata,
        },
      });
    } catch (rollbackError) {
      console.error("zep.updateProfileMemory.rollback.failed", {
        userId,
        previousMetadata,
        error: rollbackError instanceof Error ? rollbackError.message : String(rollbackError),
      });
    }

    console.error("zep.updateProfileMemory.failed", {
      userId,
      metadata,
      message,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
};
