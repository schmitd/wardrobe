import WardrobeGrid from '@/components/WardrobeGrid';
import { Effect } from 'effect';
import { runtime } from '@/lib/run-effect';
import { DatabaseService } from '@/services/DatabaseService';
import { SupabaseService } from '@/services/SupabaseService';
import { AppLive } from '@/services';
import AddItemSection from '@/components/AddItemSection';
import { SignInButton, SignedOut } from '@clerk/nextjs';

export const dynamic = 'force-dynamic';

import { auth } from '@clerk/nextjs/server';

export default async function Home() {
    const { userId } = await auth();

    let items: any[] = [];

    if (userId) {
        items = await runtime.runPromise(
            Effect.gen(function* () {
                const dbService = yield* DatabaseService
                const supabase = yield* SupabaseService
                const rawItems = yield* dbService.getWardrobeItems(userId)

                const items = yield* Effect.all(
                    rawItems.map(item => Effect.gen(function* () {
                        if (item.image_url && !item.image_url.startsWith('http')) {
                            // It's a storage path, sign it
                            const signedUrl = yield* supabase.createSignedUrl(item.image_url, 3600) // 1 hour expiry
                            return { ...item, image_url: signedUrl }
                        }
                        return item
                    })),
                    { concurrency: 10 }
                )

                return items
            }).pipe(
                Effect.provide(AppLive),
                Effect.catchAll(error => Effect.gen(function* () {
                    yield* Effect.logError("Error fetching wardrobe items", { userId, error })
                    return []
                }))
            )
        )
    }

    return (
        <main className="flex-1 bg-gray-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {userId ? (
                    <>
                        <AddItemSection />
                        <WardrobeGrid items={items || []} />
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
