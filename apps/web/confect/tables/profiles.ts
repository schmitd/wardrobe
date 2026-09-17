import { Table } from "@confect/core";
import { Schema } from "effect";
import { Id } from "../_generated/id";

export default Table.make(() => Schema.Struct({
  userId: Schema.String,
  bio: Schema.optionalKey(Schema.String),
  bioSource: Schema.optionalKey(Schema.String),
  bioManualAnchor: Schema.optionalKey(Schema.String),
  bioContextFingerprint: Schema.optionalKey(Schema.String),
  bioClosetItemCount: Schema.optionalKey(Schema.Number),
  bioFitCheckCount: Schema.optionalKey(Schema.Number),
  bioCollectionCount: Schema.optionalKey(Schema.Number),
  bioCollectionMembershipCount: Schema.optionalKey(Schema.Number),
  bioGeneratedAt: Schema.optionalKey(Schema.Number),
  bioLastManualEditAt: Schema.optionalKey(Schema.Number),
  bioRevisionId: Schema.optionalKey(Id("profileBioRevisions")),
  skinTone: Schema.optionalKey(Schema.String),
  complexion: Schema.optionalKey(Schema.String),
  hairColor: Schema.optionalKey(Schema.String),
  colorSeason: Schema.optionalKey(Schema.String),
  updatedAt: Schema.Number,
})).index("by_user", ["userId"]);
