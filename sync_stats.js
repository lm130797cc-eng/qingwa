import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load env vars
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const CONFIG = {
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseKey: process.env.SUPABASE_KEY,
    outputPath: path.resolve(__dirname, '../02_FRONTEND/dashboard_data.json'),
    interval: 60 * 1000 // 60 seconds
};

if (!CONFIG.supabaseUrl || !CONFIG.supabaseKey) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_KEY');
    process.exit(1);
}

const supabase = createClient(CONFIG.supabaseUrl, CONFIG.supabaseKey);

async function syncStats() {
    try {
        console.log(`[${new Date().toISOString()}] 🔄 Starting sync...`);

        // 1. Overview Stats
        const { count: totalUsers, error: errUsers } = await supabase
            .from('users')
            .select('*', { count: 'exact', head: true });
        
        // Revenue: Sum of orders (paid) + donation_records (confirmed)
        // Note: Supabase JS doesn't support sum() directly easily without RPC.
        // We fetch and sum in JS for simplicity (assuming volume isn't huge yet).
        // For production with millions of rows, use RPC or specific query.
        
        const { data: orders, error: errOrders } = await supabase
            .from('orders')
            .select('service_price')
            .eq('payment_status', 'paid');
            
        const { data: donations, error: errDonations } = await supabase
            .from('donation_records')
            .select('amount, currency') // currency usually USDT
            .eq('status', 'confirmed');

        let totalRevenueCNY = 0;
        
        if (orders) {
            totalRevenueCNY += orders.reduce((sum, o) => sum + (Number(o.service_price) || 0), 0);
        }
        
        // Convert USDT donations to CNY (approx rate 7.2)
        if (donations) {
            const usdtToCny = 7.2;
            totalRevenueCNY += donations.reduce((sum, d) => sum + ((Number(d.amount) || 0) * usdtToCny), 0);
        }

        // 2. Element Distribution
        let { data: aiLogs, error: errAi } = await supabase
            .from('ai_logs')
            .select('missing_element');
        
        // Fallback for missing table
        if (errAi && (errAi.code === '42P01' || errAi.message.includes('Could not find'))) {
             aiLogs = []; 
             errAi = null;
        }

        const elementsCount = { '金': 0, '木': 0, '水': 0, '火': 0, '土': 0 };
        if (aiLogs) {
            aiLogs.forEach(log => {
                if (elementsCount[log.missing_element] !== undefined) {
                    elementsCount[log.missing_element]++;
                }
            });
        }
        
        const elementsData = Object.keys(elementsCount).map(k => ({
            label: k,
            value: elementsCount[k]
        }));

        // 3. User Growth (Last 24h)
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { data: newUsers, error: errNewUsers } = await supabase
            .from('users')
            .select('created_at')
            .gte('created_at', yesterday);
            
        const growthData = [];
        if (newUsers) {
            // Group by hour
            const hourly = {};
            newUsers.forEach(u => {
                const h = new Date(u.created_at).getHours();
                hourly[h] = (hourly[h] || 0) + 1;
            });
            
            // Format for chart (0-23h sorted)
            for (let i = 0; i < 24; i++) {
                growthData.push({ 
                    hour: i, 
                    count: hourly[i] || 0 
                });
            }
        }

        // 4. Recent Orders (Mix of orders and donations for "feed")
        // We'll fetch last 10 of each and merge/sort
        const { data: recentOrders } = await supabase
            .from('orders')
            .select('created_at, service_type, service_price, users(ref_code, country_code)')
            .order('created_at', { ascending: false })
            .limit(10);
            
        const { data: recentDonations } = await supabase
            .from('donation_records')
            .select('created_at, amount, currency, geo_location, users(ref_code)')
            .order('created_at', { ascending: false })
            .limit(10);

        let feed = [];
        if (recentOrders) {
            feed = feed.concat(recentOrders.map(o => ({
                time: new Date(o.created_at).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }),
                username: o.users?.ref_code || 'Anonymous',
                package_type: o.service_type,
                amount: `¥${o.service_price}`,
                timestamp: new Date(o.created_at).getTime()
            })));
        }
        if (recentDonations) {
            feed = feed.concat(recentDonations.map(d => ({
                time: new Date(d.created_at).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }),
                username: d.users?.ref_code || 'Supporter',
                package_type: '捐赠 (' + (d.geo_location || 'Global') + ')',
                amount: `${d.amount} ${d.currency}`,
                timestamp: new Date(d.created_at).getTime()
            })));
        }
        
        // Sort by timestamp desc and take top 10
        feed.sort((a, b) => b.timestamp - a.timestamp);
        feed = feed.slice(0, 10);

        // 5. Geo Distribution (Enhanced with Flags)
        // Use users.country_code or donation_records.geo_location
        const { data: geoUsers } = await supabase
            .from('users')
            .select('country_code');
            
        const geoMap = {};
        if (geoUsers) {
            geoUsers.forEach(u => {
                // 00 = meaningless/unknown
                const c = u.country_code || '00';
                geoMap[c] = (geoMap[c] || 0) + 1;
            });
        }
        
        // Flag Mapping
        const flagMap = {
            'CN': '🇨🇳', 'SG': '🇸🇬', 'MY': '🇲🇾', 'US': '🇺🇸', 'TW': '🇹🇼',
            'HK': '🇭🇰', 'JP': '🇯🇵', 'KR': '🇰🇷', 'AU': '🇦🇺', 'CA': '🇨🇦',
            'GB': '🇬🇧', 'FR': '🇫🇷', 'DE': '🇩🇪', '00': '🏳️'
        };

        // Convert to list sorted by count
        const geoList = Object.entries(geoMap)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([code, count]) => ({
                n: code,
                c: count,
                f: flagMap[code] || '🏳️', // Fallback flag
                percentage: totalUsers ? Math.round((count / totalUsers) * 100) + '%' : '0%'
            }));


        // Construct Final JSON
        const dashboardData = {
            last_updated: new Date().toLocaleString(),
            overview: {
                users: totalUsers || 0,
                revenue: totalRevenueCNY.toFixed(2),
                online: Math.floor(Math.random() * 50) + 50, // Mock online users 50-100
                ai_calls: (totalUsers || 0) * 3 // Estimate
            },
            elements: elementsData,
            growth: growthData,
            orders: feed,
            geo: geoList
        };

        // Write to file
        fs.writeFileSync(CONFIG.outputPath, JSON.stringify(dashboardData, null, 4), 'utf8');
        console.log(`✅ Synced to ${CONFIG.outputPath}`);

    } catch (error) {
        console.error('❌ Sync failed:', error.message);
    }
}

// Start Loop
console.log(`🚀 Starting Sync Service (Interval: ${CONFIG.interval}ms)`);
syncStats(); // Run once immediately
setInterval(syncStats, CONFIG.interval);
