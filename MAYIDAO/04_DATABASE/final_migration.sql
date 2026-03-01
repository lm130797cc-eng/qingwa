-- =====================================================
-- 蚂蚁岛 (MAYIDAO) 最终上线迁移脚本
-- 包含：用户表修正 + 支付记录表 + 统计视图
-- =====================================================

-- 1️⃣ 修正 Users 表（添加 Telegram ID 绑定）
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS telegram_id BIGINT UNIQUE;

-- 为 Telegram ID 添加索引（加速查询）
CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON users(telegram_id);

-- 2️⃣ 创建支付记录表（防重放 + 审计）
CREATE TABLE IF NOT EXISTS payment_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  txid TEXT UNIQUE NOT NULL,
  user_id UUID REFERENCES users(id),
  order_id UUID REFERENCES orders(id),
  amount_usdt NUMERIC(10,2),
  gas_credited INTEGER,
  status TEXT DEFAULT 'pending', -- pending/verified/completed/failed
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 支付表索引
CREATE INDEX IF NOT EXISTS idx_payment_txid ON payment_records(txid);
CREATE INDEX IF NOT EXISTS idx_payment_user ON payment_records(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_status ON payment_records(status, verified_at);

-- 3️⃣ 创建用户充值统计视图
CREATE OR REPLACE VIEW v_user_payment_summary AS
SELECT
  u.id AS user_id,
  u.ref_code,
  u.telegram_id,
  COUNT(pr.id) AS total_payments,
  SUM(pr.amount_usdt) AS total_usdt,
  SUM(pr.gas_credited) AS total_gas,
  MAX(pr.verified_at) AS last_payment
FROM users u
LEFT JOIN payment_records pr ON u.id = pr.user_id AND pr.status = 'completed'
GROUP BY u.id;
