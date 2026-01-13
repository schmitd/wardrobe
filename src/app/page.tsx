import WardrobeGrid from '@/components/WardrobeGrid';
import { Effect } from 'effect';
import { runtime } from '@/lib/run-effect';
import { DatabaseService } from '@/services/DatabaseService';
import { SupabaseService } from '@/services/SupabaseService';
import { AppLive } from '@/services';
import AddItemSection from '@/components/AddItemSection';
import { SignInButton, SignedOut } from '@clerk/nextjs';
import { auth } from '@clerk/nextjs/server';

export const dynamic = 'force-dynamic';

export default async function Home() {
    const { userId } = await auth();

    let items: any[] = [];

    if (userId) {
        items = await runtime.runPromise(
            Effect.gen(function* () {
                const databaseService = yield* DatabaseService
                const supabaseService = yield* SupabaseService

                const dbItems = yield* databaseService.getWardrobeItems(userId)

                // Sign URLs for display
                const signedItems = yield* Effect.all(
                    dbItems.map(item =>
                        Effect.gen(function* () {
                            // If imageUrl is already a full URL (e.g. external), leave it. 
                            // But we assume it's a path "users/..."
                            const signedUrl = yield* supabaseService.createSignedUrl(item.imageUrl, 3600)
                            return { ...item, imageUrl: signedUrl }
                        }).pipe(
                            // If signing fails, return null so we can filter it out
                            Effect.catchAll(e => Effect.succeed(null))
                        )
                    ),
                    { concurrency: 5 }
                )

                return signedItems.filter((item): item is NonNullable<typeof item> => item !== null)
            }).pipe(
                Effect.catchAll(error => Effect.gen(function* () {
                    yield* Effect.logError("Error fetching wardrobe items", { userId, error })
                    return []
                })),
                Effect.provide(AppLive)
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
