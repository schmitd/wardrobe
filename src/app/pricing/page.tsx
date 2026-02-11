'use client';

import { PricingTable } from '@clerk/nextjs';

export default function PricingPage() {
    return (
        <div className="min-h-screen px-4 py-12 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
                <h1 className="text-4xl font-black uppercase tracking-tight text-[#310A31] sm:text-5xl lg:text-6xl">
                    Upgrade your closet companion
                </h1>
                <p className="mx-auto mt-5 max-w-xl text-base font-medium text-slate-700 sm:text-lg">
                    Unlock unlimited compatibility checks, saved profiles, and deeper personalization.
                </p>
            </div>

            <div className="mx-auto w-full max-w-4xl border-4 border-black bg-white p-2 shadow-[8px_8px_0_#000]">
                <PricingTable />
            </div>
        </div>
    );
}
