const config = {
  frontend: {
    url: 'https://mayidao-h5.vercel.app',
    testParams: '?ref=180user0669',
    keyword: '福娃'
  },
  backend: {
    healthUrl: 'https://qingwa.onrender.com/health',
    timeout: 30000 // Increased to 30s for Render cold start
  },
  database: {
    // Uses existing Supabase client from project root
  },
  referral: {
    levels: {
      l1: 0.30,
      l2: 0.05,
      l3: 0.03
    }
  },
  alert: {
    telegramBotToken: process.env.TELEGRAM_BOT_TOKEN, // Will load from env
    adminChatId: '180user0669' // Placeholder, will need real ID or just log
  }
};

module.exports = config;