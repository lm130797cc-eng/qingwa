-- 现金流监控视图
CREATE OR REPLACE VIEW cash_flow_dashboard AS 
SELECT 
  -- 今日数据
  SUM(CASE WHEN DATE(created_at) = CURRENT_DATE THEN amount ELSE 0 END) as today_revenue,
  
  -- 本周数据
  SUM(CASE WHEN DATE_TRUNC('week', created_at) = DATE_TRUNC('week', NOW()) 
       THEN amount ELSE 0 END) as week_revenue,
  
  -- 本月数据
  SUM(CASE WHEN DATE_TRUNC('month', created_at) = DATE_TRUNC('month', NOW()) 
       THEN amount ELSE 0 END) as month_revenue,
  
  -- 待发放佣金 (Assuming commission logic is tracked)
  -- For now, placeholder 0 as we don't have a direct 'commission_paid' column in 'transactions' usually
  0 as pending_commissions,
  
  -- 净利润 (Simplified)
  SUM(amount) as net_profit
  
FROM payment_records
WHERE status = 'completed';

-- 检查会员数据
CREATE OR REPLACE VIEW member_stats AS
SELECT 
  COUNT(*) as total_members, 
  COUNT(CASE WHEN telegram_id IS NOT NULL THEN 1 END) as active_members
FROM users;