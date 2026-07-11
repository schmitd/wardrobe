'use client';

import { useState, useRef } from 'react';
import { Effect, Layer } from 'effect';
import { AlertCircle, ImagePlus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getUploadUrlAction } from '@/app/actions/wardrobe';
import { userFacingErrorMessage } from '@/lib/userFacingError';
import { ImageUploadService, makeImageUploadLayer } from '@/services/ImageUploadService';

export interface UploadedFile {
    storageId: string;
    previewUrl?: string;
    file: File;
}

interface ImageUploaderProps {
    onUploadComplete: (files: UploadedFile[]) => void;
    label?: string;
    allowMultiple?: boolean;
    enablePreview?: boolean;
    inputId?: string;
    capture?: 'user' | 'environment';
    uploadLayer?: Layer.Layer<ImageUploadService>;
    hiddenTriggerOnly?: boolean;
}

export default function ImageUploader({
    onUploadComplete,
    label,
    allowMultiple = true,
    enablePreview = false,
    inputId,
    capture,
    uploadLayer,
    hiddenTriggerOnly = false,
}: ImageUploaderProps) {
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const liveUploadLayer = makeImageUploadLayer({ getUploadUrl: getUploadUrlAction });
    const activeUploadLayer = uploadLayer ?? liveUploadLayer;

    // Determine label based on allowMultiple if not explicitly provided
    const displayLabel = label || (allowMultiple ? "Upload Images" : "Upload Image");

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            handleFiles(Array.from(e.target.files));
        }
    };

    const handleFiles = async (files: File[]) => {
        if (!allowMultiple && files.length > 1) {
            setError("Please upload a single image for this feature.");
            return;
        }
        setUploading(true);
        setError(null);
        const uploadedFiles: UploadedFile[] = [];

        try {
            for (const file of files) {
                const { storageId } = await Effect.runPromise(
                    ImageUploadService.pipe(
                        Effect.flatMap((service) => service.uploadImageFile(file)),
                        Effect.provide(activeUploadLayer)
                    )
                );

                uploadedFiles.push({
                    storageId,
                    previewUrl: enablePreview ? URL.createObjectURL(file) : undefined,
                    file,
                });
            }

            if (uploadedFiles.length > 0) {
                onUploadComplete(uploadedFiles);
            }

        } catch (e) {
            console.error("Upload error:", e);
            setError(userFacingErrorMessage(e, "Upload failed"));
        } finally {
            setUploading(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    if (hiddenTriggerOnly) {
        return (
            <>
                <input
                    type="file"
                    id={inputId}
                    ref={fileInputRef}
                    className="hidden"
                    multiple={allowMultiple}
                    accept="image/*"
                    capture={capture}
                    onChange={handleFileSelect}
                />

                {error && (
                    <div className="mt-4 flex items-center gap-2 border border-[var(--rack-line)] bg-[#f8e6ee] p-3 text-sm font-semibold text-[#b93267]">
                        <AlertCircle size={16} />
                        <span>{error}</span>
                    </div>
                )}
            </>
        );
    }

    return (
        <div className="w-full">
            <div className="flex flex-wrap items-center gap-3">
                <input
                    type="file"
                    id={inputId}
                    ref={fileInputRef}
                    className="hidden"
                    multiple={allowMultiple}
                    accept="image/*"
                    capture={capture}
                    onChange={handleFileSelect}
                />

                <Button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="h-10 rounded-none border border-[var(--rack-line)] bg-[#DCE66E] px-4 text-sm font-extrabold text-[#241426] shadow-[2px_2px_0_var(--rack-panel-shadow)]"
                >
                    {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                    {uploading ? 'Adding…' : displayLabel}
                </Button>
                <p className="text-sm font-medium text-[var(--rack-ink-soft)]">Choose from your device or use its camera.</p>
            </div>

            {error && (
                <div className="mt-4 flex items-center gap-2 border border-[var(--rack-line)] bg-[#f8e6ee] p-3 text-sm font-semibold text-[#b93267]">
                    <AlertCircle size={16} />
                    <span>{error}</span>
                </div>
            )}
        </div>
    );
}
