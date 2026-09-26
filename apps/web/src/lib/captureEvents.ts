export const OPEN_CAPTURE_MENU_EVENT = "wardrobe:open-capture-menu";

export type CapturePlanContext = { planId: string; expectedPlanRevision: number };

export const openCaptureMenu = (context?: CapturePlanContext) => {
  window.dispatchEvent(new CustomEvent(OPEN_CAPTURE_MENU_EVENT, { detail: context }));
};
