
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY; // Use the key that works in dashboard
const supabase = createClient(supabaseUrl, supabaseKey);

async function runTest() {
    console.log('🧪 Starting Viral Flow Test...');

    // 1. Clean up test users
    const testRefCodes = ['TEST_A', 'TEST_B'];
    for (const code of testRefCodes) {
        const { data: u } = await supabase.from('users').select('id').eq('ref_code', code).single();
        if (u) {
            await supabase.from('referrals').delete().eq('referrer_id', u.id);
            await supabase.from('referrals').delete().eq('referred_id', u.id);
            await supabase.from('gas_transactions').delete().eq('user_id', u.id);
            await supabase.from('users').delete().eq('id', u.id);
        }
    }
    console.log('🧹 Cleanup complete');

    // 2. Create User A (Admin activates A)
    // Simulate Admin Dashboard: Create user A
    const { data: userA, error: errA } = await supabase.from('users').insert({
        telegram_id: 'TEST_ID_A',
        ref_code: 'TEST_A',
        is_member: true,
        member_activated_at: new Date(),
        gas_balance: 0
    }).select().single();
    
    if (errA) throw errA;
    console.log('✅ User A created (Member):', userA.ref_code);

    // 3. User B joins via A
    // Simulate Bot: ensureTelegramUser with parentRefCode
    const { data: userB, error: errB } = await supabase.from('users').insert({
        telegram_id: 'TEST_ID_B',
        ref_code: 'TEST_B',
        parent_ref_code: 'TEST_A',
        gas_balance: 0
    }).select().single();

    if (errB) throw errB;
    
    // Record referral relation (Bot does this)
    await supabase.from('referrals').insert({
        referrer_id: userA.id,
        referred_id: userB.id,
        ref_code: 'TEST_A'
    });
    console.log('✅ User B joined via A:', userB.ref_code);

    // 4. Admin activates B -> A gets 90 GAS
    // Simulate Admin Dashboard Logic
    console.log('🔄 Admin activating B...');
    
    // a. Update B
    await supabase.from('users').update({ 
        is_member: true, 
        member_activated_at: new Date() 
    }).eq('id', userB.id);

    // b. Reward A (90 GAS)
    const { data: parentA } = await supabase.from('users').select('gas_balance').eq('id', userA.id).single();
    const newBalanceA = (parentA.gas_balance || 0) + 90;
    
    await supabase.from('users').update({ gas_balance: newBalanceA }).eq('id', userA.id);
    
    // c. Log transaction
    await supabase.from('gas_transactions').insert({
        user_id: userA.id,
        amount: 90,
        balance_after: newBalanceA,
        transaction_type: 'referral_reward',
        description: `Referral Reward for ${userB.ref_code}`
    });

    console.log(`✅ User A rewarded. New Balance: ${newBalanceA}`);

    // 5. Verify A's balance
    if (newBalanceA !== 90) throw new Error(`Expected 90 GAS, got ${newBalanceA}`);

    // 6. User A activates C (Ghost) -> Costs 88 GAS
    // Simulate Bot /activate command
    console.log('🔄 User A activating Sub-User C...');
    
    if (newBalanceA >= 90) {
        // Deduct 88
        const finalBalanceA = newBalanceA - 88;
        await supabase.from('users').update({ gas_balance: finalBalanceA }).eq('id', userA.id);
        
        await supabase.from('gas_transactions').insert({
            user_id: userA.id,
            amount: -88,
            balance_after: finalBalanceA,
            transaction_type: 'activate_sub_user',
            description: 'Activate Sub User'
        });

        // Create C
        const refCodeC = 'TEST_C_' + Math.random().toString(36).slice(2, 6);
        const { data: userC } = await supabase.from('users').insert({
            telegram_id: `GHOST_${refCodeC}`,
            ref_code: refCodeC,
            parent_ref_code: 'TEST_A',
            is_member: true,
            member_activated_at: new Date(),
            gas_balance: 0
        }).select().single();

        console.log(`✅ Sub-User C created: ${refCodeC} (Ghost)`);
        console.log(`✅ User A Final Balance: ${finalBalanceA}`);

        if (finalBalanceA !== 2) throw new Error(`Expected 2 GAS, got ${finalBalanceA}`);
    } else {
        throw new Error('User A has insufficient balance');
    }

    console.log('🎉 Viral Flow Test Passed!');
}

runTest().catch(e => {
    console.error('❌ Test Failed:', e);
    process.exit(1);
});
