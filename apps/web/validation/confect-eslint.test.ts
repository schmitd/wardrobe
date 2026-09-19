import { expect, test } from "bun:test";
import { Linter } from "eslint";
import plugin from "./confect-eslint.mjs";

// Negative controls prove that the gate catches a violation; examples are not app mocks.
test("architecture lints reject bypasses and accept the documented boundaries", () => {
  const lint = (rule: string, code: string, filename: string) => new Linter().verify(code, [{ files: ["**/*.js"], plugins: { wardrobe: plugin }, rules: { [`wardrobe/${rule}`]: "error" } }], { filename });
  expect(lint("storage-authority", "ctx.storage.getUrl(id)", "confect/other.js")).toHaveLength(1);
  expect(lint("bounded-effect-reads", "ctx.db.query('items').collect()", "confect/new.impl.js")).toHaveLength(1);
  expect(lint("server-direction", 'import { x } from "@/app/actions/wardrobe"', "server/workflow.js")).toHaveLength(1);
  expect(lint("shared-provider-runtime", 'import { Effect as E } from "effect"; import { GeminiLive as Live } from "./GeminiService"; E.provide(Live)', "server/workflow.js")).toHaveLength(1);
  expect(lint("storage-authority", "ownedStorageUrl(ctx, user, id)", "confect/other.js")).toHaveLength(0);
  expect(lint("bounded-effect-reads", "ctx.db.query('items').take(48)", "confect/new.impl.js")).toHaveLength(0);
});
