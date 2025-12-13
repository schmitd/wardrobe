-- Helper function to get the current user ID from the JWT (Clerk sends ID as 'sub')
CREATE OR REPLACE FUNCTION requesting_user_id()
RETURNS TEXT AS $$
  SELECT nullif(current_setting('request.jwt.claims', true)::json ->> 'sub', '')::text;
$$ LANGUAGE sql STABLE;

-- Stripe customer binding (maps Clerk userId to Stripe customerId)
CREATE TABLE IF NOT EXISTS stripe_customers (
  user_id TEXT PRIMARY KEY,
  stripe_customer_id TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Subscription state (synced from Stripe)
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT UNIQUE NOT NULL REFERENCES stripe_customers(user_id),
  stripe_subscription_id TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'none', -- 'active', 'canceled', 'past_due', 'none'
  price_id TEXT,
  current_period_start BIGINT,
  current_period_end BIGINT,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS policies
ALTER TABLE stripe_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- Drop policies if they exist to allow re-running
DROP POLICY IF EXISTS "Users can view own data" ON stripe_customers;
DROP POLICY IF EXISTS "Users can view own subscription" ON subscriptions;

CREATE POLICY "Users can view own data" ON stripe_customers
  FOR SELECT USING (user_id = requesting_user_id());
  
CREATE POLICY "Users can view own subscription" ON subscriptions
  FOR SELECT USING (user_id = requesting_user_id());
