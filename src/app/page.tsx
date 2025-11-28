import { supabase } from '@/lib/supabase';
import WardrobeGrid from '@/components/WardrobeGrid';
import AddItemSection from '@/components/AddItemSection';
import Link from 'next/link';
import { Shirt } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function Home() {
    const { data: items } = await supabase
        .from('wardrobe_items')
        .select('*')
        .order('created_at', { ascending: false });

    return (
        <main className="min-h-screen bg-gray-50">
            <nav className="bg-white border-b border-gray-200 sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Shirt className="h-6 w-6 text-indigo-600" />
                        <span className="font-bold text-xl tracking-tight text-gray-900">WardrobeAI</span>
                    </div>
                    <div className="flex gap-4">
                        <Link
                            href="/check"
                            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium text-sm"
                        >
                            Check Compatibility
                        </Link>
                    </div>
                </div>
            </nav>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <AddItemSection />
                <WardrobeGrid items={items || []} />
            </div>
        </main>
    );
}
