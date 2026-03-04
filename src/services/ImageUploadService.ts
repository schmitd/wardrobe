import { Context, Effect, Layer } from 'effect';

export interface ImageUploadService {
  readonly uploadImageFile: (file: File) => Effect.Effect<{ storageId: string }, Error>;
}

export const ImageUploadService = Context.GenericTag<ImageUploadService>('ImageUploadService');

interface ImageUploadLiveDeps {
  readonly getUploadUrl: () => Promise<string>;
  readonly fetchImpl?: typeof fetch;
}

const make = (deps: ImageUploadLiveDeps): ImageUploadService => {
  const fetchImpl = deps.fetchImpl ?? fetch;

  return {
    uploadImageFile: (file) =>
      Effect.tryPromise({
        try: async () => {
          if (!file.type.startsWith('image/')) {
            throw new Error('Only image files are allowed.');
          }

          const uploadUrl = await deps.getUploadUrl();
          const uploadResponse = await fetchImpl(uploadUrl, {
            method: 'POST',
            body: file,
          });

          if (!uploadResponse.ok) {
            throw new Error(`Upload failed: ${uploadResponse.statusText}`);
          }

          const payload = await uploadResponse.json();
          const storageId = payload?.storageId;
          if (!storageId || typeof storageId !== 'string') {
            throw new Error('Upload response missing storageId');
          }

          return { storageId };
        },
        catch: (error) => (error instanceof Error ? error : new Error(String(error))),
      }),
  };
};

export const makeImageUploadLayer = (deps: ImageUploadLiveDeps) =>
  Layer.succeed(ImageUploadService, make(deps));
