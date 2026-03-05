// Main entry point for FuwaGuardian
const checkFrontend = require('./monitor_frontend.cjs');
const checkBackend = require('./monitor_backend.cjs');
const checkDatabase = require('./monitor_database.cjs');
const checkReferrals = require('./monitor_referrals.cjs');
const sendAlert = require('./alert_system.cjs');
const fixFrontend = require('./fix_frontend.cjs');

async function runGuardian() {
  console.log(`
┌─────────────────────────────────────────────────────┐
│            福娃AI取名联盟 · 全链路监控系统            │
├─────────────────────────────────────────────────────┤
│  启动时间: ${new Date().toLocaleString()}               │
└─────────────────────────────────────────────────────┘
  `);

  const results = {};

  console.log('[FuwaGuardian] Starting parallel checks...');

  const [frontend, backend, database, referrals] = await Promise.allSettled([
      checkFrontend(),
      checkBackend(),
      checkDatabase(),
      checkReferrals()
  ]);

  results.frontend = frontend.status === 'fulfilled' ? frontend.value : { status: 'CRITICAL', error: frontend.reason };
  results.backend = backend.status === 'fulfilled' ? backend.value : { status: 'CRITICAL', error: backend.reason };
  results.database = database.status === 'fulfilled' ? database.value : { status: 'CRITICAL', error: database.reason };
  results.referrals = referrals.status === 'fulfilled' ? referrals.value : { status: 'CRITICAL', error: referrals.reason };
  
  console.log('\n[FuwaGuardian] All Checks Completed.');
  
  // Summary & Alerting
  const criticals = Object.values(results).filter(r => r.status === 'CRITICAL');
  const warnings = Object.values(results).filter(r => r.status === 'WARNING');
  
  if (criticals.length > 0) {
      console.log(`🔴 SYSTEM CRITICAL: ${criticals.length} failures detected.`);
      const msg = criticals.map(c => `- ${JSON.stringify(c)}`).join('\n');
      await sendAlert('CRITICAL', `System Check Failed:\n${msg}`);
      // Auto-fix attempt for Frontend?
       if (results.frontend && results.frontend.status === 'CRITICAL') {
           console.log('[AutoFix] Attempting Frontend Fix (Copying index.html to root)...');
           await fixFrontend();
       }
   } else if (warnings.length > 0) {
      console.log(`🟡 SYSTEM WARNING: ${warnings.length} warnings detected.`);
      const msg = warnings.map(w => `- ${JSON.stringify(w)}`).join('\n');
      await sendAlert('WARNING', `System Warnings:\n${msg}`);
  } else {
      console.log(`🟢 SYSTEM HEALTHY: All systems operational.`);
      await sendAlert('INFO', `Daily System Check Passed.\nFrontend: ${results.frontend.loadTime}ms\nBackend: ${results.backend.loadTime}ms`);
  }
}

runGuardian();