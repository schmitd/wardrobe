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
  // Bind resumed imports to the account that began them, without clearing drafts.
  importOwnerId?: string;
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
// One bounded recovery slot preserves an unfinished owned import when a new guest
// draft replaces the anonymous slot. It is only selected by its confirmed owner.
const RECOVERY_KEY = "wardrobe.guestSnapshot.recovery.v1";
const readSnapshot = (key: string): GuestSnapshot | null => {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(key) ?? "null") as GuestSnapshot | null;
    return parsed?.version === 1 && Array.isArray(parsed.items) ? parsed : null;
  } catch { return null; }
};
export const loadGuestSnapshot = (ownerId?: string): GuestSnapshot | null => {
  const recovery = ownerId ? readSnapshot(RECOVERY_KEY) : null;
  if (recovery?.importOwnerId === ownerId && ownerId) return recovery;
  return readSnapshot(STORAGE_KEY);
};
export const saveGuestSnapshot = (snapshot: GuestSnapshot) => {
  try {
    const recovery = readSnapshot(RECOVERY_KEY);
    if (snapshot.importOwnerId && recovery?.importOwnerId === snapshot.importOwnerId && recovery.createdAt === snapshot.createdAt) {
      sessionStorage.setItem(RECOVERY_KEY, JSON.stringify(snapshot));
      return;
    }
    const current = readSnapshot(STORAGE_KEY);
    if (current?.importOwnerId && (!snapshot.importOwnerId || snapshot.importOwnerId !== current.importOwnerId)) {
      // Do not displace a second owner's recovery or lose the original on quota failure.
      if (recovery && recovery.importOwnerId !== current.importOwnerId) return;
      sessionStorage.setItem(RECOVERY_KEY, JSON.stringify(current));
    }
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // Best effort; the existing owned draft remains intact if storage is full.
  }
};
export const clearGuestSnapshot = (ownerId?: string, createdAt?: number) => {
  try {
    for (const key of [STORAGE_KEY, RECOVERY_KEY]) {
      const current = readSnapshot(key);
      if (current && (ownerId ? current.importOwnerId === ownerId : !current.importOwnerId && key === STORAGE_KEY)
        && (createdAt === undefined || current.createdAt === createdAt)) sessionStorage.removeItem(key);
    }
  } catch { /* Storage can be unavailable. */ }
};
export const updateGuestSnapshotItem = (id: string, patch: Partial<GuestSnapshotItem>, ownerId?: string) => {
  const snapshot = loadGuestSnapshot(ownerId);
  if (!snapshot || (snapshot.importOwnerId && snapshot.importOwnerId !== ownerId)) return;
  saveGuestSnapshot({ ...snapshot, items: snapshot.items.map(item => item.id === id ? { ...item, ...patch } : item) });
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
