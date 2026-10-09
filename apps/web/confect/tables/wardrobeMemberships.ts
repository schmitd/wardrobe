import { Table } from "@confect/core";
import { Schema } from "effect";
import { Id } from "../_generated/id";

export default Table.make(() => Schema.Struct({
  userId: Schema.String,
  wardrobeId: Id("wardrobes"),
  itemId: Schema.optionalKey(Id("wardrobeItems")),
  candidateItemId: Schema.optionalKey(Id("candidateItems")),
  membershipKind: Schema.String,
  removed: Schema.optionalKey(Schema.Boolean),
  rationale: Schema.optionalKey(Schema.String),
  createdAt: Schema.Number,
  updatedAt: Schema.Number,
}))
    .index("by_user", ["userId"])
    .index("by_wardrobe", ["wardrobeId"])
    .index("by_item", ["itemId"])
    .index("by_candidate", ["candidateItemId"])
    .index("by_candidate_wardrobe", ["candidateItemId", "wardrobeId"])
    .index("by_wardrobe_item", ["wardrobeId", "itemId"]);
