// 蚂蚁岛前端配置 - 商业闭环版
// 生成时间：2024年 | 版本：2.0 (积分内循环)

window.MAYIDAO_CONFIG = {
  // Supabase 数据库连接
  supabase: {
    url: 'https://unjpgieetbrtelcafykl.supabase.co',
    anonKey: 'sb_publishable_o6SafjUzgegDHy2z_0-HKg_gtoFOQEh'
  },
  
  // 💰 价格体系（人民币 + USDT 双标）
  prices: {
    personal: {
      cny: 88,      // 个人命名：88元
      usdt: 12,     // ≈12 USDT
      reward: {
        cny: 26,    // 推荐奖励：26元
        usdt: 3.6   // ≈3.6 USDT
      }
    },
    enterprise: {
      cny: 288,     // 企业命名：288元
      usdt: 40,     // ≈40 USDT
      reward: {
        cny: 86,    // 推荐奖励：≈30%
        usdt: 12    // ≈12 USDT
      }
    }
  },
  
  // 🔄 积分内循环机制（关键！）
  gas: {
    registerBonus: 30,        // 注册赠送 30 GAS
    purchaseRewardRate: 0.30, // 消费返佣 30%
    
    // GAS 积分只能站内消费（不可提现）
    usage: {
      discount_report: { cost: 50, desc: '抵扣 1 次基础报告' },
      unlock_premium: { cost: 100, desc: '解锁高级五行分析' },
      extend_link: { cost: 20, desc: '报告链接延期 24 小时' },
      priority_gen: { cost: 30, desc: '优先生成队列' }
    },
    
    // 积分过期策略（促进消费）
    expire: {
      enable: true,
      days: 90,  // 90 天未使用自动过期 10%
      notify: true
    }
  },
  
  // Telegram Bot 配置
  telegram: {
    botUsername: 'qingwa_go_bot',
    paymentChannel: '@AntIslandPay'
  },
  
  // 系统设置
  settings: {
    debug: false,
    reportExpireHours: 24,
    maxRefDepth: 3 // 推荐链最多 3 级
  },
  
  version: '2.0',
  buildDate: new Date().toISOString()
};

// 初始化 Supabase 客户端（保持不变）
window.initSupabase = function() {
  if (!window.supabase) {
    console.error('❌ Supabase SDK 未加载');
    return null;
  }
  const config = window.MAYIDAO_CONFIG;
  return window.supabase.createClient(config.supabase.url, config.supabase.anonKey);
};

// 快捷函数：计算推荐奖励
window.calculateReward = function(serviceType) {
  const prices = window.MAYIDAO_CONFIG.prices;
  return prices[serviceType]?.reward?.cny || 0;
};

// 快捷函数：GAS 积分是否足够
window.canUseGas = function(userBalance, usageKey) {
  const cost = window.MAYIDAO_CONFIG.gas.usage[usageKey]?.cost || 0;
  return userBalance >= cost;
};

window.checkIslandAccess = window.checkIslandAccess || function() {
  const islandMember = localStorage.getItem('island_member');
  const donationStatus = localStorage.getItem('donation_status');

  if (islandMember !== 'true' || donationStatus !== 'completed') {
    if (!window.location.href.includes('donate.html')) {
      const redirect = window.location.pathname + window.location.search;
      window.location.href = 'donate.html?redirect=' + encodeURIComponent(redirect);
    }
    return false;
  }
  return true;
};

// 页面加载自动初始化
window.addEventListener('DOMContentLoaded', function() {
  console.log('🐜 蚂蚁岛 v2.0 启动 | 积分内循环模式');
  window.initSupabase();
});
