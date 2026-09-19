export type { WardrobeItem } from "@wardrobe/shared";

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
