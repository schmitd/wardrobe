import { subscriptions } from "../db/schema";
import { withRLS } from "../db";
import { eq } from "drizzle-orm";

export class SubscriptionService {
  /**
   * Gets the subscription for the given user using RLS.
   * This ensures we only fetch the subscription if the user is authorized to see it.
   */
  static async getSubscription(userId: string) {
    return await withRLS(userId, async (tx) => {
       // RLS policy `view_own_subscription` ensures we only see rows where user_id matches
       const result = await tx.select()
        .from(subscriptions)
        .limit(1);

       return result[0] || null;
    });
  }

  static async isProUser(userId: string): Promise<boolean> {
    try {
        const subscription = await this.getSubscription(userId);
        // Logic: Active subscription = Pro
        return subscription?.status === "active";
    } catch (error) {
        console.error("Error checking pro status:", error);
        return false;
    }
  }
}
