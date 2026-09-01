export type WardrobeItem = {
  id: string;
  imageUrl: string;
  category: string | null;
  description: string | null;
  styleTags: string[] | null;
  analysisStatus: string;
  analysisError?: string | null;
  createdAt: number;
};

export type OptimisticWardrobeItem = {
  tempId: string;
  imageUrl: string;
  status: "uploading" | "processing" | "error";
  createdAt: number;
  category?: string | null;
  description?: string | null;
  styleTags?: string[] | null;
  serverId?: string;
  error?: string | null;
};

export type InspirationItem = {
  id: string;
  imageUrl: string | null;
  sourceUrl: string | null;
  note: string | null;
  category: string | null;
  description: string | null;
  styleTags: string[] | null;
  createdAt: number;
};
