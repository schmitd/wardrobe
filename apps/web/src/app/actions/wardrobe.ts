"use server";

export type { GuestFitCheckAnalysisResult } from "@/server/workflows/wardrobe";

import * as workflows from "@/server/workflows/wardrobe";

export async function getMobileBootstrapAction(...args: Parameters<typeof workflows.getMobileBootstrapAction>) {
  return workflows.getMobileBootstrapAction(...args);
}

export async function createCollectionAction(...args: Parameters<typeof workflows.createCollectionAction>) {
  return workflows.createCollectionAction(...args);
}

export async function addCollectionItemAction(...args: Parameters<typeof workflows.addCollectionItemAction>) {
  return workflows.addCollectionItemAction(...args);
}

export async function removeCollectionItemAction(...args: Parameters<typeof workflows.removeCollectionItemAction>) {
  return workflows.removeCollectionItemAction(...args);
}

export async function resolveFitObservationAction(...args: Parameters<typeof workflows.resolveFitObservationAction>) {
  return workflows.resolveFitObservationAction(...args);
}

export async function promoteFitObservationAction(...args: Parameters<typeof workflows.promoteFitObservationAction>) {
  return workflows.promoteFitObservationAction(...args);
}

export async function getUploadUrlAction(...args: Parameters<typeof workflows.getUploadUrlAction>) {
  return workflows.getUploadUrlAction(...args);
}

export async function routeCaptureAction(...args: Parameters<typeof workflows.routeCaptureAction>) {
  return workflows.routeCaptureAction(...args);
}

export async function createWardrobeItemAction(...args: Parameters<typeof workflows.createWardrobeItemAction>) {
  return workflows.createWardrobeItemAction(...args);
}

export async function seedWardrobeItemFromGuestAction(...args: Parameters<typeof workflows.seedWardrobeItemFromGuestAction>) {
  return workflows.seedWardrobeItemFromGuestAction(...args);
}

export async function completeGuestOnboardingAction(...args: Parameters<typeof workflows.completeGuestOnboardingAction>) {
  return workflows.completeGuestOnboardingAction(...args);
}

export async function deleteWardrobeItemAction(...args: Parameters<typeof workflows.deleteWardrobeItemAction>) {
  return workflows.deleteWardrobeItemAction(...args);
}

export async function updateProfileBioAction(...args: Parameters<typeof workflows.updateProfileBioAction>) {
  return workflows.updateProfileBioAction(...args);
}

export async function processWardrobeItemAction(...args: Parameters<typeof workflows.processWardrobeItemAction>) {
  return workflows.processWardrobeItemAction(...args);
}

export async function checkCompatibilityAction(...args: Parameters<typeof workflows.checkCompatibilityAction>) {
  return workflows.checkCompatibilityAction(...args);
}

export async function saveInspirationAction(...args: Parameters<typeof workflows.saveInspirationAction>) {
  return workflows.saveInspirationAction(...args);
}

export async function enrichInspirationAction(...args: Parameters<typeof workflows.enrichInspirationAction>) {
  return workflows.enrichInspirationAction(...args);
}

export async function refreshStyleBioAction(...args: Parameters<typeof workflows.refreshStyleBioAction>) {
  return workflows.refreshStyleBioAction(...args);
}

export async function analyzeSelfieAction(...args: Parameters<typeof workflows.analyzeSelfieAction>) {
  return workflows.analyzeSelfieAction(...args);
}

export async function recordDailyFitCheckAction(...args: Parameters<typeof workflows.recordDailyFitCheckAction>) {
  return workflows.recordDailyFitCheckAction(...args);
}

export async function recordTryOnFitCheckAction(...args: Parameters<typeof workflows.recordTryOnFitCheckAction>) {
  return workflows.recordTryOnFitCheckAction(...args);
}

export async function analyzeGuestFitCheckAction(...args: Parameters<typeof workflows.analyzeGuestFitCheckAction>) {
  return workflows.analyzeGuestFitCheckAction(...args);
}

export async function analyzeGuestBatchAction(...args: Parameters<typeof workflows.analyzeGuestBatchAction>) {
  return workflows.analyzeGuestBatchAction(...args);
}
