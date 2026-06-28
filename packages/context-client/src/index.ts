import type { StyleFitRequest, StyleFitResponse } from "@wardrobe/shared";

export type WardrobeContextClientOptions = {
  baseUrl: string;
  token?: string;
  fetchImpl?: typeof fetch;
};

export const createWardrobeContextClient = ({
  baseUrl,
  token,
  fetchImpl = fetch,
}: WardrobeContextClientOptions) => {
  const normalizedBaseUrl = baseUrl.replace(/\/$/, "");

  return {
    async checkStyleFit(input: StyleFitRequest): Promise<StyleFitResponse> {
      const response = await fetchImpl(`${normalizedBaseUrl}/api/context/style-fit`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        throw new Error(`Style fit check failed: ${response.status}`);
      }

      return response.json() as Promise<StyleFitResponse>;
    },
  };
};
