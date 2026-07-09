"use client";

import { useEffect, useState } from "react";
import { Trash2, X } from "lucide-react";
import type { OptimisticWardrobeItem, WardrobeItem } from "@/types/wardrobe";
import { deleteWardrobeItemAction } from "@/app/actions/wardrobe";
import { createTraceContext } from "@/lib/trace";
import { Button } from "@/components/ui/button";
import RackItemCard from "./RackItemCard";

interface WardrobeGridProps {
    items: WardrobeItem[];
    optimisticItems?: OptimisticWardrobeItem[];
    onAddPiece?: () => void;
    onRemoveOptimistic?: (tempId: string) => void;
}

type RenderItem = (WardrobeItem & { isOptimistic: false }) | (OptimisticWardrobeItem & { isOptimistic: true });

export default function WardrobeGrid({
    items,
    optimisticItems = [],
    onAddPiece,
    onRemoveOptimistic,
}: WardrobeGridProps) {
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [reason, setReason] = useState("Disliked item style");
    const [showConfirm, setShowConfirm] = useState<string | null>(null); // ID of item to confirm delete
    const [notice, setNotice] = useState<string | null>(null);
    const [actionError, setActionError] = useState<string | null>(null);

    useEffect(() => {
        if (!showConfirm) return;

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                setShowConfirm(null);
                setActionError(null);
            }
        };

        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [showConfirm]);

    const handleDelete = async (id: string) => {
        setDeletingId(id);
        setActionError(null);
        setNotice(null);
        try {
            const trace = createTraceContext();
            await deleteWardrobeItemAction({ itemId: id, reason, ...trace });
            setShowConfirm(null);
            setNotice("Piece removed from your rack.");
        } catch (error) {
            console.error('wardrobe.delete.failed', {
                itemId: id,
                message: error instanceof Error ? error.message : 'Unknown error',
            });
            setActionError(error instanceof Error ? error.message : "Could not remove this piece. Try again.");
        } finally {
            setDeletingId(null);
        }
    };

    const mergedItems: RenderItem[] = [
        ...optimisticItems.map((item) => ({ ...item, isOptimistic: true as const })),
        ...items.map((item) => ({ ...item, isOptimistic: false as const })),
    ];

    if (mergedItems.length === 0) {
        return (
            <section className="rack-empty-state" aria-labelledby="empty-rack-title">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-[#4e1e51]">Closet Rack</p>
                <h3 id="empty-rack-title" className="mt-2 text-2xl font-black uppercase text-[#310A31]">
                    Start with a few clear pieces
                </h3>
                <p className="mt-3 max-w-xl text-sm font-medium leading-relaxed text-[#4e1e51]">
                    Upload 3-6 closet photos with good light. Each analyzed piece appears here as a rack card with a category tag, notes, and compatibility context.
                </p>
                {onAddPiece && (
                    <Button
                        type="button"
                        onClick={onAddPiece}
                        className="mt-5 h-auto rounded-none border-2 border-black bg-[#310A31] px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-white shadow-[4px_4px_0_#000]"
                    >
                        Add first piece
                    </Button>
                )}
            </section>
        );
    }

    return (
        <section className="space-y-4" aria-label="Closet rack">
            {(notice || actionError) && (
                <div
                    role="status"
                    className={`border-2 border-black p-3 text-sm font-semibold ${
                        actionError ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-800"
                    }`}
                >
                    {actionError ?? notice}
                </div>
            )}

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                {mergedItems.map((item) => {
                    const itemId = item.isOptimistic ? item.tempId : item.id;
                    const isPending = item.isOptimistic ? item.status !== "error" : item.analysisStatus !== "ready";
                    const isError = item.isOptimistic ? item.status === "error" : item.analysisStatus === "error";
                    const errorMessage = item.isOptimistic ? item.error : item.analysisError;

                    return (
                        <article
                            key={itemId}
                            data-wardrobe-item-id={itemId}
                            className="relative"
                        >
                            <RackItemCard
                                imageUrl={item.imageUrl}
                                category={item.category ?? null}
                                description={item.description ?? null}
                                styleTags={item.styleTags ?? null}
                                badgeLabel={isPending ? "Processing" : isError ? "Needs review" : undefined}
                            />

                            {!item.isOptimistic && (
                                <button
                                    type="button"
                                    aria-label={`Remove ${item.category ?? "piece"}`}
                                    aria-expanded={showConfirm === item.id}
                                    onClick={() => {
                                        setShowConfirm(item.id);
                                        setActionError(null);
                                    }}
                                    className="wardrobe-item-action-button"
                                >
                                    <Trash2 size={16} />
                                </button>
                            )}

                            {!item.isOptimistic && showConfirm === item.id && (
                                <div
                                    role="alertdialog"
                                    aria-modal="false"
                                    aria-labelledby={`remove-title-${item.id}`}
                                    className="absolute inset-0 z-10 flex flex-col items-center justify-center border-2 border-black bg-white/95 p-3 text-center"
                                >
                                    <button
                                        type="button"
                                        aria-label="Cancel remove piece"
                                        onClick={() => {
                                            setShowConfirm(null);
                                            setActionError(null);
                                        }}
                                        className="absolute right-2 top-2 border-2 border-black bg-white p-1 text-[#310A31]"
                                    >
                                        <X size={14} />
                                    </button>
                                    <h4 id={`remove-title-${item.id}`} className="mb-2 text-sm font-black uppercase tracking-wide text-[#310A31]">
                                        Remove piece?
                                    </h4>
                                    <label htmlFor={`remove-reason-${item.id}`} className="sr-only">
                                        Reason for removing this piece
                                    </label>
                                    <select
                                        id={`remove-reason-${item.id}`}
                                        className="mb-3 w-full max-w-[260px] border-2 border-black bg-white p-2 text-xs font-semibold"
                                        value={reason}
                                        onChange={(e) => setReason(e.target.value)}
                                    >
                                        <option value="Disliked item style">Disliked style</option>
                                        <option value="Item damaged/lost">Damaged or lost</option>
                                        <option value="Poor fit">Poor fit</option>
                                        <option value="Other">Other</option>
                                    </select>
                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setShowConfirm(null);
                                                setActionError(null);
                                            }}
                                            className="border-2 border-black bg-white px-3 py-2 text-xs font-semibold uppercase"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => void handleDelete(item.id)}
                                            disabled={deletingId === item.id}
                                            className="border-2 border-black bg-[#310A31] px-3 py-2 text-xs font-black uppercase text-white shadow-[3px_3px_0_#000] disabled:opacity-50"
                                        >
                                            {deletingId === item.id ? "Removing..." : "Remove"}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {isPending && !isError && showConfirm !== itemId && (
                                <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-white/65 text-xs font-black uppercase tracking-[0.14em] text-[#310A31]">
                                    Processing
                                </div>
                            )}

                            {isError && showConfirm !== itemId && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white/90 p-4 text-center">
                                    <p className="text-xs font-black uppercase tracking-[0.14em] text-[#310A31]">Analysis needs another pass</p>
                                    <p className="max-w-xs text-xs font-semibold leading-relaxed text-[#4e1e51]">
                                        {errorMessage ?? "This item could not be analyzed. Try a clearer photo with the garment filling the frame."}
                                    </p>
                                    {item.isOptimistic && onRemoveOptimistic && (
                                        <button
                                            type="button"
                                            onClick={() => onRemoveOptimistic(item.tempId)}
                                            className="border-2 border-black bg-white px-3 py-2 text-xs font-black uppercase tracking-[0.08em] text-[#310A31]"
                                        >
                                            Dismiss failed photo
                                        </button>
                                    )}
                                    {!item.isOptimistic && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setShowConfirm(item.id);
                                                setActionError(null);
                                            }}
                                            className="border-2 border-black bg-white px-3 py-2 text-xs font-black uppercase tracking-[0.08em] text-[#310A31]"
                                        >
                                            Remove from rack
                                        </button>
                                    )}
                                </div>
                            )}
                        </article>
                    );
                })}
            </div>
        </section>
    );
}
