
import { checkFraud } from './fraud_detection.js';

// Mock Supabase Client
const mockSupabase = (mockCount) => {
    return {
        from: (table) => {
            return {
                select: (columns, options) => {
                    return {
                        eq: (field, value) => {
                            return {
                                gte: (field, value) => {
                                    // Return the mock count
                                    return { count: mockCount, error: null };
                                }
                            };
                        }
                    };
                }
            };
        }
    };
};

async function runTest() {
    console.log('🚀 Starting Fraud Detection Logic Test (Mock DB)...');
    
    const testUserId = 'user-123';
    
    // 1. Test High Value ($101) with Low Frequency (0)
    console.log('\n🧪 Test 1: High Value Order ($101)');
    let result = await checkFraud({ userId: testUserId, amount: 101 }, mockSupabase(0));
    console.log('Result:', result.status, result.reasons);
    
    // Adjusted expectation: If amount > 100, score += 50 (to ensure flag)
    // Currently code adds 40. I need to update fraud_detection.js to make it >= 50 or lower threshold.
    // For now, let's see if it flags.
    if (result.status === 'FLAGGED') {
        console.log('✅ Passed High Value Check');
    } else {
        console.log('❌ Failed High Value Check (Score too low?)');
    }

    // 2. Test High Frequency (5 txs) with Low Value ($10)
    console.log('\n🧪 Test 2: High Frequency (5 txs in 24h)');
    result = await checkFraud({ userId: testUserId, amount: 10 }, mockSupabase(5));
    console.log('Result:', result.status, result.reasons);
    
    if (result.status === 'FLAGGED' && result.reasons.some(r => r.includes('Frequency'))) {
        console.log('✅ Passed Frequency Check');
    } else {
        console.error('❌ Failed Frequency Check');
    }
    
    // 3. Test Normal Transaction
    console.log('\n🧪 Test 3: Normal Transaction');
    result = await checkFraud({ userId: testUserId, amount: 10 }, mockSupabase(0));
    console.log('Result:', result.status);
    
    if (result.status === 'APPROVED') {
        console.log('✅ Passed Normal Check');
    } else {
        console.error('❌ Failed Normal Check');
    }
}

runTest();
