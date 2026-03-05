// Simulate DB check using Supabase client from project root
// We need to require the supabase client setup
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../.env' }); // Load env from parent

// Mocking the client if env is missing for simulation
const supabaseUrl = process.env.SUPABASE_URL || 'https://mock.supabase.co';
const supabaseKey = process.env.SUPABASE_KEY || 'mock-key';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDatabase() {
  console.log(`[FuwaGuardian] Checking Database Integrity...`);
  
  const checkPromise = (async () => {
    try {
      // 1. Check Members
      const { count: memberCount, error: memberError } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true });
        
      if (memberError) throw memberError;
      console.log(`✅ Member Count: ${memberCount}`);

      // 2. Check Referrals
      const { count: referralCount, error: refError } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .not('referrer_id', 'is', null);

      if (refError) throw refError;
      console.log(`✅ Active Referral Links: ${referralCount}`);
      
      return { status: 'OK', members: memberCount, referrals: referralCount };
    } catch (error) {
      throw error;
    }
  })();

  const timeoutPromise = new Promise((_, reject) => 
    setTimeout(() => reject(new Error('Database check timed out (10s)')), 10000)
  );

  try {
    return await Promise.race([checkPromise, timeoutPromise]);
  } catch (error) {
    console.error(`❌ Database Check Failed: ${error.message}`);
    return { status: 'CRITICAL', error: error.message };
  }
}

if (require.main === module) {
    checkDatabase().then(console.log).catch(console.error);
}

module.exports = checkDatabase;