import { uploadPhoto } from "./photoUpload";
import { Context, Effect, Layer } from 'effect';

export interface ImageUploadService {
  readonly uploadImageFile: (file: File) => Effect.Effect<{ storageId: string }, Error>;
}

export const ImageUploadService = Context.Service<ImageUploadService>('ImageUploadService');

interface ImageUploadLiveDeps {
  readonly getUploadUrl: () => Promise<string>;
  readonly fetchImpl?: typeof fetch;
}

const make = (deps: ImageUploadLiveDeps): ImageUploadService => ({
  uploadImageFile: file => uploadPhoto(file, deps.getUploadUrl, deps.fetchImpl).pipe(
    Effect.map(storageId => ({ storageId })),
  ),
});

export const makeImageUploadLayer = (deps: ImageUploadLiveDeps) =>
  Layer.succeed(ImageUploadService, make(deps));
