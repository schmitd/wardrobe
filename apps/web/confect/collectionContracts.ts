import { FunctionSpec } from "@confect/core";
import { Schema } from "effect";
import { Id } from "./_generated/id";
import RequireUser from "./middleware/RequireUser.spec";

// Match Convex's reactive pagination contract, including range/split cursors.
const paginationOptions = Schema.Struct({
  numItems: Schema.Number,
  cursor: Schema.NullOr(Schema.String),
  endCursor: Schema.optionalKey(Schema.NullOr(Schema.String)),
  id: Schema.optionalKey(Schema.Number),
  maximumRowsRead: Schema.optionalKey(Schema.Number),
  maximumBytesRead: Schema.optionalKey(Schema.Number),
});
const paginationResult = {
  isDone: Schema.Boolean,
  continueCursor: Schema.String,
  splitCursor: Schema.optionalKey(Schema.NullOr(Schema.String)),
  pageStatus: Schema.optionalKey(
    Schema.NullOr(Schema.Literals(["SplitRecommended", "SplitRequired"])),
  ),
};

export class CollectionInput extends Schema.TaggedError<CollectionInput>()(
  "CollectionInput",
  { message: Schema.String },
) {}
export const pageCollectionsSpec = FunctionSpec.publicQuery({
  name: "pageCollections",
  args: () => ({
    paginationOpts: paginationOptions,
  }),
  returns: () =>
    Schema.Struct({
      ...paginationResult,
      page: Schema.mutable(
        Schema.Array(
          Schema.Struct({
            _id: Id("wardrobes"),
            name: Schema.String,
            description: Schema.NullOr(Schema.String),
            previews: Schema.mutable(
              Schema.Array(
                Schema.Struct({
                  id: Schema.String,
                  imageUrl: Schema.String,
                  category: Schema.NullOr(Schema.String),
                }),
              ),
            ),
          }),
        ),
      ),
    }),
}).middleware(RequireUser);
export const pagePiecesSpec = FunctionSpec.publicQuery({
  name: "pagePieces",
  args: () => ({
    wardrobeId: Id("wardrobes"),
    paginationOpts: paginationOptions,
  }),
  returns: () =>
    Schema.Struct({
      ...paginationResult,
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
export const pageInspirationSpec = FunctionSpec.publicQuery({
  name: "pageInspiration",
  args: () => ({
    wardrobeId: Id("wardrobes"),
    paginationOpts: paginationOptions,
  }),
  returns: () =>
    Schema.Struct({
      ...paginationResult,
      page: Schema.mutable(
        Schema.Array(
          Schema.Struct({
            _id: Id("candidateItems"),
            imageUrl: Schema.NullOr(Schema.String),
            category: Schema.NullOr(Schema.String),
            description: Schema.NullOr(Schema.String),
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
