-- AI易经取名看板数据库初始化脚本
-- 请在 Supabase SQL Editor 中运行此脚本

-- 1. 创建订单表 (如果不存在) - 使用 public schema 以确保兼容性
CREATE TABLE IF NOT EXISTS public.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id), -- 如果使用 Supabase Auth, 否则使用 public.users
    service_type VARCHAR(50) NOT NULL, -- 'expert_naming', 'basic_naming', 'five_elements'
    service_price DECIMAL(10, 2) NOT NULL,
    payment_status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'paid'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 如果有单独的用户表，请创建
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ref_code VARCHAR(255),
    telegram_id VARCHAR(255),
    country_code VARCHAR(10), -- e.g. 'CN', 'US'
    city VARCHAR(100),
    last_ip VARCHAR(45),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 创建AI日志表 (用于五行分布统计)
CREATE TABLE IF NOT EXISTS public.ai_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id),
    missing_element VARCHAR(10), -- '金', '木', '水', '火', '土'
    suggested_names TEXT[],
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 创建捐赠记录表 (用于USDT入账和Geo统计)
CREATE TABLE IF NOT EXISTS public.donation_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id),
    amount DECIMAL(18, 6) NOT NULL,
    currency VARCHAR(10) DEFAULT 'USDT',
    tx_id VARCHAR(255) UNIQUE,
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'confirmed'
    risk_level VARCHAR(20) DEFAULT 'low',
    geo_location VARCHAR(10), -- e.g. 'CN', 'US'
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. 启用 RLS (Row Level Security) - 可选，根据需要
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.donation_records ENABLE ROW LEVEL SECURITY;

-- 5. 开放读取权限 (允许 Service Key 读取，或根据 Auth 策略)
-- 简单起见，允许所有认证用户读取 (生产环境请更严格)
CREATE POLICY "Enable read access for all users" ON public.orders FOR SELECT USING (true);
CREATE POLICY "Enable read access for all users" ON public.ai_logs FOR SELECT USING (true);
CREATE POLICY "Enable read access for all users" ON public.donation_records FOR SELECT USING (true);

-- 6. 插入一些测试数据 (可选)
-- INSERT INTO public.ai_logs (missing_element) VALUES ('金'), ('木'), ('火'), ('金'), ('土');
