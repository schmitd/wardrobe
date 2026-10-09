import type { Zep } from "@getzep/zep-cloud";

export type InspirationReference = { candidateItemId: string; wardrobeId?: string };
export type RecallAccess = (references: InspirationReference[]) => Promise<boolean[]>;

const textAttribute = (node: Zep.EntityNode, key: string) => typeof node.attributes?.[key] === "string" ? node.attributes[key] as string : undefined;
const candidateReference = (node: Zep.EntityNode) => {
  const candidate = node.name.startsWith("Candidate ") || node.labels?.includes("CandidateItem") || node.attributes?.reference_mode === "associative";
  if (!candidate) return undefined;
  const id = textAttribute(node, "item_id");
  if (id) return id;
  const nameId = node.name.match(/^Candidate ([a-zA-Z0-9]{20,64})$/)?.[1];
  return nameId;
};
const isCollection = (node: Zep.EntityNode) => node.labels?.includes("WardrobeCollection") || /^Wardrobe [a-zA-Z0-9]{20,64}$/.test(node.name) || typeof node.attributes?.collection_kind === "string";
const wardrobeReference = (node: Zep.EntityNode) => textAttribute(node, "wardrobe_id") ?? textAttribute(node, "source_ref") ?? node.name.match(/^Wardrobe ([a-zA-Z0-9]{20,64})$/)?.[1];

/** Revalidate graph references at recall time; never modify historical/shared graph data. */
export async function filterInspirationRecall(edges: Zep.EntityEdge[], getNode: (uuid: string) => Promise<Zep.EntityNode>, access: RecallAccess) {
  const current = edges.filter(edge => !edge.invalidAt && !edge.expiredAt).slice(0, 20);
  const nodes = new Map<string, Promise<Zep.EntityNode | null>>();
  const node = (uuid: string) => {
    if (!nodes.has(uuid)) nodes.set(uuid, getNode(uuid).catch(() => null));
    return nodes.get(uuid)!;
  };
  const references: InspirationReference[] = [];
  const checks = await Promise.all(current.map(async edge => {
    const [source, target] = await Promise.all([node(edge.sourceNodeUuid), node(edge.targetNodeUuid)]);
    // An unavailable endpoint cannot prove that a fact is unrelated to removed inspiration.
    if (!source || !target) return false;
    const candidates = [source, target].filter(endpoint => endpoint.name.startsWith("Candidate ") || endpoint.labels?.includes("CandidateItem") || endpoint.attributes?.reference_mode === "associative");
    const explicit = edge.attributes?.membership_kind === "inspiration";
    const inspirationRelation = /INSPIR/i.test(edge.name) && (isCollection(source) || isCollection(target));
    if (!candidates.length) return explicit || inspirationRelation ? false : true;
    const membership = edge.name === "MEMBER_OF_WARDROBE" || explicit || isCollection(source) || isCollection(target);
    const indexes: number[] = [];
    for (const candidate of candidates) {
      const candidateItemId = candidateReference(candidate);
      // Omit only unverifiable candidate facts, rather than suppressing a whole recall family.
      if (!candidateItemId) {
        if (membership || candidate.attributes?.reference_mode === "associative") return false;
        // Unsaved try-on/comparison candidates also use CandidateItem nodes. Their
        // unrelated style facts must not be suppressed merely for lacking a DB id.
        continue;
      }
      let wardrobeId: string | undefined;
      if (membership) {
        wardrobeId = wardrobeReference(candidate === source ? target : source);
        if (!wardrobeId) return false;
      }
      indexes.push(references.push({ candidateItemId, ...(wardrobeId ? { wardrobeId } : {}) }) - 1);
    }
    return indexes;
  }));
  // Check all resolved references in one authoritative Convex snapshot after graph I/O.
  const allowed = references.length ? await access(references) : [];
  return current.filter((_, index) => typeof checks[index] === "boolean" ? checks[index] : (checks[index] as number[]).every(reference => allowed[reference] === true));
}
