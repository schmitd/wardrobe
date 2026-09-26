import { Table, GenericId } from "@confect/core";
import { Schema } from "effect";
export default Table.make(() =>
  Schema.Struct({
    userId: Schema.String,
    daily: Schema.Boolean,
    planned: Schema.Boolean,
    timezone: Schema.String,
    middayMinute: Schema.Number,
    quietStart: Schema.Number,
    quietEnd: Schema.Number,
    dailyCap: Schema.Number,
    primaryInstallationId: Schema.optionalKey(
      GenericId.GenericId("notificationInstallations"),
    ),
    revision: Schema.Number,
    nextReconcileAt: Schema.Number,
    captureUntil: Schema.optionalKey(Schema.Number),
    capturePlanId: Schema.optionalKey(GenericId.GenericId("outfitSuggestions")),
    updatedAt: Schema.Number,
  }),
)
  .index("by_user", ["userId"])
  .index("by_reconcile", ["nextReconcileAt"]);
