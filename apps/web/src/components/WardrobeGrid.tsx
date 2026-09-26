"use client";

import type { OptimisticWardrobeItem, WardrobeItem } from "@/types/wardrobe";
import { userFacingErrorMessage } from "@/lib/userFacingError";
import { Button } from "@/components/ui/button";
import RackItemCard from "./RackItemCard";

export interface WardrobeGridProps {
    items: WardrobeItem[];
    collectionLabel?: string;
    onOpenItem?: (item: WardrobeItem) => void;
    optimisticItems?: OptimisticWardrobeItem[];
    onAddPiece?: () => void;
    onRemoveOptimistic?: (tempId: string) => void;
}

type RenderItem = (WardrobeItem & { isOptimistic: false }) | (OptimisticWardrobeItem & { isOptimistic: true });

export default function WardrobeGrid({
    items,
    collectionLabel,
    onOpenItem,
    optimisticItems = [],
    onAddPiece,
    onRemoveOptimistic,
}: WardrobeGridProps) {
    const mergedItems: RenderItem[] = [
        ...optimisticItems.map((item) => ({ ...item, isOptimistic: true as const })),
        ...items.map((item) => ({ ...item, isOptimistic: false as const })),
    ];

    if (mergedItems.length === 0) {
        return (
            <section className="rack-empty-state" aria-labelledby="empty-rack-title">
                <p className="text-sm font-semibold text-[#56345c]">Closet rack</p>
                <h3 id="empty-rack-title" className="mt-2 text-2xl font-extrabold text-[#241426]">
                    Start with a few clear pieces
                </h3>
                <p className="mt-3 max-w-xl text-sm font-medium leading-relaxed text-[#56345c]">
                    Start with one clear piece or a full fit. I&apos;ll recognize the photo type, connect familiar pieces, and place only owned items on your rack.
                </p>
                {onAddPiece && (
                    <Button
                        type="button"
                        onClick={onAddPiece}
                        className="mt-5 h-auto rounded-none border border-[var(--rack-line)] bg-[#DCE66E] px-4 py-3 text-sm font-extrabold text-[#241426] shadow-[3px_3px_0_var(--rack-panel-shadow)]"
                    >
                        Add a photo
                    </Button>
                )}
            </section>
        );
    }

    return (
        <section className="space-y-4" aria-label="Closet rack">
            <div className="collection-piece-grid grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-4">
                {mergedItems.map((item) => {
                    const itemId = item.isOptimistic ? item.tempId : item.id;
                    const isPending = item.isOptimistic ? item.status !== "error" : !["ready", "error"].includes(item.analysisStatus);
                    const isError = item.isOptimistic ? item.status === "error" : item.analysisStatus === "error";
                    const errorMessage = userFacingErrorMessage(
                        item.isOptimistic ? item.error : item.analysisError,
                        "Analysis failed"
                    );

                    return (
                        <article
                            data-private
                            key={itemId}
                            data-wardrobe-item-id={itemId}
                            role="group"
                            aria-label={item.category ?? "Wardrobe item"}
                            className="ph-no-capture group relative outline-none focus-visible:ring-2 focus-visible:ring-[var(--rack-line)] focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                        >
                            <button type="button" className="block w-full rounded-lg text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#735079]" data-piece-open={itemId}
                                aria-label={`Open ${item.category ?? "piece"} details`} disabled={item.isOptimistic} onClick={() => { if (!item.isOptimistic) onOpenItem?.(item); }}>
                            <RackItemCard
                                compact
                                hasNote={!item.isOptimistic && Boolean(item.note)}
                                collectionLabel={collectionLabel}
                                imageUrl={item.imageUrl}
                                category={item.category ?? null}
                                description={item.description ?? null}
                                styleTags={item.styleTags ?? null}
                                badgeLabel={isPending ? "Processing" : isError ? "Needs review" : undefined}
                            />
                            </button>

                            {isError && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white/90 p-4 text-center">
                                    <p className="text-sm font-extrabold text-[#241426]">Analysis needs another pass</p>
                                    <p className="max-w-xs text-xs font-semibold leading-relaxed text-[#56345c]">
                                        {errorMessage ?? "This item could not be analyzed. Try a clearer photo with the garment filling the frame."}
                                    </p>
                                    {item.isOptimistic && onRemoveOptimistic && (
                                        <button
                                            type="button"
                                            onClick={() => onRemoveOptimistic(item.tempId)}
                                            className="border border-[var(--rack-line)] bg-white px-3 py-2 text-xs font-black uppercase tracking-[0.08em] text-[#241426]"
                                        >
                                            Dismiss failed photo
                                        </button>
                                    )}
                                    {!item.isOptimistic && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                onOpenItem?.(item);
                                            }}
                                            className="border border-[var(--rack-line)] bg-white px-3 py-2 text-xs font-black uppercase tracking-[0.08em] text-[#241426]"
                                        >
                                            View details
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
