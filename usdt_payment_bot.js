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
  referralReward: 90, // 推荐奖励 90 GAS
  landingUrl: process.env.LANDING_URL || 'https://mayidao-h5.vercel.app',
  
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

    // 2. 推荐奖励已移至 processOrderWithReferral 统一处理 (支持3级分销)
}

// ========== 推荐奖励逻辑 ==========

// 获取用户 (by RefCode)
async function getUserByRefCode(refCode) {
    const { data, error } = await supabase.from('users').select('*').eq('ref_code', refCode).single();
    return data;
}

// 验证奖励资格 (防刷)
async function validateReferralReward(orderId, userId, amount) {
    // 1. 同一订单不可重复奖励
    const { count } = await supabase
        .from('gas_transactions')
        .select('*', { count: 'exact', head: true })
        .eq('description', `Referral Reward L1 from order ${orderId}`); // 简单查重

    if (count > 0) return false;

    // 2. 最低订单金额限制 (默认 $10)
    // const { data: config } = await supabase.from('referral_config').select('min_order_amount').limit(1).single();
    // const minAmount = config?.min_order_amount || 10;
    const minAmount = 10; // 硬编码兜底，减少数据库查询
    if (amount < minAmount) return false;

    // 3. 同一用户24小时内最多奖励5次
    const { count: recentCount } = await supabase
        .from('gas_transactions')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('transaction_type', 'referral_reward')
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    return (recentCount || 0) < 5;
}

// === 3 层推荐奖励分发 ===
async function distributeReferralRewards(orderId, userId, orderAmount) {
    // 防刷校验 (保留原有逻辑)
    if (!await validateReferralReward(orderId, userId, orderAmount)) {
        console.log(`⚠️ Referral reward skipped for order ${orderId} (Validation failed)`);
        return null;
    }

    try {
        const { data: rewards, error } = await supabase.rpc('distribute_referral_rewards', {
            p_order_id: orderId,
            p_user_id: userId,
            p_order_amount: orderAmount
        });
        
        if (error) {
            console.error('❌ Reward distribution failed:', error);
            return null;
        }
        
        // 发送 Telegram 通知给各层级推荐人
        if (rewards && rewards.length > 0) {
            for (const reward of rewards) {
                const refUser = await getUserByRefCode(reward.recipient_ref_code);
                if (refUser?.telegram_id) {
                    await bot.telegram.sendMessage(
                        refUser.telegram_id,
                        `🎉 推荐奖励到账！\n\n` +
                        `📊 层级：L${reward.level}\n` +
                        `💰 金额：${reward.reward_amount} GAS\n` +
                        `📦 订单：${orderId}\n\n` +
                        `继续推广赚取更多积分！\n` +
                        `发送 /refer 获取您的专属链接`
                    ).catch(e => console.error(`Failed to notify user ${refUser.telegram_id}`, e));
                }
            }
            console.log('✅ Rewards distributed:', rewards);
        }
        
        return rewards;
    } catch (err) {
        console.error('❌ Reward distribution error:', err);
        return null;
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
        // 会员依然触发推荐奖励
        await distributeReferralRewards(txid, user.id, amount);
    } else {
        // 支付成功 → 创建订单 → 触发奖励分发
        const orderId = crypto.randomUUID();
        
        // 创建订单记录
        await supabase.from('orders').insert({
            id: orderId,
            user_id: user.id,
            service_type: 'AI Naming Report',
            service_price: amount,
            payment_method: 'USDT',
            payment_status: 'paid',
            report_status: 'pending'
        });

        const gasAmount = CONFIG.donationGasBonus; // +30 GAS
        await creditGas(user.id, gasAmount, 'purchase_reward', `Buy Report (${txid.slice(0,6)})`);
        
        // 🐸 触发 3 层推荐奖励
        await distributeReferralRewards(orderId, user.id, amount);
        
        // 触发报告生成
        if (CONFIG.reportWebhook) {
             await fetch(CONFIG.reportWebhook, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ event: 'payment_confirmed', user_id: user.id, order_id: `TX-${txid.slice(0,8)}` })
            }).catch(e => console.error('Webhook fail', e));
        }

        // 发送成功通知给用户
        await bot.telegram.sendMessage(
            user.telegram_id,
            `✅ 支付成功！\n\n` +
            `订单：${orderId}\n` +
            `金额：$${amount}\n` +
            `报告生成中...\n\n` +
            `如有推荐人，他们已获得 GAS 奖励！`
        );
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

// 创建子用户 (Ghost)
async function createSubUser(parentRefCode, newRefCode) {
    const { data: parent } = await supabase.from('users').select('id').eq('ref_code', parentRefCode).single();
    if (!parent) return;

    // 创建新用户 (Ghost)
    const { data: newUser, error } = await supabase.from('users').insert({
        telegram_id: `GHOST_${newRefCode}`, // 占位符，后续可通过 /claim 绑定
        ref_code: newRefCode,
        parent_ref_code: parentRefCode,
        gas_balance: 0,
        is_member: true,
        member_activated_at: new Date().toISOString(),
        created_at: new Date().toISOString()
    }).select().single();

    if (error) throw error;

    // 记录推荐关系
    await supabase.from('referrals').insert({
        referrer_id: parent.id,
        referred_id: newUser.id,
        ref_code: parentRefCode
    });

    return newUser;
}

// ========== 命令处理 ==========

bot.command('activate', async (ctx) => {
    try {
        const user = await ensureTelegramUser(ctx.from.id);
        
        // 检查积分 (90 GAS 门槛，实际扣除 88 GAS)
        // 用户提示说 "检查积分是否>=90"，然后 "扣除88积分"
        if ((user.gas_balance || 0) >= 90) {
            const newRefCode = generateRefCode();
            
            // 扣除 88 GAS
            await creditGas(user.id, -88, 'activate_sub_user', `Activate Sub User: ${newRefCode}`);
            
            // 创建子用户
            await createSubUser(user.ref_code, newRefCode);
            
          await ctx.reply(
                `✅ <b>新会员开通成功！</b>\n\n` +
                `推荐码: <code>${newRefCode}</code>\n` +
            `推广链接: ${CONFIG.landingUrl}?ref=${newRefCode}\n\n` +
                `已扣除 88 GAS，剩余: ${(user.gas_balance || 0) - 88}`,
                { parse_mode: 'HTML', disable_web_page_preview: true }
            );
        } else {
            await ctx.reply(`❌ 积分不足\n当前: ${user.gas_balance || 0} GAS\n需要: 90 GAS`);
        }
    } catch (e) {
        console.error('Activate error:', e);
        ctx.reply('⚠️ 系统错误');
    }
});

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
      `✨ 我们的服务:\n` +
      `• AI 个人命名报告 $12\n` +
      `• AI 企业命名方案 $40\n` +
      `• 青蛙机器人会员 $12\n\n` +
      `🎁 推荐奖励计划:\n` +
      `• 推广 1 个 → 30% GAS\n` +
      `• 推广 2 个 → 5% GAS\n` +
      `• 推广 3 个 → 3% GAS\n` +
      `• 推广 3 个即可回本!\n\n` +
      `发送 /refer 获取您的专属链接`
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
        `✅ 推荐1人返 90 GAS\n` +
        `✅ 88 GAS 可开通子账号\n\n` +
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
            `专属链接: ${CONFIG.landingUrl}?ref=${user.ref_code}`,
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
        const link = `${CONFIG.landingUrl}?ref=${user.ref_code}`;
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
  if (req.url === '/health' || req.url.startsWith('/health?')) {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({ status: 'ok', timestamp: Date.now() }));
    return;
  }

  // 根路径：捕获 ref 并写入 localStorage，再跳转到 landingUrl
  if (req.url === '/' || req.url.startsWith('/?')) {
    const urlObj = new URL(req.url, `http://${req.headers.host}`);
    const ref = urlObj.searchParams.get('ref') || '';
    const landingBase = CONFIG.landingUrl;

    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(`<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Qingwa Redirect</title>
  </head>
  <body style="font-family:system-ui,Segoe UI,Roboto,sans-serif;padding:24px;">
    <div style="max-width:520px;margin:0 auto;">
      <h2 style="margin:0 0 8px;">正在跳转…</h2>
      <p style="margin:0 0 16px;color:#666;">若 3 秒未跳转，请点击下方按钮。</p>
      <p><a id="go" href="#" style="display:inline-block;padding:10px 14px;background:#111827;color:#fff;text-decoration:none;border-radius:8px;">继续</a></p>
    </div>
    <script>
      (function () {
        var params = new URLSearchParams(window.location.search);
        var ref = params.get('ref');
        if (ref) {
          try { localStorage.setItem('ant_ref', ref); } catch (e) {}
        }

        var landing = '${landingBase}'.replace(/\\/+$/, '');
        var target = landing;
        if (ref) {
          target += (landing.indexOf('?') >= 0 ? '&' : '?') + 'ref=' + encodeURIComponent(ref);
        }

        var btn = document.getElementById('go');
        if (btn) btn.href = target;
        setTimeout(function () { window.location.replace(target); }, 300);
      })();
    </script>
  </body>
</html>`);
    return;
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
