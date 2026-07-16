export type GuestSnapshotItem = {
  id: string;
  fileName: string;
  mimeType: string;
  // Data URL (base64). Keep it small (downscaled) so sessionStorage can hold it.
  dataUrl: string;
  category: string;
  description: string;
  styleTags: string[];
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  confidence?: number;
  createdItemId?: string;
};

export type GuestSnapshot = {
  version: 1;
  createdAt: number;
  bio: string;
  items: GuestSnapshotItem[];
  sourceFit?: {
    fileName: string;
    mimeType: string;
    dataUrl: string;
    transcription: string;
  };
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

export const updateGuestSnapshotItem = (id: string, patch: Partial<GuestSnapshotItem>) => {
  const snapshot = loadGuestSnapshot();
  if (!snapshot) return;
  saveGuestSnapshot({
    ...snapshot,
    items: snapshot.items.map((item) => (item.id === id ? { ...item, ...patch } : item)),
  });
};

export const removeGuestSnapshotItem = (id: string) => {
  const snapshot = loadGuestSnapshot();
  if (!snapshot) return;
  const next = {
    ...snapshot,
    items: snapshot.items.filter((item) => item.id !== id),
  } satisfies GuestSnapshot;

  if (next.items.length === 0) {
    clearGuestSnapshot();
    return;
  }

  saveGuestSnapshot(next);
};
