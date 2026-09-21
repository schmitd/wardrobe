import { describe, expect, test } from "bun:test";
import { createHmac } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { receiver } from "./receiver";
import { Store } from "./store";
import { parseEvent, REPOSITORY, REPOSITORY_ID, MAX_BODY_BYTES } from "./events";

const secret = "synthetic-test-secret-never-used-for-deployment";
const head = "a".repeat(40);
const payload = () => ({ repository: { id: REPOSITORY_ID, full_name: REPOSITORY }, action: "synchronize", sender: { login: "schmitd" }, pull_request: { number: 99, base: { ref: "main" }, head: { sha: head, repo: { id: REPOSITORY_ID } } } });
function request(body: string, delivery = "delivery-1", event = "pull_request", signed = true) {
  return new Request("http://localhost/github", { method: "POST", headers: { "x-github-delivery": delivery, "x-github-event": event, "x-hub-signature-256": signed ? `sha256=${createHmac("sha256", secret).update(body).digest("hex")}` : "sha256=" + "0".repeat(64) }, body });
}

describe("authenticated event boundary", () => {
  test("rejects forgery and edited content, but queues a legitimate event", async () => {
    const store = new Store(":memory:"); let wakes = 0;
    const handler = receiver(secret, ["schmitd"], store, () => { wakes++; });
    const body = JSON.stringify(payload());
    expect((await handler(request(body, "forged", "pull_request", false))).status).toBe(401);
    const original = request(body, "edited");
    expect((await handler(new Request(original.url, { method: "POST", headers: original.headers, body: body.replace("synchronize", "opened") }))).status).toBe(401);
    expect(store.next()).toBeNull();
    expect((await handler(request(body))).status).toBe(202);
    expect(wakes).toBe(1);
    expect(store.next()?.event).toEqual({ kind: "pr", number: 99, head, trustHead: true, reason: "pull_request.synchronize" });
    store.close();
  });
  test("replay cannot multiply jobs by replacing the unsigned delivery ID", async () => {
    const store = new Store(":memory:"); let wakes = 0;
    const handler = receiver(secret, ["schmitd"], store, () => { wakes++; });
    const body = JSON.stringify(payload());
    for (let i = 0; i < 100; i++) await handler(request(body, `replay-${i}`));
    expect(wakes).toBe(1); expect(store.next()).not.toBeNull(); expect(store.next()).toBeNull();
    store.close();
  });
  test("neither a fork nor an untrusted sender authorizes Desktop execution", () => {
    const owner = payload(); expect(parseEvent("pull_request", owner, ["schmitd"])).toMatchObject({ trustHead: true });
    const fork = payload(); fork.pull_request.head.repo.id = 123;
    expect(parseEvent("pull_request", fork, ["schmitd"])).toMatchObject({ trustHead: false });
    const outsider = payload(); outsider.sender.login = "outsider";
    expect(parseEvent("pull_request", outsider, ["schmitd"])).toMatchObject({ trustHead: false });
    const label = payload(); label.action = "labeled";
    expect(parseEvent("pull_request", label, ["schmitd"])).toMatchObject({ trustHead: false });
  });
  test("repository identity and head syntax cannot redirect the controller", () => {
    const wrong = payload(); wrong.repository.id = 2;
    expect(parseEvent("pull_request", wrong, ["schmitd"])).toBeNull();
    const injection = payload(); injection.pull_request.head.sha = "$(touch /tmp/should-not-exist)";
    expect(parseEvent("pull_request", injection, ["schmitd"])).toBeNull();
  });
  test("CI completion is a wakeup, never proof of a passed gate", () => {
    const value = { repository: payload().repository, action: "completed", workflow_run: { id: 10, name: "CI", event: "pull_request", head_repository: { id: REPOSITORY_ID }, head_sha: head, actor: { login: "schmitd" }, conclusion: "failure", pull_requests: [{ number: 99 }] } };
    expect(parseEvent("workflow_run", value, ["schmitd"])).toMatchObject({ kind: "ci", numbers: [99], head });
    value.workflow_run.name = "Other";
    expect(parseEvent("workflow_run", value, ["schmitd"])).toBeNull();
  });
  test("oversized bodies and non-webhook routes cannot reach the queue", async () => {
    const store = new Store(":memory:"); const handler = receiver(secret, ["schmitd"], store, () => {});
    expect((await handler(request("x".repeat(MAX_BODY_BYTES + 1)))).status).toBe(413);
    expect((await handler(new Request("http://localhost/private-file"))).status).toBe(404);
    expect(store.next()).toBeNull(); store.close();
  });
});

test("queued work survives a restart without replaying completed work or losing a head trust decision", async () => {
  const directory = await mkdtemp(join(tmpdir(), "wardrobe-queue-test-"));
  try {
    let store = new Store(join(directory, "queue.sqlite"));
    const event = parseEvent("pull_request", payload(), ["schmitd"])!;
    store.receive("one", "hash-one", event); store.receive("two", "hash-two", event);
    const first = store.next()!; store.finish(first.id, "done", "done");
    const interrupted = store.next()!; store.trust(99, head); store.close();
    store = new Store(join(directory, "queue.sqlite")); store.recover();
    expect(store.next()?.id).toBe(interrupted.id);
    expect(store.next()).toBeNull(); expect(store.trusted(99, head)).toBe(true);
    expect(store.trusted(99, "b".repeat(40))).toBe(false); store.close();
  } finally { await rm(directory, { recursive: true, force: true }); }
});
