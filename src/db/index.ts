import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { sql, ExtractTablesWithRelations } from 'drizzle-orm';
import { PgTransaction } from 'drizzle-orm/pg-core';
import { PostgresJsQueryResultHKT } from 'drizzle-orm/postgres-js';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL;

// Disable prefetch as it is not supported for "Transaction" pool mode
const client = postgres(connectionString!, { prepare: false });
export const db = drizzle(client, { schema });

// Helper to run queries with RLS context
// This simulates the Supabase authenticated environment by setting the request.jwt.claim.sub config
// and switching to the authenticated role for the duration of the transaction.
export const withRLS = async <T>(
  userId: string,
  callback: (tx: PgTransaction<PostgresJsQueryResultHKT, typeof schema, ExtractTablesWithRelations<typeof schema>>) => Promise<T>
): Promise<T> => {
  return await db.transaction(async (tx) => {
    try {
      // Set the user ID in the session config (local to transaction)
      await tx.execute(sql`SELECT set_config('request.jwt.claim.sub', ${userId}, true)`);
      // Switch to the authenticated role (local to transaction)
      await tx.execute(sql`SET LOCAL ROLE authenticated`);

      // Execute the callback with the RLS-enabled transaction
      return await callback(tx);
    } catch (e) {
      throw e;
    }
  });
};
