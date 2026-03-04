'use client';

import { useState, useRef } from 'react';
import { Effect, Layer } from 'effect';
import { useMutation } from 'convex/react';
import { api } from '@convex/_generated/api';
import { CloudUpload, AlertCircle } from 'lucide-react';
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
}

export default function ImageUploader({
    onUploadComplete,
    label,
    allowMultiple = true,
    enablePreview = false,
    inputId,
    capture,
    uploadLayer,
}: ImageUploaderProps) {
    const [isDragging, setIsDragging] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const getUploadUrl = useMutation(api.wardrobe.getUploadUrl);
    const liveUploadLayer = makeImageUploadLayer({ getUploadUrl });
    const activeUploadLayer = uploadLayer ?? liveUploadLayer;

    // Determine label based on allowMultiple if not explicitly provided
    const displayLabel = label || (allowMultiple ? "Upload Images" : "Upload Image");

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        setError(null);

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            if (!allowMultiple && e.dataTransfer.files.length > 1) {
                setError("Please upload a single image for this feature.");
                return;
            }
            handleFiles(Array.from(e.dataTransfer.files));
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            handleFiles(Array.from(e.target.files));
        }
    };

    const handleFiles = async (files: File[]) => {
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
            setError(e instanceof Error ? e.message : "Upload failed");
        } finally {
            setUploading(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    return (
        <div className="w-full">
            <div
                className={`relative cursor-pointer border-4 border-black p-8 text-center transition-all duration-200 ease-in-out ${
                    isDragging
                        ? 'bg-[#c6b9cd]'
                        : 'bg-white hover:-translate-y-1 hover:shadow-[8px_8px_0_#000]'
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
            >
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

                <div className="flex flex-col items-center justify-center gap-4">
                    <div className={`rounded-none border-2 border-black p-4 ${isDragging ? 'bg-white text-[#310A31]' : 'bg-[#9C92A3] text-white'}`}>
                        {uploading ? (
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-current"></div>
                        ) : (
                            <CloudUpload size={32} />
                        )}
                    </div>

                    <div>
                        <h4 className="text-lg font-black uppercase tracking-wide text-[#310A31]">
                            {uploading ? 'Uploading...' : displayLabel}
                        </h4>
                        <p className="mt-1 text-sm font-medium text-slate-700">
                            {uploading
                                ? 'Please wait while we process your images'
                                : (allowMultiple ? 'Click or drag photos to upload' : 'Click or drag one photo to upload')
                            }
                        </p>
                    </div>
                </div>

                {uploading && (
                    <div className="absolute inset-0 cursor-not-allowed bg-white/40">
                        {/* Overlay to prevent interactions while uploading */}
                    </div>
                )}
            </div>

            {error && (
                <div className="mt-4 flex items-center gap-2 border-2 border-black bg-rose-100 p-3 text-sm font-semibold text-rose-700">
                    <AlertCircle size={16} />
                    <span>{error}</span>
                </div>
            )}
        </div>
    );
}
