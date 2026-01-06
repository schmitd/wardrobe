import WardrobeGrid from '@/components/WardrobeGrid';
import { Effect } from 'effect';
import { runtime } from '@/lib/run-effect';
import { SupabaseService } from '@/services/SupabaseService';
import { AppLive } from '@/services';
import AddItemSection from '@/components/AddItemSection';
import { SignInButton, SignedOut } from '@clerk/nextjs';

export const dynamic = 'force-dynamic';

import { auth } from '@clerk/nextjs/server';

export default async function Home() {
    const { userId, getToken } = await auth();

    let items: any[] = [];

    if (userId) {
        const token = await getToken();
        if (token) {
            items = await runtime.runPromise(
                Effect.gen(function* () {
                    const supabaseService = yield* SupabaseService
                    const supabase = yield* supabaseService.getClient(token)
                    const { data, error } = yield* Effect.tryPromise({
                        try: () => supabase
                            .from('wardrobe_items')
                            .select('*')
                            .eq('user_id', userId)
                            .order('created_at', { ascending: false }),
                        catch: (e) => new Error("Supabase query failed: " + String(e))
                    })

                    if (error) {
                        yield* Effect.logError("Error fetching wardrobe items", { userId, error })
                        return []
                    }
                    return data || []
                }).pipe(
                    Effect.provide(AppLive)
                )
            )
        }
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
