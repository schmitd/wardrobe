import type { Document } from "@confect/server";
import type schemaDefinition from "./schema";

export type CandidateItemsDoc = Document.Document<typeof schemaDefinition, "candidateItems">;
export type DeletedAccountsDoc = Document.Document<typeof schemaDefinition, "deletedAccounts">;
export type FitCheckItemsDoc = Document.Document<typeof schemaDefinition, "fitCheckItems">;
export type FitChecksDoc = Document.Document<typeof schemaDefinition, "fitChecks">;
export type GarmentObservationsDoc = Document.Document<typeof schemaDefinition, "garmentObservations">;
export type OutfitSuggestionsDoc = Document.Document<typeof schemaDefinition, "outfitSuggestions">;
export type PlanningSettingsDoc = Document.Document<typeof schemaDefinition, "planningSettings">;
export type ProfileBioRevisionsDoc = Document.Document<typeof schemaDefinition, "profileBioRevisions">;
export type ProfilesDoc = Document.Document<typeof schemaDefinition, "profiles">;
export type StorageObjectsDoc = Document.Document<typeof schemaDefinition, "storageObjects">;
export type StyleBioJobsDoc = Document.Document<typeof schemaDefinition, "styleBioJobs">;
export type SubscriptionsDoc = Document.Document<typeof schemaDefinition, "subscriptions">;
export type UploadTicketsDoc = Document.Document<typeof schemaDefinition, "uploadTickets">;
export type UploadsDoc = Document.Document<typeof schemaDefinition, "uploads">;
export type WardrobeItemsDoc = Document.Document<typeof schemaDefinition, "wardrobeItems">;
export type WardrobeMembershipsDoc = Document.Document<typeof schemaDefinition, "wardrobeMemberships">;
export type WardrobesDoc = Document.Document<typeof schemaDefinition, "wardrobes">;

export interface Docs {
  candidateItems: CandidateItemsDoc;
  deletedAccounts: DeletedAccountsDoc;
  fitCheckItems: FitCheckItemsDoc;
  fitChecks: FitChecksDoc;
  garmentObservations: GarmentObservationsDoc;
  outfitSuggestions: OutfitSuggestionsDoc;
  planningSettings: PlanningSettingsDoc;
  profileBioRevisions: ProfileBioRevisionsDoc;
  profiles: ProfilesDoc;
  storageObjects: StorageObjectsDoc;
  styleBioJobs: StyleBioJobsDoc;
  subscriptions: SubscriptionsDoc;
  uploadTickets: UploadTicketsDoc;
  uploads: UploadsDoc;
  wardrobeItems: WardrobeItemsDoc;
  wardrobeMemberships: WardrobeMembershipsDoc;
  wardrobes: WardrobesDoc;
}
