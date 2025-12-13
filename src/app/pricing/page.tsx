'use client';

import { PricingTable } from '@clerk/nextjs';

export default function PricingPage() {
    return (
        <div className="min-h-screen bg-orange-50 py-12 px-4 sm:px-6 lg:px-8 flex flex-col items-center">
            <div className="text-center mb-12">
                <h1 className="text-4xl font-extrabold text-gray-900 sm:text-5xl sm:tracking-tight lg:text-6xl">
                    Upgrade your Wardrobe
                </h1>
                <p className="mt-5 max-w-xl mx-auto text-xl text-gray-500">
                    Get unlimited AI styling advice and compatibility checks.
                </p>
            </div>

            <div className="w-full max-w-4xl">
                <PricingTable />
            </div>
        </div>
    );
}
