import { createClient } from "@supabase/supabase-js";
import { ZepService } from "../services/ZepService";

// Script to sync all existing wardrobe items to Zep
// Run with: bun run src/scripts/sync-to-zep.ts

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;
const ZEP_KEY = process.env.ZEP_KEY;

if (!SUPABASE_URL || !SUPABASE_SECRET_KEY || !ZEP_KEY) {
  console.error("Missing environment variables: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY, ZEP_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY);

async function sync() {
  console.log("Starting sync to Zep...");

  // Get all unique user IDs from wardrobe_items
  // Note: This is not efficient for millions of users, but okay for this scale
  const { data: users, error: userError } = await supabase
    .from("wardrobe_items")
    .select("user_id")

    // .distinct() is not directly supported in JS client select() easily without modifiers,
    // but we can just fetch all and dedup in JS for now or use RPC if needed.
    // Actually, let's just paginate through items.

  if (userError) {
      console.error("Error fetching users", userError);
      return;
  }

  // Deduplicate users
  const uniqueUsers = Array.from(new Set(users.map(u => u.user_id)));
  console.log(`Found ${uniqueUsers.length} users with items.`);

  for (const userId of uniqueUsers) {
      console.log(`Syncing user ${userId}...`);
      await ZepService.createUser(userId); // Ensure user exists

      const { data: items, error: itemsError } = await supabase
          .from("wardrobe_items")
          .select("category, description, style_tags")
          .eq("user_id", userId);

      if (itemsError) {
          console.error(`Error fetching items for user ${userId}:`, itemsError);
          continue;
      }

      if (items && items.length > 0) {
          // We can batch them all into one "Initial Sync" memory
          await ZepService.addWardrobeItems(userId, items as any);
          console.log(`Synced ${items.length} items for user ${userId}`);
      }
  }

  console.log("Sync complete.");
}

sync().catch(console.error);
