'use client';

import { useState } from 'react';
import ImageUploader, { type UploadedFile } from './ImageUploader';
import { Loader2 } from 'lucide-react';
import type { OptimisticWardrobeItem } from '@/types/wardrobe';
import { createTraceContext } from '@/lib/trace';
import { createWardrobeItemAction, processWardrobeItemAction } from '@/app/actions/wardrobe';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface AddItemSectionProps {
    onOptimisticAdd: (items: OptimisticWardrobeItem[]) => void;
    onOptimisticUpdate: (tempId: string, patch: Partial<OptimisticWardrobeItem>) => void;
    uploaderInputId?: string;
}

export default function AddItemSection({ onOptimisticAdd, onOptimisticUpdate, uploaderInputId }: AddItemSectionProps) {
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
        <div className="mb-8" id="rack-uploader">
            <div className="mb-4 flex items-center justify-between">
                <h2 className="text-2xl font-black uppercase tracking-tight text-[#310A31]">Closet Rack</h2>
            </div>

            <Card className="rack-panel mb-6 rounded-none py-0">
                <CardHeader className="px-0">
                    <CardTitle className="mb-0 text-lg font-black uppercase tracking-wide text-[#310A31]">Add pieces</CardTitle>
                </CardHeader>
                <CardContent className="px-0">
                <ImageUploader
                    onUploadComplete={handleUpload}
                    label="Upload Closet Photos"
                    enablePreview
                    inputId={uploaderInputId}
                    capture="environment"
                />

                {isProcessing && (
                    <div className="mt-4 flex items-center justify-center gap-2 text-[#310A31]">
                        <Loader2 className="animate-spin" />
                        <span>{status}</span>
                    </div>
                )}
                {!isProcessing && status && (
                    <div className={`mt-4 border-2 border-black p-3 text-center font-semibold ${status.startsWith('Error') ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-800'}`}>
                        {status}
                    </div>
                )}
                </CardContent>
            </Card>
        </div>
    );
}
