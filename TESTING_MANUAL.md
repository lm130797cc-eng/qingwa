# 🧪 全链路测试手册 (Phase 5)

## 🎯 测试目标
确保从用户访问、下单、支付到交付的全流程畅通无阻，无阻塞点。

## 🛠️ 测试环境
- **Shopify Store**: `https://f8618.myshopify.com`
- **Telegram Bot**: `@qingwa_go_bot`
- **Payment**: PayPal (Production/Sandbox), USDT (TRC20/ERC20)

---

## 📋 测试清单 (Checklist)

### Test 1: 网站访问 & 浏览
- [ ] **首页访问**: 访问 `https://f8618.myshopify.com`，确保加载速度 < 3秒。
- [ ] **移动端适配**: 使用手机浏览器访问，检查布局是否正常。
- [ ] **链接检查**: 点击导航栏、Footer 链接，确保无 404 错误。

### Test 2: 产品展示 (Shopify指挥官)
- [ ] **产品列表**: 确认 3 个核心产品均已上架：
  1. AI I-Ching Personal Naming Report ($12)
  2. Enterprise Brand Naming ($40)
  3. Ant Island Membership (Free/Referral)
- [ ] **详情页**:
  - 图片清晰加载
  - 描述中英文双语完整
  - 价格显示正确（含原价对比）
  - "Buy Now" 按钮可用

### Test 3: 支付流程 (支付指挥官)
#### 3.1 PayPal 支付
- [ ] **下单**: 将产品加入购物车，点击 Checkout。
- [ ] **支付**: 选择 PayPal，登录并完成支付。
- [ ] **确认**:
  - 检查邮箱是否收到 Shopify 订单确认邮件。
  - 检查 PayPal 账户是否扣款/收款成功。
- [ ] **交付**: 检查是否收到包含下载链接的邮件 (Sky Pilot/Digital Downloads)。

#### 3.2 USDT 支付 (幽灵模式)
- [ ] **指引**: 在产品页或 Checkout 页找到 USDT 支付指引。
- [ ] **转账**: 向 `0xf3ce1bb32dcfb11e81c69efa0cc6f5ae7bd00f80` 转账 > $10 (测试可用小额，但 Bot 设置了最小值)。
- [ ] **核验**:
  - 打开 Telegram `@qingwa_go_bot`
  - 发送 TXID (64位哈希)
  - 预期响应: `✅ 入账已确认...` 或 `🔄 正在核验...`
- [ ] **交付**: 确认 Bot 是否引导至下载或发送报告。

### Test 4: 推荐系统 (运营指挥官)
- [ ] **获取链接**: 向 Bot 发送 `/refer`，获取专属链接 `?ref=ANT...`。
- [ ] **追踪测试**:
  - 使用隐身窗口打开推荐链接。
  - 模拟下单 (或检查 LocalStorage `ant_ref_code` 是否存在)。
- [ ] **数据核对**: 检查 Supabase 数据库 `users` 表，确认 `ref_code` 绑定关系。

### Test 5: Telegram Bot 功能 (运营指挥官)
- [ ] **启动**: 发送 `/start`，检查欢迎语及菜单。
- [ ] **帮助**: 发送 `/help`，检查命令列表。
- [ ] **余额**: 发送 `/balance`，检查初始积分。
- [ ] **关键词**:
  - 发送 "价格" -> 返回价格表
  - 发送 "案例" -> 返回案例列表
  - 发送 "推荐" -> 返回推荐链接
- [ ] **入群欢迎**: 新用户加入群组，Bot 自动发送欢迎语。

### Test 6: 风控与安全 (合规指挥官)
- [ ] **频率限制**: 连续快速发送 20 次 TXID 查询，检查是否触发限流提示。
- [ ] **异常金额**: 发送低于 $1 的 TXID，检查是否提示金额过低。
- [ ] **错链检查**: 发送非 USDT 的 TXID (如 TRX 转账)，检查是否报错。

---

## 🐞 故障排查 (Troubleshooting)

| 问题现象 | 可能原因 | 解决方案 |
|---------|---------|---------|
| Bot 不回复 | Render 服务休眠 / Token 错误 | 检查 Render 日志; 确认 Token 正确 |
| TXID 核验失败 | 链上数据延迟 / API 额度超限 | 等待 3-5 分钟重试; 检查 TronScan API Key |
| 推荐关系未绑定 | 浏览器 Cookie 拦截 / 脚本未加载 | 检查 Shopify `theme.liquid` 是否包含追踪脚本 |
| 邮件未收到 | 垃圾邮件拦截 / SMTP 配置错误 | 检查 Spam 文件夹; 检查 Shopify 通知设置 |

## ✅ 上线确认
- [ ] 所有 Critical 测试项通过
- [ ] 风控规则已生效
- [ ] 客服自动回复已启用
- [ ] 支付通道畅通

**批准上线**: ___________ (Bagua Agent)
**日期**: 2026-03-02
