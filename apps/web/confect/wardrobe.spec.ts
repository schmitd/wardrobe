import { FunctionSpec, GroupSpec } from "@confect/core";
import type * as functions from "./legacy/wardrobe";

export default GroupSpec.make()
  .addFunction(FunctionSpec.convexPublicQuery<typeof functions.pageWardrobeItems>()("pageWardrobeItems"))
  .addFunction(FunctionSpec.convexPublicQuery<typeof functions.listWardrobeItems>()("listWardrobeItems"))
  .addFunction(FunctionSpec.convexPublicMutation<typeof functions.getUploadUrl>()("getUploadUrl"))
  .addFunction(FunctionSpec.convexPublicMutation<typeof functions.createWardrobeItem>()("createWardrobeItem"))
  .addFunction(FunctionSpec.convexPublicMutation<typeof functions.deleteWardrobeItem>()("deleteWardrobeItem"))
  .addFunction(FunctionSpec.convexPublicQuery<typeof functions.getWardrobeItem>()("getWardrobeItem"))
  .addFunction(FunctionSpec.convexInternalQuery<typeof functions.getWardrobeItemInternal>()("getWardrobeItemInternal"))
  .addFunction(FunctionSpec.convexPublicQuery<typeof functions.getWardrobeItemWithUrl>()("getWardrobeItemWithUrl"))
  .addFunction(FunctionSpec.convexPublicQuery<typeof functions.getWardrobeItemsDisplayByIds>()("getWardrobeItemsDisplayByIds"))
  .addFunction(FunctionSpec.convexPublicAction<typeof functions.searchSimilarItems>()("searchSimilarItems"))
  .addFunction(FunctionSpec.convexPublicAction<typeof functions.searchGarmentIdentityCandidates>()("searchGarmentIdentityCandidates"))
  .addFunction(FunctionSpec.convexPublicQuery<typeof functions.listItemsForSimilarity>()("listItemsForSimilarity"))
  .addFunction(FunctionSpec.convexPublicQuery<typeof functions.listItemsMissingVisualEmbedding>()("listItemsMissingVisualEmbedding"))
  .addFunction(FunctionSpec.convexPublicMutation<typeof functions.applyVisualEmbedding>()("applyVisualEmbedding"))
  .addFunction(FunctionSpec.convexPublicMutation<typeof functions.setAnalysisStatus>()("setAnalysisStatus"))
  .addFunction(FunctionSpec.convexPublicMutation<typeof functions.applyTags>()("applyTags"))
  .addFunction(FunctionSpec.convexPublicMutation<typeof functions.applyDescription>()("applyDescription"))
  .addFunction(FunctionSpec.convexPublicMutation<typeof functions.applyEmbedding>()("applyEmbedding"))
  .addFunction(FunctionSpec.convexPublicMutation<typeof functions.applyFullAnalysis>()("applyFullAnalysis"))
  .addFunction(FunctionSpec.convexPublicMutation<typeof functions.setAnalysisError>()("setAnalysisError"));
