import { auth } from "@clerk/nextjs/server";
import { Context, Effect, Layer } from "effect";
import { runServerAction } from "@/lib/run-effect";
import { ArcjetLive, ArcjetService, type AuthenticatedScope, type UserTier } from "@/services/ArcjetService";
import { RequestFailure } from "./errors";

export type ConvexAuthContext = { userId: string; token: string; tier: UserTier };
export class RequestAuth extends Context.Service<RequestAuth, ConvexAuthContext>()("wardrobe/RequestAuth") {}
const authenticate = Effect.gen(function* () {
  const { userId, getToken, has } = yield* Effect.tryPromise({ try: () => auth(), catch: () => new RequestFailure({ status: 503, message: "Sign-in could not be checked. Please try again." }) });
  if (!userId) return yield* new RequestFailure({ status: 401, message: "Unauthorized" });
  const token = yield* Effect.tryPromise({ try: () => getToken({ template: process.env.CLERK_JWT_TEMPLATE ?? "convex" }), catch: () => new RequestFailure({ status: 503, message: "Sign-in could not be checked. Please try again." }) });
  if (!token) return yield* new RequestFailure({ status: 401, message: "Missing Convex token" });
  return { userId, token, tier: has?.({ permission: "compatibility_check" }) || has?.({ plan: "pro" }) ? "pro" as const : "free" as const };
});
// Provide once per request, never cache an authenticated identity in the shared runtime.
export const RequestAuthLive = Layer.effect(RequestAuth, authenticate);
export const getConvexAuth = (): Promise<ConvexAuthContext> => runServerAction(RequestAuth.pipe(Effect.provide(RequestAuthLive)));
export const enforceAuthenticatedProtection = (input: { scope: AuthenticatedScope; tier: UserTier; userId: string }) => runServerAction(
  ArcjetService.pipe(Effect.flatMap(service => service.protectAuthenticated(input)), Effect.provide(ArcjetLive)),
);
