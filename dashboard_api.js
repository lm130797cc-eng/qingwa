import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';
import geoip from 'geoip-lite';
import shopifyWebhookRouter from './shopify_webhook.js'; // Import Shopify Webhook

// Config
dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Integrate Shopify Webhook (Mount it before auth middleware if no auth required, or handle separately)
// Shopify Webhooks are authenticated via HMAC in headers, not Bearer tokens.
// Our shopify_webhook.js handles basic logic.
app.use(shopifyWebhookRouter);

// Supabase Client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Supabase URL/Key missing in .env');
  console.error('Please create .env file with SUPABASE_URL and SUPABASE_KEY');
  // process.exit(1); 
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Auth Middleware (Simple Password Check)
const authenticate = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  // Use 88888888 as the static admin token for now
  if (token === '88888888' || token === process.env.ADMIN_TOKEN) {
    next();
  } else {
    res.status(403).json({ error: '🚫 Access Denied: Invalid Token' });
  }
};

// --- Routes ---

/** 
 * Track User Location (GeoIP)
 * Can be called by frontend or bot (if IP available)
 */
async function trackUserLocation(ip, userId) {
    try {
        // 1. Handle local/test IPs
        let processedIp = ip;
        if (ip === '::1' || ip === '127.0.0.1') {
            processedIp = '202.96.128.86'; // Mock Shanghai IP for testing
        }

        // 2. Lookup Geo
        const geo = geoip.lookup(processedIp);
        
        if (geo) {
            const country = geo.country; // e.g., 'CN', 'SG'
            const region = geo.region;
            const city = geo.city;

            // 3. Update DB
            // Check if user exists first to avoid error? Or just update.
            // Assuming user_id is valid UUID.
            const { error } = await supabase
                .from('users')
                .update({ 
                    country_code: country, 
                    last_ip: processedIp, 
                    city: city 
                })
                .eq('id', userId);

            if (error) {
                 console.error(`[GeoLog] DB Update Failed for ${userId}:`, error.message);
            } else {
                 console.log(`[GeoLog] User ${userId} tracked: ${country} - ${city}`);
            }
        } else {
            console.warn(`[GeoLog] IP Lookup Failed: ${processedIp}`);
        }
    } catch (error) {
        console.error("Operation conversion cannot be achieved: 0/1", error);
    }
}

// Public endpoint for user tracking (e.g. from frontend app)
app.post('/api/user/track', async (req, res) => {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'Missing userId' });
    
    // Get IP
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    
    // Track async
    trackUserLocation(ip, userId);
    
    res.json({ success: true });
});

// 1. Overview Stats
app.get('/api/stats/overview', authenticate, async (req, res) => {
  try {
    // Total Users
    const { count: totalUsers, error: userError } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true });
    
    if (userError) throw userError;

    // Total Revenue (USDT from donation_records)
    const { data: donations, error: donationError } = await supabase
      .from('donation_records')
      .select('amount_usdt');
    
    if (donationError) throw donationError;
    const totalRevenueUSDT = donations.reduce((sum, d) => sum + (Number(d.amount_usdt) || 0), 0);
    const totalRevenueCNY = Math.round(totalRevenueUSDT * 7.2); // Approx conversion

    // Today AI Calls (Mocked or from orders)
    // Let's use orders count for today as proxy
    const todayStart = new Date();
    todayStart.setHours(0,0,0,0);
    const { count: todayOrders, error: orderError } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', todayStart.toISOString());

    if (orderError) throw orderError;

    // Online Users (Mocked)
    const onlineUsers = Math.floor(Math.random() * 50) + 50; 

    res.json({
      success: true,
      data: {
        totalUsers: totalUsers || 0,
        totalRevenue: totalRevenueCNY,
        todayAiCalls: todayOrders || 0, // Using orders as proxy for AI calls
        onlineUsers
      }
    });
  } catch (error) {
    console.error('Stats Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 2. Element Distribution
app.get('/api/stats/element-distribution', authenticate, async (req, res) => {
  try {
    // Fetch from ai_logs
    let { data: logs, error } = await supabase
      .from('ai_logs')
      .select('missing_element');
    
    // Graceful fallback for missing table
    if (error && (error.code === '42P01' || error.message.includes('Could not find the table'))) {
      console.warn('⚠️ ai_logs table missing, using mock data');
      logs = [];
      error = null;
    }

    if (error) throw error;

    // Group by element in JS
    const counts = { '金': 0, '木': 0, '水': 0, '火': 0, '土': 0 };
    if (logs && logs.length > 0) {
      logs.forEach(log => {
        const el = log.missing_element;
        if (counts[el] !== undefined) {
          counts[el]++;
        }
      });
    } else {
      // Return mock data if empty (for demo purpose)
      counts['金'] = Math.floor(Math.random() * 20) + 5;
      counts['木'] = Math.floor(Math.random() * 20) + 5;
      counts['水'] = Math.floor(Math.random() * 20) + 5;
      counts['火'] = Math.floor(Math.random() * 20) + 5;
      counts['土'] = Math.floor(Math.random() * 20) + 5;
    }

    // Format for Chart.js (labels matching the chart config)
    // Return array of objects for frontend mapping
    const elementsOrder = ['金', '木', '水', '火', '土'];
    const data = elementsOrder.map(el => ({
      element: el,
      count: counts[el] || 0
    }));
    
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 3. User Growth (Last 24h)
app.get('/api/stats/user-growth', authenticate, async (req, res) => {
  try {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: users, error } = await supabase
      .from('users')
      .select('created_at')
      .gte('created_at', yesterday);
    
    if (error) throw error;

    // Group by hour
    const hourlyCounts = {};
    users.forEach(u => {
      const hour = new Date(u.created_at).getHours();
      hourlyCounts[hour] = (hourlyCounts[hour] || 0) + 1;
    });

    // Format for Chart.js
    const labels = [];
    const counts = [];
    const currentHour = new Date().getHours();
    for (let i = 0; i <= 12; i++) { // Show 12 points (every 2 hours)
        const h = (currentHour - 24 + (i * 2) + 24) % 24;
        labels.push(`${h}h`);
        counts.push(hourlyCounts[h] || 0);
    }

    res.json({ success: true, data: { labels, counts } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 4. Recent Orders
app.get('/api/stats/recent-orders', authenticate, async (req, res) => {
  try {
    const { data: orders, error } = await supabase
      .from('orders')
      .select('created_at, service_type, service_price, payment_status, users(ref_code)')
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) throw error;

    const formatted = orders.map(o => ({
      t: new Date(o.created_at).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }),
      u: o.users?.ref_code || 'Anonymous',
      item: o.service_type,
      status: o.payment_status === 'paid' ? '已完成' : '待支付',
      amt: `¥${o.service_price}`
    }));

    res.json({ success: true, data: formatted });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 5. Geo Distribution (From donation_records)
app.get('/api/stats/geo', authenticate, async (req, res) => {
  try {
    const { data: donations, error } = await supabase
      .from('donation_records')
      .select('geo_location');
    
    if (error) throw error;

    const geoMap = {};
    donations.forEach(d => {
      const geo = d.geo_location || 'UNKNOWN';
      geoMap[geo] = (geoMap[geo] || 0) + 1;
    });

    const total = donations.length || 1;
    const sortedGeo = Object.entries(geoMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([code, count]) => ({
        n: code,
        c: Math.round((count / total) * 100) + '%',
        f: '🌍' // Simplified flag
      }));

    res.json({ success: true, data: sortedGeo });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- Review API (Ghost Global Compliance) ---

// Mock Data Storage for Dev/Offline Mode
import fs from 'fs';
const MOCK_DB_FILE = path.join(__dirname, 'dev_orders.json');

// Helper to get orders (Supabase -> Local Fallback)
async function getPendingOrders() {
    try {
        if (!supabaseUrl || !supabaseKey) throw new Error("No Supabase Config");
        
        const { data, error } = await supabase
            .from('orders')
            .select(`
                id, created_at, service_type, service_price, review_status,
                logo_url, logo_prompt, translated_report, compliance_check,
                users ( ref_code, country_code, city )
            `)
            .eq('review_status', 'pending')
            .order('created_at', { ascending: false })
            .limit(50);

        if (error) throw error;
        return data;
    } catch (e) {
        console.warn(`[Ghost] Supabase unavailable (${e.message}), using local dev_orders.json`);
        if (fs.existsSync(MOCK_DB_FILE)) {
            return JSON.parse(fs.readFileSync(MOCK_DB_FILE, 'utf8'));
        }
        return [];
    }
}

// 6. Get Pending Reviews
app.get('/api/review/pending', authenticate, async (req, res) => {
    try {
        // Fetch detailed order info
        const data = await getPendingOrders();

        // Transform data to match frontend expectation
        const formattedData = data.map(o => ({
            id: o.id,
            enterpriseName: o.users?.ref_code || 'Unknown', 
            chineseReport: o.chineseReport || { summary: `Mock Chinese Report for ${o.service_type}` },
            localizedReport: o.translated_report || { lang: 'Pending', tabooWarning: null },
            logo: { 
                watermarked: o.logo_url || 'https://via.placeholder.com/100', 
                engine: o.logo_engine || 'AI-Mock' 
            },
            compliance: o.compliance_check,
            ...o
        }));

        // Stats (Mock for dev mode if needed)
        const pendingCount = data.length;
        const approvedCount = 0; // Mock for now in dev mode

        res.json({
            success: true,
            data: formattedData,
            stats: {
                pending: pendingCount,
                approved_today: approvedCount
            }
        });
    } catch (error) {
        console.error('Review Fetch Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// 7. Submit Review Action
app.post('/api/review/action', authenticate, async (req, res) => {
    const { orderId, action, reason } = req.body;
    
    if (!['approve', 'reject', 'modify'].includes(action)) {
        return res.status(400).json({ error: 'Invalid action' });
    }

    try {
        // 1. Update Order Status
        const newStatus = action === 'approve' ? 'approved' : 
                          action === 'reject' ? 'rejected' : 'modification_requested';
        
        const { error: updateError } = await supabase
            .from('orders')
            .update({ 
                review_status: newStatus,
                updated_at: new Date()
            })
            .eq('id', orderId);

        if (updateError) throw updateError;

        // 2. Trigger Next Step (Stub)
        if (action === 'approve') {
            // Trigger n8n workflow
            // In production: fetch('https://your-n8n/webhook/send_report', ...)
            console.log(`[Ghost] Order ${orderId} Approved -> Triggering Delivery (n8n Webhook)...`);
        }

        res.json({ success: true, status: newStatus });
    } catch (error) {
        console.error('Review Action Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// 8. Generate Logo (Mock/Stub for Qwen + n8n)
app.post('/api/review/generate-logo', authenticate, async (req, res) => {
    const { orderId, prompt } = req.body;
    
    // In real scenario: Call Qwen API to refine prompt -> Call n8n webhook -> Get Image URL
    console.log(`[Ghost] Generating Logo for ${orderId} with prompt: ${prompt}`);
    
    // Simulate delay
    await new Promise(r => setTimeout(r, 1500));
    
    const mockLogoUrl = 'https://via.placeholder.com/300x300.png?text=AI+Generated+Logo';
    
    try {
        await supabase.from('orders').update({ logo_url: mockLogoUrl }).eq('id', orderId);
        res.json({ success: true, url: mockLogoUrl });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Start Server
app.listen(PORT, () => {
  console.log(`🚀 Dashboard API running on http://localhost:${PORT}`);
  console.log(`🔑 Auth Token: 88888888`);
});
