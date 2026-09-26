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
import type * as candidates from "../candidates.js";
import type * as crons from "../crons.js";
import type * as fitChecks from "../fitChecks.js";
import type * as garmentIdentityQueries from "../garmentIdentityQueries.js";
import type * as http from "../http.js";
import type * as mobile from "../mobile.js";
import type * as planning from "../planning.js";
import type * as profile from "../profile.js";
import type * as reminderDelivery from "../reminderDelivery.js";
import type * as reminders from "../reminders.js";
import type * as storage from "../storage.js";
import type * as storageMigration from "../storageMigration.js";
import type * as styleMemory from "../styleMemory.js";
import type * as styleMemoryData from "../styleMemoryData.js";
import type * as uploads from "../uploads.js";
import type * as wardrobe from "../wardrobe.js";
import type * as wardrobes from "../wardrobes.js";
import type * as wear from "../wear.js";
import type * as wearGraph from "../wearGraph.js";
import type * as wearProjectionData from "../wearProjectionData.js";
import type * as zepSync from "../zepSync.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  account: typeof account;
  candidates: typeof candidates;
  crons: typeof crons;
  fitChecks: typeof fitChecks;
  garmentIdentityQueries: typeof garmentIdentityQueries;
  http: typeof http;
  mobile: typeof mobile;
  planning: typeof planning;
  profile: typeof profile;
  reminderDelivery: typeof reminderDelivery;
  reminders: typeof reminders;
  storage: typeof storage;
  storageMigration: typeof storageMigration;
  styleMemory: typeof styleMemory;
  styleMemoryData: typeof styleMemoryData;
  uploads: typeof uploads;
  wardrobe: typeof wardrobe;
  wardrobes: typeof wardrobes;
  wear: typeof wear;
  wearGraph: typeof wearGraph;
  wearProjectionData: typeof wearProjectionData;
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
  actionRetrier: import("@convex-dev/action-retrier/_generated/component.js").ComponentApi<"actionRetrier">;
};
