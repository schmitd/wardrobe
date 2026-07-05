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

const addUserGraphEpisode = async (
  client: ZepClient,
  userId: string,
  input: {
    data: unknown;
    sourceDescription: string;
    createdAt?: number;
  }
) => {
  await ensureUser(client, userId);
  await client.graph.add({
    userId,
    type: "json",
    data: JSON.stringify(input.data),
    sourceDescription: input.sourceDescription,
    createdAt: new Date(input.createdAt ?? Date.now()).toISOString(),
  });
};

const wardrobeUserNodeName = (userId: string) => `Wardrobe user ${userId}`;

const addUserFactTriple = async (
  client: ZepClient,
  userId: string,
  input: {
    factName: string;
    fact: string;
    targetNodeName: string;
    targetNodeSummary?: string;
    targetNodeAttributes?: Record<string, string | number | boolean | null>;
    edgeAttributes?: Record<string, string | number | boolean | null>;
    createdAt?: number | null;
  }
) => {
  await ensureUser(client, userId);
  await client.graph.addFactTriple({
    userId,
    factName: input.factName,
    fact: input.fact,
    sourceNodeName: wardrobeUserNodeName(userId),
    sourceNodeSummary: "A Wardrobe app user.",
    targetNodeName: input.targetNodeName,
    targetNodeSummary: input.targetNodeSummary,
    targetNodeAttributes: input.targetNodeAttributes,
    edgeAttributes: input.edgeAttributes,
    createdAt: new Date(input.createdAt ?? Date.now()).toISOString(),
  });
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
    await addUserGraphEpisode(client, userId, {
      sourceDescription: "Wardrobe item upload",
      data: {
        event: "wardrobe_items_added",
        items: items.map((item) => ({
          category: item.category ?? null,
          description: item.description ?? null,
          styleTags: item.styleTags ?? [],
        })),
      },
    });
    await Promise.all(
      items.map((item) =>
        addUserFactTriple(client, userId, {
          factName: "OWNS_WARDROBE_ITEM",
          fact: `User owns wardrobe item: ${item.description ?? item.category ?? "Uncategorized item"}.`,
          targetNodeName: item.description ?? item.category ?? "Uncategorized wardrobe item",
          targetNodeSummary: item.description ?? item.category ?? "A wardrobe item.",
          targetNodeAttributes: {
            category: item.category ?? null,
            styleTags: item.styleTags?.join(", ") ?? null,
          },
          edgeAttributes: {
            source: "wardrobe_analysis",
          },
        })
      )
    );

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

export const addWardrobeItemCreatedMemory = async (
  userId: string,
  item: {
    itemId: string;
    clientFileName?: string | null;
    contentType?: string | null;
    createdAt?: number | null;
  }
) => {
  if (!apiKey) return;

  const client = ensureClient();
  const message = `I started adding a wardrobe item${item.clientFileName ? ` from ${item.clientFileName}` : ""}.`;

  try {
    await addUserGraphEpisode(client, userId, {
      sourceDescription: "Wardrobe item created",
      createdAt: item.createdAt ?? undefined,
      data: {
        event: "wardrobe_item_created",
        itemId: item.itemId,
        clientFileName: item.clientFileName ?? null,
        contentType: item.contentType ?? null,
        status: "queued_for_analysis",
      },
    });
    await addUserFactTriple(client, userId, {
      factName: "STARTED_ADDING_WARDROBE_ITEM",
      fact: `User started adding wardrobe item ${item.itemId}.`,
      targetNodeName: `Wardrobe item ${item.itemId}`,
      targetNodeSummary: item.clientFileName
        ? `A wardrobe item uploaded from ${item.clientFileName}.`
        : "A wardrobe item queued for analysis.",
      targetNodeAttributes: {
        itemId: item.itemId,
        clientFileName: item.clientFileName ?? null,
        contentType: item.contentType ?? null,
        status: "queued_for_analysis",
      },
      edgeAttributes: {
        source: "wardrobe_create",
      },
      createdAt: item.createdAt,
    });

    const threadId = await ensureUserAndMainThread(client, userId);
    await client.thread.addMessages(threadId, {
      messages: [
        {
          role: "user",
          content: message,
          metadata: {
            type: "item_created",
            itemId: item.itemId,
            clientFileName: item.clientFileName ?? undefined,
            contentType: item.contentType ?? undefined,
          },
        },
      ],
    });
  } catch (error) {
    console.error("zep.addWardrobeItemCreatedMemory.failed", {
      userId,
      item,
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

  await addUserGraphEpisode(client, userId, {
    sourceDescription: "Wardrobe item deletion",
    data: {
      event: "wardrobe_item_removed",
      description,
      reason,
    },
  });
  await addUserFactTriple(client, userId, {
    factName: "REMOVED_WARDROBE_ITEM",
    fact: `User removed wardrobe item: ${description}. Reason: ${reason}.`,
    targetNodeName: description,
    targetNodeSummary: `Removed wardrobe item. Reason: ${reason}.`,
    targetNodeAttributes: {
      description,
      removed: true,
      reason,
    },
    edgeAttributes: {
      source: "wardrobe_delete",
      reason,
    },
  });

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
    await addUserGraphEpisode(client, userId, {
      sourceDescription: "Wardrobe profile update",
      data: {
        event: "profile_updated",
        bio: profile.bio ?? null,
        skinTone: profile.skinTone ?? null,
        hairColor: profile.hairColor ?? null,
      },
    });
    await addUserFactTriple(client, userId, {
      factName: "HAS_STYLE_PROFILE",
      fact: `User has style profile: ${profile.bio ?? "No bio provided"}. Skin tone: ${profile.skinTone ?? "N/A"}. Hair color: ${profile.hairColor ?? "N/A"}.`,
      targetNodeName: "Wardrobe style profile",
      targetNodeSummary: profile.bio ?? "Wardrobe style profile.",
      targetNodeAttributes: {
        bio: profile.bio ?? null,
        skinTone: profile.skinTone ?? null,
        hairColor: profile.hairColor ?? null,
      },
      edgeAttributes: {
        source: "profile_update",
      },
    });

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

export const deleteUserMemory = async (userId: string) => {
  if (!apiKey) return { deleted: false as const, skipped: "missing_api_key" as const };

  const client = ensureClient();

  try {
    await client.user.delete(userId);
    return { deleted: true as const };
  } catch (error) {
    if (isNotFoundError(error)) {
      return { deleted: false as const, skipped: "not_found" as const };
    }
    throw error;
  }
};
