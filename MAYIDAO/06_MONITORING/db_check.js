
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || 'https://unjpgieetbrtelcafykl.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseKey) {
    console.log('❌ Supabase Key missing');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    try {
        const start = Date.now();
        const { count, error } = await supabase.from('users').select('*', { count: 'exact', head: true });
        const duration = Date.now() - start;
        
        if (error) throw error;
        
        console.log(`✅ Supabase OK | Time: ${duration}ms | Users: ${count}`);
    } catch (e) {
        console.error(`❌ Supabase Error: ${e.message}`);
        process.exit(1);
    }
}

check();
