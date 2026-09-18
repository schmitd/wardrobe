import { expect, test } from "bun:test";
import fc from "fast-check";
import { convexTest } from "convex-test";
import schema from "../convex/schema";
import { api } from "../convex/_generated/api";
import { propertyOptions } from "./property-options";

const directory = new URL("../convex/", import.meta.url).pathname;
const modules = Object.fromEntries([...new Bun.Glob("**/*.{ts,js}").scanSync(directory)].map(path => [`./${path}`, () => import(`${directory}${path}`)]));

test("fuzz: arbitrary claim order never changes the authoritative photo owner", async () => {
  await fc.assert(fc.asyncProperty(fc.array(fc.record({ actor: fc.constantFrom("alice", "bob", "anonymous"), operation: fc.constantFrom("claim", "read", "poison") }), { minLength: 1, maxLength: 25 }), async operations => {
    const t = convexTest(schema, modules);
    const photo = await t.run(async ctx => {
      const storageId = await ctx.storage.store(new Blob(["synthetic"]));
      await ctx.db.insert("storageObjects", { storageId, userId: "alice", provenance: "upload", createdAt: 1 });
      return storageId;
    });
    for (const { actor, operation } of operations) {
      if (operation === "poison") {
        // Historical contaminated rows are input too; purpose metadata is never authority.
        await t.run(ctx => ctx.db.insert("uploads", { storageId: photo, userId: actor, purpose: "selfie", createdAt: 1 }));
        continue;
      }
      const client = actor === "anonymous" ? t : t.withIdentity({ subject: actor });
      const call = operation === "claim" ? client.mutation(api.storage.registerUpload, { storageId: photo, purpose: "selfie" }) : client.query(api.storage.getStorageUrl, { storageId: photo });
      if (actor === "alice") expect(await call).toBeTruthy();
      else await expect(call).rejects.toThrow();
    }
    expect(await t.withIdentity({ subject: "alice" }).query(api.storage.getStorageUrl, { storageId: photo })).toBeString();
    expect((await t.run(ctx => ctx.db.query("storageObjects").collect())).map(row => row.userId)).toEqual(["alice"]);
  }), propertyOptions);
}, 30_000);
