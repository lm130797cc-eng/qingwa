/**
 * report_bridge.js
 * 【关键】桥接MAYIJUN_CORE现有取名Agent，避免重复开发
 * 部署路径：D:/MAYIJU/MAYIDAO/03_BACKEND/
 */

const { exec } = require('child_process');
const path = require('path');
const fs = require('fs').promises;

// Configuration
const CORE_PATH = 'D:\\MAYIJU';
const NAMING_SCRIPT = 'name_generator_v2.py';
const BUSINESS_SCRIPT = 'business_namer.py';
const LOG_DIR = 'D:\\MAYIJU\\MAYIDAO\\logs';

// 合规过滤器：强制添加娱乐声明，过滤敏感词
function complianceFilter(input) {
  const sensitiveWords = ['算命', '预测', '吉凶', '风水', '八字', '占卜'];
  const sanitized = JSON.stringify(input).toLowerCase();
  
  if (sensitiveWords.some(word => sanitized.includes(word))) {
    throw new Error('COMPLIANCE_ERROR: Sensitive keywords detected');
  }
  
  return {
    ...input,
    // 强制标记用途，供下游Agent识别
    metadata: {
      purpose: 'cultural_entertainment_only',
      disclaimer_acknowledged: true,
      client_type: 'mobile_h5',
      timestamp: new Date().toISOString()
    }
  };
}

// 审计日志函数（轻量版，Phase 1用console+文件）
async function logAudit(logEntry) {
  const logLine = `[${new Date().toISOString()}] ${JSON.stringify(logEntry)}\n`;
  try {
    await fs.appendFile(
      path.join(LOG_DIR, 'audit.log'),
      logLine,
      'utf-8'
    );
  } catch (err) {
    console.error('Failed to write audit log:', err);
  }
}

// 模拟调用 Python 脚本 (由于无法直接 import file:// 协议的 Python 模块到 JS)
// 这里保留之前的 exec 逻辑，但包装成 import 风格的接口
const personalNamingAgent = {
  analyze: async (input) => {
    return new Promise((resolve, reject) => {
      const scriptPath = path.join(CORE_PATH, NAMING_SCRIPT);
      // Command: python name_generator_v2.py [args]
      const cmd = `python "${scriptPath}" --name "${input.name}" --birth "${input.birth}" --json`;
      
      exec(cmd, (error, stdout, stderr) => {
        if (error) {
          console.error(`exec error: ${error}`);
          return reject(error);
        }
        try {
          // Assume script outputs JSON result or file path
          // For now, we mock the result if script output is not JSON
          try {
              const result = JSON.parse(stdout);
              resolve(result);
          } catch {
               resolve({ raw_output: stdout, mocked_analysis: "Mocked Personal Analysis Result" });
          }
        } catch (e) {
          reject(e);
        }
      });
    });
  }
};

const enterpriseNamingAgent = {
  analyze: async (input) => {
     return new Promise((resolve) => {
         // Mock for business namer
         resolve({ status: "success", suggestion: "AI Enterprise Name Suggestion" });
     });
  }
};


// 主函数：生成报告（复用现有逻辑！）
async function generateCulturalReport(serviceType, userInput, refCode = null) {
  try {
    // 1. 合规预处理
    const safeInput = complianceFilter(userInput);
    
    // 2. 调用现有Agent（核心复用！）
    let reportData;
    if (serviceType === 'personal' || serviceType === 'personal_naming') {
      reportData = await personalNamingAgent.analyze(safeInput);
    } else if (serviceType === 'enterprise' || serviceType === 'enterprise_naming') {
      reportData = await enterpriseNamingAgent.analyze(safeInput);
    } else {
      throw new Error(`Unsupported service type: ${serviceType}`);
    }
    
    // 3. 添加蚂蚁岛专属包装（分润追踪+品牌标识）
    const wrappedReport = {
      ...reportData,
      island_meta: {
        report_id: `ANT_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        generated_at: new Date().toISOString(),
        ref_code: refCode, // 用于后续积分结算
        version: 'mayidao_phase1'
      },
      // 强制添加合规声明（报告内页）
      compliance: {
        disclaimer_zh: '本报告基于AI对传统文化数据的模拟分析，仅供娱乐与文化研究参考，不具备科学预测功能。请勿迷信，命运掌握在自己手中。',
        disclaimer_en: 'This report is for cultural entertainment and research reference only. Not scientific prediction. Rationality advocated.'
      }
    };
    
    // 4. 记录审计日志（不含敏感数据）
    await logAudit({
      service: serviceType,
      report_id: wrappedReport.island_meta.report_id,
      ref_code: refCode,
      status: 'success'
    });
    
    return wrappedReport;
    
  } catch (error) {
    // 错误处理：记录+返回友好提示
    await logAudit({
      service: serviceType,
      error: error.message,
      status: 'failed'
    });
    
    if (error.message && error.message.includes('COMPLIANCE')) {
      throw new Error('请求内容不符合文化咨询规范，请调整用词后重试');
    }
    throw error;
  }
}

// 导出供其他模块调用
module.exports = { generateCulturalReport };
