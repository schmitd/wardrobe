export type StyleBioCounts = {
  closetItemCount: number;
  fitCheckCount: number;
  collectionCount: number;
  collectionMembershipCount: number;
};

export type StyleBioBaseline = {
  bio?: string;
  bioClosetItemCount?: number;
  bioFitCheckCount?: number;
  bioCollectionCount?: number;
  bioCollectionMembershipCount?: number;
  bioGeneratedAt?: number;
} | null;

export const styleBioContextFingerprint = (counts: StyleBioCounts) =>
  [counts.closetItemCount, counts.fitCheckCount, counts.collectionCount, counts.collectionMembershipCount].join(":");

export const getStyleBioRefreshState = (
  profile: StyleBioBaseline,
  counts: StyleBioCounts,
  timestamp = Date.now()
) => {
  if (!profile?.bio?.trim()) return { refresh: true, reason: "first_profile_visit" };

  const closetDelta = Math.abs(counts.closetItemCount - (profile.bioClosetItemCount ?? 0));
  const fitDelta = Math.abs(counts.fitCheckCount - (profile.bioFitCheckCount ?? 0));
  const collectionDelta = Math.abs(counts.collectionCount - (profile.bioCollectionCount ?? 0));
  const membershipDelta = Math.abs(counts.collectionMembershipCount - (profile.bioCollectionMembershipCount ?? 0));
  const closetThreshold = Math.max(3, Math.ceil(Math.max(1, profile.bioClosetItemCount ?? 0) * 0.25));

  if (closetDelta >= closetThreshold) return { refresh: true, reason: "closet_shift" };
  if (fitDelta >= 3) return { refresh: true, reason: "fit_check_shift" };
  if (collectionDelta >= 1 || membershipDelta >= 5) return { refresh: true, reason: "collection_shift" };

  const staleForThirtyDays = profile.bioGeneratedAt && timestamp - profile.bioGeneratedAt >= 30 * 24 * 60 * 60 * 1000;
  if (staleForThirtyDays && closetDelta + fitDelta + collectionDelta + membershipDelta > 0) {
    return { refresh: true, reason: "stale_context" };
  }
  return { refresh: false, reason: "current" };
};
