import { describe, expect, it } from "bun:test";
import { getStyleBioRefreshState } from "./styleBioPolicy";

const baseline = {
  bio: "I favor soft tailoring.",
  bioClosetItemCount: 12,
  bioFitCheckCount: 4,
  bioCollectionCount: 1,
  bioCollectionMembershipCount: 3,
  bioGeneratedAt: Date.UTC(2026, 5, 1),
};

describe("style bio refresh policy", () => {
  it("creates a first bio even without closet evidence", () => {
    expect(getStyleBioRefreshState(null, {
      closetItemCount: 0,
      fitCheckCount: 0,
      collectionCount: 0,
      collectionMembershipCount: 0,
    }).reason).toBe("first_profile_visit");
  });

  it("does not churn after a small context change", () => {
    expect(getStyleBioRefreshState(baseline, {
      closetItemCount: 13,
      fitCheckCount: 5,
      collectionCount: 1,
      collectionMembershipCount: 4,
    }, Date.UTC(2026, 5, 10))).toEqual({ refresh: false, reason: "current" });
  });

  it("refreshes after substantial closet, fit, or collection changes", () => {
    expect(getStyleBioRefreshState(baseline, { closetItemCount: 15, fitCheckCount: 4, collectionCount: 1, collectionMembershipCount: 3 }).reason).toBe("closet_shift");
    expect(getStyleBioRefreshState(baseline, { closetItemCount: 12, fitCheckCount: 7, collectionCount: 1, collectionMembershipCount: 3 }).reason).toBe("fit_check_shift");
    expect(getStyleBioRefreshState(baseline, { closetItemCount: 12, fitCheckCount: 4, collectionCount: 2, collectionMembershipCount: 3 }).reason).toBe("collection_shift");
  });

  it("refreshes stale text after any meaningful new evidence", () => {
    expect(getStyleBioRefreshState(baseline, {
      closetItemCount: 13,
      fitCheckCount: 4,
      collectionCount: 1,
      collectionMembershipCount: 3,
    }, Date.UTC(2026, 7, 1)).reason).toBe("stale_context");
  });
});
