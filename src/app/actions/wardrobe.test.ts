import { describe, it, expect, beforeEach, mock } from "bun:test";

const fetchMutationMock = mock();
const fetchQueryMock = mock();
const runServerActionMock = mock();
const publishJsonMock = mock();

const apiMock = {
  wardrobe: {
    createWardrobeItem: {},
    deleteWardrobeItem: {},
    getWardrobeItemWithUrl: {},
    setAnalysisStatus: {},
    applyTags: {},
    applyDescription: {},
    applyEmbedding: {},
    applyFullAnalysis: {},
    setAnalysisError: {},
    listItemsForSimilarity: {},
    listWardrobeItems: {},
  },
  storage: {
    getStorageUrl: {},
  },
  profile: {
    updateBio: {},
    updateProfileAttributes: {},
  },
};

mock.module("convex/nextjs", () => ({
  fetchMutation: fetchMutationMock,
  fetchQuery: fetchQueryMock,
}));

mock.module("@clerk/nextjs/server", () => ({
  auth: () => ({
    userId: "user_123",
    getToken: async () => "token_123",
  }),
}));

mock.module("@convex/_generated/api", () => ({
  api: apiMock,
}));

mock.module("@/lib/run-effect", () => ({
  runServerAction: runServerActionMock,
}));

mock.module("@/lib/qstash", () => ({
  publishJson: publishJsonMock,
}));

const { api } = await import("@convex/_generated/api");
const actions = await import("./wardrobe");

const setupFetch = () => {
  global.fetch = mock(async () => ({
    ok: true,
    statusText: "OK",
    arrayBuffer: async () => new ArrayBuffer(8),
  })) as unknown as typeof fetch;
};

beforeEach(() => {
  fetchMutationMock.mockClear();
  fetchQueryMock.mockClear();
  runServerActionMock.mockClear();
  publishJsonMock.mockClear();
  setupFetch();
});

describe("wardrobe server actions", () => {
  it("creates a wardrobe item with trace context", async () => {
    fetchMutationMock.mockResolvedValue({ id: "item_1" });

    const result = await actions.createWardrobeItemAction({
      storageId: "storage_1",
      clientFileName: "test.jpg",
      contentType: "image/jpeg",
    });

    expect(result.id).toBe("item_1");
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
    fetchQueryMock.mockResolvedValue({
      _id: "item_1",
      userId: "user_123",
      description: "Test item",
      category: "Shirt",
      imageUrl: "https://example.com/item.jpg",
    });
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
    expect(publishJsonMock).toHaveBeenCalled();
  });

  it("updates profile bio via Convex mutation", async () => {
    fetchMutationMock.mockResolvedValue({ success: true });

    const result = await actions.updateProfileBioAction({ bio: "New bio" });

    expect(result.success).toBe(true);
    const [mutation, args] = fetchMutationMock.mock.calls[0];
    expect(mutation).toBe(api.profile.updateBio);
    expect(args.bio).toBe("New bio");
    expect(publishJsonMock).toHaveBeenCalled();
  });

  it("processes a wardrobe item and enqueues Zep sync", async () => {
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

    runServerActionMock
      .mockResolvedValueOnce({ category: "Shirt", style_tags: ["casual"] })
      .mockResolvedValueOnce({ category: "Shirt", description: "Blue shirt" })
      .mockResolvedValueOnce([0.1, 0.2, 0.3]);

    fetchMutationMock.mockResolvedValue({ success: true });

    const result = await actions.processWardrobeItemAction({ itemId: "item_1" });

    expect(result.success).toBe(true);
    expect(publishJsonMock).toHaveBeenCalled();
  });

  it("marks analysis error when inference fails", async () => {
    fetchQueryMock.mockResolvedValue({
      _id: "item_1",
      userId: "user_123",
      imageUrl: "https://example.com/item.jpg",
    });

    runServerActionMock.mockRejectedValue(new Error("boom"));
    fetchMutationMock.mockResolvedValue({ success: true });

    const result = await actions.processWardrobeItemAction({ itemId: "item_1" });

    expect(result.success).toBe(false);
    const errorCalls = fetchMutationMock.mock.calls.filter(
      ([mutation]) => mutation === api.wardrobe.setAnalysisError
    );
    expect(errorCalls.length).toBe(1);
  });

  it("checks compatibility using generated embeddings", async () => {
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
      if (query === api.wardrobe.listWardrobeItems) {
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

    runServerActionMock
      .mockResolvedValueOnce({
        category: "Shirt",
        description: "Blue shirt",
        style_tags: ["casual"],
      })
      .mockResolvedValueOnce("blue shirt casual")
      .mockResolvedValueOnce([1, 0, 0])
      .mockResolvedValueOnce({
        score: 80,
        explanation: "Works well",
        best_pairings: [0],
        worst_clashes: [],
      });

    const result = await actions.checkCompatibilityAction({ storageId: "storage_1" });

    expect(result.candidate.description).toBe("Blue shirt");
    expect(result.evaluation?.score).toBe(80);
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
      }),
      expect.objectContaining({ token: "token_123" })
    );
    expect(publishJsonMock).toHaveBeenCalled();
  });
});
