import { expect, test } from "bun:test";
import { progressStream } from "./progressStream";

test("reader cancellation cannot prevent inference from reaching persistence", async () => {
  const release = Promise.withResolvers<void>();
  const persisted = Promise.withResolvers<void>();
  const stream = progressStream(new AbortController().signal, async send => {
    send({ stage: "analyzing" });
    await release.promise;
    send({ stage: "description" });
    persisted.resolve();
    send({ stage: "complete" });
  });
  const reader = stream.getReader();
  expect((await reader.read()).done).toBe(false);
  await reader.cancel();
  release.resolve();
  await persisted.promise;
  expect((await reader.read()).done).toBe(true);
});

test("connected clients receive valid ordered NDJSON and a clean end", async () => {
  const stream = progressStream(new AbortController().signal, async send => { send({ stage: "tags" }); send({ stage: "complete" }); });
  expect(await new Response(stream).text()).toBe('{"stage":"tags"}\n{"stage":"complete"}\n');
});
