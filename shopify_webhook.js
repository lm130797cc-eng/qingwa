
// 文件：D:/MAYIJU/MAYIDAO/03_BACKEND/shopify_webhook.js
// 功能：接收Shopify订单 → 触发AI报告生成

import express from 'express';
import { createClient } from '@supabase/supabase-js';

const router = express.Router();

// Supabase 初始化 (使用环境变量)
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  // 暂时忽略错误，避免阻塞应用启动，但功能将不可用
  console.warn('⚠️ Shopify Webhook: SUPABASE_URL or SUPABASE_SERVICE_KEY missing. Webhook will fail.');
}

const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

// Shopify Webhook 路由
router.post('/webhook/shopify', async (req, res) => {
  if (!supabase) {
    return res.status(500).send('Server Misconfiguration: Database not connected');
  }
  try {
    const order = req.body;
    console.log(`🛍️ Received Shopify Order: #${order.id}`);

    // 1. 提取订单信息
    const {
      id: shopifyOrderId,
      email,
      total_price,
      line_items,
      shipping_address
    } = order;

    // 2. 识别服务类型（个人/企业）
    // 假设商品标题包含 "企业" 或 "Enterprise" 视为企业版，否则为个人版
    const firstItemTitle = line_items?.[0]?.title || '';
    const serviceType = (firstItemTitle.includes('企业') || firstItemTitle.includes('Enterprise')) 
        ? 'enterprise' 
        : 'personal';
    
    const priceCNY = parseFloat(total_price); // 转换为浮点数

    // 3. 创建蚂蚁岛订单记录 (对应 orders 表)
    // 注意：需要确保 orders 表有 shopify_order_id, payment_method 等字段
    const { data: antOrder, error } = await supabase
      .from('orders')
      .insert({
        // id: 自动生成 UUID
        shopify_order_id: String(shopifyOrderId),
        user_email: email, // 需确保 orders 表有此字段或关联 users 表
        service_type: serviceType,
        service_price: priceCNY,
        payment_status: 'paid', // Shopify Webhook通常是支付成功后触发
        payment_method: 'shopify',
        review_status: 'pending', // 进入人工审查队列
        created_at: new Date().toISOString(),
        // 存储 Shopify 原始数据备查
        meta_data: {
            shopify_payload: {
                line_items,
                shipping_address
            }
        }
      })
      .select()
      .single();

    if (error) {
        console.error('❌ Database Insert Error:', error);
        throw error;
    }

    console.log(`✅ Order Created in Supabase: ${antOrder.id}`);

    // 4. 触发报告生成 (调用本地 Agent 或 n8n)
    // 这里调用本地函数，实际逻辑可扩展
    await triggerReportGeneration({
      orderId: antOrder.id,
      serviceType,
      userEmail: email,
      userData: {
        name: shipping_address?.name || 'Shopify User',
        industry: line_items[0].properties?.find(p => p.name === 'industry')?.value || '未指定',
        preferences: line_items[0].properties?.find(p => p.name === 'preferences')?.value || ''
      }
    });

    // 5. 返回成功 (Shopify 要求 200 OK)
    res.status(200).send('OK');

  } catch (err) {
    console.error('❌ Shopify webhook error:', err);
    // 即使出错也尽量返回 200 防止 Shopify 重试队列堵塞 (视策略而定)
    // 这里返回 500 让 Shopify 稍后重试
    res.status(500).send('Error processing webhook');
  }
});

// 模拟触发报告生成
async function triggerReportGeneration(params) {
  console.log('🔄 Triggering AI Report Generation:', JSON.stringify(params, null, 2));
  // TODO: 这里可以集成 ai_naming_agent.js 的生成逻辑
  // 目前仅作为占位符，因为 Ghost 模式下会自动扫描 pending 订单
}

export default router;
