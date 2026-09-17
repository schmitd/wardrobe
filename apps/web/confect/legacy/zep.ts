"use node";

import { Zep, ZepClient } from "@getzep/zep-cloud";
import { wardrobeEdgeTypes, wardrobeEntityTypes } from "./zepOntology";
import type { AuthenticatedUser } from "./authIdentity";

type Scalar = string | number | boolean | null;

type WardrobeItemMemory = {
  itemId?: string | null;
  wardrobeId?: string | null;
  sourceFitCheckId?: string | null;
  category?: string | null;
  description?: string | null;
  styleTags?: string[] | null;
  clientFileName?: string | null;
  contentType?: string | null;
  createdAt?: number | null;
  updatedAt?: number | null;
};

type CandidateComparisonMemory = {
  candidate: WardrobeItemMemory;
  storageId?: string | null;
  evaluation?: {
    score: number;
    explanation: string;
    best_pairings: number[];
    worst_clashes: number[];
  } | null;
  similarItems: WardrobeItemMemory[];
  dissimilarItems: WardrobeItemMemory[];
};

type CandidateInspirationMemory = {
  candidate: WardrobeItemMemory & { sourceUrl?: string | null; sourceLabel?: string | null };
  storageId?: string | null;
  collection: Omit<WardrobeCollectionMemory, "item" | "membershipKind" | "rationale">;
};

type WardrobeCollectionMemory = {
  wardrobeId: string;
  name: string;
  kind: string;
  description?: string | null;
  status: string;
  moodWords?: string[] | null;
  item?: WardrobeItemMemory | null;
  membershipKind?: string | null;
  rationale?: string | null;
};

type FitCheckMemory = {
  fitCheckId: string;
  type: "daily_fit_check" | "try_on" | "candidate_fit_check";
  description?: string | null;
  transcription?: string | null;
  storageId: string;
  createdAt: number;
  items: Array<
    WardrobeItemMemory & {
      wardrobeItemId?: string | null;
      source: "matched_existing" | "created_from_fit_check" | "transcribed_only" | "observed_unresolved";
      boundingBox?: { x: number; y: number; width: number; height: number } | null;
      confidence?: number;
    }
  >;
};

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

const compact = <T extends Record<string, unknown>>(value: T) =>
  Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as Partial<T>;

const scalarAttributes = (value: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(value)
      .filter(([, entry]) => entry === null || ["string", "number", "boolean"].includes(typeof entry))
      .map(([key, entry]) => [key, entry as Scalar])
  );

const truncate = (value: string, maxLength: number) =>
  value.length <= maxLength ? value : value.slice(0, maxLength - 1).trimEnd();

// Zep limits ontology descriptions and field text to 100 characters. Keep that
// transport constraint at the boundary so richer source documentation cannot
// prevent every user graph from being initialized.
const zepOntologyText = <T>(value: T): T => {
  if (typeof value === "string") return truncate(value, 100) as T;
  if (Array.isArray(value)) return value.map(zepOntologyText) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [key, zepOntologyText(entry)])
    ) as T;
  }
  return value;
};

const cleanText = (value?: string | null, fallback = "") => {
  const text = value?.replace(/\s+/g, " ").trim();
  return text || fallback;
};

const joinTags = (tags?: string[] | null) => (tags ?? []).filter(Boolean).join(", ");

const toIso = (timestamp?: number | null) => new Date(timestamp ?? Date.now()).toISOString();

const userDisplayName = (userId: string, user?: AuthenticatedUser | null) =>
  cleanText(user?.fullName, cleanText([user?.firstName, user?.lastName].filter(Boolean).join(" "), `Wardrobe user ${userId}`));

const userMetadata = (user?: AuthenticatedUser | null, metadata?: Record<string, unknown>) =>
  compact({
    ...metadata,
    app: "wardrobe",
    email: user?.email,
    full_name: user?.fullName,
    first_name: user?.firstName,
    last_name: user?.lastName,
  });

const userPayload = (
  userId: string,
  user?: AuthenticatedUser | null,
  metadata?: Record<string, unknown>
): Zep.CreateUserRequest => ({
    userId,
    ...compact({
      email: user?.email,
      firstName: user?.firstName,
      lastName: user?.lastName,
      metadata: userMetadata(user, metadata),
    }),
  });

const updateUserPayload = (user?: AuthenticatedUser | null, metadata?: Record<string, unknown>) =>
  compact({
    email: user?.email,
    firstName: user?.firstName,
    lastName: user?.lastName,
    metadata: userMetadata(user, metadata),
  });

const wardrobeUserNodeName = (userId: string, user?: AuthenticatedUser | null) =>
  truncate(userDisplayName(userId, user), 50);

const wardrobeUserSummary = (userId: string, user?: AuthenticatedUser | null) =>
  truncate(
    [
      `Wardrobe app user ${userDisplayName(userId, user)}.`,
      user?.email ? `Email: ${user.email}.` : undefined,
    ]
      .filter(Boolean)
      .join(" "),
    500
  );

const itemReference = (item: WardrobeItemMemory) =>
  item.itemId ?? cleanText(item.description, item.category ?? "unidentified-item");

const itemNodeName = (item: WardrobeItemMemory, prefix = "Item") =>
  truncate(`${prefix} ${itemReference(item)}`, 50);

const itemSummary = (item: WardrobeItemMemory) =>
  truncate(
    [
      item.category ? `Category: ${item.category}.` : undefined,
      item.description ? `Description: ${item.description}.` : undefined,
      item.styleTags?.length ? `Tags: ${joinTags(item.styleTags)}.` : undefined,
      item.wardrobeId ? `Wardrobe locus: ${item.wardrobeId}.` : undefined,
      item.sourceFitCheckId ? `Created from fit check ${item.sourceFitCheckId}.` : undefined,
    ]
      .filter(Boolean)
      .join(" ") || "Wardrobe item.",
    500
  );

const itemAttributes = (item: WardrobeItemMemory) =>
  scalarAttributes({
    item_id: item.itemId ?? null,
    category: item.category ?? null,
    description: item.description ?? null,
    style_tags: joinTags(item.styleTags),
    wardrobe_id: item.wardrobeId ?? null,
    source_fit_check_id: item.sourceFitCheckId ?? null,
    client_file_name: item.clientFileName ?? null,
    content_type: item.contentType ?? null,
  });

const styleConceptNode = (kind: string, value: string) =>
  truncate(`${kind}: ${cleanText(value, "unknown")}`, 50);

const collectionNodeName = (collection: WardrobeCollectionMemory) =>
  truncate(`Wardrobe ${collection.wardrobeId}`, 50);

const collectionSummary = (collection: WardrobeCollectionMemory) =>
  truncate(
    [
      `Name: ${collection.name}.`,
      `Kind: ${collection.kind}.`,
      `Status: ${collection.status}.`,
      collection.description ? `Description: ${collection.description}.` : undefined,
      collection.moodWords?.length ? `Mood words: ${collection.moodWords.join(", ")}.` : undefined,
    ]
      .filter(Boolean)
      .join(" "),
    500
  );

const fact = (value: string) => truncate(cleanText(value, "Wardrobe fact."), 250);

const addGraphEpisode = async (
  client: ZepClient,
  userId: string,
  user: AuthenticatedUser | null | undefined,
  input: {
    data: unknown;
    sourceDescription: string;
    createdAt?: number | null;
  }
) => {
  await ensureUser(client, userId, user);
  await client.graph.add({
    userId,
    type: "json",
    data: JSON.stringify(input.data),
    sourceDescription: input.sourceDescription,
    createdAt: toIso(input.createdAt),
  });
};

const addFactTriple = async (
  client: ZepClient,
  userId: string,
  user: AuthenticatedUser | null | undefined,
  input: {
    factName: keyof typeof wardrobeEdgeTypes;
    fact: string;
    sourceNodeName?: string;
    sourceNodeSummary?: string;
    sourceNodeAttributes?: Record<string, unknown>;
    targetNodeName: string;
    targetNodeSummary?: string;
    targetNodeAttributes?: Record<string, unknown>;
    edgeAttributes?: Record<string, unknown>;
    createdAt?: number | null;
    invalidAt?: number | null;
  }
) => {
  await ensureUser(client, userId, user);
  await client.graph.addFactTriple({
    userId,
    factName: input.factName,
    fact: fact(input.fact),
    sourceNodeName: input.sourceNodeName ?? wardrobeUserNodeName(userId, user),
    sourceNodeSummary: input.sourceNodeSummary ?? wardrobeUserSummary(userId, user),
    sourceNodeAttributes: scalarAttributes(input.sourceNodeAttributes ?? {}),
    targetNodeName: truncate(input.targetNodeName, 50),
    targetNodeSummary: input.targetNodeSummary ? truncate(input.targetNodeSummary, 500) : undefined,
    targetNodeAttributes: scalarAttributes(input.targetNodeAttributes ?? {}),
    edgeAttributes: scalarAttributes(input.edgeAttributes ?? {}),
    createdAt: toIso(input.createdAt),
    validAt: toIso(input.createdAt),
    invalidAt: input.invalidAt ? toIso(input.invalidAt) : undefined,
  });
};

const wardrobeSummaryInstructions = [
  {
    name: "wardrobe_style_identity_v1",
    text: "Summarize wardrobe identity: silhouettes, colors, textures, roles, fit, lifestyle, and tags.",
  },
  {
    name: "wardrobe_temporal_profile_v1",
    text: "Track evolving profile details: bio, hair, complexion, skin tone, color season, and corrections.",
  },
  {
    name: "wardrobe_fit_check_story_v1",
    text: "Distinguish daily fits from try-ons; retain worn items, closet matches, candidates, and removals.",
  },
  {
    name: "wardrobe_loci_v1",
    text: "Treat wardrobes, capsules, moods, trips, seasons, and goals as evolving first-class loci.",
  },
];

let projectSetupPromise: Promise<void> | null = null;

const runProjectSetup = async (client: ZepClient) => {
  await client.graph.setOntology(zepOntologyText(wardrobeEntityTypes), zepOntologyText(wardrobeEdgeTypes));

  const existing = await client.user.listUserSummaryInstructions({});
  const existingNames = new Set((existing.instructions ?? []).map((instruction) => instruction.name));
  const missing = wardrobeSummaryInstructions.filter((instruction) => !existingNames.has(instruction.name));
  if (missing.length > 0) {
    await client.user.addUserSummaryInstructions({ instructions: missing });
  }
};

export const ensureWardrobeZepProject = async () => {
  if (!apiKey) return { skipped: "missing_api_key" as const };
  const client = ensureClient();

  projectSetupPromise ??= runProjectSetup(client).catch((error) => {
    projectSetupPromise = null;
    throw error;
  });
  await projectSetupPromise;

  return { ok: true as const };
};

const ensureUser = async (
  client: ZepClient,
  userId: string,
  user?: AuthenticatedUser | null,
  metadata?: Record<string, unknown>
) => {
  await ensureWardrobeZepProject();

  try {
    await client.user.get(userId);
    return client.user.update(userId, updateUserPayload(user, metadata));
  } catch (error) {
    if (!isNotFoundError(error)) throw error;
    return client.user.add(userPayload(userId, user, metadata));
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

const addStyleConceptFacts = async (
  client: ZepClient,
  userId: string,
  user: AuthenticatedUser | null | undefined,
  item: WardrobeItemMemory,
  sourceNodeName: string,
  sourceNodeSummary: string,
  createdAt?: number | null
) => {
  const conceptFacts = [
    item.category
      ? {
          concept: item.category,
          conceptKind: "garment_role",
          relevance: "primary category / garment role",
        }
      : null,
    ...(item.styleTags ?? []).map((tag) => ({
      concept: tag,
      conceptKind: "tag",
      relevance: "generated style tag",
    })),
  ].filter((entry): entry is { concept: string; conceptKind: string; relevance: string } =>
    Boolean(entry?.concept)
  );

  await Promise.all(
    conceptFacts.map((entry) =>
      addFactTriple(client, userId, user, {
        factName: "HAS_STYLE_CONCEPT",
        fact: `${sourceNodeName} has ${entry.conceptKind} ${entry.concept}.`,
        sourceNodeName,
        sourceNodeSummary,
        sourceNodeAttributes: itemAttributes(item),
        targetNodeName: styleConceptNode(entry.conceptKind, entry.concept),
        targetNodeSummary: `${entry.conceptKind}: ${entry.concept}`,
        targetNodeAttributes: {
          concept_kind: entry.conceptKind,
          wording: entry.concept,
          polarity: "neutral",
        },
        edgeAttributes: {
          relevance: entry.relevance,
        },
        createdAt,
      })
    )
  );
};

export const addWardrobeItemsMemory = async (
  userId: string,
  items: WardrobeItemMemory[],
  user?: AuthenticatedUser | null
) => {
  if (!apiKey) return;

  const client = ensureClient();

  try {
    await addGraphEpisode(client, userId, user, {
      sourceDescription: "Wardrobe item analysis",
      data: {
        event: "wardrobe_items_analyzed",
        ontology_hints: {
          entities: ["WardrobeItem", "StyleConcept", "WardrobeCollection"],
          edges: ["ADDED_TO_WARDROBE", "HAS_STYLE_CONCEPT", "MEMBER_OF_WARDROBE"],
        },
        user: userMetadata(user),
        items: items.map((item) => ({
          itemId: item.itemId ?? null,
          wardrobeId: item.wardrobeId ?? null,
          sourceFitCheckId: item.sourceFitCheckId ?? null,
          category: item.category ?? null,
          description: item.description ?? null,
          styleTags: item.styleTags ?? [],
          garmentRole: item.category ?? null,
        })),
      },
      createdAt: items[0]?.updatedAt ?? items[0]?.createdAt,
    });

    const threadId = await ensureMainThread(client, userId);
    await client.thread.addMessages(threadId, {
      messages: [
        {
          role: "user",
          name: userDisplayName(userId, user),
          content: `I added or updated ${items.length} analyzed wardrobe item${items.length === 1 ? "" : "s"}.`,
          metadata: { type: "wardrobe_items_analyzed", count: items.length },
        },
      ],
    });
  } catch (error) {
    console.error("zep.addWardrobeItemsMemory.failed", {
      userId,
      count: items.length,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
};

export const deleteWardrobeItemMemory = async (
  userId: string,
  description: string,
  reason: string,
  user?: AuthenticatedUser | null
) => {
  if (!apiKey) return;

  const client = ensureClient();
  const createdAt = Date.now();

  await addGraphEpisode(client, userId, user, {
    sourceDescription: "Wardrobe item removal",
    createdAt,
    data: {
      event: "wardrobe_item_removed",
      ontology_hints: {
        entities: ["WardrobeItem"],
        edges: ["REMOVED_FROM_WARDROBE"],
      },
      user: userMetadata(user),
      item: { description },
      removal: {
        reason,
        eventTime: toIso(createdAt),
      },
    },
  });

  await addFactTriple(client, userId, user, {
    factName: "REMOVED_FROM_WARDROBE",
    fact: `User removed wardrobe item ${description}. Reason: ${reason}.`,
    targetNodeName: itemNodeName({ description }, "Removed item"),
    targetNodeSummary: `Removed wardrobe item. Reason: ${reason}.`,
    targetNodeAttributes: {
      description,
      removed: true,
      removal_reason: reason,
    },
    edgeAttributes: {
      removal_reason: reason,
      event_time: toIso(createdAt),
    },
    createdAt,
  });

  const threadId = await ensureMainThread(client, userId);
  await client.thread.addMessages(threadId, {
    messages: [
      {
        role: "user",
        name: userDisplayName(userId, user),
        content: `I removed an item from my wardrobe: "${description}". Reason: ${reason}.`,
        metadata: { type: "item_deletion", reason },
      },
    ],
  });
};

export const updateProfileMemory = async (
  userId: string,
  profile: {
    bio?: string | null;
    bioSource?: string | null;
    bioRevisionId?: string | null;
    previousBioRevisionId?: string | null;
    updateReason?: string | null;
    skinTone?: string | null;
    complexion?: string | null;
    hairColor?: string | null;
    colorSeason?: string | null;
  },
  user?: AuthenticatedUser | null
) => {
  if (!apiKey) return;

  const client = ensureClient();
  const createdAt = Date.now();
  const metadata = userMetadata(user, {
    bio: profile.bio ?? undefined,
    skin_tone: profile.skinTone ?? undefined,
    complexion: profile.complexion ?? undefined,
    hair_color: profile.hairColor ?? undefined,
    color_season: profile.colorSeason ?? undefined,
  });

  const existingUser = await ensureUser(client, userId, user, metadata);
  const previousMetadata =
    typeof existingUser === "object" &&
    existingUser !== null &&
    "metadata" in existingUser &&
    typeof existingUser.metadata === "object" &&
    existingUser.metadata !== null
      ? { ...existingUser.metadata }
      : {};

  const profileAttributes = [
    { kind: "style_bio", value: profile.bio, evidence: profile.bioSource ?? "profile update" },
    { kind: "skin_tone", value: profile.skinTone, evidence: "selfie analysis" },
    { kind: "complexion", value: profile.complexion, evidence: "selfie analysis" },
    { kind: "hair_color", value: profile.hairColor, evidence: "selfie analysis" },
    { kind: "color_season", value: profile.colorSeason, evidence: "selfie analysis" },
  ].filter((entry): entry is { kind: string; value: string; evidence: string } =>
    Boolean(entry.value)
  );

  try {
    await addGraphEpisode(client, userId, user, {
      sourceDescription: "Wardrobe profile update",
      createdAt,
      data: {
        event: profile.bio ? "style_bio_updated" : "profile_updated",
        ontology_hints: {
          entities: ["ProfileAttribute"],
          edges: ["PROFILE_ATTRIBUTE_SET"],
        },
        user: userMetadata(user),
        profile: {
          bio: profile.bio ?? null,
          skinTone: profile.skinTone ?? null,
          complexion: profile.complexion ?? null,
          hairColor: profile.hairColor ?? null,
          colorSeason: profile.colorSeason ?? null,
          bioSource: profile.bioSource ?? null,
          bioRevisionId: profile.bioRevisionId ?? null,
          previousBioRevisionId: profile.previousBioRevisionId ?? null,
          updateReason: profile.updateReason ?? null,
        },
        eventTime: toIso(createdAt),
      },
    });

    await Promise.all(
      profileAttributes.map((entry) =>
        addFactTriple(client, userId, user, {
          factName: "PROFILE_ATTRIBUTE_SET",
          fact: `User profile ${entry.kind} is ${entry.value}.`,
          targetNodeName: truncate(`Profile ${entry.kind}`, 50),
          targetNodeSummary: `${entry.kind}: ${entry.value}`,
          targetNodeAttributes: {
            attribute_kind: entry.kind,
            value_text: entry.value,
            evidence: entry.evidence,
          },
          edgeAttributes: {
            update_kind: "updated",
            event_time: toIso(createdAt),
          },
          createdAt,
        })
      )
    );

    const threadId = await ensureMainThread(client, userId);
    await client.thread.addMessages(threadId, {
      messages: [
        {
          role: "user",
          name: userDisplayName(userId, user),
          content: [
            `My style bio is: ${profile.bio ?? "N/A"}.`,
            `Skin tone: ${profile.skinTone ?? "N/A"}.`,
            `Complexion: ${profile.complexion ?? "N/A"}.`,
            `Hair color: ${profile.hairColor ?? "N/A"}.`,
            `Color season: ${profile.colorSeason ?? "N/A"}.`,
          ].join("\n"),
          metadata: {
            type: profile.bio ? "style_bio_update" : "profile_update",
            bio_source: profile.bioSource ?? undefined,
            bio_revision_id: profile.bioRevisionId ?? undefined,
            previous_bio_revision_id: profile.previousBioRevisionId ?? undefined,
            update_reason: profile.updateReason ?? undefined,
          },
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
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
};

export const searchStyleBioGraphContext = async (userId: string) => {
  if (!apiKey) return [];
  const client = ensureClient();
  const result = await client.graph.search({
    userId,
    query: "Current personal style, closet patterns, repeated outfits, fit-check behavior, collection goals, inspiration, preferences, corrections, and style bio history",
    scope: "edges",
    limit: 20,
  });
  return (result.edges ?? [])
    .filter((edge) => !edge.invalidAt && !edge.expiredAt)
    .map((edge) => `${edge.validAt ?? edge.createdAt}: ${edge.fact}`)
    .filter(Boolean)
    .slice(0, 20);
};

export const addWardrobeCollectionMemory = async (
  userId: string,
  collection: WardrobeCollectionMemory,
  user?: AuthenticatedUser | null
) => {
  if (!apiKey) return;

  const client = ensureClient();
  const createdAt = Date.now();
  const nodeName = collectionNodeName(collection);

  await addGraphEpisode(client, userId, user, {
    sourceDescription: "Wardrobe locus update",
    createdAt,
    data: {
      event: "wardrobe_collection_updated",
      ontology_hints: {
        entities: ["WardrobeCollection", "WardrobeItem", "StyleConcept"],
        edges: ["CURATES_WARDROBE", "MEMBER_OF_WARDROBE", "HAS_STYLE_CONCEPT"],
      },
      user: userMetadata(user),
      collection,
    },
  });

  await addFactTriple(client, userId, user, {
    factName: "CURATES_WARDROBE",
    fact: `User curates wardrobe locus ${collection.name}.`,
    targetNodeName: nodeName,
    targetNodeSummary: collectionSummary(collection),
    targetNodeAttributes: {
      collection_kind: collection.kind,
      intent: collection.description ?? null,
      mood_words: (collection.moodWords ?? []).join(", "),
      source_ref: collection.wardrobeId,
    },
    edgeAttributes: {
      intent: collection.description ?? null,
      status: collection.status,
    },
    createdAt,
  });

  if (collection.item) {
    await addFactTriple(client, userId, user, {
      factName: "MEMBER_OF_WARDROBE",
      fact: `${itemReference(collection.item)} belongs to wardrobe locus ${collection.name}.`,
      sourceNodeName: itemNodeName(collection.item, "Wardrobe item"),
      sourceNodeSummary: itemSummary(collection.item),
      sourceNodeAttributes: itemAttributes(collection.item),
      targetNodeName: nodeName,
      targetNodeSummary: collectionSummary(collection),
      targetNodeAttributes: {
        collection_kind: collection.kind,
        intent: collection.description ?? null,
        source_ref: collection.wardrobeId,
      },
      edgeAttributes: {
        membership_kind: collection.membershipKind ?? "included",
        rationale: collection.rationale ?? null,
      },
      createdAt,
    });
  }
};

export const addCandidateComparisonMemory = async (
  userId: string,
  comparison: CandidateComparisonMemory,
  user?: AuthenticatedUser | null
) => {
  if (!apiKey) return;

  const client = ensureClient();
  const createdAt = Date.now();
  const candidateNode = itemNodeName(comparison.candidate, "Candidate");
  const candidateSummary = itemSummary(comparison.candidate);
  const evaluation = comparison.evaluation ?? null;
  const verdict =
    evaluation === null
      ? "unknown"
      : evaluation.score >= 70
        ? "strong fit"
        : evaluation.score >= 45
          ? "mixed fit"
          : "weak fit";

  await addGraphEpisode(client, userId, user, {
    sourceDescription: "Candidate fit check",
    createdAt,
    data: {
      event: "candidate_fit_check",
      ontology_hints: {
        entities: ["CandidateItem", "WardrobeItem", "StyleConcept"],
        edges: ["COMPARED_CANDIDATE", "STYLE_RELATION", "HAS_STYLE_CONCEPT"],
      },
      user: userMetadata(user),
      candidate: comparison.candidate,
      storageId: comparison.storageId ?? null,
      evaluation,
      similarItems: comparison.similarItems,
      dissimilarItems: comparison.dissimilarItems,
    },
  });

  await addFactTriple(client, userId, user, {
    factName: "COMPARED_CANDIDATE",
    fact: `User checked candidate item ${cleanText(comparison.candidate.description, comparison.candidate.category ?? "item")}.`,
    targetNodeName: candidateNode,
    targetNodeSummary: candidateSummary,
    targetNodeAttributes: itemAttributes(comparison.candidate),
    edgeAttributes: {
      verdict,
      score: evaluation?.score ?? null,
      rationale: evaluation?.explanation ?? null,
      source_ref: comparison.storageId ?? null,
      event_time: toIso(createdAt),
    },
    createdAt,
  });

  await addStyleConceptFacts(client, userId, user, comparison.candidate, candidateNode, candidateSummary, createdAt);

  const related = [
    ...comparison.similarItems.map((item) => ({ item, relationKind: "pairs_with" })),
    ...comparison.dissimilarItems.map((item) => ({ item, relationKind: "clashes_with" })),
  ];

  await Promise.all(
    related.map(({ item, relationKind }) =>
      addFactTriple(client, userId, user, {
        factName: "STYLE_RELATION",
        fact: `Candidate ${relationKind.replace(/_/g, " ")} ${cleanText(item.description, item.category ?? itemReference(item))}.`,
        sourceNodeName: candidateNode,
        sourceNodeSummary: candidateSummary,
        sourceNodeAttributes: itemAttributes(comparison.candidate),
        targetNodeName: itemNodeName(item, "Wardrobe item"),
        targetNodeSummary: itemSummary(item),
        targetNodeAttributes: itemAttributes(item),
        edgeAttributes: {
          relation_kind: relationKind,
          rationale: evaluation?.explanation ?? null,
          strength: "model_inferred",
        },
        createdAt,
      })
    )
  );
};

export const addFitCheckMemory = async (
  userId: string,
  fitCheck: FitCheckMemory,
  user?: AuthenticatedUser | null
) => {
  if (!apiKey) return;

  const client = ensureClient();
  const createdAt = fitCheck.createdAt;
  const contextName = truncate(`Fit check ${fitCheck.fitCheckId}`, 50);
  const contextSummary = truncate(
    [
      `Type: ${fitCheck.type}.`,
      fitCheck.description ? `Description: ${fitCheck.description}.` : undefined,
      fitCheck.transcription ? `Transcription: ${fitCheck.transcription}.` : undefined,
    ]
      .filter(Boolean)
      .join(" "),
    500
  );

  await addGraphEpisode(client, userId, user, {
    sourceDescription:
      fitCheck.type === "daily_fit_check" ? "Daily outfit fit check" : "Try-on fit check",
    createdAt,
    data: {
      event: fitCheck.type,
      ontology_hints: {
        entities: ["WearContext", "WardrobeItem", "CandidateItem", "StyleConcept"],
        edges: ["WORN_FOR", "STYLE_RELATION", "HAS_STYLE_CONCEPT", "ADDED_TO_WARDROBE"],
      },
      user: userMetadata(user),
      fitCheck,
    },
  });

  for (const item of fitCheck.items) {
    // Unresolved visual observations stay in the source episode, but do not
    // become graph identities until the app or user resolves them.
    if (item.source === "observed_unresolved") continue;
    const wardrobeItem: WardrobeItemMemory = {
      ...item,
      itemId: item.wardrobeItemId ?? item.itemId ?? null,
      sourceFitCheckId: fitCheck.fitCheckId,
    };
    const itemNode = itemNodeName(
      wardrobeItem,
      fitCheck.type === "try_on" && item.source === "transcribed_only" ? "Candidate" : "Wardrobe item"
    );
    const itemNodeSummary = itemSummary(wardrobeItem);

    await addFactTriple(client, userId, user, {
      factName: "WORN_FOR",
      fact: `${itemReference(wardrobeItem)} was recorded in ${fitCheck.type}.`,
      sourceNodeName: itemNode,
      sourceNodeSummary: itemNodeSummary,
      sourceNodeAttributes: itemAttributes(wardrobeItem),
      targetNodeName: contextName,
      targetNodeSummary: contextSummary,
      targetNodeAttributes: {
        context_kind: fitCheck.type,
        description: fitCheck.description ?? fitCheck.transcription ?? null,
        timeframe: toIso(createdAt),
        source_ref: fitCheck.fitCheckId,
      },
      edgeAttributes: {
        usage_kind: fitCheck.type,
        feedback: item.source,
        event_time: toIso(createdAt),
      },
      createdAt,
    });

    if (item.source === "created_from_fit_check") {
      await addFactTriple(client, userId, user, {
        factName: "ADDED_TO_WARDROBE",
        fact: `User created wardrobe item ${itemReference(wardrobeItem)} from ${fitCheck.type}.`,
        targetNodeName: itemNode,
        targetNodeSummary: itemNodeSummary,
        targetNodeAttributes: itemAttributes(wardrobeItem),
        edgeAttributes: {
          added_reason: `created_from_${fitCheck.type}`,
          source_ref: fitCheck.fitCheckId,
          event_time: toIso(createdAt),
        },
        createdAt,
      });
    }

    await addStyleConceptFacts(client, userId, user, wardrobeItem, itemNode, itemNodeSummary, createdAt);
  }
};

export const addGarmentIdentityResolutionMemory = async (
  userId: string,
  resolution: {
    fitCheckId: string;
    wardrobeItemId: string;
    category: string;
    description: string;
    resolution: "confirmed" | "promoted_new";
    score?: number | null;
    createdAt: number;
  },
  user?: AuthenticatedUser | null
) => {
  if (!apiKey) return;
  const client = ensureClient();
  const item: WardrobeItemMemory = {
    itemId: resolution.wardrobeItemId,
    category: resolution.category,
    description: resolution.description,
    sourceFitCheckId: resolution.fitCheckId,
  };
  const itemNode = itemNodeName(item, "Wardrobe item");
  const contextName = truncate(`Fit check ${resolution.fitCheckId}`, 50);

  await addGraphEpisode(client, userId, user, {
    sourceDescription: "Garment observation identity resolved",
    createdAt: resolution.createdAt,
    data: {
      event: "garment_identity_resolved",
      wardrobeItemId: resolution.wardrobeItemId,
      fitCheckId: resolution.fitCheckId,
      category: resolution.category,
      description: resolution.description,
      resolution: resolution.resolution,
      matchScore: resolution.score ?? null,
    },
  });

  await addFactTriple(client, userId, user, {
    factName: "WORN_FOR",
    fact: `${itemReference(item)} was identified in daily fit check ${resolution.fitCheckId}.`,
    sourceNodeName: itemNode,
    sourceNodeSummary: itemSummary(item),
    sourceNodeAttributes: itemAttributes(item),
    targetNodeName: contextName,
    targetNodeSummary: `Daily fit check containing ${resolution.description}.`,
    targetNodeAttributes: {
      context_kind: "daily_fit_check",
      timeframe: toIso(resolution.createdAt),
      source_ref: resolution.fitCheckId,
    },
    edgeAttributes: {
      usage_kind: "worn",
      feedback: resolution.resolution,
      event_time: toIso(resolution.createdAt),
      match_score: resolution.score ?? null,
    },
    createdAt: resolution.createdAt,
  });

  if (resolution.resolution === "promoted_new") {
    await addFactTriple(client, userId, user, {
      factName: "ADDED_TO_WARDROBE",
      fact: `User added ${itemReference(item)} after identifying it in a daily fit check.`,
      targetNodeName: itemNode,
      targetNodeSummary: itemSummary(item),
      targetNodeAttributes: itemAttributes(item),
      edgeAttributes: {
        added_reason: "confirmed_from_daily_fit_check",
        source_ref: resolution.fitCheckId,
        event_time: toIso(resolution.createdAt),
      },
      createdAt: resolution.createdAt,
    });
  }
};

export const addCandidateInspirationMemory = async (
  userId: string,
  inspiration: CandidateInspirationMemory,
  user?: AuthenticatedUser | null
) => {
  if (!apiKey) return;
  const client = ensureClient();
  const createdAt = Date.now();
  const candidateNode = itemNodeName(inspiration.candidate, "Candidate");
  const candidateSummary = itemSummary(inspiration.candidate);
  const collectionNode = collectionNodeName(inspiration.collection);
  await addGraphEpisode(client, userId, user, {
    sourceDescription: "Associative visual inspiration saved to collection",
    createdAt,
    data: {
      event: "candidate_inspiration_saved",
      ontology_hints: { entities: ["CandidateItem", "WardrobeCollection", "StyleConcept"], edges: ["MEMBER_OF_WARDROBE", "HAS_STYLE_CONCEPT", "STYLE_RELATION"] },
      user: userMetadata(user), candidate: inspiration.candidate,
      storageId: inspiration.storageId ?? null, collection: inspiration.collection,
      membershipKind: "inspiration",
    },
  });
  await addFactTriple(client, userId, user, {
    factName: "MEMBER_OF_WARDROBE",
    fact: `${cleanText(inspiration.candidate.description, inspiration.candidate.category ?? "Inspiration")} inspires collection ${inspiration.collection.name}.`,
    sourceNodeName: candidateNode,
    sourceNodeSummary: candidateSummary,
    sourceNodeAttributes: { ...itemAttributes(inspiration.candidate), purchase_context: inspiration.candidate.sourceLabel ?? "visual inspiration", reference_mode: "associative", source_ref: inspiration.candidate.sourceUrl ?? inspiration.storageId ?? inspiration.candidate.itemId ?? null },
    targetNodeName: collectionNode,
    targetNodeSummary: collectionSummary(inspiration.collection),
    targetNodeAttributes: { collection_kind: inspiration.collection.kind, intent: inspiration.collection.description ?? null, source_ref: inspiration.collection.wardrobeId },
    edgeAttributes: { membership_kind: "inspiration", rationale: inspiration.candidate.description ?? null },
    createdAt,
  });
  await addStyleConceptFacts(client, userId, user, inspiration.candidate, candidateNode, candidateSummary, createdAt);
};

export const searchWardrobeStyleMemory = async (
  userId: string,
  query: string,
  user?: AuthenticatedUser | null
) => {
  if (!apiKey) return [];
  const client = ensureClient();
  await ensureUser(client, userId, user);
  const results = await client.graph.search({ userId, query: truncate(query, 500), limit: 8, scope: "edges" });
  return (results.edges ?? []).map((edge) => ({ fact: edge.fact, relation: edge.name, relevance: edge.relevance ?? edge.score ?? null }));
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
