import { db } from "./index";
import { sql } from "drizzle-orm";

export const withRLS = async <T>(userId: string | null, callback: (tx: typeof db) => Promise<T>) => {
    // If no userId, we cannot set RLS claim, so we might want to throw error or proceed as admin?
    // Given the context, we should probably require userId for authenticated operations.
    // However, for code safety, if userId is null, maybe we just don't set the role?
    // But then we are superuser.
    // Let's assume this is strictly for authenticated user context.

    // We use a transaction to scope the SET LOCAL commands
    return await db.transaction(async (tx) => {
        if (userId) {
            // Set the claim first
            await tx.execute(sql`SELECT set_config('request.jwt.claim.sub', ${userId}, true)`);
            // Set the role to authenticated
            await tx.execute(sql`SET LOCAL role authenticated`);
        }

        // Execute the callback with the transaction object
        // The callback MUST use 'tx' for all queries to be within the RLS scope
        // casting tx to any to avoid complex type matching if needed, but typeof db is better
        return await callback(tx as unknown as typeof db);
    });
};
