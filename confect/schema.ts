import { GenericId } from "@confect/core";
import { DatabaseSchema, Table } from "@confect/server";
import { Schema } from "effect";

const OptionalString = Schema.optionalWith(Schema.String, { exact: true });

export const analysisStatusSchema = Schema.Union(
  Schema.Literal("queued"),
  Schema.Literal("processing_tags"),
  Schema.Literal("processing_description"),
  Schema.Literal("processing_embedding"),
  Schema.Literal("ready"),
  Schema.Literal("error"),
);

const wardrobeItems = Table.make(
  "wardrobeItems",
  Schema.Struct({
    userId: Schema.String,
    storageId: GenericId.GenericId("_storage"),
    clientFileName: OptionalString,
    contentType: OptionalString,
    category: OptionalString,
    description: OptionalString,
    styleTags: Schema.optionalWith(Schema.Array(Schema.String), { exact: true }),
    embedding: Schema.optionalWith(Schema.Array(Schema.Number), { exact: true }),
    analysisStatus: analysisStatusSchema,
    analysisError: OptionalString,
    traceId: OptionalString,
    traceparent: OptionalString,
    createdAt: Schema.Number,
    updatedAt: Schema.Number,
  }),
)
  .index("by_user", ["userId"])
  .index("by_user_createdAt", ["userId", "createdAt"]);

const profiles = Table.make(
  "profiles",
  Schema.Struct({
    userId: Schema.String,
    bio: OptionalString,
    skinTone: OptionalString,
    hairColor: OptionalString,
    updatedAt: Schema.Number,
  }),
).index("by_user", ["userId"]);

const uploads = Table.make(
  "uploads",
  Schema.Struct({
    userId: Schema.String,
    storageId: GenericId.GenericId("_storage"),
    purpose: Schema.String,
    createdAt: Schema.Number,
  }),
)
  .index("by_user_storage", ["userId", "storageId"])
  .index("by_storage", ["storageId"]);

const subscriptions = Table.make(
  "subscriptions",
  Schema.Struct({
    userId: Schema.String,
    status: OptionalString,
    updatedAt: Schema.Number,
  }),
).index("by_user", ["userId"]);

export default DatabaseSchema.make()
  .addTable(wardrobeItems)
  .addTable(profiles)
  .addTable(uploads)
  .addTable(subscriptions);
