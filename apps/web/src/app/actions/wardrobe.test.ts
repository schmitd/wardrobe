import { describe, it, expect, beforeEach, mock } from "bun:test";

const fetchMutationMock = mock();
const fetchQueryMock = mock();
const fetchActionMock = mock();
const runServerActionMock = mock();

const apiMock = {
  wardrobe: {
    getUploadUrl: {},
    createWardrobeItem: {},
    deleteWardrobeItem: {},
    getWardrobeItemWithUrl: {},
    setAnalysisStatus: {},
    applyTags: {},
    applyDescription: {},
    applyFullAnalysis: {},
    setAnalysisError: {},
    listItemsForSimilarity: {},
    getWardrobeItemsDisplayByIds: {},
    searchSimilarItems: {},
  },
  storage: {
    registerUpload: {},
    getStorageUrl: {},
  },
  profile: {
    updateBio: {},
    updateProfileAttributes: {},
  },
};

mock.module("convex/nextjs", () => ({
  fetchAction: fetchActionMock,
  fetchMutation: fetchMutationMock,
  fetchQuery: fetchQueryMock,
}));

mock.module("@clerk/nextjs/server", () => ({
  auth: () => ({
    userId: "user_123",
    getToken: async () => "token_123",
    has: () => false,
  }),
}));

mock.module("@convex/_generated/api", () => ({
  api: apiMock,
}));

mock.module("@/lib/run-effect", () => ({
  runServerAction: runServerActionMock,
}));

process.env.ARCJET_KEY = "test_arcjet_key";

const { api } = await import("@convex/_generated/api");
const actions = await import("./wardrobe");

const setupFetch = () => {
  global.fetch = mock(async () => ({
    ok: true,
    statusText: "OK",
    arrayBuffer: async () => new ArrayBuffer(8),
  })) as unknown as typeof fetch;
};

const allowArcjet = () => {
  runServerActionMock.mockResolvedValueOnce(undefined);
};

const queueRunServerAction = (...values: unknown[]) => {
  allowArcjet();
  for (const value of values) {
    runServerActionMock.mockResolvedValueOnce(value);
  }
};

beforeEach(() => {
  fetchMutationMock.mockClear();
  fetchQueryMock.mockClear();
  fetchActionMock.mockClear();
  runServerActionMock.mockClear();
  setupFetch();
});

describe("wardrobe server actions", () => {
  it("generates an authenticated upload URL", async () => {
    fetchMutationMock.mockResolvedValue("https://uploads.example.test/upload");

    const result = await actions.getUploadUrlAction();

    expect(result).toBe("https://uploads.example.test/upload");
    expect(fetchMutationMock).toHaveBeenCalledTimes(1);
    const [mutation, args, options] = fetchMutationMock.mock.calls[0];
    expect(mutation).toBe(api.wardrobe.getUploadUrl);
    expect(args).toEqual({});
    expect(options).toEqual({ token: "token_123" });
  });

  it("creates a wardrobe item with trace context", async () => {
    fetchMutationMock.mockResolvedValue({ id: "item_1" });
    allowArcjet();

    const result = await actions.createWardrobeItemAction({
      storageId: "storage_1",
      clientFileName: "test.jpg",
      contentType: "image/jpeg",
    });

    expect(String(result.id)).toBe("item_1");
    expect(fetchMutationMock).toHaveBeenCalledTimes(1);
    const [mutation, args, options] = fetchMutationMock.mock.calls[0];
    expect(mutation).toBe(api.wardrobe.createWardrobeItem);
    expect(args.storageId).toBe("storage_1");
    expect(args.clientFileName).toBe("test.jpg");
    expect(args.contentType).toBe("image/jpeg");
    expect(args.traceId).toBeDefined();
    expect(args.traceparent).toBeDefined();
    expect(options).toEqual({ token: "token_123" });
  });

  it("deletes a wardrobe item", async () => {
    fetchMutationMock.mockResolvedValue({ success: true });

    const result = await actions.deleteWardrobeItemAction({
      itemId: "item_1",
      reason: "duplicate",
    });

    expect(result.success).toBe(true);
    const [mutation, args] = fetchMutationMock.mock.calls[0];
    expect(mutation).toBe(api.wardrobe.deleteWardrobeItem);
    expect(args.itemId).toBe("item_1");
    expect(args.reason).toBe("duplicate");
    expect(args.traceId).toBeDefined();
    expect(args.traceparent).toBeDefined();
  });

  it("updates profile bio via Convex mutation", async () => {
    fetchMutationMock.mockResolvedValue({ success: true });

    const result = await actions.updateProfileBioAction({ bio: "New bio" });

    expect(result.success).toBe(true);
    const [mutation, args] = fetchMutationMock.mock.calls[0];
    expect(mutation).toBe(api.profile.updateBio);
    expect(args.bio).toBe("New bio");
    expect(args.traceId).toBeDefined();
    expect(args.traceparent).toBeDefined();
  });

  it("processes a wardrobe item and persists full analysis", async () => {
    fetchQueryMock.mockImplementation(async (query) => {
      if (query === api.wardrobe.getWardrobeItemWithUrl) {
        return {
          _id: "item_1",
          userId: "user_123",
          imageUrl: "https://example.com/item.jpg",
        };
      }
      return null;
    });

    queueRunServerAction(
      { category: "Shirt", style_tags: ["casual"] },
      { category: "Shirt", description: "Blue shirt" },
      [0.1, 0.2, 0.3]
    );

    fetchMutationMock.mockResolvedValue({ success: true });

    const result = await actions.processWardrobeItemAction({ itemId: "item_1" });

    expect(result.success).toBe(true);
    const applyFullAnalysisCalls = fetchMutationMock.mock.calls.filter(
      ([mutation]) => mutation === api.wardrobe.applyFullAnalysis
    );
    expect(applyFullAnalysisCalls.length).toBe(1);
  });

  it("marks analysis error when inference fails", async () => {
    fetchQueryMock.mockResolvedValue({
      _id: "item_1",
      userId: "user_123",
      imageUrl: "https://example.com/item.jpg",
    });

    allowArcjet();
    runServerActionMock.mockRejectedValueOnce(new Error("boom"));
    fetchMutationMock.mockResolvedValue({ success: true });

    const result = await actions.processWardrobeItemAction({ itemId: "item_1" });

    expect(result.success).toBe(false);
    const errorCalls = fetchMutationMock.mock.calls.filter(
      ([mutation]) => mutation === api.wardrobe.setAnalysisError
    );
    expect(errorCalls.length).toBe(1);
  });

  it("surfaces Convex auth provider mismatches as configuration errors", async () => {
    fetchQueryMock.mockResolvedValue({
      _id: "item_1",
      userId: "user_123",
      imageUrl: "https://example.com/item.jpg",
    });

    allowArcjet();
    runServerActionMock.mockRejectedValueOnce(
      new Error(
        '{"code":"NoAuthProvider","message":"No auth provider found matching the given token."}'
      )
    );
    fetchMutationMock.mockResolvedValue({ success: true });

    const result = await actions.processWardrobeItemAction({ itemId: "item_1" });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("auth configuration is refreshed");
    }
    expect(fetchMutationMock).toHaveBeenCalledWith(
      api.wardrobe.setAnalysisError,
      expect.objectContaining({
        itemId: "item_1",
        error: expect.stringContaining("auth configuration is refreshed"),
      }),
      expect.objectContaining({ token: "token_123" })
    );
  });

  it("checks compatibility using generated embeddings", async () => {
    fetchActionMock.mockResolvedValue([
      { _id: "item_1", _score: 0.98 },
    ]);

    fetchQueryMock.mockImplementation(async (query) => {
      if (query === api.storage.getStorageUrl) {
        return "https://example.com/candidate.jpg";
      }
      if (query === api.wardrobe.listItemsForSimilarity) {
        return [
          {
            _id: "item_1",
            embedding: [1, 0, 0],
            category: "Pants",
            description: "Black pants",
            styleTags: [],
          },
          {
            _id: "item_2",
            embedding: [0, 1, 0],
            category: "Hat",
            description: "Green hat",
            styleTags: [],
          },
        ];
      }
      if (query === api.wardrobe.getWardrobeItemsDisplayByIds) {
        return [
          {
            id: "item_1",
            imageUrl: "https://example.com/item1.jpg",
            category: "Pants",
            description: "Black pants",
            styleTags: [],
          },
          {
            id: "item_2",
            imageUrl: "https://example.com/item2.jpg",
            category: "Hat",
            description: "Green hat",
            styleTags: [],
          },
        ];
      }
      return null;
    });

    queueRunServerAction(
      {
        category: "Shirt",
        description: "Blue shirt",
        style_tags: ["casual"],
      },
      "blue shirt casual",
      [1, 0, 0],
      {
        score: 80,
        explanation: "Works well",
        best_pairings: [0],
        worst_clashes: [],
      }
    );

    const result = await actions.checkCompatibilityAction({ storageId: "storage_1" });

    expect(result.candidate.description).toBe("Blue shirt");
    expect(result.evaluation?.score).toBe(80);
    expect(fetchActionMock).toHaveBeenCalledWith(
      api.wardrobe.searchSimilarItems,
      expect.objectContaining({
        embedding: [1, 0, 0],
        limit: 5,
      }),
      expect.objectContaining({ token: "token_123" })
    );
    expect(result.similarItems.length).toBeGreaterThan(0);
    expect(result.dissimilarItems.length).toBeGreaterThan(0);
  });

  it("analyzes selfie and syncs profile", async () => {
    fetchQueryMock.mockImplementation(async (query) => {
      if (query === api.storage.getStorageUrl) {
        return "https://example.com/selfie.jpg";
      }
      return null;
    });

    runServerActionMock.mockResolvedValue({
      bio: "Minimalist profile",
      skin_tone: "Medium",
      hair_color: "Brown",
    });

    fetchMutationMock.mockResolvedValue({ success: true });

    const result = await actions.analyzeSelfieAction({ storageId: "storage_1" });

    expect(result.bio).toBe("Minimalist profile");
    expect(fetchMutationMock).toHaveBeenCalledWith(
      api.profile.updateProfileAttributes,
      expect.objectContaining({
        bio: "Minimalist profile",
        traceId: expect.any(String),
        traceparent: expect.any(String),
      }),
      expect.objectContaining({ token: "token_123" })
    );
  });

  it("caps guest batch analysis at four items", async () => {
    queueRunServerAction(
      {
        category: "Top",
        description: "Blue shirt",
        style_tags: ["casual"],
      },
      {
        category: "Bottom",
        description: "Black jeans",
        style_tags: ["minimal"],
      },
      {
        category: "Outerwear",
        description: "Olive jacket",
        style_tags: ["layered"],
      },
      {
        category: "Shoes",
        description: "White sneakers",
        style_tags: ["sporty"],
      },
      { bio: "I wear clean lines with practical layers." }
    );

    const result = await actions.analyzeGuestBatchAction({
      items: [
        { fileName: "one.jpg", mimeType: "image/jpeg", base64: "data:image/jpeg;base64,QUJDRA==" },
        { fileName: "two.jpg", mimeType: "image/jpeg", base64: "data:image/jpeg;base64,QUJDRA==" },
        { fileName: "three.jpg", mimeType: "image/jpeg", base64: "data:image/jpeg;base64,QUJDRA==" },
        { fileName: "four.jpg", mimeType: "image/jpeg", base64: "data:image/jpeg;base64,QUJDRA==" },
        { fileName: "five.jpg", mimeType: "image/jpeg", base64: "data:image/jpeg;base64,QUJDRA==" },
      ],
    });

    expect(result.limit).toBe(4);
    expect(result.capped).toBe(true);
    expect(result.items).toHaveLength(4);
    expect(runServerActionMock).toHaveBeenCalledTimes(6);
  });

  it("rejects oversized guest images before inference", async () => {
    const oversized = "A".repeat(2_100_000);

    await expect(
      actions.analyzeGuestBatchAction({
        items: [
          {
            fileName: "huge.jpg",
            mimeType: "image/jpeg",
            base64: oversized,
          },
        ],
      })
    ).rejects.toThrow("Each image must be under 1.5MB after compression");

    expect(runServerActionMock).not.toHaveBeenCalled();
  });
});
