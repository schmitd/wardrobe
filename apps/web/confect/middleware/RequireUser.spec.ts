import { MiddlewareSpec } from "@confect/core";
import { Context } from "effect";
import { NotAuthenticated } from "../errors";

export class CurrentUser extends Context.Service<CurrentUser, { userId: string }>()("wardrobe/CurrentUser") {}

export default class RequireUser extends MiddlewareSpec.MiddlewareSpec<RequireUser, { provides: CurrentUser }>()(
  "wardrobe/RequireUser", {
    error: () => NotAuthenticated,
    functionTypes: { query: true, mutation: true, action: false },
  },
) {}
