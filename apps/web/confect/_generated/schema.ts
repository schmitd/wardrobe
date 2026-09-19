import { DatabaseSchema as $DatabaseSchema } from "@confect/server";

import candidateItems from "./tables/candidateItems";
import deletedAccounts from "./tables/deletedAccounts";
import fitCheckItems from "./tables/fitCheckItems";
import fitChecks from "./tables/fitChecks";
import garmentObservations from "./tables/garmentObservations";
import outfitSuggestions from "./tables/outfitSuggestions";
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

const databaseSchema: $DatabaseSchema.DatabaseSchema<
  typeof candidateItems |
  typeof deletedAccounts |
  typeof fitCheckItems |
  typeof fitChecks |
  typeof garmentObservations |
  typeof outfitSuggestions |
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
  typeof wardrobes
> = $DatabaseSchema.make({
  candidateItems,
  deletedAccounts,
  fitCheckItems,
  fitChecks,
  garmentObservations,
  outfitSuggestions,
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
});

export default databaseSchema;
