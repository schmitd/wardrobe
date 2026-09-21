import { Table } from "@confect/core";
import { Schema } from "effect";
export default Table.make(() => Schema.Struct({ userId: Schema.String, revision: Schema.Number, attempts: Schema.Number, queuedAt: Schema.Number, updatedAt: Schema.Number })).index("by_user", ["userId"]);
