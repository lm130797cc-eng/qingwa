
# 👻 Ghost Global Protocol (幽灵全球化协议)

## Status: 🟢 ACTIVE | AUTONOMOUS | SILENT

### 1. 核心目标 (Core Objectives)
- **中文为核**: 底层逻辑基于易经八字 (Source: Chinese)
- **多语适配**: 自动根据 IP 适配语言，并过滤当地禁忌 (Target: Localized)
- **静默运行**: 除非人工干预，系统将自动在后台完成翻译与绘图
- **自动绕行**: API 超时/配额用尽时自动切换备用方案 (Qwen → DeepL | SD → Template)

### 2. 启动指南 (User Action Guide)

**Step 1: 启动后端 (终端执行)**
```powershell
cd D:\MAYIJU\MAYIDAO\03_BACKEND
node dashboard_api.js
```
*此时后端运行在 http://localhost:3001*

**Step 2: 生成测试数据 (可选)**
```powershell
node verify_ghost_flow.js
```
*这将模拟一个全链路订单，验证翻译、LOGO生成及合规检查是否正常。*

**Step 3: 打开审查窗口 (浏览器)**
直接打开文件:
`D:\MAYIJU\MAYIDAO\review\dashboard.html`
*或使用 VS Code Live Server 打开*

### 3. 系统自动运行 (System Auto-Operation)
- **新订单** → 中文易经内核 → 多语禁忌过滤 → LOGO生成 → 审查队列
- **审查操作** → 本地窗口显示待审订单 → 您点击[✅ 通过发送] → 自动交付+通知
- **异常自愈** → 遇阻自动绕行(3种方案) → 失败才告警 → 目标导向

### 4. 幽灵输出协议 (Ghost Output Protocol)
系统将在日志中输出极简状态报告：

```text
🟢 Ghost OK | Orders: X | ¥: XXX | Review: Y pending  ← 每日00:00 
💰 +12U | ANT*** | US | 14:23                          ← USDT入账 
📋 Review: 2 orders | Logo: 1 | Est: 2min              ← 审查待办 
🔧 Integrated: [Tool] | ROI: +X% | ✅                   ← 新工具集成 
🔴 [Module] | Auto-Detour: [Solution] | ✅              ← 异常自愈 
🆘 [Issue] | Failed 3x | Suggest: [1.2.3.]             ← 仅此时需人工 
```

### 5. 文件结构 (Key Files)
- `D:\MAYIJU\MAYIDAO\03_BACKEND\ai_naming_agent.js`: 核心逻辑 (多语+LOGO+绕行)
- `D:\MAYIJU\MAYIDAO\03_BACKEND\dashboard_api.js`: 后端接口 (支持离线/Dev模式)
- `D:\MAYIJU\MAYIDAO\review\dashboard.html`: 本地审查前端

---
**系统承诺**: 中文为核 + 多语合规 + 人工审查 + 自动绕行 + 静默运行。
