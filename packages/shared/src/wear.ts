/** Wear truth is derived from active evidence; intent is never evidence. */
export type WearEvidenceValue = {
  kind: "manual" | "photo" | "correction";
  itemIds: readonly string[];
  unresolvedCount: number;
  retractedAt?: number;
};

export function deriveWear(
  evidence: readonly WearEvidenceValue[],
  plannedItemIds?: readonly string[],
) {
  const active = evidence.filter((e) => e.retractedAt === undefined);
  const correction = [...active].reverse().find((e) => e.kind === "correction");
  const itemIds = [
    ...new Set(
      correction ? correction.itemIds : active.flatMap((e) => [...e.itemIds]),
    ),
  ].sort();
  const unresolvedCount = correction
    ? 0
    : active.reduce((sum, e) => sum + e.unresolvedCount, 0);
  const manuallyAffirmed = active.some(
    (e) => e.kind === "manual" || e.kind === "correction",
  );
  const supported = active.length > 0;
  const coverage =
    manuallyAffirmed || (itemIds.length > 0 && unresolvedCount === 0)
      ? "supported"
      : "partial";
  const planned = new Set(plannedItemIds ?? []);
  const sameItems =
    planned.size > 0 &&
    planned.size === itemIds.length &&
    itemIds.every((id) => planned.has(id));
  const outcome =
    !supported || !itemIds.length || (!manuallyAffirmed && unresolvedCount > 0)
      ? "unconfirmed"
      : sameItems
        ? "confirmed_as_planned"
        : manuallyAffirmed
          ? "worn_differently"
          : "unconfirmed";
  return { itemIds, unresolvedCount, supported, coverage, outcome } as const;
}

export function validateWearDate(
  date: string | undefined,
  timezone: string | undefined,
  now = Date.now(),
) {
  if (date === undefined && timezone === undefined) return;
  if (
    !date ||
    !timezone ||
    timezone.length > 100 ||
    !/^\d{4}-\d{2}-\d{2}$/.test(date)
  )
    throw new Error("Choose a valid wear date and timezone.");
  const parsed = new Date(`${date}T12:00:00Z`);
  if (
    !Number.isFinite(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== date
  )
    throw new Error("Choose a valid wear date.");
  let today: string;
  try {
    today = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now);
  } catch {
    throw new Error("Choose a valid timezone.");
  }
  if (date > today)
    throw new Error("You can only record an outfit you have already worn.");
}

/** A matching date or item set alone must never merge two real outfits. */
export function canSupportPlan(
  observedItemIds: readonly string[],
  plannedItemIds: readonly string[],
) {
  return observedItemIds.some((id) => plannedItemIds.includes(id));
}

export const WEAR_ONTOLOGY_VERSION = 2;

export type WearOutfit = {
  id: string;
  revision: number;
  planId?: string;
  localDate?: string;
  timezone?: string;
  itemIds: string[];
  pieces: {
    id: string;
    category: string;
    description: string;
    imageUrl: string | null;
  }[];
  photos: { id: string; imageUrl: string | null; countsAsWear?: boolean }[];
  unresolvedCount: number;
  coverage: "partial" | "supported";
  outcome: "unconfirmed" | "confirmed_as_planned" | "worn_differently";
  canUndoManual: boolean;
  recordedAt: number;
};

export type PendingWearPlan = {
  id: string;
  date: string;
  title: string;
  itemIds: string[];
  revision: number;
  notWornAt?: number;
  pieces: { id: string; category: string; imageUrl: string | null }[];
};
export type PendingWearPage = {
  page: PendingWearPlan[];
  isDone: boolean;
  continueCursor: string;
};
export type WearOperation =
  | { operation: "wear_pending"; through: string; cursor?: string }
  | { operation: "wear_list" }
  | {
      operation: "wear_update";
      id: string;
      expectedRevision: number;
      action:
        | "undo_manual"
        | "correct"
        | "set_date"
        | "attach_plan"
        | "detach_plan"
        | "retract_photo"
        | "restore_photo";
      itemIds?: string[];
      localDate?: string;
      timezone?: string;
      planId?: string;
      fitId?: string;
      expectedPlanRevision?: number;
    };

export type WearFactCandidate = {
  ontologyVersion: number;
  occurrenceId: string;
  revision: number;
  itemId: string;
};

/** Temporal validity in Zep is not a substitute for current application truth. */
export function isCurrentWearFact(
  candidate: WearFactCandidate,
  current: {
    id: string;
    revision: number;
    itemIds: readonly string[];
    active: boolean;
  },
) {
  return (
    candidate.ontologyVersion === WEAR_ONTOLOGY_VERSION &&
    current.active &&
    candidate.occurrenceId === current.id &&
    candidate.revision === current.revision &&
    current.itemIds.includes(candidate.itemId)
  );
}
