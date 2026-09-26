import { Table, GenericId } from "@confect/core";
import { Schema } from "effect";
export default Table.make(() =>
  Schema.Struct({
    userId: Schema.String,
    intentId: GenericId.GenericId("notificationIntents"),
    installationId: GenericId.GenericId("notificationInstallations"),
    installationRevision: Schema.Number,
    preferenceRevision: Schema.Number,
    outcome: Schema.Union([
      Schema.Literal("reserved"),
      Schema.Literal("provider_accepted"),
      Schema.Literal("provider_handoff"),
      Schema.Literal("definite_rejection"),
      Schema.Literal("unknown"),
    ]),
    providerTicket: Schema.optionalKey(Schema.String),
    errorKind: Schema.optionalKey(Schema.String),
    receiptChecks: Schema.Number,
    createdAt: Schema.Number,
    updatedAt: Schema.Number,
  }),
)
  .index("by_created", ["createdAt"])
  .index("by_intent", ["intentId"])
  .index("by_user", ["userId"])
  .index("by_outcome", ["outcome", "updatedAt"]);
