
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const REFERRAL_BASE_URL = process.env.REFERRAL_BASE_URL || 'https://qingwa.onrender.com';

/**
 * Generate a unique referral code for a user
 * @param {string} userId - The user's ID (e.g., Telegram ID or email)
 * @returns {Promise<string>} - The full referral link
 */
export async function generateReferralLink(userId) {
  // 1. Check if user already has a ref code
  const { data: existingUser } = await supabase
    .from('users')
    .select('ref_code')
    .eq('telegram_id', userId.toString()) // Assuming Telegram ID for now
    .single();

  if (existingUser?.ref_code) {
    return `${REFERRAL_BASE_URL}/?ref=${existingUser.ref_code}`;
  }

  // 2. Generate new code: REF_XXXXXXXX
  const randomSuffix = crypto.randomBytes(4).toString('hex').toUpperCase();
  const refCode = `REF_${randomSuffix}`;

  // 3. Store in database
  // Note: This assumes the user record might need to be created or updated
  const { error } = await supabase
    .from('users')
    .upsert({ 
      telegram_id: userId.toString(),
      ref_code: refCode,
      updated_at: new Date().toISOString()
    }, { onConflict: 'telegram_id' });

  if (error) {
    console.error('Error generating referral code:', error);
    throw new Error('Failed to generate referral link');
  }

  return `${REFERRAL_BASE_URL}/?ref=${refCode}`;
}

// Example usage if run directly
if (process.argv[1] === import.meta.url) {
  const testId = process.argv[2] || 'test_user_123';
  generateReferralLink(testId).then(link => console.log('Generated Link:', link));
}
