import CompatibilityChecker from '@/components/CompatibilityChecker';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';


export default function CheckPage() {
    return (
        <main className="flex-1 bg-gray-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="max-w-4xl mx-auto mb-6 flex justify-end">
                    <Link
                        href="/"
                        className="inline-flex items-center gap-2 text-gray-600 hover:text-indigo-600 bg-white px-4 py-2 rounded-lg border border-gray-200 shadow-sm hover:shadow transition-all duration-200"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        <span className="font-medium">Back to Wardrobe</span>
                    </Link>
                </div>
                <CompatibilityChecker />
            </div>
        </main>
    );
}
