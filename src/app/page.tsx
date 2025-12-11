import { supabase, createAuthenticatedClient } from '@/lib/supabase';
import WardrobeGrid from '@/components/WardrobeGrid';
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
            const supabase = createAuthenticatedClient(token);
            const { data, error } = await supabase
                .from('wardrobe_items')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false });

            if (error) {
                console.error("Error fetching wardrobe items:", error);
            }
            items = data || [];
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
