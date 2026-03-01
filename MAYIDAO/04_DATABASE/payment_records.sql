-- 支付记录表（防重放 + 审计）
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

-- 索引加速查询
CREATE INDEX IF NOT EXISTS idx_payment_txid ON payment_records(txid);
CREATE INDEX IF NOT EXISTS idx_payment_user ON payment_records(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_status ON payment_records(status, verified_at);

-- 视图：用户充值统计
CREATE OR REPLACE VIEW v_user_payment_summary AS
SELECT
  u.ref_code,
  u.telegram_id,
  COUNT(pr.id) AS total_payments,
  SUM(pr.amount_usdt) AS total_usdt,
  SUM(pr.gas_credited) AS total_gas,
  MAX(pr.verified_at) AS last_payment
FROM users u
LEFT JOIN payment_records pr ON u.id = pr.user_id AND pr.status = 'completed'
GROUP BY u.id;
