'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Shirt } from 'lucide-react';
import { SignInButton, SignedIn, SignedOut, UserButton } from '@clerk/nextjs';
import { useSubscription } from '../hooks/useSubscription';



export default function Navbar() {
    const pathname = usePathname();
    const isCheckPage = pathname === '/check';
    const { isSubscribed } = useSubscription();

    return (
        <nav className="bg-white border-b border-gray-200 sticky top-0 z-10 w-full">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                        <Shirt className="h-6 w-6 text-indigo-600" />
                        <span className="font-bold text-xl tracking-tight text-gray-900">WardrobeAI</span>
                    </Link>
                </div>
                <div className="flex items-center gap-4">
                    {!isCheckPage && (
                        <Link
                            href="/check"
                            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium text-sm shadow-sm"
                        >
                            Check Compatibility
                        </Link>
                    )}

                    {!isSubscribed && (
                        <Link
                            href="/pricing"
                            className="px-4 py-2 text-orange-600 font-medium text-sm hover:bg-orange-50 rounded-lg transition-colors border border-orange-200"
                        >
                            Upgrade
                        </Link>
                    )}

                    <div className="flex items-center">
                        <SignedOut>
                            <SignInButton mode="modal">
                                <button className="px-4 py-2 text-indigo-600 font-medium text-sm hover:bg-slate-100 rounded-lg transition-colors">
                                    Sign In
                                </button>
                            </SignInButton>
                        </SignedOut>
                        <SignedIn>
                            <UserButton afterSignOutUrl="/" />
                        </SignedIn>
                    </div>
                </div>
            </div>
        </nav>
    );
}
