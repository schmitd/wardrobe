import CompatibilityChecker from '@/components/CompatibilityChecker';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function CheckPage() {
    return (
        <main className="min-h-screen bg-gray-50">
            <nav className="bg-white border-b border-gray-200 sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center">
                    <Link href="/" className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors">
                        <ArrowLeft className="h-5 w-5" />
                        <span className="font-medium">Back to Wardrobe</span>
                    </Link>
                </div>
            </nav>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <CompatibilityChecker />
            </div>
        </main>
    );
}
