'use client';

import { useState, useCallback } from "react";
import Image from "next/image";
import { Loader2, UploadCloud, X } from "lucide-react";
import { getUploadUrl } from "@/app/actions";

interface ImageUploaderProps {
    onUploadComplete: (paths: string[]) => void;
    label?: string;
}

export default function ImageUploader({ onUploadComplete, label = "Upload Image" }: ImageUploaderProps) {
    const [previews, setPreviews] = useState<string[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadError, setUploadError] = useState<string | null>(null);

    const processFiles = async (files: File[]) => {
        setIsUploading(true);
        setUploadError(null);
        const newPreviews: string[] = [];
        const uploadedPaths: string[] = [];

        try {
            //Create local previews first
            files.forEach(file => {
                const objectUrl = URL.createObjectURL(file);
                newPreviews.push(objectUrl);
            });
            setPreviews(prev => [...prev, ...newPreviews]);

            // Upload each file
            for (const file of files) {
                // 1. Get Signed URL
                const result = await getUploadUrl(file.name);

                if (!result.success) {
                    throw new Error(result.error || "Failed to get upload URL");
                }

                const { url, path } = result as { success: true; url: string; path: string };

                if (!url) {
                    throw new Error("Failed to get upload URL (missing url)");
                }

                // 2. Upload to Supabase
                const uploadRes = await fetch(url, {
                    method: 'PUT',
                    body: file,
                    headers: {
                        'Content-Type': file.type
                    }
                });

                if (!uploadRes.ok) {
                    throw new Error(`Upload failed for ${file.name}`);
                }

                if (path) uploadedPaths.push(path);
            }

            // 3. Notify parent
            onUploadComplete(uploadedPaths);

        } catch (err: any) {
            console.error("Upload error:", err);
            setUploadError(err.message || "Failed to upload images");
            // Clean up previews if failed? Maybe keep them for retry?
            // For now, let's leave them but show error.
        } finally {
            setIsUploading(false);
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            processFiles(Array.from(e.target.files));
        }
    };

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            processFiles(Array.from(e.dataTransfer.files));
        }
    }, []);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
    }, []);

    const handleRemove = (index: number) => {
        setPreviews(prev => prev.filter((_, i) => i !== index));
        // Note: We can't easily "un-upload" from here without another server action, 
        // but since we just pass paths to parent on completion, removing from UI 
        // implies we might want to clear the uploadedPaths in parent.
        // However, the current interface `onUploadComplete` is called ONCE after batch upload.
        // If user removes a preview *after* upload but *before* submitting the parent form (if any),
        // it strictly depends on how parent handles it.
        // Given AddItemSection immediately calls `addItems` with the result of `onUploadComplete`,
        // the upload flow is atomic: Select -> Upload -> Add Items.
        // So this remove button effectively just clears the *preview* for the NEXT batch if any, or if we want to support multiple batches.
        // Actually, AddItemSection calls `addItems` immediately. 
        // So typically, after `processFiles` finishes, `onUploadComplete` is called and parent does its thing.
        // So this UI state might be reset by parent or we should reset it?
        // AddItemSection does NOT reset the Uploader. 
        // We should probably allow clearing valid/invalid state.
    };

    const clearAll = () => {
        setPreviews([]);
        setUploadError(null);
    };

    return (
        <div className="w-full max-w-md mx-auto">
            <div
                className={`border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center transition-colors ${isUploading ? 'bg-gray-50 border-gray-300' : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
                    }`}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
            >
                {previews.length > 0 ? (
                    <div className="w-full mb-4">
                        <div className="grid grid-cols-2 gap-2 mb-4">
                            {previews.map((url, index) => (
                                <div key={index} className="relative w-full aspect-square text-gray-800">
                                    <Image
                                        src={url}
                                        alt={`Uploaded ${index + 1}`}
                                        fill
                                        className="object-cover rounded-md"
                                    />
                                    {/* Only allow removing if not currently uploading (simple lock) */}
                                    {!isUploading && (
                                        <button
                                            onClick={() => handleRemove(index)}
                                            className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full text-xs hover:bg-red-600 transition-colors"
                                            aria-label="Remove image"
                                        >
                                            <X size={12} />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                        {!isUploading && (
                            <button
                                onClick={clearAll}
                                className="text-sm text-red-500 hover:text-red-700 underline w-full text-center"
                            >
                                Clear All
                            </button>
                        )}
                    </div>
                ) : (
                    <label className="w-full cursor-pointer flex flex-col items-center justify-center">
                        <div className="p-4 bg-gray-100 rounded-full mb-3">
                            <UploadCloud className="h-6 w-6 text-gray-500" />
                        </div>
                        <h3 className="text-center font-semibold mb-2 text-gray-700">{label}</h3>
                        <p className="text-center text-xs text-gray-500 mb-4">Drag & drop or click to upload</p>
                        <input
                            type="file"
                            multiple
                            accept="image/*"
                            className="hidden"
                            onChange={handleFileSelect}
                            disabled={isUploading}
                        />
                    </label>
                )}

                {isUploading && (
                    <div className="flex items-center gap-2 mt-2 text-blue-600">
                        <Loader2 className="animate-spin h-4 w-4" />
                        <span>Uploading...</span>
                    </div>
                )}

                {uploadError && (
                    <div className="mt-2 text-sm text-red-600 text-center">
                        {uploadError}
                    </div>
                )}
            </div>
        </div>
    );
}
