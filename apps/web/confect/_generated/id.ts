import { GenericId } from "@confect/core";

export type TableNames = "candidateItems" | "deletedAccounts" | "fitCheckItems" | "fitChecks" | "garmentObservations" | "notificationAttempts" | "notificationBudgets" | "notificationInstallations" | "notificationIntents" | "notificationPreferences" | "outfitSuggestions" | "planRevisions" | "planningSettings" | "profileBioRevisions" | "profiles" | "storageObjects" | "styleBioJobs" | "subscriptions" | "uploadTickets" | "uploads" | "wardrobeItems" | "wardrobeMemberships" | "wardrobes" | "wearEvidence" | "wearGraphLocks" | "wearGraphNodes" | "wearOccurrences" | "wearProjectionOutbox" | "wearRevisions";

export const Id = <const TableName extends TableNames>(
  tableName: TableName,
) => GenericId.GenericId(tableName);
