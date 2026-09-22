import { GenericId } from "@confect/core";

export type TableNames = "candidateItems" | "deletedAccounts" | "fitCheckItems" | "fitChecks" | "garmentObservations" | "garmentPreviewJobs" | "outfitSuggestions" | "planningSettings" | "profileBioRevisions" | "profiles" | "storageObjects" | "styleBioJobs" | "subscriptions" | "uploadTickets" | "uploads" | "wardrobeItems" | "wardrobeMemberships" | "wardrobes";

export const Id = <const TableName extends TableNames>(
  tableName: TableName,
) => GenericId.GenericId(tableName);
