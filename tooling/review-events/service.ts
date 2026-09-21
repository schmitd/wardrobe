import { resolve } from "node:path";
import { mkdir, chmod } from "node:fs/promises";
import { readConfig } from "./config";
import { Store } from "./store";
import { receiver } from "./receiver";
import { dispatch } from "./dispatch";
import { MAX_BODY_BYTES } from "./events";

const config = await readConfig(Bun.argv[2] ?? "");
await mkdir(config.stateDirectory, { recursive: true, mode: 0o700 });
const secret = (await Bun.file(config.secretFile).text()).trim();
if (secret.length < 32) throw new Error("Webhook secret must contain at least 32 characters");
const store = new Store(resolve(config.stateDirectory, "queue.sqlite"));
await chmod(resolve(config.stateDirectory, "queue.sqlite"), 0o600);
store.recover();
let running = false;
async function drain() {
  if (running) return;
  running = true;
  try {
    let row;
    while ((row = store.next())) {
      console.log(JSON.stringify({ event: row.id, state: "running", reason: row.event.reason }));
      try {
        const detail = await dispatch(row.event, config, store);
        store.finish(row.id, "done", detail);
        console.log(JSON.stringify({ event: row.id, state: "done", detail }));
      } catch (error) {
        const detail = String(error);
        store.finish(row.id, "failed", detail);
        console.error(JSON.stringify({ event: row.id, state: "failed", detail }));
      }
    }
  } finally { running = false; }
}
Bun.serve({ hostname: "127.0.0.1", port: config.port, maxRequestBodySize: MAX_BODY_BYTES, idleTimeout: 10,
  fetch: receiver(secret, config.trustedActors, store, () => { queueMicrotask(() => void drain()); }) });
console.log(`Wardrobe event receiver on loopback:${config.port}; execution=${config.execute}`);
void drain();
