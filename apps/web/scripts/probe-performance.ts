import { parseArgs } from "node:util";
import { resolve } from "node:path";
import { mkdir } from "node:fs/promises";
import { convexTest } from "convex-test";
import { validateOutfit } from "@wardrobe/shared";
import schema from "../convex/schema";
import { api } from "../convex/_generated/api";
import { boundedInteger } from "../validation/property-options";

const { values } = parseArgs({ args: Bun.argv.slice(2), options: { sizes: { type: "string" }, samples: { type: "string" }, output: { type: "string" } } });
const sizes = (values.sizes ?? "50,500,2000").split(",").map(s => boundedInteger(s, 0, 1, 5000));
if (sizes.length > 5) throw new Error("At most five sizes");
const samples = boundedInteger(values.samples, 7, 3, 30);
const directory = new URL("../convex/", import.meta.url).pathname;
const modules = Object.fromEntries([...new Bun.Glob("**/*.{ts,js}").scanSync(directory)].map(path => [`./${path}`, () => import(`${directory}${path}`)]));
async function measure(run: () => unknown | Promise<unknown>) {
  for (let i = 0; i < 3; i++) await run();
  const times: number[] = [];
  for (let i = 0; i < samples; i++) { const start = performance.now(); await run(); times.push(performance.now() - start); }
  times.sort((a, b) => a - b);
  return { p50Ms: times[Math.floor(times.length / 2)], p95Ms: times[Math.min(times.length - 1, Math.ceil(times.length * .95) - 1)], samples, warmups: 3 };
}
const owned = new Set(Array.from({ length: 2000 }, (_, i) => `piece-${i}`));
const unit = await measure(() => { for (let i = 0; i < 1000; i++) validateOutfit({ title: "Synthetic", rationale: "Owned", itemIds: ["piece-1", "piece-999"], missing: [] }, owned); });
const integration = [];
for (const size of sizes) {
  const t = convexTest(schema, modules);
  await t.run(async ctx => {
    const storageId = await ctx.storage.store(new Blob(["synthetic"]));
    await ctx.db.insert("storageObjects", { storageId, userId: "probe", provenance: "upload", createdAt: 1 });
    for (let i = 0; i < size; i++) await ctx.db.insert("wardrobeItems", { userId: "probe", storageId, analysisStatus: "ready", embedding: Array(768).fill(.1), createdAt: i, updatedAt: i });
  });
  let bytes = 0; let rows = 0;
  const timings = await measure(async () => {
    const result = await t.withIdentity({ subject: "probe" }).query(api.mobile.bootstrap, {});
    const json = JSON.stringify(result); bytes = new TextEncoder().encode(json).length; rows = result.items.length;
    if (rows !== Math.min(48, size) || bytes > 100_000 || /"(?:visualEmbedding|semanticEmbedding|embedding)":/.test(json)) throw new Error("Bootstrap size/projection budget failed");
  });
  integration.push({ accountItems: size, returnedRows: rows, bytes, ...timings });
}
const output = resolve(import.meta.dir, "../../..", values.output ?? "output/performance.json");
await mkdir(resolve(output, ".."), { recursive: true });
await Bun.write(output, JSON.stringify({ scope: "in-process Convex harness; timings advisory, row/byte/projection budgets enforced", unit: { operation: "1000 outfit validations", ...unit }, integration }, null, 2));
console.log(await Bun.file(output).text());
