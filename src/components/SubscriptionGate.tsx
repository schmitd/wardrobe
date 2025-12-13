'use client';

import { useSubscription } from '../hooks/useSubscription';


export default function SubscriptionGate({ children }: { children: React.ReactNode }) {
    const { isSubscribed, loading } = useSubscription();

    if (loading) return <div className="p-8 text-center text-gray-500">Checking subscription...</div>;

    if (!isSubscribed) {
        return (
            <div className="flex flex-col items-center justify-center p-12 bg-white rounded-2xl shadow-sm border border-orange-100 max-w-2xl mx-auto mt-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">Premium Feature</h2>
                <p className="text-gray-600 mb-8 text-center max-w-md">
                    The Compatibility Checker is a premium feature. Please upgrade to access AI styling advice.
                </p>
                <a
                    href="/pricing"
                    className="mt-4 px-6 py-3 bg-orange-600 text-white font-semibold rounded-lg hover:bg-orange-700 transition-colors"
                >
                    View Plans
                </a>
            </div>
        );
    }

    return <>{children}</>;
}
