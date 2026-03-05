const axios = require('axios');
const config = require('./config.cjs');

async function sendAlert(level, message) {
  const timestamp = new Date().toLocaleString();
  const icon = level === 'CRITICAL' ? '🔴' : (level === 'WARNING' ? '🟡' : '🔵');
  const text = `${icon} [FuwaGuardian] ${level}\nTime: ${timestamp}\n\n${message}`;
  
  console.log(`[Alert System] Sending ${level} alert via Telegram...`);
  
  if (config.alert.telegramBotToken && config.alert.adminChatId) {
      try {
          const url = `https://api.telegram.org/bot${config.alert.telegramBotToken}/sendMessage`;
          await axios.post(url, {
              chat_id: config.alert.adminChatId,
              text: text
          });
          console.log(`✅ Alert sent to Telegram.`);
      } catch (error) {
          console.error(`❌ Failed to send Telegram alert: ${error.message}`);
      }
  } else {
      console.warn(`⚠️ Telegram config missing (Token or ChatID). Logged only.`);
  }
}

module.exports = sendAlert;