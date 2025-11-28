'use client';

import { useState } from 'react';
import ImageUploader from './ui/ImageUploader';
import { addItem } from '@/app/actions';
import { Loader2 } from 'lucide-react';

export default function AddItemSection() {
    const [isProcessing, setIsProcessing] = useState(false);
    const [status, setStatus] = useState<string | null>(null);

    const handleUpload = async (url: string) => {
        setIsProcessing(true);
        setStatus("Analyzing item with Gemini...");

        try {
            const result = await addItem(url);
            if (result.success) {
                setStatus("Item added to wardrobe!");
                setTimeout(() => setStatus(null), 3000);
            } else {
                setStatus(`Error: ${result.error}`);
            }
        } catch (e) {
            setStatus("Error processing item.");
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="mb-8">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-gray-800">My Wardrobe</h2>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-6">
                <h3 className="text-lg font-medium mb-4">Add New Item</h3>
                <ImageUploader onUploadComplete={handleUpload} label="Upload Clothing Item" />

                {isProcessing && (
                    <div className="mt-4 flex items-center justify-center gap-2 text-blue-600">
                        <Loader2 className="animate-spin" />
                        <span>{status}</span>
                    </div>
                )}
                {!isProcessing && status && (
                    <div className={`mt-4 text-center font-medium ${status.startsWith('Error') ? 'text-red-600' : 'text-green-600'}`}>
                        {status}
                    </div>
                )}
            </div>
        </div>
    );
}
