/**
 * usdt_payment_bot.js
 * 蚂蚁岛·USDT (TRC20) 自动核验服务 & 会员系统
 * 功能：用户发送 TXID → Bot 自动核验 → 积分/会员权益发放
 * 部署：Railway/Render
 */

import { Telegraf } from 'telegraf';
import fetch from 'node-fetch';
import { createClient } from '@supabase/supabase-js';
import { createServer } from 'http';
import * as fs from 'fs';
import * as crypto from 'crypto';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { checkFraud } from './03_BACKEND/fraud_detection.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const COMPLIANCE_LINE_1 = '积分仅供站内服务兑换，不可提现。';
const COMPLIANCE_LINE_2 = '仅供文化娱乐参考，不涉及命运预测。';

// ========== 配置 ==========
const CONFIG = {
  // Telegram
  botToken: process.env.TELEGRAM_BOT_TOKEN,
  channelId: process.env.TELEGRAM_CHANNEL_ID || '@AntIslandPay',
  
  // Supabase
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseKey: process.env.SUPABASE_SERVICE_KEY,
  
  // USDT (TRC20/EVM)
  walletAddress: process.env.USDT_WALLET_ADDRESS, 
  chainType: (process.env.USDT_WALLET_ADDRESS || '').startsWith('T') ? 'TRON' : 'EVM',
  minConfirmations: 20, 
  tronScanApi: 'https://api.tronscan.org/api/transaction-info',
  
  evmApi: 'https://api.etherscan.io/api', 
  evmUsdtContract: '0xdac17f958d2ee523a2206206994597c13d831ec7', // USDT (ERC20)
  evmDecimals: 6, 
  
  // 业务配置
  exchangeRate: 10, // 1 USDT = 10 GAS
  minUsdt: 1, 
  donationUsdt: Number(process.env.DONATION_USDT || 12), // $12 购买报告/会员
  donationGasBonus: 30, // 购买报告赠送 30 GAS
  membershipPrice: 12, // 会员价格 $12
  referralReward: 30, // 推荐奖励 30 GAS
  
  // 安全
  rateLimit: { window: 3600000, max: 20 },
  maxDonationsPerDay: 5,
  amountTolerance: 0.05,
  
  // 服务
  reportWebhook: process.env.N8N_WEBHOOK_URL
};

// GHOST 模式配置 (保持原样)
const GHOST = {
  enabled: process.env.GHOST_MODE !== '0',
  silent: process.env.GHOST_SILENT !== '0',
  scanIntervalMs: Number(process.env.GHOST_SCAN_INTERVAL_MS || 5 * 60 * 1000),
  maxAutoFixAttempts: Number(process.env.GHOST_MAX_AUTOFIX || 3),
  logsDir: process.env.GHOST_LOGS_DIR || path.resolve(__dirname, '../logs'),
  freeQuotaLimit: Number(process.env.GHOST_FREE_QUOTA || 0.9)
};

// 初始化
const bot = new Telegraf(CONFIG.botToken);
let supabase = createClient(CONFIG.supabaseUrl, CONFIG.supabaseKey);

// 状态缓存
const txCache = new Map(); // txid -> { verified: boolean, timestamp }
const rateLimitMap = new Map(); // userId -> [timestamps]
const userIntents = new Map(); // userId -> 'membership' | 'report' (User's last intent)

// ========== 辅助函数 ==========

function appendCompliance(text) {
  const t = String(text || '');
  const has1 = t.includes(COMPLIANCE_LINE_1);
  const has2 = t.includes(COMPLIANCE_LINE_2);
  if (has1 && has2) return t;
  const suffix = [!has1 ? COMPLIANCE_LINE_1 : null, !has2 ? COMPLIANCE_LINE_2 : null].filter(Boolean).join('\n');
  if (!suffix) return t;
  return t.trim().length ? `${t}\n\n${suffix}` : suffix;
}

function ghostOut(line) { console.log(line); }
function ghostDebug(...args) { if (!GHOST.silent) console.log(...args); }

function maskRefCode(refCode) {
  const s = String(refCode || '');
  if (s.length <= 5) return `${s.slice(0, 2)}***`;
  return `${s.slice(0, 3)}***${s.slice(-2)}`;
}

function generateRefCode() {
  return 'ANT' + Math.random().toString(36).slice(2, 10).toUpperCase();
}

// 确保用户存在 (包含推荐关系处理)
async function ensureTelegramUser(telegramUserId, parentRefCode = null) {
  // 1. 查询现有用户
  const { data: existing, error: existingErr } = await supabase
    .from('users')
    .select('*')
    .eq('telegram_id', telegramUserId.toString())
    .single();

  if (existing && !existingErr) {
    // 如果是现有用户，但没有上级，且提供了有效的 parentRefCode，尝试绑定
    if (!existing.parent_ref_code && parentRefCode && parentRefCode !== existing.ref_code) {
        await supabase.from('users').update({ parent_ref_code: parentRefCode }).eq('id', existing.id);
        // 记录到 referrals 表
        const { data: referrer } = await supabase.from('users').select('id').eq('ref_code', parentRefCode).single();
        if (referrer) {
            await supabase.from('referrals').insert({
                referrer_id: referrer.id,
                referred_id: existing.id,
                ref_code: parentRefCode
            });
        }
    }
    return existing;
  }

  // 2. 创建新用户
  const refCode = generateRefCode();
  const newUser = {
    telegram_id: telegramUserId.toString(),
    ref_code: refCode,
    gas_balance: 0,
    created_at: new Date().toISOString(),
    parent_ref_code: parentRefCode // 记录上级
  };

  const { data: created, error: createErr } = await supabase
    .from('users')
    .insert(newUser)
    .select('*')
    .single();

  if (createErr) throw createErr;

  // 3. 如果有上级，记录 referral 关系
  if (parentRefCode) {
      const { data: referrer } = await supabase.from('users').select('id').eq('ref_code', parentRefCode).single();
      if (referrer) {
          await supabase.from('referrals').insert({
              referrer_id: referrer.id,
              referred_id: created.id,
              ref_code: parentRefCode
          });
      }
  }

  return created;
}

// 绑定用户 (RefCode)
async function bindExistingUserToTelegram(userId, refCode) {
    if (!refCode || refCode === 'DIRECT') return;
    try {
        await ensureTelegramUser(userId, refCode);
    } catch (e) {
        console.error('Bind user exception:', e);
    }
}

// ========== 核心：积分与会员逻辑 ==========

// 增加积分
async function creditGas(userId, amount, type, description) {
    const { data: user } = await supabase.from('users').select('gas_balance').eq('id', userId).single();
    if (!user) return;

    const newBalance = (user.gas_balance || 0) + amount;
    
    // 更新余额
    await supabase.from('users').update({ gas_balance: newBalance }).eq('id', userId);
    
    // 记录流水
    await supabase.from('gas_transactions').insert({
        user_id: userId,
        amount: amount,
        balance_after: newBalance,
        transaction_type: type,
        description: description
    });
    
    // 如果是推荐奖励，更新用户的 total_earned_gas
    if (type === 'referral_reward') {
        await supabase.rpc('increment_total_earned_gas', { user_uuid: userId, amount_to_add: amount });
    }
}

// 处理会员开通
async function activateMembership(userId, txid) {
    // 1. 更新用户状态
    const { data: user } = await supabase
        .from('users')
        .update({ is_member: true, member_activated_at: new Date() })
        .eq('telegram_id', userId.toString())
        .select()
        .single();
        
    if (!user) return;

    // 2. 查找推荐人并奖励
    if (user.parent_ref_code) {
        const { data: referrer } = await supabase.from('users').select('id').eq('ref_code', user.parent_ref_code).single();
        if (referrer) {
            // 奖励推荐人 30 GAS
            await creditGas(referrer.id, CONFIG.referralReward, 'referral_reward', `Invite Member: ${maskRefCode(user.ref_code)}`);
            // 通知推荐人 (如果有 chat_id)
            // await bot.telegram.sendMessage(...)
        }
    }
}

// ========== 核心：交易核验 ==========

async function fetchTronTransaction(txid) {
    try {
        const response = await fetch(`${CONFIG.tronScanApi}?hash=${txid}`, { headers: { 'Accept': 'application/json' } });
        if (!response.ok) return { success: false, message: `TronScan API Error: ${response.status}` };
        const txData = await response.json();
        if (!txData || txData.Error) return { success: false, error: 'TX_NOT_FOUND', message: '❌ 交易未找到' };
        if (txData.contractRet !== 'SUCCESS') return { success: false, error: 'TX_FAILED', message: '❌ 交易失败' };

        let transfer = txData.tokenTransferInfo || txData.contractData;
        if (!transfer) return { success: false, error: 'NO_TRANSFER', message: '❌ 未识别到转账' };
        
        const symbol = (transfer.symbol || transfer.tokenAbbr || '').toUpperCase();
        const to = transfer.to_address;
        const amount = parseFloat(transfer.amount_str || transfer.amount || 0) / 1000000;

        return { success: true, data: { amount, to, token: symbol } };
    } catch (e) {
        return { success: false, message: `TronScan Error: ${e.message}` };
    }
}

async function verifyTransaction(txid, telegramUserId) {
  try {
    // 0. 检查是否已处理
    const { count } = await supabase.from('payment_records').select('*', { count: 'exact', head: true }).eq('txid', txid).eq('status', 'completed');
    if (count > 0) return { success: true, message: '✅ 该交易已处理', duplicate: true };

    // 1. 链上核验
    const fetchResult = await fetchTronTransaction(txid); // 暂只支持 TRON
    if (!fetchResult.success) return fetchResult;

    const { amount, to, token } = fetchResult.data;
    if (token !== 'USDT') return { success: false, error: 'WRONG_TOKEN', message: '❌ 仅支持 USDT' };
    if (to.toLowerCase() !== CONFIG.walletAddress.toLowerCase()) return { success: false, error: 'WRONG_ADDRESS', message: '❌ 收款地址不匹配' };

    // 2. 判定业务类型
    const intent = userIntents.get(telegramUserId) || 'report'; // 默认为购买报告
    const isMembership = Math.abs(amount - CONFIG.membershipPrice) <= CONFIG.amountTolerance && intent === 'membership';
    
    // 2.5 风控检查
    const user = await ensureTelegramUser(telegramUserId);
    const fraudCheck = await checkFraud({ userId: user.id, amount }, supabase);

    if (!fraudCheck.approved) {
        // 记录异常交易
        await supabase.from('payment_records').insert({
            txid, user_id: user.id, amount_usdt: amount, status: 'flagged', verified_at: new Date(),
            notes: `Fraud Alert: ${fraudCheck.reasons.join(', ')}`
        });
        
        // 通知管理员
        if (CONFIG.channelId) {
             await bot.telegram.sendMessage(CONFIG.channelId, 
                `⚠️ <b>风控告警 (Fraud Alert)</b>\n` +
                `用户: <code>${user.ref_code}</code>\n` +
                `金额: $${amount}\n` +
                `原因: ${fraudCheck.reasons.join(', ')}\n` +
                `TXID: <code>${txid}</code>`, 
                { parse_mode: 'HTML' }
            ).catch(e => console.error('Admin notify failed', e));
        }
        
        return { success: false, message: '⚠️ 交易触发风控审核，请联系客服。' };
    }

    // 3. 执行业务逻辑
    // const user = await ensureTelegramUser(telegramUserId); // Moved up
    
    if (isMembership) {
        await activateMembership(telegramUserId, txid);
        // 记录
        await supabase.from('membership_applications').insert({
            user_id: user.id,
            payment_proof: txid,
            payment_method: 'USDT',
            amount_paid: amount,
            status: 'approved',
            approved_at: new Date()
        });
    } else {
        // 默认作为购买报告/捐赠处理
        const gasAmount = CONFIG.donationGasBonus; // +30 GAS
        await creditGas(user.id, gasAmount, 'purchase_reward', `Buy Report (${txid.slice(0,6)})`);
        
        // 触发报告生成
        if (CONFIG.reportWebhook) {
             await fetch(CONFIG.reportWebhook, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ event: 'payment_confirmed', user_id: user.id, order_id: `TX-${txid.slice(0,8)}` })
            }).catch(e => console.error('Webhook fail', e));
        }
    }

    // 4. 记录交易
    await supabase.from('payment_records').insert({
        txid, user_id: user.id, amount_usdt: amount, status: 'completed', verified_at: new Date()
    });

    userIntents.delete(telegramUserId); // 清除意图

    return {
        success: true,
        type: isMembership ? 'membership' : 'report',
        amountUSDT: amount,
        gasAmount: isMembership ? 0 : CONFIG.donationGasBonus,
        balance: (user.gas_balance || 0) + (isMembership ? 0 : CONFIG.donationGasBonus)
    };

  } catch (error) {
    console.error('Verify error:', error);
    return { success: false, message: '系统繁忙' };
  }
}

// ========== 命令处理 ==========

bot.start(async (ctx) => {
  const userId = ctx.from.id;
  const startPayload = ctx.startPayload; // 获取 ref code
  
  try {
    await ensureTelegramUser(userId, startPayload);
  } catch (e) {
    console.error('Start error:', e);
  }

  await ctx.reply(
    appendCompliance(
      `🐸 欢迎使用 Qingwa Ghost Mode!\n\n` +
      `🔥 <b>热门服务:</b>\n` +
      `1️⃣ <b>AI易经取名报告</b> ($12)\n` +
      `   赠送 30 GAS，含中英文解读\n` +
      `2️⃣ <b>青蛙会员 (Agent)</b> ($12)\n` +
      `   开启推广权限，邀3人回本，无限赚佣金\n\n` +
      `🚀 <b>如何开始?</b>\n` +
      `点击下方链接或发送 /upgrade 升级会员\n` +
      `👉 https://f8618.myshopify.com`
    ),
    { parse_mode: 'HTML', disable_web_page_preview: true }
  );
});

bot.command('donate', async (ctx) => {
    userIntents.set(ctx.from.id, 'report');
    await ctx.reply(
        `💰 <b>购买报告 / 捐赠</b>\n` +
        `支付 <b>$12 USDT</b> 获取命名报告 + 30 GAS\n\n` +
        `地址 (TRC20):\n<code>${CONFIG.walletAddress}</code>\n\n` +
        `支付后请发送 TXID`,
        { parse_mode: 'HTML' }
    );
});

bot.command('upgrade', async (ctx) => {
    userIntents.set(ctx.from.id, 'membership');
    await ctx.reply(
        `👑 <b>升级青蛙会员</b>\n` +
        `权益：\n` +
        `✅ 专属推广链接\n` +
        `✅ 推荐1人返 30 GAS\n` +
        `✅ 推荐3人回本 (90 GAS)\n\n` +
        `支付 <b>$12 USDT</b> 开启权限:\n` +
        `地址 (TRC20):\n<code>${CONFIG.walletAddress}</code>\n\n` +
        `支付后请发送 TXID`,
        { parse_mode: 'HTML' }
    );
});

bot.command('me', async (ctx) => {
    try {
        const user = await ensureTelegramUser(ctx.from.id);
        // 获取下级数量
        const { count } = await supabase.from('referrals').select('*', { count: 'exact', head: true }).eq('referrer_id', user.id);
        
        await ctx.reply(
            `👤 <b>个人中心</b>\n` +
            `🆔 ID: <code>${user.ref_code}</code>\n` +
            `👑 身份: ${user.is_member ? '青蛙会员 (Member)' : '普通用户'}\n` +
            `⛽ GAS余额: ${user.gas_balance || 0}\n` +
            `👥 邀请人数: ${count || 0} 人\n\n` +
            `专属链接: https://f8618.myshopify.com/?ref=${user.ref_code}`,
            { parse_mode: 'HTML', disable_web_page_preview: true }
        );
    } catch (e) {
        ctx.reply('⚠️ 查询失败');
    }
});

bot.command('team', async (ctx) => {
    try {
        const user = await ensureTelegramUser(ctx.from.id);
        const { data: refs } = await supabase.from('referrals').select('created_at, ref_code').eq('referrer_id', user.id).limit(10).order('created_at', { ascending: false });
        
        let msg = `👥 <b>我的团队 (最近10人)</b>\n`;
        if (!refs || refs.length === 0) {
            msg += `暂无下级，快去邀请吧！\n发送 /refer 获取链接`;
        } else {
            refs.forEach((r, i) => {
                msg += `${i+1}. 用户 ${maskRefCode(r.ref_code)} (${new Date(r.created_at).toLocaleDateString()})\n`;
            });
        }
        await ctx.reply(msg, { parse_mode: 'HTML' });
    } catch (e) {
        ctx.reply('⚠️ 查询失败');
    }
});

bot.command('refer', async (ctx) => {
    try {
        const user = await ensureTelegramUser(ctx.from.id);
        const link = `http://qingwa.onrender.com/?ref=${user.ref_code}`; // 使用 Render 中转链接
        await ctx.reply(
            `📢 <b>您的专属推广链接</b>\n` +
            `${link}\n\n` +
            `转发给好友，TA购买或升级，您均可获得 GAS 奖励！`,
            { parse_mode: 'HTML' }
        );
    } catch (e) {
        ctx.reply('⚠️ Error');
    }
});

bot.on('text', async (ctx) => {
  const text = ctx.message.text.trim();
  
  // 识别 TXID
  if (/^[a-f0-9]{64}$/i.test(text)) {
      if (txCache.has(text)) return ctx.reply('⏳ 正在核验中...');
      txCache.set(text, true);
      
      const msg = await ctx.reply('🔄 正在核验...');
      const result = await verifyTransaction(text, ctx.from.id);
      
      try { await ctx.telegram.deleteMessage(ctx.chat.id, msg.message_id); } catch {}
      
      if (result.success) {
          let reply = '';
          if (result.type === 'membership') {
              reply = `🎉 <b>恭喜！会员已开通</b>\n您现在可以发送 /refer 获取推广链接赚钱了！`;
          } else {
              reply = `✅ <b>支付成功</b>\n获得 30 GAS\n报告正在生成中...`;
          }
          await ctx.reply(appendCompliance(reply), { parse_mode: 'HTML' });
      } else {
          await ctx.reply(appendCompliance(result.message || '❌ 核验失败'));
          txCache.delete(text);
      }
  }
});

// ========== HTTP Server (Health & Redirect) ==========
createServer((req, res) => {
  // 根路径重定向 (处理 ?ref=xxx)
  if (req.url === '/' || req.url.startsWith('/?')) {
      const urlObj = new URL(req.url, `http://${req.headers.host}`);
      const ref = urlObj.searchParams.get('ref');
      let target = 'https://f8618.myshopify.com';
      if (ref) target += `?ref=${ref}`; // 传递给 Shopify
      
      res.writeHead(302, { 'Location': target });
      res.end();
      return;
  }

  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', timestamp: Date.now() }));
  } else {
    res.writeHead(404);
    res.end('Not Found');
  }
}).listen(process.env.PORT || 3000);

// 启动
bot.launch().then(() => {
  console.log('✅ Qingwa Bot Started');
  if (GHOST.enabled) console.log('👻 Ghost Mode Active');
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

export default bot;
