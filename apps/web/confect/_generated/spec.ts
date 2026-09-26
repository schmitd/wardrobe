import { GroupSpec, Spec } from "@confect/core";
import account from "../account.spec";
import candidates from "../candidates.spec";
import fitChecks from "../fitChecks.spec";
import garmentIdentityQueries from "../garmentIdentityQueries.spec";
import mobile from "../mobile.spec";
import planning from "../planning.spec";
import profile from "../profile.spec";
import reminderDelivery from "../reminderDelivery.spec";
import reminders from "../reminders.spec";
import storage from "../storage.spec";
import storageMigration from "../storageMigration.spec";
import styleMemory from "../styleMemory.spec";
import styleMemoryData from "../styleMemoryData.spec";
import uploads from "../uploads.spec";
import wardrobe from "../wardrobe.spec";
import wardrobes from "../wardrobes.spec";
import wear from "../wear.spec";
import wearGraph from "../wearGraph.spec";
import wearProjectionData from "../wearProjectionData.spec";
import zepSync from "../zepSync.spec";

const spec: Spec.Spec<
  | GroupSpec.NamedAt<typeof account, "account">
  | GroupSpec.NamedAt<typeof candidates, "candidates">
  | GroupSpec.NamedAt<typeof fitChecks, "fitChecks">
  | GroupSpec.NamedAt<typeof garmentIdentityQueries, "garmentIdentityQueries">
  | GroupSpec.NamedAt<typeof mobile, "mobile">
  | GroupSpec.NamedAt<typeof planning, "planning">
  | GroupSpec.NamedAt<typeof profile, "profile">
  | GroupSpec.NamedAt<typeof reminderDelivery, "reminderDelivery">
  | GroupSpec.NamedAt<typeof reminders, "reminders">
  | GroupSpec.NamedAt<typeof storage, "storage">
  | GroupSpec.NamedAt<typeof storageMigration, "storageMigration">
  | GroupSpec.NamedAt<typeof styleMemory, "styleMemory">
  | GroupSpec.NamedAt<typeof styleMemoryData, "styleMemoryData">
  | GroupSpec.NamedAt<typeof uploads, "uploads">
  | GroupSpec.NamedAt<typeof wardrobe, "wardrobe">
  | GroupSpec.NamedAt<typeof wardrobes, "wardrobes">
  | GroupSpec.NamedAt<typeof wear, "wear">
  | GroupSpec.NamedAt<typeof wearGraph, "wearGraph">
  | GroupSpec.NamedAt<typeof wearProjectionData, "wearProjectionData">
  | GroupSpec.NamedAt<typeof zepSync, "zepSync">
> = Spec.make().addAt("account", account).addAt("candidates", candidates).addAt("fitChecks", fitChecks).addAt("garmentIdentityQueries", garmentIdentityQueries).addAt("mobile", mobile).addAt("planning", planning).addAt("profile", profile).addAt("reminderDelivery", reminderDelivery).addAt("reminders", reminders).addAt("storage", storage).addAt("storageMigration", storageMigration).addAt("styleMemory", styleMemory).addAt("styleMemoryData", styleMemoryData).addAt("uploads", uploads).addAt("wardrobe", wardrobe).addAt("wardrobes", wardrobes).addAt("wear", wear).addAt("wearGraph", wearGraph).addAt("wearProjectionData", wearProjectionData).addAt("zepSync", zepSync);

export default spec;
