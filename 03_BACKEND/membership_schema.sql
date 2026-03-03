-- 🐸 青蛙机器人会员系统数据库迁移脚本
-- 运行环境: Supabase SQL Editor

-- 1. 扩展 users 表 (如果表已存在，请使用 ALTER TABLE; 这里为了完整性展示 CREATE OR REPLACE 逻辑的意图，实际需根据现状调整)
-- 假设 users 表已存在，我们添加缺失字段
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(20) UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS parent_ref_code VARCHAR(20);
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_member BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS member_activated_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS total_referrals INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS total_earned_gas INTEGER DEFAULT 0;

-- 2. 创建推荐关系表
CREATE TABLE IF NOT EXISTS referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID REFERENCES users(id), -- 推荐人
  referred_id UUID REFERENCES users(id), -- 被推荐人
  ref_code VARCHAR(20), -- 使用的推荐码
  gas_reward INTEGER DEFAULT 30, -- 奖励积分
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(referred_id) -- 每个用户只能被推荐一次
);

-- 3. 创建积分流水表
CREATE TABLE IF NOT EXISTS gas_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  amount INTEGER, -- +30 (奖励) 或 -88 (开通会员)
  balance_after INTEGER, -- 交易后余额
  transaction_type TEXT, -- 'referral_reward' | 'activate_member' | 'purchase' | 'admin_adjustment'
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. 创建会员开通申请表
CREATE TABLE IF NOT EXISTS membership_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  phone VARCHAR(20),
  payment_proof TEXT, -- 支付凭证
  payment_method TEXT, -- 'cash' | 'wechat_transfer' | 'paypal' | 'gas'
  amount_paid DECIMAL(10,2), -- 支付金额
  amount_gas INTEGER, -- 支付积分 (如果是积分兑换)
  status TEXT DEFAULT 'pending', -- 'pending' | 'approved' | 'rejected'
  admin_notes TEXT,
  approved_by UUID, -- 管理员ID
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. 创建佣金记录表 (用于"子用户消费，推广者收现金")
CREATE TABLE IF NOT EXISTS commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID REFERENCES users(id),
  source_user_id UUID REFERENCES users(id),
  order_id TEXT, -- 关联的 Shopify 订单号
  amount DECIMAL(10,2), -- 佣金金额
  currency TEXT DEFAULT 'USD',
  status TEXT DEFAULT 'pending', -- 'pending' | 'paid'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. 索引优化
CREATE INDEX IF NOT EXISTS idx_users_ref_code ON users(ref_code);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer_id ON referrals(referrer_id);

-- 7. 触发器：自动更新总推荐数 (可选)
CREATE OR REPLACE FUNCTION update_referral_stats()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE users 
  SET total_referrals = total_referrals + 1 
  WHERE id = NEW.referrer_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_referral_stats ON referrals;
CREATE TRIGGER trg_update_referral_stats
AFTER INSERT ON referrals
FOR EACH ROW
EXECUTE FUNCTION update_referral_stats();
