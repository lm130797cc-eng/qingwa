
-- Shopify 订单适配迁移脚本

-- 1. 更新 orders 表：添加 Shopify 专属字段
-- shopify_order_id: 存储 Shopify 的原始订单 ID (String)
-- meta_data: 存储 JSON 格式的元数据 (包含 line_items, shipping_address 等)
-- payment_method: 增加 shopify 选项 (现有表可能已有，确保支持)

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS shopify_order_id VARCHAR(100);
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS meta_data JSONB DEFAULT '{}'::jsonb;

-- 2. 创建索引以加速查询
CREATE INDEX IF NOT EXISTS idx_orders_shopify_id ON public.orders(shopify_order_id);

-- 3. (可选) 如果 service_type 需要扩展，可在此备注
-- 目前前端逻辑：'enterprise' 或 'personal'，直接复用即可。

-- 4. 确保 payment_method 字段长度足够
ALTER TABLE public.orders ALTER COLUMN payment_method TYPE VARCHAR(50);

-- 5. 确保 user_email 字段存在 (部分旧表可能只有 user_id)
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS user_email VARCHAR(255);

