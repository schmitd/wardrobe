'use client';

import { useState, useRef } from 'react';
import { CloudUpload, X, Image as ImageIcon, CheckCircle, AlertCircle } from 'lucide-react';
import { getUploadUrl } from '@/app/upload-actions';

interface ImageUploaderProps {
    onUploadComplete: (paths: string[]) => void;
    label?: string;
}

export default function ImageUploader({ onUploadComplete, label = "Upload Image" }: ImageUploaderProps) {
    const [isDragging, setIsDragging] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

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
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
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
        const uploadedPaths: string[] = [];

        try {
            for (const file of files) {
                if (!file.type.startsWith('image/')) {
                    setError('Only image files are allowed.');
                    continue;
                }

                // 1. Get Signed URL
                const response = await getUploadUrl(file.name, file.type);

                if (!response.success) {
                    throw new Error(response.error || 'Failed to get upload URL');
                }

                // Assert type for success case
                const { url, path } = response as { success: true; url: string; token: string; path: string };

                if (!url || !path) {
                    throw new Error('Invalid response from server');
                }

                // 2. Upload to Supabase Storage via signed URL
                const uploadResponse = await fetch(url, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': file.type,
                    },
                    body: file,
                });

                if (!uploadResponse.ok) {
                    throw new Error(`Upload failed: ${uploadResponse.statusText}`);
                }

                uploadedPaths.push(path);
            }

            if (uploadedPaths.length > 0) {
                onUploadComplete(uploadedPaths);
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
                    multiple
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
                            {uploading ? 'Uploading...' : 'Click to upload or drag and drop'}
                        </h4>
                        <p className="text-sm text-gray-500 mt-1">
                            {uploading ? 'Please wait while we process your images' : 'SVG, PNG, JPG or GIF (max. 10MB)'}
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
