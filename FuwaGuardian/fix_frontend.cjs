const fs = require('fs');
const path = require('path');

async function fixFrontend() {
  console.log('[AutoFix] 🔧 Starting Frontend Repair...');
  
  const rootDir = path.resolve(__dirname, '..');
  const sourceDir = path.join(rootDir, 'MAYIDAO', '02_FRONTEND');
  
  const indexSource = path.join(sourceDir, 'index.html');
  const indexDest = path.join(rootDir, 'index.html');
  
  const vercelSource = path.join(sourceDir, 'vercel.json');
  const vercelDest = path.join(rootDir, 'vercel.json');
  
  let fixed = false;

  try {
    // 1. Check if source exists
    if (fs.existsSync(indexSource)) {
      console.log(`   > Found source index.html at ${indexSource}`);
      fs.copyFileSync(indexSource, indexDest);
      console.log(`   ✅ Copied index.html to root ${indexDest}`);
      fixed = true;
    } else {
      console.error(`   ❌ Source index.html NOT FOUND at ${indexSource}`);
    }

    // 2. Vercel config
    if (fs.existsSync(vercelSource)) {
      console.log(`   > Found source vercel.json at ${vercelSource}`);
      fs.copyFileSync(vercelSource, vercelDest);
      console.log(`   ✅ Copied vercel.json to root ${vercelDest}`);
      fixed = true;
    } else {
        // Create default if missing
        const defaultVercel = {
            "version": 2,
            "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
        };
        fs.writeFileSync(vercelDest, JSON.stringify(defaultVercel, null, 2));
        console.log(`   ✅ Created default vercel.json at root`);
        fixed = true;
    }

    if (fixed) {
        console.log('[AutoFix] 🟢 Frontend files restored to root. Vercel should pick this up on next push.');
        // Note: We can't trigger Vercel deploy from here without API token, but user can git push.
    }

    return fixed;
  } catch (err) {
    console.error(`[AutoFix] 🔴 Repair Failed: ${err.message}`);
    return false;
  }
}

// Auto-run if main module
if (require.main === module) {
    fixFrontend();
}

module.exports = fixFrontend;