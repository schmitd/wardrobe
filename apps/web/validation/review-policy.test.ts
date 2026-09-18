import { expect, test } from "bun:test";
import { mergeReadiness } from "../../../scripts/review-policy";
const base = "a".repeat(40), head = "b".repeat(40);
const pass = { base, head, verdict: "pass" as const, summary: "Verified", findings: [], decisions: [], coverageGaps: [], commands: [{ command: "bun run validate core", exitCode: 0, artifact: "output/core.log" }] };
test("merge attestation rejects stale, incomplete, failed, and decision-held reviews", () => {
  expect(mergeReadiness(pass, base, head)).toBe(pass);
  for (const bad of [{ ...pass, head: base }, { ...pass, base: head }, { ...pass, verdict: "incomplete" }, { ...pass, findings: ["Confirmed ownership bypass"] }, { ...pass, decisions: ["Legacy data policy"] }, { ...pass, coverageGaps: ["Browser did not run"] }, { ...pass, commands: [] }, { ...pass, commands: [{ ...pass.commands[0], exitCode: 1 }] }, { ...pass, commands: [{ ...pass.commands[0], artifact: "" }] }]) expect(() => mergeReadiness(bad, base, head)).toThrow();
});
