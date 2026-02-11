import CompatibilityChecker from '@/components/CompatibilityChecker';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';


export default function CheckPage() {
    return (
        <main className="flex-1">
            <div className="mx-auto max-w-[1320px] px-4 py-8 lg:px-8">
                <div className="mx-auto mb-6 flex max-w-5xl justify-end">
                    <Link
                        href="/"
                        className="inline-flex items-center gap-2 border-2 border-black bg-white px-4 py-2 text-xs font-black uppercase tracking-wide text-[#310A31] shadow-[4px_4px_0_#000]"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        <span>Back to rack</span>
                    </Link>
                </div>
                <CompatibilityChecker />
            </div>
        </main>
    );
}
