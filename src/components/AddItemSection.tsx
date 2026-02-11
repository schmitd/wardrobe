'use client';

import { useState } from 'react';
import ImageUploader, { type UploadedFile } from './ImageUploader';
import { Loader2 } from 'lucide-react';
import type { OptimisticWardrobeItem } from '@/types/wardrobe';
import { createTraceContext } from '@/lib/trace';
import { createWardrobeItemAction, processWardrobeItemAction } from '@/app/actions/wardrobe';

interface AddItemSectionProps {
    onOptimisticAdd: (items: OptimisticWardrobeItem[]) => void;
    onOptimisticUpdate: (tempId: string, patch: Partial<OptimisticWardrobeItem>) => void;
}

export default function AddItemSection({ onOptimisticAdd, onOptimisticUpdate }: AddItemSectionProps) {
    const [isProcessing, setIsProcessing] = useState(false);
    const [status, setStatus] = useState<string | null>(null);
    const handleUpload = async (uploads: UploadedFile[]) => {
        if (uploads.length === 0) return;

        setIsProcessing(true);
        setStatus(`Preparing ${uploads.length} item${uploads.length === 1 ? '' : 's'}...`);

        const queue = uploads.map((upload) => ({
            upload,
            tempId: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
            ...createTraceContext(),
        }));

        onOptimisticAdd(
            queue.map(({ upload, tempId }) => ({
                tempId,
                imageUrl: upload.previewUrl || '',
                status: 'uploading',
                createdAt: Date.now(),
            }))
        );

        try {
            for (const { upload, tempId, traceId, traceparent } of queue) {
                try {
                    const result = await createWardrobeItemAction({
                        storageId: upload.storageId,
                        clientFileName: upload.file.name,
                        contentType: upload.file.type,
                        traceId,
                        traceparent,
                    });

                    onOptimisticUpdate(tempId, {
                        status: 'processing',
                        serverId: result.id,
                    });

                    const processed = await processWardrobeItemAction({
                        itemId: result.id,
                        traceId,
                        traceparent,
                    });

                    if (!processed.success) {
                        console.error('Failed to process wardrobe item', {
                            itemId: result.id,
                            error: processed.error,
                        });
                        onOptimisticUpdate(tempId, {
                            status: 'error',
                            error: processed.error ?? 'Processing failed',
                        });
                        continue;
                    }
                } catch (error) {
                    console.error('Failed to create wardrobe item', error);
                    onOptimisticUpdate(tempId, {
                        status: 'error',
                        error: error instanceof Error ? error.message : 'Failed to add item',
                    });
                }
            }

            setStatus(`Processed ${uploads.length} item${uploads.length === 1 ? '' : 's'}.`);
            setTimeout(() => setStatus(null), 3000);
        } catch (e) {
            console.error("Exception in batch processing:", e);
            setStatus("Error: An unexpected error occurred.");
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
                <ImageUploader onUploadComplete={handleUpload} label="Upload Clothing Items" enablePreview />

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
