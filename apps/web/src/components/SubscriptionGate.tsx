'use client';

import { useSubscription } from '../hooks/useSubscription';


export default function SubscriptionGate({ children }: { children: React.ReactNode }) {
    const { isSubscribed, loading } = useSubscription();

    if (loading) return <div className="p-8 text-center text-gray-500">Checking subscription...</div>;

    if (!isSubscribed) {
        return (
            <div className="rack-panel rack-panel--shell mx-auto mt-8 flex max-w-2xl flex-col items-center justify-center p-12">
                <h2 className="mb-4 text-2xl font-black uppercase tracking-tight text-[#241426]">Premium Feature</h2>
                <p className="mb-8 max-w-md text-center text-sm font-medium text-slate-700">
                    Compatibility checks are available on paid plans. Upgrade to continue and unlock full personalization.
                </p>
                <a
                    href="/pricing"
                    className="mt-4 border-2 border-black bg-[#DCE66E] px-6 py-3 text-xs font-black uppercase tracking-[0.14em] text-[#241426] shadow-[4px_4px_0_rgb(0_0_0_/_0.18)]"
                >
                    View Plans
                </a>
            </div>
        );
    }

    return <>{children}</>;
}
