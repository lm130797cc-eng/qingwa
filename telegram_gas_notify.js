import { Telegraf } from 'telegraf';
import { createClient } from '@supabase/supabase-js';

// 初始化
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// 用户通知偏好缓存（内存 + 定期同步）
const notifyPrefs = new Map(); // ref_code -> { enabled: boolean, last_notify: timestamp }

// 启动 Bot
bot.start((ctx) => {
  ctx.reply(
    `👋 欢迎使用蚂蚁岛通知服务！\n\n` +
    `📬 您将收到：\n` +
    `• 积分到账提醒\n` +
    `• 兑换成功确认\n` +
    `• 积分过期预警（可选）\n\n` +
    `⚙️ 管理通知：\n` +
    `/stop_notify - 关闭积分通知\n` +
    `/start_notify - 重新开启\n\n` +
    `⚠️ 声明：通知仅供文化娱乐参考，不涉及命运预测。`
  );
});

// 关闭通知
bot.command('stop_notify', (ctx) => {
  const refCode = ctx.from.id.toString(); // 简化：用 Telegram ID 关联
  notifyPrefs.set(refCode, { enabled: false, last_notify: Date.now() });
  ctx.reply('✅ 积分通知已关闭。回复 /start_notify 随时重新开启。');
});

// 开启通知
bot.command('start_notify', (ctx) => {
  const refCode = ctx.from.id.toString();
  notifyPrefs.set(refCode, { enabled: true, last_notify: 0 });
  ctx.reply('✅ 积分通知已开启。积分变动时将收到私信提醒~');
});

// 核心：监听 Supabase gas_logs 变化（轮询方案，免费层友好）
async function watchGasLogs() {
  let lastCheck = Date.now() - 60000; // 从 1 分钟前开始
  
  setInterval(async () => {
    try {
      // 查询最近 1 分钟的新积分记录
      const { data: logs, error } = await supabase
        .from('gas_logs')
        .select('*, users(ref_code, user_hash)')
        .gte('created_at', new Date(lastCheck).toISOString())
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      if (!logs || logs.length === 0) {
          // 无新日志，更新检查时间
          lastCheck = Date.now();
          return;
      }

      for (const log of logs) {
        const refCode = log.users?.ref_code;
        if (!refCode) continue;
        
        // 检查用户是否允许通知
        const pref = notifyPrefs.get(refCode) || { enabled: true, last_notify: 0 };
        if (!pref.enabled) continue;
        
        // 防频限：1 小时内最多 3 条
        const now = Date.now();
        if (now - pref.last_notify < 3600000) {
          const count = Array.from(notifyPrefs.values())
            .filter(p => now - p.last_notify < 3600000).length;
          if (count >= 3) continue;
        }
        
        // 生成通知文案（合规脱敏）
        const maskedRef = refCode.slice(-4).padStart(refCode.length, '•');
        const amountText = log.amount > 0 ? `+${log.amount}` : `${log.amount}`;
        const color = log.amount > 0 ? '🟢' : '🔴';
        
        const message = 
          `${color} GAS 积分变动通知\n\n` +
          `用户：${maskedRef}\n` +
          `变动：${amountText} GAS\n` +
          `原因：${log.reason}\n` +
          `余额：${log.balance_after} GAS\n\n` +
          `⚠️ 积分仅供站内使用，不可提现\n` +
          `管理通知：/stop_notify`;
        
        // 发送 Telegram 消息（简化：用 ref_code 映射 Telegram chat_id，Phase 2 完善）
        await sendTelegramMessage(refCode, message).catch(err => {
          console.warn('⚠️ 通知发送失败:', err.message);
        });
        
        // 更新通知时间
        notifyPrefs.set(refCode, { ...pref, last_notify: now });
      }
      
      lastCheck = Date.now();
      
    } catch (error) {
      console.error('❌ watchGasLogs error:', error);
    }
  }, 30000); // 每 30 秒轮询一次（免费层友好）
}

// 发送 Telegram 消息（简化版：用广播频道 + @mention，Phase 2 接真实用户映射）
async function sendTelegramMessage(refCode, message) {
  // 方案 A：发送到公共频道 + @refCode（用户需主动关注频道）
  await bot.telegram.sendMessage(
    process.env.TELEGRAM_CHANNEL_ID || '@AntIslandNotify',
    message,
    { parse_mode: 'HTML' }
  );
  
  // 方案 B（Phase 2）：通过用户绑定的 chat_id 私信
  // const chatId = await getChatIdByRefCode(refCode);
  // if (chatId) await bot.telegram.sendMessage(chatId, message);
}

// 启动服务
bot.launch().then(() => {
  console.log('✅ Telegram Bot 已启动');
  watchGasLogs();
  console.log('🔄 开始监听积分变动...');
});

// 优雅退出
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

export default bot;