/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as account from "../account.js";
import type * as authIdentity from "../authIdentity.js";
import type * as candidates from "../candidates.js";
import type * as fitChecks from "../fitChecks.js";
import type * as garmentIdentityQueries from "../garmentIdentityQueries.js";
import type * as http from "../http.js";
import type * as profile from "../profile.js";
import type * as retrier from "../retrier.js";
import type * as storage from "../storage.js";
import type * as styleBioPolicy from "../styleBioPolicy.js";
import type * as trace from "../trace.js";
import type * as wardrobe from "../wardrobe.js";
import type * as wardrobes from "../wardrobes.js";
import type * as zep from "../zep.js";
import type * as zepOntology from "../zepOntology.js";
import type * as zepSync from "../zepSync.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  account: typeof account;
  authIdentity: typeof authIdentity;
  candidates: typeof candidates;
  fitChecks: typeof fitChecks;
  garmentIdentityQueries: typeof garmentIdentityQueries;
  http: typeof http;
  profile: typeof profile;
  retrier: typeof retrier;
  storage: typeof storage;
  styleBioPolicy: typeof styleBioPolicy;
  trace: typeof trace;
  wardrobe: typeof wardrobe;
  wardrobes: typeof wardrobes;
  zep: typeof zep;
  zepOntology: typeof zepOntology;
  zepSync: typeof zepSync;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  actionRetrier: {
    public: {
      cancel: FunctionReference<
        "mutation",
        "internal",
        { runId: string },
        boolean
      >;
      cleanup: FunctionReference<
        "mutation",
        "internal",
        { runId: string },
        any
      >;
      start: FunctionReference<
        "mutation",
        "internal",
        {
          functionArgs: any;
          functionHandle: string;
          options: {
            base: number;
            initialBackoffMs: number;
            logLevel: "DEBUG" | "INFO" | "WARN" | "ERROR";
            maxFailures: number;
            onComplete?: string;
            runAfter?: number;
            runAt?: number;
          };
        },
        string
      >;
      status: FunctionReference<
        "query",
        "internal",
        { runId: string },
        | { type: "inProgress" }
        | {
            result:
              | { returnValue: any; type: "success" }
              | { error: string; type: "failed" }
              | { type: "canceled" };
            type: "completed";
          }
      >;
    };
  };
};
