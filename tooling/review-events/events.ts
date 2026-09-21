import { createHmac, timingSafeEqual, createHash } from "node:crypto";

export const REPOSITORY = "schmitd/wardrobe";
export const REPOSITORY_ID = 1106151081;
export const MAX_BODY_BYTES = 2_000_000;
const sha = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{40}$/.test(value);
const prNumber = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) > 0;
export type Event =
  | { kind: "pr"; number: number; head: string; trustHead: boolean; reason: string }
  | { kind: "ci"; numbers: number[]; head: string; trustHead: boolean; runId: number; reason: string }
  | { kind: "feedback"; number: number; reason: string }
  | { kind: "main"; reason: string };

export function authenticated(body: Uint8Array, signature: string | null, secret: string): boolean {
  if (!signature || !/^sha256=[a-f0-9]{64}$/.test(signature) || body.byteLength > MAX_BODY_BYTES || secret.length < 32) return false;
  const actual = Buffer.from(signature.slice(7), "hex");
  const expected = createHmac("sha256", secret).update(body).digest();
  return timingSafeEqual(actual, expected);
}

export function digest(body: Uint8Array): string { return createHash("sha256").update(body).digest("hex"); }

// Only this bounded, numeric/SHA metadata survives the HTTP boundary. Never pass
// titles, bodies, branch names, workflow commands or repository instructions to a shell.
export function parseEvent(name: string | null, value: unknown, trustedActors: string[]): Event | null {
  if (!value || typeof value !== "object") return null;
  const p = value as Record<string, any>;
  if (p.repository?.id !== REPOSITORY_ID || p.repository?.full_name !== REPOSITORY) return null;
  if (name === "pull_request" && ["opened", "reopened", "synchronize", "ready_for_review", "converted_to_draft", "labeled", "unlabeled", "closed", "edited"].includes(p.action)) {
    const pr = p.pull_request;
    if (p.action === "edited" && !p.changes?.base) return null;
    if (!prNumber(pr?.number) || !sha(pr?.head?.sha) || pr?.base?.ref !== "main") return null;
    return { kind: "pr", number: pr.number, head: pr.head.sha,
      trustHead: ["opened", "reopened", "synchronize", "ready_for_review", "edited"].includes(p.action) && pr.head.repo?.id === REPOSITORY_ID && trustedActors.includes(p.sender?.login),
      reason: `pull_request.${p.action}` };
  }
  if (name === "issue_comment" && ["created", "edited"].includes(p.action) && p.issue?.pull_request && prNumber(p.issue.number) && ["chatgpt-codex-connector[bot]", "chatgpt-codex-connector"].includes(p.comment?.user?.login)) {
    return { kind: "feedback", number: p.issue.number, reason: "issue_comment.codex" };
  }
  if (name === "pull_request_review" && ["submitted", "edited"].includes(p.action) && ["chatgpt-codex-connector[bot]", "chatgpt-codex-connector"].includes(p.review?.user?.login)) {
    const pr = p.pull_request;
    if (!prNumber(pr?.number) || !sha(pr?.head?.sha) || pr?.base?.ref !== "main") return null;
    return { kind: "pr", number: pr.number, head: pr.head.sha, trustHead: false, reason: "pull_request_review.submitted" };
  }
  if (name === "workflow_run" && p.action === "completed") {
    const run = p.workflow_run;
    if (run?.name !== "CI" || run?.event !== "pull_request" || run?.head_repository?.id !== REPOSITORY_ID || !sha(run?.head_sha) || !prNumber(run?.id)) return null;
    return { kind: "ci", numbers: (Array.isArray(run.pull_requests) ? run.pull_requests : []).map((pr: any) => pr.number).filter(prNumber).slice(0, 100),
      head: run.head_sha, runId: run.id, trustHead: trustedActors.includes(run.actor?.login), reason: "workflow_run.CI.completed" };
  }
  if (name === "push" && p.ref === "refs/heads/main" && !p.deleted && sha(p.after)) return { kind: "main", reason: "push.main" };
  return null;
}
