import { FunctionSpec } from "@confect/core";
import { Schema } from "effect";
import { Id } from "./_generated/id";
import RequireUser from "./middleware/RequireUser.spec";

export class CollectionInput extends Schema.TaggedError<CollectionInput>()(
  "CollectionInput",
  { message: Schema.String },
) {}
export const pagePiecesSpec = FunctionSpec.publicQuery({
  name: "pagePieces",
  args: () => ({
    wardrobeId: Id("wardrobes"),
    paginationOpts: Schema.Struct({
      numItems: Schema.Number,
      cursor: Schema.NullOr(Schema.String),
      id: Schema.optionalKey(Schema.Number),
    }),
  }),
  returns: () =>
    Schema.Struct({
      isDone: Schema.Boolean,
      continueCursor: Schema.String,
      page: Schema.mutable(
        Schema.Array(
          Schema.Struct({
            id: Id("wardrobeItems"),
            imageUrl: Schema.String,
            category: Schema.NullOr(Schema.String),
            description: Schema.NullOr(Schema.String),
            styleTags: Schema.NullOr(
              Schema.mutable(Schema.Array(Schema.String)),
            ),
            note: Schema.String,
            analysisStatus: Schema.String,
            analysisError: Schema.NullOr(Schema.String),
            createdAt: Schema.Number,
          }),
        ),
      ),
    }),
}).middleware(RequireUser);
export const itemDetailsSpec = FunctionSpec.publicQuery({
  name: "itemDetails",
  args: () => ({ itemId: Id("wardrobeItems") }),
  returns: () =>
    Schema.NullOr(
      Schema.Struct({
        note: Schema.String,
        truncated: Schema.Boolean,
        collections: Schema.Array(
          Schema.Struct({ id: Id("wardrobes"), name: Schema.String }),
        ),
      }),
    ),
}).middleware(RequireUser);
export const saveNoteSpec = FunctionSpec.publicMutation({
  name: "saveNote",
  args: () => ({ itemId: Id("wardrobeItems"), note: Schema.String }),
  returns: () => Schema.Null,
  error: () => CollectionInput,
}).middleware(RequireUser);
