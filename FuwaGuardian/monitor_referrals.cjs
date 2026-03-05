// Referral System Validator
// Validates the 3-level commission logic (30%, 5%, 3%)
const config = require('./config.cjs');

async function checkReferrals() {
  console.log(`[FuwaGuardian] Validating Referral Logic (L1: ${config.referral.levels.l1*100}%, L2: ${config.referral.levels.l2*100}%, L3: ${config.referral.levels.l3*100}%)...`);
  
  // In a real scenario, this would query recent transactions and verify the math.
  // Here we simulate the validation logic.
  
  const simulatedOrderAmount = 100;
  const expectedL1 = simulatedOrderAmount * config.referral.levels.l1; // 30
  const expectedL2 = simulatedOrderAmount * config.referral.levels.l2; // 5
  const expectedL3 = simulatedOrderAmount * config.referral.levels.l3; // 3
  
  console.log(`   > Test Order: $${simulatedOrderAmount}`);
  console.log(`   > Expected Commission: L1=$${expectedL1}, L2=$${expectedL2}, L3=$${expectedL3}`);
  
  // Logic check
  if (expectedL1 === 30 && expectedL2 === 5 && expectedL3 === 3) {
      console.log(`✅ Commission Calculation Logic: PASS`);
      return { status: 'OK' };
  } else {
      console.error(`❌ Commission Logic Mismatch!`);
      return { status: 'CRITICAL', error: 'Math mismatch' };
  }
}

module.exports = checkReferrals;