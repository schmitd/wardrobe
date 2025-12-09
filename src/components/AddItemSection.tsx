'use client';

import { useState } from 'react';
import ImageUploader from './ui/ImageUploader';
import { addItem } from '@/app/actions';
import { Loader2 } from 'lucide-react';

export default function AddItemSection() {
    const [isProcessing, setIsProcessing] = useState(false);
    const [status, setStatus] = useState<string | null>(null);

    const handleUpload = async (urls: string[]) => {
        setIsProcessing(true);
        setStatus(`Preparing to analyze ${urls.length} items...`);
        console.log("Starting processing for URLs:", urls);

        let successCount = 0;
        let failCount = 0;

        for (let i = 0; i < urls.length; i++) {
            setStatus(`Analyzing item ${i + 1} of ${urls.length}...`);
            console.log(`Processing item ${i + 1}/${urls.length}:`, urls[i]);
            try {
                const result = await addItem(urls[i]);
                console.log(`Result for item ${i + 1}:`, result);
                if (result.success) {
                    successCount++;
                } else {
                    failCount++;
                    console.error(`Failed to add item ${i}:`, result.error);
                }
            } catch (e) {
                console.error(`Exception processing item ${i}:`, e);
                failCount++;
            }
        }

        console.log("Processing complete. Success:", successCount, "Fail:", failCount);

        if (failCount === 0) {
            setStatus(`Successfully added ${successCount} items!`);
            setTimeout(() => setStatus(null), 3000);
        } else {
            setStatus(`Finished. Added ${successCount} items. Failed: ${failCount}.`);
        }
        setIsProcessing(false);
    };

    return (
        <div className="mb-8">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-gray-800">My Wardrobe</h2>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-6">
                <h3 className="text-lg font-medium mb-4">Add New Item</h3>
                <ImageUploader onUploadComplete={handleUpload} label="Upload Clothing Items" />

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
