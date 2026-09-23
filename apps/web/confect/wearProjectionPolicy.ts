export type WearProjectionSnapshot = {
  kind: "plan" | "wear";
  userId: string;
  id: string;
  revision: number;
  localDate?: string;
  timezone?: string;
  recordedAt: number;
  active: boolean;
  itemIds: string[];
  planId?: string;
  planRevision?: number;
  outcome?: string;
  evidenceIds: string[];
};

/** Only verified identities enter extractable facts. No raw photo narrative. */
export function wearProjectionTriples(snapshot: WearProjectionSnapshot) {
  if (!snapshot.active) return [];
  const kind = snapshot.kind === "plan" ? "PlanOccurrence" : "WearOccurrence";
  const attributes = {
    ontology_version: 2,
    aggregate_id: snapshot.id,
    aggregate_revision: snapshot.revision,
    occurrence_date: snapshot.localDate ?? null,
    occurrence_timezone: snapshot.timezone ?? null,
    time_precision: snapshot.localDate ? "date" : "unknown",
    evidence_refs: snapshot.evidenceIds.join(","),
  };
  const source = {
    sourceNodeName: `${kind === "PlanOccurrence" ? "Plan" : "Wear"} ${snapshot.id}`,
    sourceNodeAttributes: {
      source_ref: snapshot.id,
      occurrence_kind: snapshot.kind,
    },
    sourceKind: kind,
    sourceRef: snapshot.id,
  };
  const triples = snapshot.itemIds.map((itemId) => ({
    ...source,
    targetNodeName: `Wardrobe item ${itemId}`,
    targetNodeAttributes: { source_ref: itemId },
    targetKind: "WardrobeItem",
    targetRef: itemId,
    factName: snapshot.kind === "plan" ? "PLANS_TO_WEAR" : "WORE_ITEM",
    fact:
      snapshot.kind === "plan"
        ? `Accepted plan ${snapshot.id} revision ${snapshot.revision} intends item ${itemId}. This is intent only.`
        : `Wear ${snapshot.id} revision ${snapshot.revision} includes item ${itemId}${snapshot.localDate ? ` on ${snapshot.localDate}` : "; wear date unknown"}.`,
    edgeAttributes: { ...attributes, item_id: itemId },
    createdAt: new Date(snapshot.recordedAt).toISOString(),
  }));
  // Dates are attributes. A date-only observation must not acquire a fabricated instant.
  if (snapshot.kind === "wear" && snapshot.planId)
    triples.push({
      ...source,
      targetNodeName: `Plan ${snapshot.planId}`,
      targetNodeAttributes: { source_ref: snapshot.planId },
      targetKind: "PlanOccurrence",
      targetRef: snapshot.planId,
      factName: "REALIZES_PLAN",
      fact: `Wear ${snapshot.id} is associated with plan ${snapshot.planId} revision ${snapshot.planRevision}; outcome ${snapshot.outcome ?? "unconfirmed"}.`,
      edgeAttributes: { ...attributes, item_id: "" },
      createdAt: new Date(snapshot.recordedAt).toISOString(),
    });
  return triples;
}
