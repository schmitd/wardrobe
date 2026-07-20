import { Effect } from "effect";
import { fetch as expoFetch } from "expo/fetch";
import { File } from "expo-file-system";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";

import { getUploadUrl } from "@/api";
import { photoUploadEffect } from "@/photo-upload-core";

type GetToken = () => Promise<string | null>;

export const uploadPhoto = (getToken: GetToken, uri: string, width = 1600) =>
  Effect.runPromise(photoUploadEffect({
    prepare: async (sourceUri, targetWidth) => {
      const prepared = await manipulateAsync(
        sourceUri,
        [{ resize: { width: targetWidth } }],
        { compress: 0.8, format: SaveFormat.JPEG }
      );
      return prepared.uri;
    },
    authorize: () => getUploadUrl(getToken),
    open: (preparedUri) => {
      const image = new File(preparedUri);
      if (!image.exists || image.size === 0) throw new Error("This photo could not be opened.");
      return image;
    },
    transfer: (uploadUrl, image) => expoFetch(uploadUrl, {
      method: "POST",
      headers: { "Content-Type": "image/jpeg" },
      // Expo File implements the native Blob contract consumed by expo/fetch.
      // Bun's DOM declarations model FormData differently, so the structural
      // types do not agree even though this is Expo's supported runtime pair.
      body: image as unknown as BodyInit,
    }),
  }, uri, width));
