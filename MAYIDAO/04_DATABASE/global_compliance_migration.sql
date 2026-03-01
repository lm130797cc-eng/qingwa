-- 全球化合规与人工审查增强迁移脚本

-- 1. 更新 orders 表：添加审查状态与多语/LOGO字段
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS review_status VARCHAR(20) DEFAULT 'pending'; -- 'pending', 'approved', 'rejected', 'modification_requested'
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS logo_prompt TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS translated_report JSONB; -- 存储多语言翻译结果
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS compliance_check JSONB; -- 存储合规检查结果
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS is_global BOOLEAN DEFAULT false; -- 标记是否为国际单

-- 2. 更新 users 表：确保 GeoIP 字段存在 (如果之前未创建)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS country_code VARCHAR(10);
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS city VARCHAR(100);
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS last_ip VARCHAR(45);

-- 3. 创建 review_logs 表：记录审查操作历史
CREATE TABLE IF NOT EXISTS public.review_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES public.orders(id),
    admin_id VARCHAR(50) DEFAULT 'admin', -- 暂时用静态ID
    action VARCHAR(20) NOT NULL, -- 'approve', 'reject', 'modify'
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. 启用 RLS (如果尚未启用)
ALTER TABLE public.review_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable read access for all users" ON public.review_logs FOR SELECT USING (true);
