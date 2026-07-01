"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import type { OptimisticWardrobeItem, WardrobeItem } from "@/types/wardrobe";
import { deleteWardrobeItemAction } from "@/app/actions/wardrobe";
import { createTraceContext } from "@/lib/trace";
import RackItemCard from "./RackItemCard";

interface WardrobeGridProps {
    items: WardrobeItem[];
    optimisticItems?: OptimisticWardrobeItem[];
}

type RenderItem = (WardrobeItem & { isOptimistic: false }) | (OptimisticWardrobeItem & { isOptimistic: true });

export default function WardrobeGrid({ items, optimisticItems = [] }: WardrobeGridProps) {
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [reason, setReason] = useState("Disliked item style");
    const [showConfirm, setShowConfirm] = useState<string | null>(null); // ID of item to confirm delete

    const handleDelete = async (id: string) => {
        setDeletingId(id);
        try {
            const trace = createTraceContext();
            await deleteWardrobeItemAction({ itemId: id, reason, ...trace });
            setShowConfirm(null);
        } catch (error) {
            console.error('wardrobe.delete.failed', {
                itemId: id,
                message: error instanceof Error ? error.message : 'Unknown error',
            });
            setShowConfirm(null);
        } finally {
            setDeletingId(null);
        }
    };

    const mergedItems: RenderItem[] = [
        ...optimisticItems.map((item) => ({ ...item, isOptimistic: true as const })),
        ...items.map((item) => ({ ...item, isOptimistic: false as const })),
    ];

    if (mergedItems.length === 0) {
        return <div className="rack-panel text-center text-sm font-semibold uppercase tracking-wide text-slate-700">No pieces yet. Upload your first rack set.</div>;
    }

    return (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            {mergedItems.map((item) => {
                const itemId = item.isOptimistic ? item.tempId : item.id;
                const isPending = item.isOptimistic ? item.status !== "error" : item.analysisStatus !== "ready";
                const isError = item.isOptimistic ? item.status === "error" : item.analysisStatus === "error";

                return (
                    <div
                        key={itemId}
                        className="group relative"
                    >
                    <div className="relative">
                        <RackItemCard
                            imageUrl={item.imageUrl}
                            category={item.category ?? null}
                            description={item.description ?? null}
                            styleTags={item.styleTags ?? null}
                            badgeLabel={isPending ? "Processing" : undefined}
                        />
                        {/* Delete Button (Visible on Hover or if Confirming) */}
                        {!item.isOptimistic && (
                            <div className={`absolute top-2 right-2 ${showConfirm === item.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}>
                                <button
                                    onClick={() => setShowConfirm(item.id)}
                                    className="border-2 border-black bg-white p-2 text-red-600 shadow-[3px_3px_0_#000]"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Delete Confirmation Overlay */}
                    {!item.isOptimistic && showConfirm === item.id && (
                        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/95 p-3 text-center">
                            <h4 className="mb-2 text-sm font-black uppercase tracking-wide text-[#310A31]">Remove piece?</h4>
                            <select
                                className="mb-3 w-full max-w-[260px] border-2 border-black bg-white p-2 text-xs font-semibold"
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                            >
                                <option value="Disliked item style">Disliked Style</option>
                                <option value="Item damaged/lost">Damaged/Lost</option>
                                <option value="Poor fit">Poor Fit</option>
                                <option value="Other">Other</option>
                            </select>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setShowConfirm(null)}
                                    className="border-2 border-black bg-white px-3 py-1 text-xs font-semibold uppercase"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => handleDelete(item.id)}
                                    disabled={deletingId === item.id}
                                    className="border-2 border-black bg-[#310A31] px-3 py-1 text-xs font-black uppercase text-white shadow-[3px_3px_0_#000] disabled:opacity-50"
                                >
                                    {deletingId === item.id ? '...' : 'Delete'}
                                </button>
                            </div>
                        </div>
                    )}

                    {(isPending || isError) && (
                        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-white/65 text-xs font-black uppercase tracking-[0.14em] text-[#310A31]">
                            {isError ? "Analysis failed" : "Processing"}
                        </div>
                    )}
                </div>
                );
            })}
        </div>
    );
}
