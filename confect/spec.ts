import { FunctionSpec, GenericId, GroupSpec, Spec } from "@confect/core";
import { Schema } from "effect";

import schema, { analysisStatusSchema } from "./schema";

const OptionalString = Schema.optionalWith(Schema.String, { exact: true });
const OptionalNumber = Schema.optionalWith(Schema.Number, { exact: true });
const OptionalNumberArray = Schema.optionalWith(Schema.Array(Schema.Number), {
  exact: true,
});
const OptionalStringArray = Schema.optionalWith(Schema.Array(Schema.String), {
  exact: true,
});
const NullableString = Schema.Union(Schema.String, Schema.Null);
const OptionalWardrobeItemId = Schema.optionalWith(
  GenericId.GenericId("wardrobeItems"),
  {
    exact: true,
  },
);
const OptionalNullableString = Schema.optionalWith(NullableString, {
  exact: true,
});

const WardrobeItemDocument = schema.tables.wardrobeItems.Doc;
const ProfileDocument = schema.tables.profiles.Doc;

const WardrobeListItemSchema = Schema.Struct({
  id: GenericId.GenericId("wardrobeItems"),
  imageUrl: Schema.String,
  category: NullableString,
  description: NullableString,
  styleTags: Schema.Union(Schema.Array(Schema.String), Schema.Null),
  analysisStatus: analysisStatusSchema,
  analysisError: NullableString,
  createdAt: Schema.Number,
});

const WardrobeItemWithUrlSchema = Schema.Struct({
  _id: GenericId.GenericId("wardrobeItems"),
  _creationTime: Schema.Number,
  userId: Schema.String,
  storageId: GenericId.GenericId("_storage"),
  clientFileName: OptionalString,
  contentType: OptionalString,
  category: OptionalString,
  description: OptionalString,
  styleTags: OptionalStringArray,
  embedding: OptionalNumberArray,
  analysisStatus: analysisStatusSchema,
  analysisError: OptionalString,
  traceId: OptionalString,
  traceparent: OptionalString,
  createdAt: Schema.Number,
  updatedAt: Schema.Number,
  imageUrl: Schema.String,
});

const StorageMetadataSchema = Schema.Struct({
  contentType: NullableString,
  size: Schema.Number,
  sha256: Schema.String,
});

const SuccessSchema = Schema.Struct({ success: Schema.Boolean });
const OkSchema = Schema.Struct({ ok: Schema.Boolean });
const SimilarityContextItemSchema = Schema.Struct({
  category: NullableString,
  description: NullableString,
});
const SyncEventTypeSchema = Schema.Union(
  Schema.Literal("wardrobe_add"),
  Schema.Literal("wardrobe_delete"),
  Schema.Literal("profile_update"),
);
const ZepInfluenceSignalSchema = Schema.Struct({
  kind: Schema.String,
  signal: Schema.String,
  weight: Schema.Number,
});
const ZepCompatibilityContextSchema = Schema.Struct({
  context: NullableString,
  influenceSignals: Schema.Array(ZepInfluenceSignalSchema),
  ontology: Schema.Array(Schema.String),
});

const wardrobeGroup = GroupSpec.make("wardrobe")
  .addFunction(
    FunctionSpec.publicQuery({
      name: "listWardrobeItems",
      args: Schema.Struct({}),
      returns: Schema.Array(WardrobeListItemSchema),
    }),
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "getUploadUrl",
      args: Schema.Struct({}),
      returns: Schema.String,
    }),
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "createWardrobeItem",
      args: Schema.Struct({
        storageId: GenericId.GenericId("_storage"),
        clientFileName: OptionalString,
        contentType: OptionalString,
        traceId: OptionalString,
        traceparent: OptionalString,
      }),
      returns: Schema.Struct({ id: GenericId.GenericId("wardrobeItems") }),
    }),
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "deleteWardrobeItem",
      args: Schema.Struct({
        itemId: GenericId.GenericId("wardrobeItems"),
        reason: Schema.String,
      }),
      returns: SuccessSchema,
    }),
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "getWardrobeItem",
      args: Schema.Struct({ itemId: GenericId.GenericId("wardrobeItems") }),
      returns: WardrobeItemDocument,
    }),
  )
  .addFunction(
    FunctionSpec.internalQuery({
      name: "getWardrobeItemInternal",
      args: Schema.Struct({ itemId: GenericId.GenericId("wardrobeItems") }),
      returns: Schema.Union(WardrobeItemDocument, Schema.Null),
    }),
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "getWardrobeItemWithUrl",
      args: Schema.Struct({ itemId: GenericId.GenericId("wardrobeItems") }),
      returns: WardrobeItemWithUrlSchema,
    }),
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "listItemsForSimilarity",
      args: Schema.Struct({ limit: OptionalNumber }),
      returns: Schema.Array(WardrobeItemDocument),
    }),
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "setAnalysisStatus",
      args: Schema.Struct({
        itemId: GenericId.GenericId("wardrobeItems"),
        status: analysisStatusSchema,
      }),
      returns: Schema.Null,
    }),
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "applyTags",
      args: Schema.Struct({
        itemId: GenericId.GenericId("wardrobeItems"),
        category: OptionalNullableString,
        styleTags: Schema.Array(Schema.String),
      }),
      returns: Schema.Null,
    }),
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "applyDescription",
      args: Schema.Struct({
        itemId: GenericId.GenericId("wardrobeItems"),
        category: OptionalNullableString,
        description: Schema.String,
      }),
      returns: Schema.Null,
    }),
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "applyEmbedding",
      args: Schema.Struct({
        itemId: GenericId.GenericId("wardrobeItems"),
        embedding: Schema.Array(Schema.Number),
      }),
      returns: Schema.Null,
    }),
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "applyFullAnalysis",
      args: Schema.Struct({
        itemId: GenericId.GenericId("wardrobeItems"),
        category: OptionalNullableString,
        description: Schema.String,
        styleTags: Schema.Array(Schema.String),
        embedding: Schema.Array(Schema.Number),
      }),
      returns: Schema.Null,
    }),
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "setAnalysisError",
      args: Schema.Struct({
        itemId: GenericId.GenericId("wardrobeItems"),
        error: Schema.String,
      }),
      returns: Schema.Null,
    }),
  );

const storageGroup = GroupSpec.make("storage")
  .addFunction(
    FunctionSpec.publicMutation({
      name: "registerUpload",
      args: Schema.Struct({
        storageId: GenericId.GenericId("_storage"),
        purpose: Schema.String,
      }),
      returns: OkSchema,
    }),
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "getStorageUrl",
      args: Schema.Struct({ storageId: GenericId.GenericId("_storage") }),
      returns: Schema.String,
    }),
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "getStorageMetadata",
      args: Schema.Struct({ storageId: GenericId.GenericId("_storage") }),
      returns: StorageMetadataSchema,
    }),
  );

const profileGroup = GroupSpec.make("profile")
  .addFunction(
    FunctionSpec.publicQuery({
      name: "getProfile",
      args: Schema.Struct({}),
      returns: Schema.Union(ProfileDocument, Schema.Null),
    }),
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "updateBio",
      args: Schema.Struct({ bio: Schema.String }),
      returns: SuccessSchema,
    }),
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "updateProfileAttributes",
      args: Schema.Struct({
        bio: OptionalString,
        skinTone: OptionalString,
        hairColor: OptionalString,
      }),
      returns: SuccessSchema,
    }),
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "internalProfileUpdate",
      args: Schema.Struct({
        userId: Schema.String,
        bio: OptionalString,
        skinTone: OptionalString,
        hairColor: OptionalString,
      }),
      returns: Schema.Null,
    }),
  );

const zepGroup = GroupSpec.make("zep")
  .addFunction(
    FunctionSpec.publicMutation({
      name: "enqueueSyncEvent",
      args: Schema.Struct({
        type: SyncEventTypeSchema,
        itemId: OptionalWardrobeItemId,
        description: OptionalString,
        reason: OptionalString,
        bio: OptionalString,
        skinTone: OptionalString,
        hairColor: OptionalString,
        traceId: OptionalString,
        traceparent: OptionalString,
      }),
      returns: SuccessSchema,
    }),
  )
  .addFunction(
    FunctionSpec.internalAction({
      name: "processSyncEvent",
      args: Schema.Struct({
        type: SyncEventTypeSchema,
        userId: Schema.String,
        itemId: OptionalWardrobeItemId,
        description: OptionalString,
        reason: OptionalString,
        bio: OptionalString,
        skinTone: OptionalString,
        hairColor: OptionalString,
        traceId: OptionalString,
        traceparent: OptionalString,
      }),
      returns: Schema.Null,
    }),
  )
  .addFunction(
    FunctionSpec.publicAction({
      name: "getCompatibilityContext",
      args: Schema.Struct({
        candidateCategory: OptionalNullableString,
        candidateDescription: Schema.String,
        candidateStyleTags: Schema.Array(Schema.String),
        similarItems: Schema.Array(SimilarityContextItemSchema),
        dissimilarItems: Schema.Array(SimilarityContextItemSchema),
      }),
      returns: ZepCompatibilityContextSchema,
    }),
  );

export default Spec.make()
  .add(wardrobeGroup)
  .add(storageGroup)
  .add(profileGroup)
  .add(zepGroup);
