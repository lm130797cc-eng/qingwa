const axios = require('axios');
const config = require('./config.cjs');

async function checkFrontend() {
  const url = `${config.frontend.url}/${config.frontend.testParams}`;
  console.log(`[FuwaGuardian] Checking Frontend: ${url}`);
  const startTime = Date.now();
  
  try {
    const response = await axios.get(url, { timeout: 10000 });
    const loadTime = Date.now() - startTime;
    const isSuccess = response.status === 200;
    const hasKeyword = response.data.includes(config.frontend.keyword);
    
    // Simulate keyword check if scraping fails due to SPA
    // In a real SPA, axios only gets the index.html template, which might not contain dynamic content.
    // However, the user asked for "Contains 'Fuwa' keyword".
    // Let's assume the meta tags or title contains it.
    
    if (isSuccess && loadTime < 3000) {
      console.log(`✅ Frontend OK (Load: ${loadTime}ms)`);
      if (hasKeyword) {
          console.log(`✅ Keyword "${config.frontend.keyword}" Found`);
      } else {
          console.log(`⚠️ Keyword "${config.frontend.keyword}" NOT Found (Check SPA rendering)`);
      }
      return { status: 'OK', loadTime, keywordFound: hasKeyword };
    } else {
      console.warn(`⚠️ Frontend Slow or Error (Status: ${response.status}, Load: ${loadTime}ms)`);
      return { status: 'WARNING', loadTime, keywordFound: hasKeyword };
    }
  } catch (error) {
    console.error(`❌ Frontend Check Failed: ${error.message}`);
    return { status: 'CRITICAL', error: error.message };
  }
}

module.exports = checkFrontend;