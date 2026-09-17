import { MiddlewareImpl } from "@confect/server";
import { Effect } from "effect";
import schema from "../_generated/schema";
import { Auth, DatabaseReader } from "../_generated/services";
import { NotAuthenticated } from "../errors";
import RequireUser, { CurrentUser } from "./RequireUser.spec";

export default MiddlewareImpl.provides(schema, RequireUser, CurrentUser, Effect.gen(function* () {
  const auth = yield* Auth;
  const identity = yield* auth.getUserIdentity.pipe(
    Effect.mapError(() => new NotAuthenticated({ message: "Sign in to continue." })),
  );
  const reader = yield* DatabaseReader;
  const deleted = yield* reader.table("deletedAccounts").index("by_user", q => q.eq("userId", identity.subject)).first().pipe(Effect.orDie);
  if (deleted._tag === "Some") return yield* new NotAuthenticated({ message: "This account has been deleted." });
  return { userId: identity.subject };
}));
