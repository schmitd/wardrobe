"use node";
import { Zep, ZepClient } from "@getzep/zep-cloud";
import {
  wearProjectionTriples,
  type WearProjectionSnapshot,
} from "../wearProjectionPolicy";
import { ensureWardrobeZepProject } from "./zep";

type NodeRef = { sourceRef: string; uuid: string; kind: string };
type Progress = { edgeIds: string[]; taskIds: string[]; nodeIds: NodeRef[] };
type References = { edgeIds: string[]; nodeIds: NodeRef[] };
const options = { maxRetries: 0, timeoutInSeconds: 20 };

export async function publishWearProjection(
  snapshot: WearProjectionSnapshot,
  references: References,
  progress: (value: Progress) => Promise<void>,
  probe?: { graphId: string; apiKey: string },
) {
  const result: Progress & { failureKind?: string } = {
    edgeIds: [],
    taskIds: [],
    nodeIds: [],
  };
  if (probe && !probe.graphId.startsWith("wardrobe-wear-probe-"))
    throw new Error("Synthetic graph required");
  if (
    !probe &&
    (process.env.WARDROBE_WEAR_ZEP_MODE !== "live" || !process.env.ZEP_KEY)
  )
    return { ...result, failureKind: "projection_disabled" };
  const client = new ZepClient({
    apiKey: probe?.apiKey ?? process.env.ZEP_KEY!,
  });
  const scope = probe
    ? { graphId: probe.graphId }
    : { userId: snapshot.userId };
  const nodes = new Map(
    references.nodeIds.map((node) => [node.sourceRef, node]),
  );
  try {
    if (!probe) await ensureWardrobeZepProject();
    // Only an existing user graph can receive projection. A late job must not
    // recreate a deleted graph. Normal account/wardrobe setup owns creation.
    if (probe) await client.graph.get(probe.graphId, options);
    else {
      await client.user.get(snapshot.userId, options);
      // Reuse the exact owned-item entity; a legacy name match is not identity.
      for (const itemId of snapshot.itemIds)
        if (!nodes.has(itemId)) {
          const found = await client.graph.search(
            {
              ...scope,
              query: itemId,
              scope: "nodes",
              limit: 2,
              searchFilters: {
                nodeLabels: ["WardrobeItem"],
                propertyFilters: [
                  {
                    propertyName: "source_ref",
                    comparisonOperator: "=",
                    propertyValue: itemId,
                  },
                ],
              },
            },
            options,
          );
          const exact = (found.nodes ?? []).filter(
            (node) =>
              node.attributes?.source_ref === itemId &&
              node.labels?.includes("WardrobeItem"),
          );
          if (exact.length !== 1)
            return { ...result, failureKind: "item_identity_mapping_required" };
          nodes.set(itemId, {
            sourceRef: itemId,
            uuid: exact[0]!.uuid,
            kind: "WardrobeItem",
          });
        }
      result.nodeIds = [...nodes.values()];
      await progress(result);
    }
    if (references.edgeIds.length > 64)
      return { ...result, failureKind: "reference_reconciliation_required" };
    const previous = await Promise.all(
      references.edgeIds.map((id) => client.graph.edge.get(id, options)),
    );
    const triples = wearProjectionTriples(snapshot);
    const kept = new Set<string>();
    for (const triple of triples) {
      const previousEdge = previous.find(
        (edge) =>
          edge.name === triple.factName &&
          edge.attributes?.item_id === triple.edgeAttributes.item_id &&
          !edge.expiredAt,
      );
      if (previousEdge) {
        const updated = await client.graph.edge.update(
          previousEdge.uuid,
          { fact: triple.fact, attributes: triple.edgeAttributes },
          options,
        );
        if (updated.attributes?.aggregate_revision !== snapshot.revision)
          throw new Error("Projection revision was not retained");
        result.edgeIds.push(updated.uuid);
        kept.add(updated.uuid);
        await progress(result);
        continue;
      }
      const created = await client.graph.addFactTriple(
        {
          ...scope,
          fact: triple.fact,
          factName: triple.factName,
          sourceNodeName: triple.sourceNodeName,
          sourceNodeLabels: [triple.sourceKind],
          sourceNodeAttributes: triple.sourceNodeAttributes,
          targetNodeName: triple.targetNodeName,
          targetNodeLabels: [triple.targetKind],
          targetNodeAttributes: triple.targetNodeAttributes,
          sourceNodeUuid: nodes.get(triple.sourceRef)?.uuid,
          targetNodeUuid: nodes.get(triple.targetRef)?.uuid,
          edgeAttributes: triple.edgeAttributes,
          createdAt: triple.createdAt,
          metadata: {
            ontology_version: 2,
            aggregate_id: snapshot.id,
            aggregate_revision: snapshot.revision,
          },
        },
        options,
      );
      let edge = created.edge;
      let source = created.sourceNode;
      let target = created.targetNode;
      if (created.taskId) {
        result.taskIds.push(created.taskId);
        await progress(result); // Persist before polling; never blindly submit again.
        for (let attempt = 0; attempt < 12 && !edge; attempt++) {
          const task = await client.task.get(created.taskId, options);
          if (task.status === "failed")
            throw new Error("Projection task failed");
          if (task.status === "succeeded") {
            const p = task.params;
            if (
              typeof p?.edge_uuid !== "string" ||
              typeof p.source_node_uuid !== "string" ||
              typeof p.target_node_uuid !== "string"
            )
              throw new Error("Projection references missing");
            [edge, source, target] = await Promise.all([
              client.graph.edge.get(p.edge_uuid, options),
              client.graph.node.get(p.source_node_uuid, options),
              client.graph.node.get(p.target_node_uuid, options),
            ]);
            break;
          }
          await new Promise((resolve) => setTimeout(resolve, 2_000));
        }
      }
      if (
        !edge ||
        !source ||
        !target ||
        !source.labels?.includes(triple.sourceKind) ||
        !target.labels?.includes(triple.targetKind) ||
        edge.attributes?.aggregate_revision !== snapshot.revision ||
        edge.attributes?.aggregate_id !== snapshot.id
      )
        throw new Error("Projection needs reconciliation");
      result.edgeIds.push(edge.uuid);
      for (const node of [
        {
          sourceRef: triple.sourceRef,
          uuid: source.uuid,
          kind: triple.sourceKind,
        },
        {
          sourceRef: triple.targetRef,
          uuid: target.uuid,
          kind: triple.targetKind,
        },
      ]) {
        const known = nodes.get(node.sourceRef);
        if (known && known.uuid !== node.uuid)
          throw new Error("Duplicate graph identity");
        nodes.set(node.sourceRef, node);
      }
      result.nodeIds = [...nodes.values()];
      result.taskIds = result.taskIds.filter((id) => id !== created.taskId);
      await progress(result);
    }
    for (const edge of previous.filter(
      (edge) => !kept.has(edge.uuid) && !edge.expiredAt,
    )) {
      // Retire the assertion at correction-recording time, preserving its
      // original event date and graph history. Never delete an historical edge.
      await client.graph.edge.update(
        edge.uuid,
        { expiredAt: new Date(snapshot.recordedAt).toISOString() },
        options,
      );
    }
    return result;
  } catch (error) {
    if (probe)
      console.error(
        "Synthetic projection diagnostic:",
        error instanceof Error
          ? error.message.replaceAll(probe.apiKey, "[redacted]")
          : "Unknown provider response",
      );
    result.failureKind =
      error instanceof Error && error.message === "Projection superseded"
        ? "superseded"
        : error instanceof Zep.NotFoundError
          ? "graph_or_reference_missing"
          : "provider_unknown";
    return result;
  }
}

export async function searchWearCandidates(userId: string, query: string) {
  if (!process.env.ZEP_KEY || process.env.WARDROBE_WEAR_ZEP_MODE !== "live")
    return [];
  const client = new ZepClient({ apiKey: process.env.ZEP_KEY });
  const result = await client.graph.search(
    {
      userId,
      query: query.slice(0, 500),
      scope: "edges",
      limit: 30,
      searchFilters: {
        edgeTypes: ["WORE_ITEM"],
        propertyFilters: [
          {
            propertyName: "ontology_version",
            comparisonOperator: "=",
            propertyValue: 2,
          },
        ],
      },
    },
    options,
  );
  return (result.edges ?? []).flatMap((edge) => {
    const a = edge.attributes;
    return a?.ontology_version === 2 &&
      typeof a.aggregate_id === "string" &&
      typeof a.aggregate_revision === "number" &&
      typeof a.item_id === "string"
      ? [
          {
            ontologyVersion: 2,
            occurrenceId: a.aggregate_id,
            revision: a.aggregate_revision,
            itemId: a.item_id,
          },
        ]
      : [];
  });
}
