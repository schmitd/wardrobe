import { db } from "../db";
import { subscriptions } from "../db/schema";
import { withRLS } from "../db/rls";
import { eq } from "drizzle-orm";

export class SubscriptionService {
  static async getSubscription(userId: string) {
    // We use withRLS to enforce security
    return await withRLS(userId, async (tx) => {
        const result = await tx.select({
            id: subscriptions.id,
            userId: subscriptions.userId,
            status: subscriptions.status,
        })
        .from(subscriptions)
        .where(eq(subscriptions.userId, userId)); // Explicit check for performance + RLS for security

        return result[0] || null;
    });
  }

  static async isProUser(userId: string): Promise<boolean> {
    const subscription = await this.getSubscription(userId);
    // Logic: Active subscription = Pro
    return subscription?.status === "active";
  }
}
