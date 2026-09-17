import { Effect } from "effect";
import type { MutationCtx } from "../convex/_generated/server";
import { internal } from "../convex/_generated/api";
import { UPLOAD_PATH, UPLOAD_TICKET_TTL_MS } from "./uploadPolicy";
import { NotAuthenticated } from "./errors";
export const issueUploadTicket = (ctx: MutationCtx, userId: string): Effect.Effect<string, NotAuthenticated> => Effect.gen(function* () {
  const deleted = yield* Effect.promise(() => ctx.db.query("deletedAccounts").withIndex("by_user", q => q.eq("userId", userId)).unique());
  if (deleted) return yield* new NotAuthenticated({ message: "This account has been deleted." });
  const site = process.env.CONVEX_SITE_URL;
  if (!site) return yield* Effect.die(new Error("CONVEX_SITE_URL is required for uploads."));
  // Mutations cannot use Web Crypto randomness. Hash a server-minted capability;
  // the unused native upload URL is never disclosed to a client.
  const capability = yield* Effect.promise(() => ctx.storage.generateUploadUrl());
  const digest = yield* Effect.promise(() => crypto.subtle.digest("SHA-256", new TextEncoder().encode(capability)));
  const token = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
  const ticketId = yield* Effect.promise(() => ctx.db.insert("uploadTickets", { token, userId, state: "issued", expiresAt: Date.now() + UPLOAD_TICKET_TTL_MS }));
  yield* Effect.promise(() => ctx.scheduler.runAfter(UPLOAD_TICKET_TTL_MS, internal.uploads.expire, { ticketId }));
  const url = new URL(UPLOAD_PATH, site);
  url.searchParams.set("ticket", token);
  return url.toString();
});
