-- Multi-level Referral System Schema

-- 1. Referral Config Table
CREATE TABLE IF NOT EXISTS referral_config (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    min_order_amount DECIMAL(10, 2) DEFAULT 10.00,
    level1_reward INT DEFAULT 90,
    level2_reward INT DEFAULT 30,
    level3_reward INT DEFAULT 10,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default config if not exists
INSERT INTO referral_config (min_order_amount, level1_reward, level2_reward, level3_reward)
SELECT 10.00, 90, 30, 10
WHERE NOT EXISTS (SELECT 1 FROM referral_config);

-- 2. Distribute Referral Rewards RPC
CREATE OR REPLACE FUNCTION distribute_referral_rewards(
    p_order_id TEXT,
    p_user_id UUID,
    p_order_amount DECIMAL
)
RETURNS TABLE (
    level INT,
    recipient_ref_code TEXT,
    reward_amount INT
) AS $$
DECLARE
    v_referrer_id UUID;
    v_current_user_id UUID := p_user_id;
    v_reward INT;
    v_config RECORD;
    v_ref_code TEXT;
    v_level INT := 1;
BEGIN
    -- Get config
    SELECT * INTO v_config FROM referral_config LIMIT 1;
    
    -- Check min order amount
    IF p_order_amount < v_config.min_order_amount THEN
        RETURN;
    END IF;

    -- Loop through 3 levels
    WHILE v_level <= 3 LOOP
        -- Find referrer
        SELECT referrer_id, ref_code INTO v_referrer_id, v_ref_code
        FROM referrals
        WHERE referred_id = v_current_user_id
        ORDER BY created_at DESC -- In case of multiple (shouldn't happen usually)
        LIMIT 1;

        -- If no referrer, break
        IF v_referrer_id IS NULL THEN
            EXIT;
        END IF;

        -- Determine reward based on level
        IF v_level = 1 THEN v_reward := v_config.level1_reward;
        ELSIF v_level = 2 THEN v_reward := v_config.level2_reward;
        ELSIF v_level = 3 THEN v_reward := v_config.level3_reward;
        END IF;

        -- Credit GAS to referrer
        UPDATE users 
        SET gas_balance = COALESCE(gas_balance, 0) + v_reward
        WHERE id = v_referrer_id;

        -- Record transaction
        INSERT INTO gas_transactions (
            user_id, 
            amount, 
            balance_after, 
            transaction_type, 
            description, 
            referral_level,
            source_order_id
        )
        SELECT 
            v_referrer_id,
            v_reward,
            gas_balance,
            'referral_reward',
            'Referral Reward L' || v_level || ' from order ' || p_order_id,
            v_level,
            p_order_id
        FROM users WHERE id = v_referrer_id;

        -- Add to result
        level := v_level;
        recipient_ref_code := (SELECT u.ref_code FROM users u WHERE u.id = v_referrer_id);
        reward_amount := v_reward;
        RETURN NEXT;

        -- Prepare for next iteration
        v_current_user_id := v_referrer_id;
        v_level := v_level + 1;
    END LOOP;
END;
$$ LANGUAGE plpgsql;
