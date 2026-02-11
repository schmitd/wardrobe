'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAuth, SignInButton, SignedOut } from '@clerk/nextjs';
import { useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import AddItemSection from '@/components/AddItemSection';
import WardrobeGrid from '@/components/WardrobeGrid';
import type { OptimisticWardrobeItem } from '@/types/wardrobe';

export default function Home() {
    const { isSignedIn } = useAuth();
    const items = useQuery(api.wardrobe.listWardrobeItems, isSignedIn ? {} : 'skip');
    const [optimisticItems, setOptimisticItems] = useState<OptimisticWardrobeItem[]>([]);

    const { filteredOptimisticItems, removedOptimisticItems } = useMemo(() => {
        if (!items) {
            return { filteredOptimisticItems: optimisticItems, removedOptimisticItems: [] };
        }
        const existingIds = new Set(items.map((item) => item.id));
        const removedOptimisticItems = optimisticItems.filter(
            (item) => item.serverId && existingIds.has(item.serverId)
        );
        const filteredOptimisticItems = optimisticItems.filter(
            (item) => !item.serverId || !existingIds.has(item.serverId)
        );
        return { filteredOptimisticItems, removedOptimisticItems };
    }, [items, optimisticItems]);

    useEffect(() => {
        for (const item of removedOptimisticItems) {
            URL.revokeObjectURL(item.imageUrl);
        }
    }, [removedOptimisticItems]);

    const handleOptimisticAdd = (newItems: OptimisticWardrobeItem[]) => {
        setOptimisticItems((prev) => [...newItems, ...prev]);
    };

    const handleOptimisticUpdate = (tempId: string, patch: Partial<OptimisticWardrobeItem>) => {
        setOptimisticItems((prev) =>
            prev.map((item) => (item.tempId === tempId ? { ...item, ...patch } : item))
        );
    };

    const displayItems = useMemo(() => items ?? [], [items]);

    return (
        <main className="flex-1 bg-gray-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {isSignedIn ? (
                    <>
                        <AddItemSection
                            onOptimisticAdd={handleOptimisticAdd}
                            onOptimisticUpdate={handleOptimisticUpdate}
                        />
                        <WardrobeGrid items={displayItems} optimisticItems={filteredOptimisticItems} />
                    </>
                ) : (
                    <div className="text-center py-20">
                        <h2 className="text-3xl font-bold text-gray-900 mb-4">Welcome to WardrobeAI</h2>
                        <p className="text-xl text-gray-600 mb-8">Sign in to manage your digital wardrobe and get styling advice.</p>
                        <SignedOut>
                            <SignInButton mode="modal">
                                <button className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium text-lg">
                                    Get Started
                                </button>
                            </SignInButton>
                        </SignedOut>
                    </div>
                )}
            </div>
        </main>
    );
}
