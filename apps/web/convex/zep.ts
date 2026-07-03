"use node";

import { Zep, ZepClient } from "@getzep/zep-cloud";
import { wardrobeEdgeTypes, wardrobeEntityTypes } from "./zepOntology";

const apiKey = process.env.ZEP_KEY;
const zepClient = apiKey ? new ZepClient({ apiKey }) : null;

const ensureClient = () => {
  if (!zepClient) {
    throw new Error("ZEP_KEY is not set");
  }
  return zepClient;
};

const mainThreadId = (userId: string) => `session_${userId}_main`;

const isNotFoundError = (error: unknown) => error instanceof Zep.NotFoundError;

const ensureUser = async (client: ZepClient, userId: string, metadata?: Record<string, unknown>) => {
  try {
    const user = await client.user.get(userId);
    if (metadata) {
      return client.user.update(userId, { metadata });
    }
    return user;
  } catch (error) {
    if (!isNotFoundError(error)) throw error;
    return client.user.add({ userId, metadata });
  }
};

const ensureMainThread = async (client: ZepClient, userId: string) => {
  const threadId = mainThreadId(userId);

  try {
    await client.thread.get(threadId, { limit: 1 });
  } catch (error) {
    if (!isNotFoundError(error)) throw error;
    await client.thread.create({ threadId, userId });
  }

  return threadId;
};

const ensureUserAndMainThread = async (
  client: ZepClient,
  userId: string,
  metadata?: Record<string, unknown>
) => {
  await ensureUser(client, userId, metadata);
  return ensureMainThread(client, userId);
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
    const threadId = await ensureUserAndMainThread(client, userId);
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

export const deleteWardrobeItemMemory = async (
  userId: string,
  description: string,
  reason: string
) => {
  if (!apiKey) return;

  const client = ensureClient();
  const message = `I removed an item from my wardrobe: "${description}". Reason: ${reason}.`;
  const threadId = await ensureUserAndMainThread(client, userId);

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

  const metadata = {
    bio: profile.bio ?? undefined,
    skin_tone: profile.skinTone ?? undefined,
    hair_color: profile.hairColor ?? undefined,
  };

  const existingUser = await ensureUser(client, userId);
  const previousMetadata =
    typeof existingUser === "object" &&
    existingUser !== null &&
    "metadata" in existingUser &&
    typeof existingUser.metadata === "object" &&
    existingUser.metadata !== null
      ? { ...existingUser.metadata }
      : {};

  const message = `My profile details:\nBio: ${profile.bio ?? "N/A"}\nSkin Tone: ${profile.skinTone ?? "N/A"}\nHair Color: ${profile.hairColor ?? "N/A"}`;

  try {
    const threadId = await ensureUserAndMainThread(client, userId, metadata);
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

export const setWardrobeOntology = async (targets?: { userIds?: string[]; graphIds?: string[] }) => {
  if (!apiKey) return;

  const client = ensureClient();
  await client.graph.setOntology(wardrobeEntityTypes, wardrobeEdgeTypes, targets);
};
