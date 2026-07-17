export const OPEN_CAPTURE_MENU_EVENT = "wardrobe:open-capture-menu";

export const openCaptureMenu = () => {
  window.dispatchEvent(new CustomEvent(OPEN_CAPTURE_MENU_EVENT));
};
