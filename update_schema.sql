-- 1. Add membership columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_member BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS member_activated_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS parent_ref_code TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS total_earned_gas NUMERIC DEFAULT 0;

-- 2. Create gas_transactions table if not exists
CREATE TABLE IF NOT EXISTS gas_transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    amount NUMERIC,
    balance_after NUMERIC,
    transaction_type TEXT,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create referrals table if not exists
CREATE TABLE IF NOT EXISTS referrals (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    referrer_id UUID REFERENCES users(id),
    referred_id UUID REFERENCES users(id),
    ref_code TEXT,
    gas_reward NUMERIC DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(referred_id)
);

-- 4. Enable RLS (Optional, but good practice)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE gas_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;

-- 5. Create policies (Simplified for demo)
CREATE POLICY "Public read users" ON users FOR SELECT USING (true);
CREATE POLICY "Public update users" ON users FOR UPDATE USING (true);
CREATE POLICY "Public insert users" ON users FOR INSERT WITH CHECK (true);

CREATE POLICY "Public read transactions" ON gas_transactions FOR SELECT USING (true);
CREATE POLICY "Public insert transactions" ON gas_transactions FOR INSERT WITH CHECK (true);

CREATE POLICY "Public read referrals" ON referrals FOR SELECT USING (true);
CREATE POLICY "Public insert referrals" ON referrals FOR INSERT WITH CHECK (true);

-- 6. Create RPC function for incrementing total earned gas
CREATE OR REPLACE FUNCTION increment_total_earned_gas(user_uuid UUID, amount_to_add NUMERIC)
RETURNS VOID AS $$
BEGIN
  UPDATE users
  SET total_earned_gas = COALESCE(total_earned_gas, 0) + amount_to_add
  WHERE id = user_uuid;
END;
$$ LANGUAGE plpgsql;

