import { FunctionImpl, GroupImpl } from "@confect/server";
import { Layer } from "effect";
import databaseSchema from "./_generated/schema";
import group from "./wardrobe.spec";
import { pageCollections, pagePieces, pageInspiration, itemDetails, itemCollectionMembership, saveNote } from "./collectionHandlers";
import RequireUserLive from "./middleware/RequireUser.impl";
import * as functions from "./legacy/wardrobe";

export default GroupImpl.make(databaseSchema, group).pipe(
  Layer.provide(Layer.mergeAll(
    pageCollections, pagePieces, pageInspiration, itemDetails, itemCollectionMembership, saveNote, RequireUserLive,
    FunctionImpl.make(databaseSchema, group, "pageWardrobeItems", functions.pageWardrobeItems),
    FunctionImpl.make(databaseSchema, group, "listWardrobeItems", functions.listWardrobeItems),
    FunctionImpl.make(databaseSchema, group, "getUploadUrl", functions.getUploadUrl),
    FunctionImpl.make(databaseSchema, group, "createWardrobeItem", functions.createWardrobeItem),
    FunctionImpl.make(databaseSchema, group, "deleteWardrobeItem", functions.deleteWardrobeItem),
    FunctionImpl.make(databaseSchema, group, "getWardrobeItem", functions.getWardrobeItem),
    FunctionImpl.make(databaseSchema, group, "getWardrobeItemInternal", functions.getWardrobeItemInternal),
    FunctionImpl.make(databaseSchema, group, "getWardrobeItemWithUrl", functions.getWardrobeItemWithUrl),
    FunctionImpl.make(databaseSchema, group, "getWardrobeItemsDisplayByIds", functions.getWardrobeItemsDisplayByIds),
    FunctionImpl.make(databaseSchema, group, "searchSimilarItems", functions.searchSimilarItems),
    FunctionImpl.make(databaseSchema, group, "searchGarmentIdentityCandidates", functions.searchGarmentIdentityCandidates),
    FunctionImpl.make(databaseSchema, group, "listItemsForSimilarity", functions.listItemsForSimilarity),
    FunctionImpl.make(databaseSchema, group, "listItemsMissingVisualEmbedding", functions.listItemsMissingVisualEmbedding),
    FunctionImpl.make(databaseSchema, group, "applyVisualEmbedding", functions.applyVisualEmbedding),
    FunctionImpl.make(databaseSchema, group, "setAnalysisStatus", functions.setAnalysisStatus),
    FunctionImpl.make(databaseSchema, group, "applyTags", functions.applyTags),
    FunctionImpl.make(databaseSchema, group, "applyDescription", functions.applyDescription),
    FunctionImpl.make(databaseSchema, group, "applyEmbedding", functions.applyEmbedding),
    FunctionImpl.make(databaseSchema, group, "applyFullAnalysis", functions.applyFullAnalysis),
    FunctionImpl.make(databaseSchema, group, "setAnalysisError", functions.setAnalysisError),
  )),
  GroupImpl.finalize,
);
