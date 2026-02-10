"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import type { OptimisticWardrobeItem, WardrobeItem } from "@/types/wardrobe";
import { deleteWardrobeItemAction } from "@/app/actions/wardrobe";
import { createTraceContext } from "@/lib/trace";

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
        const trace = createTraceContext();
        await deleteWardrobeItemAction({ itemId: id, reason, ...trace });
        setDeletingId(null);
        setShowConfirm(null);
    };

    const mergedItems: RenderItem[] = [
        ...optimisticItems.map((item) => ({ ...item, isOptimistic: true as const })),
        ...items.map((item) => ({ ...item, isOptimistic: false as const })),
    ];

    if (mergedItems.length === 0) {
        return (
            <div className="text-center py-10 text-gray-500">
                No items in your wardrobe yet. Upload some!
            </div>
        );
    }

    return (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {mergedItems.map((item) => {
                const itemId = item.isOptimistic ? item.tempId : item.id;
                const isPending = item.isOptimistic ? item.status !== "error" : item.analysisStatus !== "ready";
                const isError = item.isOptimistic ? item.status === "error" : item.analysisStatus === "error";

                return (
                    <div key={itemId} className="group relative break-inside-avoid rounded-lg overflow-hidden shadow-md hover:shadow-xl transition-shadow bg-white">
                    <div className="aspect-[3/4] relative">
                        <img
                            src={item.imageUrl}
                            alt={item.description || "Wardrobe Item"}
                            className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                            loading="lazy"
                        />
                        {/* Delete Button (Visible on Hover or if Confirming) */}
                        {!item.isOptimistic && (
                            <div className={`absolute top-2 right-2 ${showConfirm === item.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}>
                                <button
                                    onClick={() => setShowConfirm(item.id)}
                                    className="bg-white/80 hover:bg-red-100 p-2 rounded-full text-red-600 shadow-sm backdrop-blur-sm"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="p-3">
                        <p className="font-bold text-sm text-gray-900">{item.category || (isPending ? "Analyzing..." : "Uncategorized")}</p>
                        <div className="flex flex-wrap gap-1 mt-1">
                            {(item.styleTags || []).slice(0, 3).map((tag, i) => (
                                <span key={i} className="text-[10px] bg-gray-100 px-2 py-1 rounded-full text-gray-600">
                                    {tag}
                                </span>
                            ))}
                            {!item.styleTags?.length && (
                                <span className="text-[10px] bg-gray-100 px-2 py-1 rounded-full text-gray-400">
                                    {isPending ? "Tags incoming" : "No tags"}
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Delete Confirmation Overlay */}
                    {!item.isOptimistic && showConfirm === item.id && (
                        <div className="absolute inset-0 bg-white/95 flex flex-col items-center justify-center p-4 text-center z-10 animate-in fade-in zoom-in-95 duration-200">
                            <h4 className="font-semibold text-sm mb-2 text-gray-900">Delete Item?</h4>
                            <select
                                className="text-xs p-1 border rounded mb-3 w-full"
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
                                    className="px-3 py-1 text-xs bg-gray-200 rounded hover:bg-gray-300"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => handleDelete(item.id)}
                                    disabled={deletingId === item.id}
                                    className="px-3 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                                >
                                    {deletingId === item.id ? '...' : 'Delete'}
                                </button>
                            </div>
                        </div>
                    )}

                    {(isPending || isError) && (
                        <div className="absolute inset-0 bg-white/70 flex items-center justify-center text-xs font-semibold text-gray-700 uppercase tracking-wide">
                            {isError ? "Analysis failed" : "Processing"}
                        </div>
                    )}
                </div>
                );
            })}
        </div>
    );
}
