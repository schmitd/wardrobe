import { DatabaseSchema as $DatabaseSchema } from "@confect/server";

import candidateItems from "./tables/candidateItems";
import deletedAccounts from "./tables/deletedAccounts";
import fitCheckItems from "./tables/fitCheckItems";
import fitChecks from "./tables/fitChecks";
import garmentObservations from "./tables/garmentObservations";
import outfitSuggestions from "./tables/outfitSuggestions";
import planRevisions from "./tables/planRevisions";
import planningSettings from "./tables/planningSettings";
import profileBioRevisions from "./tables/profileBioRevisions";
import profiles from "./tables/profiles";
import storageObjects from "./tables/storageObjects";
import styleBioJobs from "./tables/styleBioJobs";
import subscriptions from "./tables/subscriptions";
import uploadTickets from "./tables/uploadTickets";
import uploads from "./tables/uploads";
import wardrobeItems from "./tables/wardrobeItems";
import wardrobeMemberships from "./tables/wardrobeMemberships";
import wardrobes from "./tables/wardrobes";
import wearEvidence from "./tables/wearEvidence";
import wearGraphLocks from "./tables/wearGraphLocks";
import wearGraphNodes from "./tables/wearGraphNodes";
import wearOccurrences from "./tables/wearOccurrences";
import wearProjectionOutbox from "./tables/wearProjectionOutbox";
import wearRevisions from "./tables/wearRevisions";

const databaseSchema: $DatabaseSchema.DatabaseSchema<
  typeof candidateItems |
  typeof deletedAccounts |
  typeof fitCheckItems |
  typeof fitChecks |
  typeof garmentObservations |
  typeof outfitSuggestions |
  typeof planRevisions |
  typeof planningSettings |
  typeof profileBioRevisions |
  typeof profiles |
  typeof storageObjects |
  typeof styleBioJobs |
  typeof subscriptions |
  typeof uploadTickets |
  typeof uploads |
  typeof wardrobeItems |
  typeof wardrobeMemberships |
  typeof wardrobes |
  typeof wearEvidence |
  typeof wearGraphLocks |
  typeof wearGraphNodes |
  typeof wearOccurrences |
  typeof wearProjectionOutbox |
  typeof wearRevisions
> = $DatabaseSchema.make({
  candidateItems,
  deletedAccounts,
  fitCheckItems,
  fitChecks,
  garmentObservations,
  outfitSuggestions,
  planRevisions,
  planningSettings,
  profileBioRevisions,
  profiles,
  storageObjects,
  styleBioJobs,
  subscriptions,
  uploadTickets,
  uploads,
  wardrobeItems,
  wardrobeMemberships,
  wardrobes,
  wearEvidence,
  wearGraphLocks,
  wearGraphNodes,
  wearOccurrences,
  wearProjectionOutbox,
  wearRevisions,
});

export default databaseSchema;
