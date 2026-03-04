import { describe, it, expect, beforeEach, afterAll, mock } from 'bun:test';
import { GlobalRegistrator } from '@happy-dom/global-registrator';
import React from 'react';
import { Effect, Layer } from 'effect';
import type { Layer as LayerType } from 'effect/Layer';

import {
  ImageUploadService,
  type ImageUploadService as ImageUploadServiceType,
} from '@/services/ImageUploadService';

GlobalRegistrator.register();

const { render, screen, fireEvent, cleanup, waitFor } = await import('@testing-library/react');
const matchers = await import('@testing-library/jest-dom/matchers');

expect.extend(
  matchers as unknown as Record<string, (this: unknown, ...args: unknown[]) => unknown>
);

mock.module('convex/react', () => ({
  useMutation: () => async () => 'unused-when-test-layer-is-provided',
}));

mock.module('@convex/_generated/api', () => ({
  api: { wardrobe: { getUploadUrl: {} } },
}));

const { default: ImageUploader } = await import('./ImageUploader');

const originalCreateObjectURL = global.URL.createObjectURL;

const makeUploadLayer = (
  uploadImageFile: ImageUploadServiceType['uploadImageFile']
): LayerType<ImageUploadServiceType> =>
  Layer.succeed(ImageUploadService, {
    uploadImageFile,
  });

const dropOnUploader = async (labelText: string, files: File[]) => {
  const dropZone = screen.getByText(labelText).closest('div');
  if (!dropZone) throw new Error('Drop zone not found');

  fireEvent.drop(dropZone, {
    dataTransfer: {
      files,
      types: ['Files'],
    },
  });
};

describe('ImageUploader', () => {
  const mockOnUploadComplete = mock(() => {});

  beforeEach(() => {
    cleanup();
    mockOnUploadComplete.mockClear();
    global.URL.createObjectURL = mock(() => 'blob:preview');
  });

  afterAll(() => {
    global.URL.createObjectURL = originalCreateObjectURL;
  });

  it('renders with default label', () => {
    render(<ImageUploader onUploadComplete={mockOnUploadComplete} />);
    expect(screen.getByText('Upload Images')).toBeInTheDocument();
  });

  it('renders with custom label', () => {
    render(<ImageUploader onUploadComplete={mockOnUploadComplete} label='Custom Label' />);
    expect(screen.getByText('Custom Label')).toBeInTheDocument();
  });

  it('restricts to single file when allowMultiple is false', () => {
    render(<ImageUploader onUploadComplete={mockOnUploadComplete} allowMultiple={false} />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input.multiple).toBe(false);
    expect(screen.getByText('Upload Image')).toBeInTheDocument();
  });

  it('shows error when dropping multiple files if allowMultiple is false', async () => {
    render(<ImageUploader onUploadComplete={mockOnUploadComplete} allowMultiple={false} />);

    const file1 = new File(['foo'], 'foo.png', { type: 'image/png' });
    const file2 = new File(['bar'], 'bar.png', { type: 'image/png' });

    await dropOnUploader('Upload Image', [file1, file2]);

    expect(screen.getByText('Please upload a single image for this feature.')).toBeInTheDocument();
    expect(mockOnUploadComplete).not.toHaveBeenCalled();
  });

  it('uploads files through the provided service layer', async () => {
    const uploadImageFile = mock((file: File) =>
      Effect.succeed({ storageId: `storage_${file.name.replace('.', '_')}` })
    );

    render(
      <ImageUploader
        onUploadComplete={mockOnUploadComplete}
        allowMultiple={false}
        uploadLayer={makeUploadLayer(uploadImageFile)}
      />
    );

    const file = new File(['foo'], 'foo.png', { type: 'image/png' });
    await dropOnUploader('Upload Image', [file]);

    await waitFor(() => {
      expect(uploadImageFile).toHaveBeenCalledTimes(1);
      expect(mockOnUploadComplete).toHaveBeenCalledTimes(1);
    });
  });

  it('surfaces service errors', async () => {
    const uploadImageFile = mock(() => Effect.fail(new Error('Upload failed: Bad Gateway')));

    render(
      <ImageUploader
        onUploadComplete={mockOnUploadComplete}
        allowMultiple={false}
        uploadLayer={makeUploadLayer(uploadImageFile)}
      />
    );

    const file = new File(['foo'], 'foo.png', { type: 'image/png' });
    await dropOnUploader('Upload Image', [file]);

    await waitFor(() => {
      expect(screen.getByText('Upload failed: Bad Gateway')).toBeInTheDocument();
    });

    expect(mockOnUploadComplete).not.toHaveBeenCalled();
  });
});
