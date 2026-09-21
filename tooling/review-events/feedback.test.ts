import { expect, test } from "bun:test";
import { coversThreads, threadFingerprint, type Thread, type Report } from "./review";
import { parseEvent, REPOSITORY, REPOSITORY_ID } from "./events";

test("feedback edits and replies invalidate prior dispositions", () => {
  const thread: Thread = { id: "T", path: "file.ts", comments: [{ author: "reviewer", body: "original", url: "synthetic", commit: "a".repeat(40) }] };
  const report = { threads: [{ id: "T", fingerprint: threadFingerprint(thread), disposition: "fixed", reason: "verified", evidence: "probe" }] } as Report;
  expect(coversThreads(report, [thread])).toBe(true);
  expect(coversThreads(report, [{ ...thread, path: "other.ts" }])).toBe(false);
  expect(coversThreads(report, [{ ...thread, comments: [{ ...thread.comments[0]!, body: "corrected concern" }] }])).toBe(false);
  expect(coversThreads(report, [{ ...thread, comments: [...thread.comments, { ...thread.comments[0]!, body: "new reply" }] }])).toBe(false);
});

test("only Codex review submissions wake review, and retargeting needs a trusted actor", () => {
  const p: any = { repository: { id: REPOSITORY_ID, full_name: REPOSITORY }, sender: { login: "schmitd" }, action: "submitted", review: { user: { login: "outsider" } }, pull_request: { number: 99, base: { ref: "main" }, head: { sha: "a".repeat(40), repo: { id: REPOSITORY_ID } } } };
  expect(parseEvent("pull_request_review", p, ["schmitd"])).toBeNull();
  p.review.user.login = "chatgpt-codex-connector[bot]";
  expect(parseEvent("pull_request_review", p, ["schmitd"])).toMatchObject({ trustHead: false });
  p.action = "edited";
  expect(parseEvent("pull_request", p, ["schmitd"])).toBeNull();
  p.changes = { base: { ref: { from: "other" } } };
  expect(parseEvent("pull_request", p, ["schmitd"])).toMatchObject({ trustHead: true });
  p.sender.login = "outsider";
  expect(parseEvent("pull_request", p, ["schmitd"])).toMatchObject({ trustHead: false });
});
