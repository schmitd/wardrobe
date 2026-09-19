/** Metadata-only inventory and explicit, operator-reviewed legacy ownership import. */
import { mkdir, chmod, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import { Schema } from "effect";
import type { Id } from "../convex/_generated/dataModel";

type InventoryRow = { storageId: Id<"_storage">; createdAt: number; sha256: string; size: number; registeredClaims: string[]; claimsTruncated: boolean; trustedOwner: string | null };
type InventoryPage = { page: InventoryRow[]; isDone: boolean; continueCursor: string };
const Approval = Schema.Struct({ storageId: Schema.String, userId: Schema.String.check(Schema.isNonEmpty()), expectedSha256: Schema.String, expectedCreatedAt: Schema.Number, evidence: Schema.String.check(Schema.isMinLength(20), Schema.isMaxLength(2000)) });
const Manifest = Schema.Struct({ deploymentUrl: Schema.String, reviewedBy: Schema.String.check(Schema.isNonEmpty()), approvals: Schema.Array(Approval).check(Schema.isMaxLength(500)) });
const args = Bun.argv.slice(2);
const option = (name: string) => { const index = args.indexOf(name); return index < 0 ? undefined : args[index + 1]; };
const local = args.includes("--local");
const mode = args[0];
if (mode !== "inventory" && mode !== "review") throw new Error("Usage: storage-review.ts inventory --out PATH [--local] | review --manifest PATH [--local] [--apply]");
const localConfig = local ? await Bun.file(new URL("../../../.convex/local/default/config.json", import.meta.url)).json() : null;
const deploymentUrl = local ? "http://127.0.0.1:3210" : process.env.CONVEX_URL;
const credential = local ? localConfig.adminKey : process.env.CONVEX_DEPLOY_KEY;
if (!deploymentUrl || !credential) throw new Error("Set CONVEX_URL and CONVEX_DEPLOY_KEY for the intended deployment, or use --local.");
const client = new ConvexHttpClient(deploymentUrl) as ConvexHttpClient & { setAdminAuth(token: string): void };
client.setAdminAuth(credential);
const inventory = makeFunctionReference<"query", { pagination: { cursor: string | null; numItems: number } }, InventoryPage>("storageMigration:inventory");
const approve = makeFunctionReference<"mutation", { storageId: Id<"_storage">; userId: string; expectedSha256: string; expectedCreatedAt: number; evidence: string }, null>("storageMigration:approveReviewed");
const rows: InventoryRow[] = [];
let cursor: string | null = null;
for (;;) {
  const page: InventoryPage = await client.query(inventory, { pagination: { cursor, numItems: 50 } });
  rows.push(...page.page);
  if (page.isDone) break;
  if (page.continueCursor === cursor) throw new Error("Inventory cursor did not advance.");
  cursor = page.continueCursor;
}
if (mode === "inventory") {
  const output = option("--out");
  if (!output) throw new Error("Choose a private output file with --out.");
  await mkdir(dirname(output), { recursive: true, mode: 0o700 });
  await writeFile(output, JSON.stringify({ deploymentUrl, generatedAt: new Date().toISOString(), rows }, null, 2) + "\n", { mode: 0o600 });
  await chmod(output, 0o600);
  console.log(`Inventoried ${rows.length} objects: ${rows.filter(row => row.trustedOwner).length} trusted, ${rows.filter(row => !row.trustedOwner).length} require review. No ownership changed.`);
} else {
  const path = option("--manifest");
  if (!path) throw new Error("Choose an operator-reviewed manifest with --manifest.");
  const manifest = Schema.decodeUnknownSync(Manifest)(await Bun.file(path).json());
  if (manifest.deploymentUrl.replace(/\/$/, "") !== deploymentUrl.replace(/\/$/, "")) throw new Error("Manifest belongs to another deployment.");
  const byId = new Map(rows.map(row => [String(row.storageId), row]));
  const seen = new Set<string>();
  for (const [index, entry] of manifest.approvals.entries()) {
    const row = byId.get(entry.storageId);
    if (seen.has(entry.storageId) || !row || row.sha256 !== entry.expectedSha256 || row.createdAt !== entry.expectedCreatedAt || (row.trustedOwner && row.trustedOwner !== entry.userId)) throw new Error(`Review row ${index + 1} conflicts with the current inventory.`);
    seen.add(entry.storageId);
  }
  if (!args.includes("--apply")) console.log(`Dry run passed for ${manifest.approvals.length} approvals. No ownership changed. The operator must verify the ownership basis authorized in STORAGE_CUTOVER.md.`);
  else {
    for (const entry of manifest.approvals) await client.mutation(approve, { ...entry, storageId: entry.storageId as Id<"_storage">, evidence: `${manifest.reviewedBy}: ${entry.evidence}`.slice(0, 2000) });
    console.log(`Applied ${manifest.approvals.length} reviewed approvals. Existing conflicting owners were never replaced.`);
  }
}
