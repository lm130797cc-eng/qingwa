-- =====================================================
-- 蚂蚁岛 (MAYIDAO) 数据库 Schema
-- 隔离策略：使用 ants_mayidao schema 与现有项目隔离
-- 兼容：Supabase PostgreSQL 14+ / 免费层
-- 版本：v2.0 (Phase 2 Automation Ready)
-- =====================================================

-- 1️⃣ 创建专属 Schema（如果不存在）
CREATE SCHEMA IF NOT EXISTS ants_mayidao;

-- 设置当前会话默认搜索路径（开发辅助，生产环境建议显式指定schema）
SET search_path TO ants_mayidao, public;

-- =====================================================
-- 2️⃣ 核心业务表
-- =====================================================

-- 👤 用户表（推荐关系 + GAS积分）
CREATE TABLE IF NOT EXISTS ants_mayidao.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- 推荐系统
  ref_code VARCHAR(20) UNIQUE NOT NULL,        -- 个人推荐码，如 ANT7F3A9B2C
  ref_from VARCHAR(20),                         -- 推荐人代码（可为空）
  
  -- 积分系统
  gas_balance INTEGER DEFAULT 30,               -- 注册送30 GAS
  total_earned INTEGER DEFAULT 0,               -- 累计赚取积分
  total_spent INTEGER DEFAULT 0,                -- 累计消费积分
  
  -- 基础信息（脱敏设计）
  user_hash VARCHAR(64) UNIQUE,                 -- 姓名+手机+时间 的SHA256哈希（不存明文）
  client_type VARCHAR(20) DEFAULT 'mobile_h5',  -- 访问终端
  ip_region VARCHAR(10),                        -- IP识别区域（CN/US/SEA等）
  
  -- 状态追踪
  status VARCHAR(20) DEFAULT 'active',          -- active/frozen/deleted
  last_active_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 📊 积分流水表（审计追踪）
CREATE TABLE IF NOT EXISTS ants_mayidao.gas_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES ants_mayidao.users(id) ON DELETE CASCADE,
  
  amount INTEGER NOT NULL,                      -- +30 / -66 / +19.8 等
  balance_after INTEGER NOT NULL,               -- 变更后余额（方便对账）
  
  reason VARCHAR(50) NOT NULL,                  -- register_bonus/purchase_reward/refund
  ref_order_id VARCHAR(50),                     -- 关联订单ID（可选）
  ref_from_user_id UUID,                        -- 如果是推荐奖励，记录来源用户
  
  metadata JSONB DEFAULT '{}',                  -- 扩展字段（如IP、UA摘要）
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 🛒 订单表（支付+报告关联）
CREATE TABLE IF NOT EXISTS ants_mayidao.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES ants_mayidao.users(id),
  
  -- 服务信息
  service_type VARCHAR(30) NOT NULL,            -- personal_naming / enterprise_naming
  service_price INTEGER NOT NULL,               -- 66 / 88 / 99
  
  -- 支付信息
  payment_method VARCHAR(20),                   -- usdt_manual / shopify / telegram
  payment_status VARCHAR(20) DEFAULT 'pending', -- pending/paid/failed/refunded
  payment_proof VARCHAR(255),                   -- USDT txid / Shopify order_id
  
  -- 报告信息
  report_id VARCHAR(50) UNIQUE,                 -- ANT_1709123456_abc123
  report_status VARCHAR(20) DEFAULT 'generating', -- generating/ready/failed
  report_url VARCHAR(255),                      -- 报告下载链接（Vercel/S3）
  
  -- 推荐追踪
  ref_code_used VARCHAR(20),                    -- 下单时使用的推荐码
  ref_reward_amount INTEGER DEFAULT 0,          -- 本次推荐奖励金额
  
  -- 合规标记
  disclaimer_acknowledged BOOLEAN DEFAULT true, -- 用户已确认娱乐声明
  compliance_version VARCHAR(10) DEFAULT 'v1',  -- 声明版本，便于后续升级
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- 📈 行为追踪表（轻量埋点，不含敏感数据）
CREATE TABLE IF NOT EXISTS ants_mayidao.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- 事件标识
  event_name VARCHAR(50) NOT NULL,              -- page_view / service_click / payment_start
  session_id VARCHAR(64),                       -- 前端生成的临时session
  
  -- 关联信息（脱敏）
  user_hash VARCHAR(64),                        -- 与users.user_hash 关联（非FK，允许匿名）
  ref_code VARCHAR(20),                         -- 当前会话的推荐码
  
  -- 事件数据
  payload JSONB DEFAULT '{}',                   -- 事件参数（如service_type）
  ua_summary VARCHAR(100),                      -- User-Agent摘要（前100字符）
  ip_region VARCHAR(10),                        -- IP区域（用于地域分析）
  
  occurred_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 3️⃣ 索引优化（免费层性能关键）
-- =====================================================

-- 用户表索引
CREATE INDEX IF NOT EXISTS idx_users_ref_code ON ants_mayidao.users(ref_code);
CREATE INDEX IF NOT EXISTS idx_users_ref_from ON ants_mayidao.users(ref_from);
CREATE INDEX IF NOT EXISTS idx_users_user_hash ON ants_mayidao.users(user_hash);
CREATE INDEX IF NOT EXISTS idx_users_active ON ants_mayidao.users(last_active_at) WHERE status = 'active';

-- 积分流水索引
CREATE INDEX IF NOT EXISTS idx_gas_logs_user ON ants_mayidao.gas_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gas_logs_reason ON ants_mayidao.gas_logs(reason, created_at);

-- 订单表索引
CREATE INDEX IF NOT EXISTS idx_orders_user ON ants_mayidao.orders(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_payment ON ants_mayidao.orders(payment_status, payment_method);
CREATE INDEX IF NOT EXISTS idx_orders_report ON ants_mayidao.orders(report_id, report_status);
CREATE INDEX IF NOT EXISTS idx_orders_ref ON ants_mayidao.orders(ref_code_used, ref_reward_amount) WHERE ref_reward_amount > 0;

-- 事件表索引（按时间分区查询）
CREATE INDEX IF NOT EXISTS idx_events_time ON ants_mayidao.events(occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_name ON ants_mayidao.events(event_name, occurred_at);

-- =====================================================
-- 4️⃣ 视图（方便报表+监控）
-- =====================================================

-- 📊 用户成长视图
CREATE OR REPLACE VIEW ants_mayidao.v_user_growth AS
SELECT
  DATE_TRUNC('day', created_at) AS signup_date,
  COUNT(*) AS new_users,
  COUNT(*) FILTER (WHERE ref_from IS NOT NULL) AS referred_users,
  AVG(gas_balance) AS avg_gas_balance
FROM ants_mayidao.users
GROUP BY DATE_TRUNC('day', created_at)
ORDER BY signup_date DESC;

-- 💰 收入统计视图（按日）
CREATE OR REPLACE VIEW ants_mayidao.v_daily_revenue AS
SELECT
  DATE_TRUNC('day', created_at) AS order_date,
  service_type,
  COUNT(*) AS order_count,
  SUM(service_price) FILTER (WHERE payment_status = 'paid') AS gross_revenue,
  SUM(ref_reward_amount) AS referral_payout,
  ROUND(100.0 * SUM(ref_reward_amount) / NULLIF(SUM(service_price),0), 2) AS referral_rate_pct
FROM ants_mayidao.orders
GROUP BY DATE_TRUNC('day', created_at), service_type
ORDER BY order_date DESC;

-- 🔗 推荐网络视图（用于病毒传播分析）
CREATE OR REPLACE VIEW ants_mayidao.v_referral_network AS
WITH RECURSIVE ref_chain AS (
  -- 起点：所有有推荐人的用户
  SELECT
    id AS user_id,
    ref_code,
    ref_from,
    1 AS depth,
    ARRAY[ref_code] AS path
  FROM ants_mayidao.users
  WHERE ref_from IS NOT NULL
  
  UNION ALL
  
  -- 递归：向上追溯推荐人
  SELECT
    u.id,
    u.ref_code,
    u.ref_from,
    rc.depth + 1,
    rc.path || u.ref_code
  FROM ants_mayidao.users u
  INNER JOIN ref_chain rc ON u.ref_code = rc.ref_from
  WHERE rc.depth < 5  -- 限制递归深度，防性能问题
)
SELECT
  root.ref_code AS root_referrer,
  COUNT(DISTINCT leaf.user_id) AS downstream_users,
  SUM(leaf.gas_balance) AS total_gas_distributed
FROM ref_chain root
LEFT JOIN ants_mayidao.users leaf ON leaf.ref_code = ANY(root.path)
GROUP BY root.ref_code
ORDER BY downstream_users DESC
LIMIT 100;  -- 只看Top100传播节点

-- =====================================================
-- 5️⃣ 函数与触发器（自动化辅助）
-- =====================================================

-- 🔄 自动更新 updated_at
CREATE OR REPLACE FUNCTION ants_mayidao.fn_update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_updated ON ants_mayidao.users;
CREATE TRIGGER trg_users_updated
  BEFORE UPDATE ON ants_mayidao.users
  FOR EACH ROW
  EXECUTE FUNCTION ants_mayidao.fn_update_timestamp();

DROP TRIGGER IF EXISTS trg_orders_updated ON ants_mayidao.orders;
CREATE TRIGGER trg_orders_updated
  BEFORE UPDATE ON ants_mayidao.orders
  FOR EACH ROW
  EXECUTE FUNCTION ants_mayidao.fn_update_timestamp();

-- 🎁 自动发放注册奖励（30 GAS）
CREATE OR REPLACE FUNCTION ants_mayidao.fn_welcome_bonus()
RETURNS TRIGGER AS $$
BEGIN
  -- 插入欢迎积分记录
  INSERT INTO ants_mayidao.gas_logs (
    user_id, amount, balance_after, reason, metadata
  ) VALUES (
    NEW.id,
    30,
    NEW.gas_balance,
    'register_bonus',
    jsonb_build_object('ip_region', NEW.ip_region, 'client_type', NEW.client_type)
  );
  
  -- 如果有推荐人，给推荐人+10 GAS（异步处理，避免长事务）
  IF NEW.ref_from IS NOT NULL THEN
    -- 这里假设 pg_notify 由外部监听器处理，或暂时只记录日志
    PERFORM pg_notify('referral_bonus', json_build_object(
      'referee_code', NEW.ref_code,
      'referrer_code', NEW.ref_from,
      'amount', 10
    )::text);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_user_welcome ON ants_mayidao.users;
CREATE TRIGGER trg_user_welcome
  AFTER INSERT ON ants_mayidao.users
  FOR EACH ROW
  EXECUTE FUNCTION ants_mayidao.fn_welcome_bonus();

-- 🗑️ 软删除函数（替代物理DELETE）
CREATE OR REPLACE FUNCTION ants_mayidao.fn_soft_delete_user(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE ants_mayidao.users
  SET status = 'deleted', user_hash = NULL, updated_at = NOW()
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 6️⃣ 行级安全策略（RLS）- 增强隔离
-- =====================================================

-- 启用 RLS
ALTER TABLE ants_mayidao.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE ants_mayidao.gas_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ants_mayidao.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE ants_mayidao.events ENABLE ROW LEVEL SECURITY;

-- 用户表策略
DROP POLICY IF EXISTS users_self_access ON ants_mayidao.users;
CREATE POLICY users_self_access ON ants_mayidao.users
  FOR SELECT USING (
    -- 允许：1) 管理员 2) 用户查自己 (基于 user_hash 或 id)
    current_setting('app.role', true) = 'admin'
    OR
    (auth.uid() IS NOT NULL AND id = auth.uid())
    OR
    user_hash = current_setting('app.user_hash', true)
  );

-- 积分流水策略
DROP POLICY IF EXISTS gas_logs_self_access ON ants_mayidao.gas_logs;
CREATE POLICY gas_logs_self_access ON ants_mayidao.gas_logs
  FOR SELECT USING (
    (auth.uid() IS NOT NULL AND user_id = auth.uid())
    OR
    current_setting('app.role', true) = 'admin'
  );

-- 订单表策略 (用户只能看自己的订单)
DROP POLICY IF EXISTS orders_self_access ON ants_mayidao.orders;
CREATE POLICY orders_self_access ON ants_mayidao.orders
  FOR SELECT USING (
    (auth.uid() IS NOT NULL AND user_id = auth.uid())
    OR
    current_setting('app.role', true) = 'admin'
  );

-- 匿名插入策略 (允许前端匿名创建订单/用户，Phase 1 简化)
DROP POLICY IF EXISTS anon_insert_users ON ants_mayidao.users;
CREATE POLICY anon_insert_users ON ants_mayidao.users FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS anon_insert_orders ON ants_mayidao.orders;
CREATE POLICY anon_insert_orders ON ants_mayidao.orders FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS anon_insert_events ON ants_mayidao.events;
CREATE POLICY anon_insert_events ON ants_mayidao.events FOR INSERT WITH CHECK (true);

-- 检查配置状态
-- SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'ants_mayidao' ORDER BY tablename;
