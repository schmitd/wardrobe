export type GuestSnapshotItem = {
  fileName: string;
  mimeType: string;
  // Data URL (base64). Keep it small (downscaled) so sessionStorage can hold it.
  dataUrl: string;
  category: string;
  description: string;
  styleTags: string[];
};

export type GuestSnapshot = {
  version: 1;
  createdAt: number;
  bio: string;
  items: GuestSnapshotItem[];
};

const STORAGE_KEY = "wardrobe.guestSnapshot.v1";

export const saveGuestSnapshot = (snapshot: GuestSnapshot) => {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // Best-effort; if storage is full/blocked, guest still works but import won't.
  }
};

export const loadGuestSnapshot = (): GuestSnapshot | null => {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GuestSnapshot;
    if (parsed?.version !== 1) return null;
    if (!Array.isArray(parsed.items)) return null;
    return parsed;
  } catch {
    return null;
  }
};

export const clearGuestSnapshot = () => {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
};

