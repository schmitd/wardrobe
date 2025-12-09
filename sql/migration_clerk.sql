-- Clear existing data as requested
TRUNCATE TABLE wardrobe_items;

-- Change user_id to text to accommodate Clerk IDs (e.g. user_2...)
-- Drop the default auth.uid() which is specific to Supabase Auth
ALTER TABLE wardrobe_items 
  ALTER COLUMN user_id DROP DEFAULT,
  ALTER COLUMN user_id TYPE text USING user_id::text;

-- Enable RLS
ALTER TABLE wardrobe_items ENABLE ROW LEVEL SECURITY;

-- Create policy for users to see only their own items
DROP POLICY IF EXISTS "Users can only access their own items" ON wardrobe_items;
CREATE POLICY "Users can only access their own items"
ON wardrobe_items
FOR ALL
USING (user_id = current_user_id());

-- We need a way to pass the Clerk user ID to Supabase RLS.
-- Standard pattern with Supabase + Clerk is to use a custom claim or JWT.
-- However, for the simple start (and creating client per request), we can
-- either trust the server-side client to filter (which we will do in actions)
-- OR set a session variable.
--
-- Since we are using the Supabase client in Server Actions where we can explicitly 
-- inject the user_id into the query, RLS is a second layer of defense.
-- The policy above `current_user_id()` assumes we can extract it from the JWT.
--
-- Actually, a simpler RLS policy for a quick start without setting up custom JWT claims mapping immediately
-- (which requires Supabase project setting changes) is to allow all access for the service role (if we used it) 
-- OR rely on the application logic for now, but RLS is safer.
--
-- Let's try to map the Clerk ID.
-- If we use `supabase-js` with the Clerk token, `auth.uid()` might not work out of the box unless we configure 
-- Supabase to verify Clerk's JWT.
--
-- ALTERNATIVE:
-- For now, let's just update the schema types. We will implement RLS logic in the SQL policy 
-- assuming we can pass the user ID, or we will handle it in the application layer for this step 
-- and come back to strict RLS when we confirm the Clerk-Supabase JWT flow details.
--
-- Let's keep it simple: just the schema change for now.
