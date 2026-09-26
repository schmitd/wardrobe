import { Table } from "@confect/core";
import { Schema } from "effect";
export default Table.make(() =>
  Schema.Struct({
    userId: Schema.String,
    installationId: Schema.String,
    transport: Schema.Union([Schema.Literal("expo"), Schema.Literal("web")]),
    endpoint: Schema.String,
    p256dh: Schema.optionalKey(Schema.String),
    auth: Schema.optionalKey(Schema.String),
    label: Schema.String,
    revision: Schema.Number,
    revokedAt: Schema.optionalKey(Schema.Number),
    lastSeenAt: Schema.Number,
  }),
)
  .index("by_revoked", ["revokedAt"])
  .index("by_seen", ["lastSeenAt"])
  .index("by_user", ["userId"])
  .index("by_installation", ["installationId"])
  .index("by_endpoint", ["endpoint"]);
