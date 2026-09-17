import { componentsGeneric } from "convex/server";

export type Components = {
  "actionRetrier": import("@convex-dev/action-retrier/_generated/component.js").ComponentApi<"actionRetrier">;
};

export const components: Components = componentsGeneric() as any;
