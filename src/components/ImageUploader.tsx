'use client';

import { useState, useRef } from 'react';
import { useMutation } from 'convex/react';
import { api } from '@convex/_generated/api';
import { CloudUpload, AlertCircle } from 'lucide-react';

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
}

export default function ImageUploader({ onUploadComplete, label, allowMultiple = true, enablePreview = false }: ImageUploaderProps) {
    const [isDragging, setIsDragging] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const getUploadUrl = useMutation(api.wardrobe.getUploadUrl);

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
                if (!file.type.startsWith('image/')) {
                    setError('Only image files are allowed.');
                    continue;
                }

                const uploadUrl = await getUploadUrl();
                const uploadResponse = await fetch(uploadUrl, {
                    method: 'POST',
                    body: file,
                });

                if (!uploadResponse.ok) {
                    throw new Error(`Upload failed: ${uploadResponse.statusText}`);
                }

                const { storageId } = await uploadResponse.json();
                if (!storageId) {
                    throw new Error('Upload response missing storageId');
                }

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
                className={`relative border-2 border-dashed rounded-xl p-8 transition-all duration-200 ease-in-out text-center cursor-pointer ${isDragging
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
                    }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
            >
                <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    multiple={allowMultiple}
                    accept="image/*"
                    onChange={handleFileSelect}
                />

                <div className="flex flex-col items-center justify-center gap-4">
                    <div className={`p-4 rounded-full ${isDragging ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'}`}>
                        {uploading ? (
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-current"></div>
                        ) : (
                            <CloudUpload size={32} />
                        )}
                    </div>

                    <div>
                        <h4 className="text-lg font-medium text-gray-700">
                            {uploading ? 'Uploading...' : displayLabel}
                        </h4>
                        <p className="text-sm text-gray-500 mt-1">
                            {uploading
                                ? 'Please wait while we process your images'
                                : (allowMultiple ? 'Click or drag images to upload' : 'Click or drag an image to upload')
                            }
                        </p>
                    </div>
                </div>

                {uploading && (
                    <div className="absolute inset-0 bg-white/50 flex items-center justify-center rounded-xl cursor-not-allowed">
                        {/* Overlay to prevent interactions while uploading */}
                    </div>
                )}
            </div>

            {error && (
                <div className="mt-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg flex items-center gap-2">
                    <AlertCircle size={16} />
                    <span>{error}</span>
                </div>
            )}
        </div>
    );
}
