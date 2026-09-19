import { Table } from "@confect/core";
import { Schema } from "effect";
import { Id } from "../_generated/id";

export default Table.make(() => Schema.Struct({
  userId: Schema.String,
  fitCheckId: Id("fitChecks"),
  wardrobeItemId: Schema.optionalKey(Id("wardrobeItems")),
  source: Schema.Union([Schema.Literal("matched_existing"), Schema.Literal("created_from_fit_check"), Schema.Literal("transcribed_only"), Schema.Literal("observed_unresolved")]),
  category: Schema.optionalKey(Schema.String),
  description: Schema.optionalKey(Schema.String),
  styleTags: Schema.optionalKey(Schema.Array(Schema.String)),
  boundingBox: Schema.optionalKey(Schema.Struct({
  x: Schema.Number,
  y: Schema.Number,
  width: Schema.Number,
  height: Schema.Number,
})),
  confidence: Schema.optionalKey(Schema.Number),
  createdAt: Schema.Number,
}))
    .index("by_user", ["userId"])
    .index("by_fit_check", ["fitCheckId"])
    .index("by_wardrobe_item", ["wardrobeItemId"]);
