const axios = require('axios');
const config = require('./config.cjs');

async function checkBackend() {
  const url = config.backend.healthUrl;
  console.log(`[FuwaGuardian] Checking Backend: ${url}`);
  const startTime = Date.now();
  
  try {
    const response = await axios.get(url, { timeout: config.backend.timeout });
    const loadTime = Date.now() - startTime;
    
    if (response.status === 200) {
      console.log(`✅ Backend API OK (Load: ${loadTime}ms)`);
      return { status: 'OK', loadTime };
    } else {
      console.warn(`⚠️ Backend API Warning (Status: ${response.status})`);
      return { status: 'WARNING', loadTime, code: response.status };
    }
  } catch (error) {
    console.error(`❌ Backend Check Failed: ${error.message}`);
    return { status: 'CRITICAL', error: error.message };
  }
}

module.exports = checkBackend;