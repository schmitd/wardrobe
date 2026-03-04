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
    await client.thread.addMessages(`session_${userId}_main`, {
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

  await client.thread.addMessages(`session_${userId}_main`, {
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
    await client.thread.addMessages(`session_${userId}_main`, {
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
  }
};
