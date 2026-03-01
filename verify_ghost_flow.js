
import { generateChineseName, generateLocalizedReport, generateLogo } from './ai_naming_agent.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runGhostFlow() {
    console.log("👻 Starting Ghost Global Compliance Flow Verification...");

    // 1. Simulate User Requirement
    const requirement = {
        birth_time: "2024-02-28 08:00",
        last_name: "Wang",
        gender: "company",
        geo: "US" // User is in US, expects English report
    };
    console.log(`[1] Received Requirement: ${JSON.stringify(requirement)}`);

    // 2. Generate Core Chinese Report
    console.log(`[2] Generating Core Chinese Report...`);
    const cnReport = await generateChineseName(requirement);
    console.log(`   > Chinese Summary: ${cnReport.report_zh}`);

    // 3. Localize (Translation + Taboo Filter)
    console.log(`[3] Localizing for ${requirement.geo}...`);
    const localized = await generateLocalizedReport(cnReport, requirement.geo);
    console.log(`   > Language: ${localized.lang}`);
    console.log(`   > Taboo Warning: ${localized.tabooWarning || 'None'}`);

    // 4. Generate Logo
    const enterpriseName = cnReport.names[0].pinyin; // e.g. "Ze"
    console.log(`[4] Generating Logo for ${enterpriseName}...`);
    const logo = await generateLogo(enterpriseName, "Tech", cnReport.names[0].meaning);
    console.log(`   > Engine: ${logo.engine}`);
    console.log(`   > URL: ${logo.watermarked}`);

    // 5. Construct Order Object (Database Schema Match)
    const order = {
        id: "GHOST-" + Date.now(),
        created_at: new Date().toISOString(),
        service_type: "expert_naming",
        service_price: 88,
        review_status: "pending",
        users: {
            ref_code: "ANT-TEST-001",
            country_code: requirement.geo,
            city: "New York"
        },
        // AI Content
        chineseReport: {
            summary: cnReport.report_zh,
            full: cnReport
        },
        translated_report: localized,
        logo_url: logo.watermarked,
        logo_engine: logo.engine,
        logo_prompt: logo.prompt,
        compliance_check: {
            passed: true,
            details: "Ghost Auto-Check Passed"
        }
    };

    // 6. Save to Dev DB for Dashboard
    const devDbPath = path.join(__dirname, 'dev_orders.json');
    let orders = [];
    if (fs.existsSync(devDbPath)) {
        orders = JSON.parse(fs.readFileSync(devDbPath, 'utf8'));
    }
    orders.unshift(order); // Add to top
    fs.writeFileSync(devDbPath, JSON.stringify(orders, null, 2));

    console.log(`✅ Flow Verified! Order saved to ${devDbPath}`);
    console.log(`🚀 Ready for Dashboard Review: http://localhost:3001/api/review/pending`);
}

runGhostFlow().catch(console.error);
