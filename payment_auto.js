/**
 * Payment Automation Handler for AntIsland Phase 2
 * Handles USDT payments via Telegram Bot and Blockchain verification
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

// Environment variables
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const SUPABASE_URL = process.env.SUPABASE_MAYIDAO_URL;
const SUPABASE_KEY = process.env.SUPABASE_MAYIDAO_SERVICE_KEY; // Must use Service Role Key for backend ops
const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL; // n8n workflow trigger URL

// Initialize clients
const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  db: { schema: 'ants_mayidao' }
});

// Blockchain API Config (TRON for USDT-TRC20 is most common)
const TRONSCAN_API = 'https://apilist.tronscan.org/api/transaction-info';
const RECEIVING_WALLET = process.env.USDT_WALLET_ADDRESS;

console.log('🐜 Payment Automation Agent v2 Started...');

const lastTxidByChat = new Map();
const processedTxids = new Set();
axios.defaults.timeout = 15000;

// ==================================================================
// 1. Telegram Command Handler
// ==================================================================

// /start - Welcome message
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, 
    `👋 欢迎来到蚂蚁岛支付中心 (AntIsland PayBot)\n\n` +
    `请发送您的 **订单号** 或 **转账凭证(TXID)** 进行核销。\n` +
    `Example: /check ANT_1709123456`
  );
});

// /check [ORDER_ID] - Manual check trigger
bot.onText(/\/check (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const orderId = match[1];
  
  await checkOrderStatus(chatId, orderId);
});

bot.onText(/\/bind\s+(\S+)\s+(\S+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const orderId = match[1];
  const txid = match[2];
  if (processedTxids.has(txid)) {
    return bot.sendMessage(chatId, '⚠️ 该交易已处理');
  }
  const ok = await prevalidateAndFinalize(orderId, txid, chatId);
  if (ok) processedTxids.add(txid);
});

bot.onText(/\/bind\s+(\S+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const orderId = match[1];
  const txid = lastTxidByChat.get(chatId);
  if (!txid) return bot.sendMessage(chatId, '请先发送 TXID 再绑定订单');
  if (processedTxids.has(txid)) {
    return bot.sendMessage(chatId, '⚠️ 该交易已处理');
  }
  const ok = await prevalidateAndFinalize(orderId, txid, chatId);
  if (ok) processedTxids.add(txid);
});

// Handle text messages (Try to identify TXID or OrderID)
bot.on('message', async (msg) => {
  if (msg.text && !msg.text.startsWith('/')) {
    const text = msg.text.trim();
    // Simple heuristic: If length > 20, assume TXID; else OrderID
    if (text.length > 20) {
      await verifyTransaction(msg.chat.id, text);
    } else {
      await checkOrderStatus(msg.chat.id, text);
    }
  }
});

// ==================================================================
// 2. Core Logic Functions
// ==================================================================

/**
 * Check order status from Supabase
 */
async function checkOrderStatus(chatId, reportId) {
  try {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('report_id', reportId)
      .single();

    if (error || !data) {
      return bot.sendMessage(chatId, `❌ 未找到订单: ${reportId}\n请检查输入是否正确。`);
    }

    if (data.payment_status === 'paid') {
      return bot.sendMessage(chatId, `✅ 订单已支付！\n报告正在生成中或已发送至您的邮箱。`);
    }

    bot.sendMessage(chatId, 
      `⏳ 订单 ${reportId} 待支付\n` +
      `金额: ${data.service_price} USDT\n` +
      `请转账至: \`${RECEIVING_WALLET}\`\n` +
      `转账后，请直接回复 TXID (交易哈希) 进行自动确认。`,
      { parse_mode: 'Markdown' }
    );

  } catch (err) {
    console.error('Error checking order:', err);
    bot.sendMessage(chatId, '⚠️ 系统繁忙，请稍后再试。');
  }
}

/**
 * Verify USDT Transaction on Blockchain
 */
async function verifyTransaction(chatId, txid) {
  bot.sendMessage(chatId, '🔍 正在区块链上查询交易，请稍候...');

  try {
    // Check if TXID already used
    const { data: existing } = await supabase
      .from('orders')
      .select('report_id')
      .eq('payment_proof', txid)
      .single();

    if (existing) {
      return bot.sendMessage(chatId, `⚠️ 该交易凭证已被使用于订单: ${existing.report_id}`);
    }

    const response = await axios.get(TRONSCAN_API, { params: { hash: txid } });
    const txData = response.data;

    if (!txData || !txData.contractData) {
      return bot.sendMessage(chatId, '❌ 未在链上找到该交易，请确认 TXID 正确（通常需等待1-2分钟上链）。');
    }

    const toAddress = (txData.contractData.to_address || '').toString().toLowerCase();
    const amountRaw = txData.contractData.amount;
    const tokenInfo = txData.contractData.tokenInfo;
    const confirmations = txData.confirmations || (txData.confirmed ? 20 : 0);
    const isValidUSDT = tokenInfo && (tokenInfo.tokenAbbr === 'USDT' || tokenInfo.tokenName === 'Tether USD');
    const toMatch = RECEIVING_WALLET ? RECEIVING_WALLET.toLowerCase() : '';

    if (confirmations >= 20 && isValidUSDT && (!toMatch || toAddress === toMatch)) {
      // Find pending order with matching price (Simple matching, in prod use Memo/Note)
      // Here we ask user to link if not specified
      lastTxidByChat.set(chatId, txid);
      bot.sendMessage(chatId, '✅ 交易验证成功！\n请使用 /bind 订单号 或 /bind 订单号 TXID 完成绑定。');
    } else {
      bot.sendMessage(chatId, '⚠️ 交易尚未确认或非USDT转账。');
    }

  } catch (err) {
    console.error('Blockchain verification error:', err);
    bot.sendMessage(chatId, '⚠️ 无法连接区块链节点，请联系管理员人工核实。');
  }
}

/**
 * Finalize Order & Trigger n8n
 * Call this when TXID + OrderID are matched
 */
async function finalizeOrder(orderId, txid, amount) {
  const { data: order, error: selErr } = await supabase
    .from('orders')
    .select('*')
    .eq('report_id', orderId)
    .single();
  if (selErr || !order) {
    return false;
  }
  const expected = Number(order.service_price || 0);
  if (expected > 0 && amount && Number(amount) < expected * 0.99) {
    return false;
  }
  const { data, error } = await supabase
    .from('orders')
    .update({
      payment_status: 'paid',
      payment_proof: txid,
      payment_method: 'usdt_telegram',
      updated_at: new Date()
    })
    .eq('report_id', orderId)
    .select()
    .single();

  if (error) {
    console.error('DB Update Failed:', error);
    return false;
  }

  // 2. Trigger n8n Workflow
  try {
    await axios.post(N8N_WEBHOOK_URL, {
      order_id: orderId,
      user_id: data.user_id,
      service_type: data.service_type,
      amount: amount || expected
    });
    console.log(`🚀 Triggered n8n for order ${orderId}`);
    return true;
  } catch (webhookErr) {
    console.error('n8n Trigger Failed:', webhookErr);
    // Logic to retry or log for manual intervention
    return false;
  }
}

async function prevalidateAndFinalize(orderId, txid, chatId) {
  try {
    const response = await axios.get(TRONSCAN_API, { params: { hash: txid } });
    const txData = response.data;
    if (!txData || !txData.contractData) return false;
    const confirmations = txData.confirmations || (txData.confirmed ? 20 : 0);
    const toAddress = (txData.contractData.to_address || '').toString().toLowerCase();
    const tokenInfo = txData.contractData.tokenInfo;
    const isValidUSDT = tokenInfo && (tokenInfo.tokenAbbr === 'USDT' || tokenInfo.tokenName === 'Tether USD');
    const toMatch = RECEIVING_WALLET ? RECEIVING_WALLET.toLowerCase() : '';
    if (!(confirmations >= 20 && isValidUSDT && (!toMatch || toAddress === toMatch))) {
      bot.sendMessage(chatId, '校验失败：未达到确认数或非USDT或地址不匹配');
      return false;
    }
    const amountRaw = txData.contractData.amount;
    const ok = await finalizeOrder(orderId, txid, amountRaw);
    if (ok) {
      bot.sendMessage(chatId, '支付已确认，正在生成报告');
      return true;
    }
    bot.sendMessage(chatId, '处理失败，请转人工核对');
    return false;
  } catch (e) {
    bot.sendMessage(chatId, '区块链校验失败，请稍后重试');
    return false;
  }
}

// Keep-alive for deployment platforms
const http = require('http');
http.createServer((req, res) => res.end('AntIsland Payment Bot Alive')).listen(process.env.PORT || 3000);
