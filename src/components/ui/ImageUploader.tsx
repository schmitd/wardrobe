'use client';

import { UploadDropzone } from "@/lib/uploadthing";
import { useState } from "react";
import Image from "next/image";
import { Loader2 } from "lucide-react";

interface ImageUploaderProps {
    onUploadComplete: (urls: string[]) => void;
    label?: string;
}

export default function ImageUploader({ onUploadComplete, label = "Upload Image" }: ImageUploaderProps) {
    const [imageUrls, setImageUrls] = useState<string[]>([]);
    const [isUploading, setIsUploading] = useState(false);

    const handleRemove = (urlToRemove: string) => {
        setImageUrls(prev => prev.filter(url => url !== urlToRemove));
    };

    return (
        <div className="w-full max-w-md mx-auto">
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 flex flex-col items-center justify-center bg-gray-50 hover:bg-gray-100 transition-colors">
                {imageUrls.length > 0 ? (
                    <div className="w-full mb-4">
                        <div className="grid grid-cols-2 gap-2 mb-4">
                            {imageUrls.map((url, index) => (
                                <div key={index} className="relative w-full aspect-square">
                                    <Image
                                        src={url}
                                        alt={`Uploaded ${index + 1}`}
                                        fill
                                        className="object-cover rounded-md"
                                    />
                                    <button
                                        onClick={() => handleRemove(url)}
                                        className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full text-xs hover:bg-red-600 transition-colors"
                                        aria-label="Remove image"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                    </button>
                                </div>
                            ))}
                        </div>
                        <button
                            onClick={() => setImageUrls([])}
                            className="text-sm text-red-500 hover:text-red-700 underline w-full text-center"
                        >
                            Clear All
                        </button>
                    </div>
                ) : (
                    <div className="w-full">
                        <h3 className="text-center font-semibold mb-2 text-gray-700">{label}</h3>
                        <p className="text-center text-xs text-gray-500 mb-4">Upload up to 10 images at once</p>
                        <UploadDropzone
                            endpoint="imageUploader"
                            onClientUploadComplete={(res: any) => {
                                setIsUploading(false);
                                if (res && res.length > 0) {
                                    const newUrls = res.map((r: any) => r.url);
                                    setImageUrls(newUrls);
                                    onUploadComplete(newUrls);
                                }
                            }}
                            onUploadError={(error: Error) => {
                                setIsUploading(false);
                                alert(`ERROR! ${error.message}`);
                            }}
                            onUploadBegin={() => setIsUploading(true)}
                            appearance={{
                                button: "bg-black text-white hover:bg-gray-800",
                                container: "border-none",
                                label: "text-gray-500",
                            }}
                        />
                    </div>
                )}
                {isUploading && (
                    <div className="flex items-center gap-2 mt-2 text-blue-600">
                        <Loader2 className="animate-spin h-4 w-4" />
                        <span>Uploading...</span>
                    </div>
                )}
            </div>
        </div>
    );
}
