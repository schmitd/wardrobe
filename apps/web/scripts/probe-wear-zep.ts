import { ZepClient } from "@getzep/zep-cloud";
import {
  wardrobeEntityTypes,
  wearEntityTypes,
  wearEdgeTypes,
} from "../confect/legacy/zepOntology";
import { publishWearProjection } from "../confect/legacy/wearGraphProvider";
import type { WearProjectionSnapshot } from "../confect/wearProjectionPolicy";

// Explicit synthetic graph only. The key travels through a pipe, never logs/files.
const deployment = Bun.argv[2];
if (
  !deployment?.startsWith("dev:") &&
  deployment !== "--credentials-from-production"
)
  throw new Error("Pass an explicit credential source.");
const keyRead = Bun.spawn(
  [
    "bun",
    "run",
    "--bun",
    "convex",
    "env",
    "get",
    "ZEP_KEY",
    ...(deployment === "--credentials-from-production" ? ["--prod"] : []),
  ],
  {
    env: {
      ...process.env,
      CONVEX_DEPLOYMENT:
        deployment === "--credentials-from-production"
          ? "dev:confident-lobster-971"
          : deployment,
    },
    stdout: "pipe",
    stderr: "pipe",
  },
);
const apiKey = (await new Response(keyRead.stdout).text()).trim();
if ((await keyRead.exited) || !apiKey || apiKey.includes("\n"))
  throw new Error("Configured Zep credential unavailable.");
const client = new ZepClient({ apiKey });
const graphId = `wardrobe-wear-probe-${crypto.randomUUID()}`;
const short = <T>(value: T): T =>
  typeof value === "string"
    ? (value.slice(0, 100) as T)
    : Array.isArray(value)
      ? (value.map(short) as T)
      : value && typeof value === "object"
        ? (Object.fromEntries(
            Object.entries(value).map(([k, v]) => [k, short(v)]),
          ) as T)
        : value;
let created = false;
try {
  await client.graph.create({ graphId, name: "Synthetic wear revision probe" });
  created = true;
  await client.graph.setOntology(
    short({
      WardrobeItem: wardrobeEntityTypes.WardrobeItem,
      ...wearEntityTypes,
    }),
    short(wearEdgeTypes),
    { graphIds: [graphId] },
  );
  const snapshot: WearProjectionSnapshot = {
    kind: "wear",
    userId: "synthetic-only",
    id: "synthetic-wear",
    revision: 1,
    localDate: "2026-09-01",
    timezone: "America/New_York",
    recordedAt: Date.now(),
    active: true,
    itemIds: ["synthetic-shirt", "synthetic-shoes"],
    evidenceIds: ["synthetic-photo"],
  };
  let refs = {
    edgeIds: [] as string[],
    nodeIds: [] as { sourceRef: string; uuid: string; kind: string }[],
  };
  const first = await publishWearProjection(snapshot, refs, async () => {}, {
    graphId,
    apiKey,
  });
  if (first.failureKind || first.taskIds.length || first.edgeIds.length !== 2)
    throw new Error(`Initial probe: ${first.failureKind ?? "missing edges"}`);
  refs = first;
  const second = await publishWearProjection(
    {
      ...snapshot,
      revision: 2,
      recordedAt: Date.now(),
      itemIds: ["synthetic-shirt"],
    },
    refs,
    async () => {},
    { graphId, apiKey },
  );
  if (second.failureKind || second.edgeIds.length !== 1)
    throw new Error(
      `Correction probe: ${second.failureKind ?? "missing edges"}`,
    );
  const edges = await Promise.all(
    first.edgeIds.map((id) => client.graph.edge.get(id)),
  );
  if (
    edges.filter((edge) => !edge.expiredAt).length !== 1 ||
    !edges.some(
      (edge) =>
        edge.expiredAt && edge.attributes?.item_id === "synthetic-shoes",
    ) ||
    !edges.some(
      (edge) => !edge.expiredAt && edge.attributes?.aggregate_revision === 2,
    )
  )
    throw new Error(
      "Correction did not preserve history and current revision.",
    );
  const last = await publishWearProjection(
    {
      ...snapshot,
      revision: 3,
      recordedAt: Date.now(),
      itemIds: [],
      active: false,
    },
    second,
    async () => {},
    { graphId, apiKey },
  );
  if (last.failureKind)
    throw new Error(`Retraction probe: ${last.failureKind}`);
  if ((await client.graph.edge.get(second.edgeIds[0]!)).expiredAt === undefined)
    throw new Error("Retraction left an active edge.");
  console.log(
    JSON.stringify({
      result: "pass",
      assertions: [
        "typed nodes",
        "edge attributes",
        "returned references",
        "correction retains edge UUID",
        "removed membership expires",
        "retraction expires remaining membership",
      ],
      graphScope: "synthetic",
    }),
  );
} finally {
  if (created) {
    await client.graph.delete(graphId);
    console.log("Synthetic graph deleted.");
  }
}
