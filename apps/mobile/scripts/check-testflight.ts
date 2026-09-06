import { existsSync } from "node:fs";
import { resolve } from "node:path";

import appConfig from "../app.json";
import easConfig from "../eas.json";

const failures: string[] = [];
const expo = appConfig.expo;
const production = easConfig.build.production;

if (!expo.ios?.bundleIdentifier || /(^|\.)example(\.|$)/i.test(expo.ios.bundleIdentifier)) {
  failures.push("Set a permanent ios.bundleIdentifier in app.json.");
}

if (!expo.extra?.eas?.projectId) {
  failures.push("Link the app to an EAS project and set expo.extra.eas.projectId.");
}

if (!expo.icon) {
  failures.push("Set expo.icon to the final 1024x1024 PNG App Store icon.");
} else if (!existsSync(resolve(import.meta.dir, "..", expo.icon))) {
  failures.push(`The configured app icon does not exist: ${expo.icon}`);
}

if (expo.ios?.infoPlist?.ITSAppUsesNonExemptEncryption !== false) {
  failures.push("Declare ITSAppUsesNonExemptEncryption in app.json before submission.");
}

if (easConfig.cli.appVersionSource !== "remote") {
  failures.push('Set eas.cli.appVersionSource to "remote".');
}

if (production.autoIncrement !== true) {
  failures.push("Enable build.production.autoIncrement to prevent duplicate build numbers.");
}

for (const variable of [
  "EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY",
  "EXPO_PUBLIC_WARDROBE_API_URL",
]) {
  if (!process.env[variable]) {
    failures.push(`Missing ${variable} in the production build environment.`);
  }
}

if (failures.length > 0) {
  console.error("TestFlight preflight failed:\n");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(
  `TestFlight preflight passed for ${expo.name} (${expo.ios.bundleIdentifier}) v${expo.version}.`,
);
