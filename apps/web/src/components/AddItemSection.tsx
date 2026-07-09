'use client';

import { useState } from 'react';
import ImageUploader, { type UploadedFile } from './ImageUploader';
import { Loader2 } from 'lucide-react';
import type { OptimisticWardrobeItem } from '@/types/wardrobe';
import { createTraceContext } from '@/lib/trace';
import { userFacingErrorMessage } from '@/lib/userFacingError';
import { createWardrobeItemAction } from '@/app/actions/wardrobe';

interface AddItemSectionProps {
    onOptimisticAdd: (items: OptimisticWardrobeItem[]) => void;
    onOptimisticUpdate: (tempId: string, patch: Partial<OptimisticWardrobeItem>) => void;
    uploaderInputId?: string;
}

type StreamEvent =
    | { type: 'status'; stage: string }
    | { type: 'tags'; category: string | null; styleTags: string[] }
    | { type: 'description'; category: string | null; description: string }
    | { type: 'complete' }
    | { type: 'error'; error?: string };

const parseEventLine = (line: string): StreamEvent | null => {
    if (!line.trim()) return null;
    try {
        return JSON.parse(line) as StreamEvent;
    } catch {
        return null;
    }
};

const stageLabel = (stage: string) => {
    switch (stage) {
        case 'fetching_image':
            return 'Preparing image...';
        case 'analyzing_tags':
            return 'Reading styles and tags...';
        case 'analyzing_description':
            return 'Drafting item description...';
        case 'embedding':
            return 'Building compatibility vector...';
        case 'persisting':
            return 'Saving final analysis...';
        default:
            return 'Processing...';
    }
};

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
            let successCount = 0;
            let failureCount = 0;

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

                    const streamResponse = await fetch('/api/wardrobe/process-stream', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            itemId: result.id,
                            traceId,
                            traceparent,
                        }),
                    });

                    if (!streamResponse.ok || !streamResponse.body) {
                        throw new Error(`Processing failed: ${streamResponse.status}`);
                    }

                    const reader = streamResponse.body.getReader();
                    const decoder = new TextDecoder();
                    let pending = '';
                    let streamFailed = false;
                    let streamCompleted = false;

                    while (true) {
                        const { value, done } = await reader.read();
                        if (done) break;
                        pending += decoder.decode(value, { stream: true });

                        let nl = pending.indexOf('\n');
                        while (nl >= 0) {
                            const line = pending.slice(0, nl);
                            pending = pending.slice(nl + 1);
                            nl = pending.indexOf('\n');

                            const event = parseEventLine(line);
                            if (!event) continue;

                            if (event.type === 'status') {
                                setStatus(`${stageLabel(event.stage)} (${upload.file.name})`);
                            } else if (event.type === 'tags') {
                                onOptimisticUpdate(tempId, {
                                    category: event.category,
                                    styleTags: event.styleTags,
                                });
                            } else if (event.type === 'description') {
                                onOptimisticUpdate(tempId, {
                                    category: event.category,
                                    description: event.description,
                                });
                            } else if (event.type === 'error') {
                                streamFailed = true;
                                onOptimisticUpdate(tempId, {
                                    status: 'error',
                                    error: userFacingErrorMessage(event.error, 'Analysis failed'),
                                });
                            } else if (event.type === 'complete') {
                                streamCompleted = true;
                            }
                        }
                    }

                    if (pending.trim()) {
                        const event = parseEventLine(pending.trim());
                        if (event?.type === 'error') {
                            streamFailed = true;
                            onOptimisticUpdate(tempId, {
                                status: 'error',
                                error: userFacingErrorMessage(event.error, 'Analysis failed'),
                            });
                        } else if (event?.type === 'complete') {
                            streamCompleted = true;
                        }
                    }

                    if (streamFailed || !streamCompleted) {
                        if (!streamFailed) {
                            onOptimisticUpdate(tempId, {
                                status: 'error',
                                error: 'Processing stream ended before completion',
                            });
                        }
                        failureCount += 1;
                        continue;
                    }

                    successCount += 1;
                } catch (error) {
                    console.error('wardrobe.create.failed', error);
                    onOptimisticUpdate(tempId, {
                        status: 'error',
                        error: userFacingErrorMessage(error, 'Analysis failed'),
                    });
                    failureCount += 1;
                }
            }

            if (failureCount > 0) {
                setStatus(
                    `Processed ${successCount}/${uploads.length} item${uploads.length === 1 ? '' : 's'} (${failureCount} failed).`
                );
            } else {
                setStatus(`Processed ${uploads.length} item${uploads.length === 1 ? '' : 's'}.`);
            }
            setTimeout(() => setStatus(null), 3000);
        } catch (e) {
            console.error("wardrobe.batch.failed", e);
            setStatus(userFacingErrorMessage(e, 'Analysis failed'));
        }
        setIsProcessing(false);
    };

    return (
        <div className="mb-8" id="rack-uploader">
            <div className="mb-4 flex items-center justify-between">
                <h2 className="text-2xl font-black uppercase tracking-tight text-[#310A31]">Closet Rack</h2>
            </div>

            <ImageUploader
                onUploadComplete={handleUpload}
                label="Upload Closet Photos"
                enablePreview
                inputId={uploaderInputId}
                capture="environment"
                hiddenTriggerOnly
            />

            {isProcessing && (
                <div className="mt-4 flex items-center justify-center gap-2 border-2 border-black bg-white p-3 text-[#310A31]">
                    <Loader2 className="animate-spin" />
                    <span>{status}</span>
                </div>
            )}
            {!isProcessing && status && (
                <div className={`mt-4 border-2 border-black p-3 text-center font-semibold ${/fail|error/i.test(status) ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-800'}`}>
                    {status}
                </div>
            )}
        </div>
    );
}
