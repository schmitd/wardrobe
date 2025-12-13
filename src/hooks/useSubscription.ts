'use client';

import { useAuth } from '@clerk/nextjs';

export function useSubscription() {
    const { isLoaded, has, userId } = useAuth();

    // Check if the user has the 'compatibility_check' permission
    // This permission must be configured in the Clerk Dashboard under the Plan
    const isSubscribed = has ? has({ permission: 'compatibility_check' }) : false;

    return {
        isSubscribed: !!isSubscribed,
        status: isSubscribed ? 'active' : 'none',
        loading: !isLoaded
    };
}
