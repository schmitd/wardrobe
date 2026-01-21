import { createClient } from "@supabase/supabase-js";

// Helper to get a supabase client with the service role key for admin tasks
// CAUTION: Only use this on the server side
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export class SubscriptionService {
  static async getSubscription(userId: string) {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.warn("SUPABASE_SERVICE_ROLE_KEY missing, treating as free tier");
      return null;
    }

    const { data, error } = await supabaseAdmin
      .from("subscriptions")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (error) {
      // It's expected to not find a subscription for free users
      if (error.code !== "PGRST116") {
        console.error("Error fetching subscription:", error);
      }
      return null;
    }
    return data;
  }

  static async isProUser(userId: string): Promise<boolean> {
    const subscription = await this.getSubscription(userId);
    // Logic: Active subscription = Pro
    return subscription?.status === "active";
  }
}
