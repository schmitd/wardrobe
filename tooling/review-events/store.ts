import { Database } from "bun:sqlite";
import type { Event } from "./events";

export class Store {
  static readonly MAX_PENDING = 1_000;
  static readonly MAX_FINISHED = 5_000;
  readonly db: Database;
  constructor(path: string) {
    this.db = new Database(path, { create: true });
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS events (id INTEGER PRIMARY KEY, delivery TEXT UNIQUE NOT NULL, digest TEXT UNIQUE NOT NULL, event TEXT NOT NULL, state TEXT NOT NULL DEFAULT 'pending', received TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, finished TEXT, detail TEXT);
      CREATE TABLE IF NOT EXISTS trusted_heads (pr INTEGER NOT NULL, head TEXT NOT NULL, PRIMARY KEY(pr, head));`);
  }
  receive(delivery: string, digest: string, event: Event): boolean {
    return this.db.transaction(() => {
      if (this.db.query("SELECT 1 FROM events WHERE delivery=? OR digest=?").get(delivery, digest)) return false;
      const pending = this.db.query("SELECT COUNT(*) AS count FROM events WHERE state IN ('pending','running')").get() as { count: number };
      if (pending.count >= Store.MAX_PENDING) throw new Error("Queue full");
      return this.db.query("INSERT INTO events (delivery,digest,event) VALUES (?,?,?)").run(delivery, digest, JSON.stringify(event)).changes === 1;
    })();
  }
  trust(pr: number, head: string) { this.db.transaction(() => {
    this.db.query("DELETE FROM trusted_heads WHERE pr=? AND head<>?").run(pr, head);
    this.db.query("INSERT OR IGNORE INTO trusted_heads VALUES (?,?)").run(pr, head);
  })(); }
  forget(pr: number) { this.db.query("DELETE FROM trusted_heads WHERE pr=?").run(pr); }
  trusted(pr: number, head: string): boolean { return Boolean(this.db.query("SELECT 1 FROM trusted_heads WHERE pr=? AND head=?").get(pr, head)); }
  recover() { this.db.exec("UPDATE events SET state='pending',detail='Resuming interrupted delivery after service restart' WHERE state='running'"); }
  next(): { id: number; event: Event } | null {
    return this.db.transaction(() => {
      const row = this.db.query("SELECT id,event FROM events WHERE state='pending' ORDER BY id LIMIT 1").get() as { id: number; event: string } | null;
      if (!row) return null;
      this.db.query("UPDATE events SET state='running' WHERE id=?").run(row.id);
      return { id: row.id, event: JSON.parse(row.event) };
    })();
  }
  finish(id: number, state: "done" | "failed", detail: string) { this.db.transaction(() => {
    this.db.query("UPDATE events SET state=?,finished=CURRENT_TIMESTAMP,detail=? WHERE id=?").run(state, detail.slice(0, 4000), id);
    this.db.query("DELETE FROM events WHERE id IN (SELECT id FROM events WHERE state IN ('done','failed') ORDER BY id DESC LIMIT -1 OFFSET ?)").run(Store.MAX_FINISHED);
  })(); }
  close() { this.db.close(); }
}
