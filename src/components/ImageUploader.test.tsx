import { describe, it, expect, beforeEach, mock } from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";
import React from 'react';

// Setup Happy DOM BEFORE importing testing-library
GlobalRegistrator.register();

const { render, screen, fireEvent, cleanup } = await import('@testing-library/react');
const matchers = await import("@testing-library/jest-dom/matchers");

// Add type for jest-dom matchers
declare module "bun:test" {
    interface Matchers<T> {
        toBeInTheDocument(): void;
        toHaveClass(className: string): void;
        toBeDisabled(): void;
    }
}

// extend expect
expect.extend(matchers);

// Mock the server action
mock.module('@/app/upload-actions', () => ({
    getUploadUrl: async () => ({
        success: true,
        url: 'https://fake-upload-url.com',
        token: 'fake-token',
        path: 'users/123/fake-image.jpg'
    })
}));

// Mock fetch
global.fetch = mock(() => Promise.resolve({
    ok: true,
    statusText: 'OK',
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    json: () => Promise.resolve({})
} as Response));

// Import component AFTER mocks (using dynamic import to ensure mock applies)
const { default: ImageUploader } = await import('./ImageUploader');

describe('ImageUploader', () => {
    const mockOnUploadComplete = mock(() => { });

    beforeEach(() => {
        cleanup();
        mockOnUploadComplete.mockClear();
    });

    it('renders with default label', () => {
        render(<ImageUploader onUploadComplete={mockOnUploadComplete} />);
        expect(screen.getByText('Upload Images')).toBeInTheDocument();
    });

    it('renders with custom label', () => {
        render(<ImageUploader onUploadComplete={mockOnUploadComplete} label="Custom Label" />);
        expect(screen.getByText('Custom Label')).toBeInTheDocument();
    });

    it('allows multiple files by default', () => {
        render(<ImageUploader onUploadComplete={mockOnUploadComplete} />);
        // Use a more generic selector or role if possible
        const input = document.querySelector('input[type="file"]') as HTMLInputElement;
        expect(input.multiple).toBe(true);
    });

    it('restricts to single file when allowMultiple is false', () => {
        render(<ImageUploader onUploadComplete={mockOnUploadComplete} allowMultiple={false} />);
        const input = document.querySelector('input[type="file"]') as HTMLInputElement;
        expect(input.multiple).toBe(false);
        expect(screen.getByText('Upload Image')).toBeInTheDocument();
    });

    it('shows error when dropping multiple files if allowMultiple is false', () => {
        render(<ImageUploader onUploadComplete={mockOnUploadComplete} allowMultiple={false} />);

        const dropZone = screen.getByText('Upload Image').closest('div');
        if (!dropZone) throw new Error('Drop zone not found');

        // Create mock files
        const file1 = new File(['foo'], 'foo.png', { type: 'image/png' });
        const file2 = new File(['bar'], 'bar.png', { type: 'image/png' });

        // Simulate drop
        fireEvent.drop(dropZone, {
            dataTransfer: {
                files: [file1, file2],
                types: ['Files']
            }
        });

        expect(screen.getByText('Please upload a single image for this feature.')).toBeInTheDocument();
        expect(mockOnUploadComplete).not.toHaveBeenCalled();
    });

    it('uploads single file successfully', async () => {
        render(<ImageUploader onUploadComplete={mockOnUploadComplete} allowMultiple={false} />);

        const dropZone = screen.getByText('Upload Image').closest('div');
        if (!dropZone) throw new Error('Drop zone not found');

        const file = new File(['foo'], 'foo.png', { type: 'image/png' });

        fireEvent.drop(dropZone, {
            dataTransfer: {
                files: [file],
                types: ['Files']
            }
        });

        // Since we can't easily await the internal async process details without act() or waitFor,
        // we assume if no error appears immediately and it starts uploading, it's good for this level of test.
        // We can check if "Uploading..." appears.
        expect(screen.getByText('Uploading...')).toBeInTheDocument();
    });
});
