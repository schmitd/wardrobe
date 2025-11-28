'use client';

import { UploadDropzone } from "@/lib/uploadthing";
import { useState } from "react";
import Image from "next/image";
import { Loader2 } from "lucide-react";

interface ImageUploaderProps {
    onUploadComplete: (url: string) => void;
    label?: string;
}

export default function ImageUploader({ onUploadComplete, label = "Upload Image" }: ImageUploaderProps) {
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);

    return (
        <div className="w-full max-w-md mx-auto">
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 flex flex-col items-center justify-center bg-gray-50 hover:bg-gray-100 transition-colors">
                {imageUrl ? (
                    <div className="relative w-full aspect-square mb-4">
                        <Image
                            src={imageUrl}
                            alt="Uploaded"
                            fill
                            className="object-cover rounded-md"
                        />
                        <button
                            onClick={() => setImageUrl(null)}
                            className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full text-xs"
                        >
                            Remove
                        </button>
                    </div>
                ) : (
                    <div className="w-full">
                        <h3 className="text-center font-semibold mb-2 text-gray-700">{label}</h3>
                        <UploadDropzone
                            endpoint="imageUploader"
                            onClientUploadComplete={(res: any) => {
                                setIsUploading(false);
                                if (res && res[0]) {
                                    setImageUrl(res[0].url);
                                    onUploadComplete(res[0].url);
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
