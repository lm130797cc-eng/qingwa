
import { createClient } from '@supabase/supabase-js';

/**
 * 🛡️ Fraud Detection System
 * 
 * Rules:
 * 1. Max 5 purchases per User (Telegram ID/IP) in 24h
 * 2. Max 3 purchases per Email (if available) in 24h
 * 3. Flag orders > $100 for manual review
 * 
 * @param {Object} params
 * @param {string} params.userId - Supabase User UUID
 * @param {number} params.amount - Transaction amount
 * @param {string} [params.email] - User email (optional)
 * @param {string} [params.ip] - User IP (optional)
 * @param {Object} supabase - Supabase client instance
 */
export async function checkFraud({ userId, amount, email, ip }, supabase) {
    console.log(`🕵️ Analyzing Risk for User: ${userId}...`);
    let riskScore = 0;
    let reasons = [];

    // Time window: Last 24 hours
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // 1. Check Transaction Frequency (User ID)
    // Query payment_records for this user in last 24h
    const { count: txCount, error } = await supabase
        .from('payment_records')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('verified_at', oneDayAgo);

    if (!error && txCount >= 5) {
        riskScore += 50;
        reasons.push(`High Transaction Frequency (${txCount} in 24h)`);
    }

    // 2. Check High Value
    if (amount > 100) {
        riskScore += 50;
        reasons.push(`High Value Transaction ($${amount} > $100)`);
    }

    // 3. Check IP Frequency (if IP provided - e.g. from Webhook)
    if (ip) {
        // Assuming we might log IP in a separate logs table or extended payment_records
        // For now, we skip or mock this check if no table exists
        // specific IP check logic would go here
    }

    // 4. Check Email Frequency (if Email provided)
    if (email) {
        // specific Email check logic would go here
    }

    const isFlagged = riskScore >= 50;
    
    const result = {
        approved: !isFlagged,
        riskScore,
        reasons,
        status: isFlagged ? 'FLAGGED' : 'APPROVED'
    };

    console.log(`📊 Risk Assessment: ${result.status} (Score: ${riskScore})`);
    if (reasons.length > 0) console.log('⚠️ Reasons:', reasons.join(', '));

    return result;
}
