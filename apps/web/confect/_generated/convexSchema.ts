import { defineSchema as $defineSchema } from "convex/server";
import { Table as $Table } from "@confect/server";

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

export default $defineSchema({
  candidateItems: $Table.tableDefinition(candidateItems),
  deletedAccounts: $Table.tableDefinition(deletedAccounts),
  fitCheckItems: $Table.tableDefinition(fitCheckItems),
  fitChecks: $Table.tableDefinition(fitChecks),
  garmentObservations: $Table.tableDefinition(garmentObservations),
  outfitSuggestions: $Table.tableDefinition(outfitSuggestions),
  planningSettings: $Table.tableDefinition(planningSettings),
  profileBioRevisions: $Table.tableDefinition(profileBioRevisions),
  profiles: $Table.tableDefinition(profiles),
  storageObjects: $Table.tableDefinition(storageObjects),
  styleBioJobs: $Table.tableDefinition(styleBioJobs),
  subscriptions: $Table.tableDefinition(subscriptions),
  uploadTickets: $Table.tableDefinition(uploadTickets),
  uploads: $Table.tableDefinition(uploads),
  wardrobeItems: $Table.tableDefinition(wardrobeItems),
  wardrobeMemberships: $Table.tableDefinition(wardrobeMemberships),
  wardrobes: $Table.tableDefinition(wardrobes),
});
