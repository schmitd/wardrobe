'use client';

import { PricingTable } from '@clerk/nextjs';

export default function PricingPage() {
    return (
        <div className="min-h-screen px-4 py-12 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
                <h1 className="text-4xl font-extrabold text-[#241426] sm:text-5xl lg:text-6xl">
                    Upgrade your closet companion
                </h1>
                <p className="mx-auto mt-5 max-w-xl text-base font-medium text-slate-700 sm:text-lg">
                    Unlock unlimited compatibility checks, saved Style notes, and deeper personalization.
                </p>
            </div>

            <div className="rack-panel rack-panel--shell mx-auto w-full max-w-4xl p-2">
                <PricingTable />
            </div>
        </div>
    );
}
