// 🛡️ Fraud Detection System
// 🎯 Goal: Detect suspicious purchase patterns (IP/Email frequency)
// ⚠️ Rules:
// 1. Max 5 purchases per IP in 24h
// 2. Max 3 purchases per Email in 24h
// 3. Flag orders > $100 for manual review

import fs from 'fs';
import path from 'path';

const RISK_LOG_PATH = path.join(process.cwd(), 'MAYIJU', '03_BACKEND', 'risk_logs.json');

// Mock Order Data
const incomingOrder = {
    id: 'ORDER-9999',
    total_price: '12.00',
    email: 'suspicious@example.com',
    ip: '192.168.1.1',
    created_at: new Date().toISOString()
};

async function checkFraud(order) {
    console.log(`🕵️ Analyzing Order: ${order.id}...`);
    let riskScore = 0;
    let reasons = [];

    // Load history
    let history = [];
    if (fs.existsSync(RISK_LOG_PATH)) {
        history = JSON.parse(fs.readFileSync(RISK_LOG_PATH, 'utf8'));
    }

    // Filter last 24h
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentOrders = history.filter(o => new Date(o.created_at) > oneDayAgo);

    // Rule 1: IP Frequency
    const ipCount = recentOrders.filter(o => o.ip === order.ip).length;
    if (ipCount >= 5) {
        riskScore += 50;
        reasons.push(`High IP frequency (${ipCount} in 24h)`);
    }

    // Rule 2: Email Frequency
    const emailCount = recentOrders.filter(o => o.email === order.email).length;
    if (emailCount >= 3) {
        riskScore += 30;
        reasons.push(`High Email frequency (${emailCount} in 24h)`);
    }

    // Rule 3: High Value
    if (parseFloat(order.total_price) > 100) {
        riskScore += 40;
        reasons.push('High value order (>$100)');
    }

    // Decision
    const result = {
        order_id: order.id,
        risk_score: riskScore,
        status: riskScore >= 50 ? 'FLAGGED' : 'APPROVED',
        reasons: reasons,
        timestamp: new Date().toISOString()
    };

    console.log(`📊 Risk Assessment: ${result.status} (Score: ${riskScore})`);
    if (reasons.length > 0) console.log('⚠️ Reasons:', reasons.join(', '));

    // Save to log (in real app, only save if processed)
    // history.push(order); 
    // fs.writeFileSync(RISK_LOG_PATH, JSON.stringify(history, null, 2));

    return result;
}

// Test Run
checkFraud(incomingOrder);
