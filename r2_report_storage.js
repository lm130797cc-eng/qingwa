import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import crypto from 'crypto';

// 初始化 R2 客户端（兼容 S3 API）
// ⚠️ 注意：如果未配置 R2 环境变量，此模块将不会初始化客户端
const r2 = (process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY && process.env.R2_SECRET_KEY) 
  ? new S3Client({
      region: 'auto',
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY,
        secretAccessKey: process.env.R2_SECRET_KEY,
      },
    })
  : null;

const BUCKET = 'mayidao-reports';

// 主函数：上传报告到 R2
export async function uploadReportToR2(reportData, options = {}) {
  const {
    reportId,
    userId,
    serviceType,
    pdfBuffer, // PDF 二进制数据
    expiresIn = 86400 // 链接有效期：默认 24 小时
  } = options;
   
  // 生成唯一文件名
  const filename = `reports/${reportId || crypto.randomUUID()}.pdf`;
   
  try {
    if (!r2) {
      console.warn('⚠️ R2 未配置，跳过报告上传');
      return { success: false, reason: 'R2_NOT_CONFIGURED' };
    }
    // 1. 上传到 R2（设置公开读 + 自动过期）
    await r2.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: filename,
      Body: pdfBuffer,
      ContentType: 'application/pdf',
      // 设置元数据，便于后续管理
      Metadata: {
          'user-id': userId,
          'service-type': serviceType,
          'created-at': new Date().toISOString()
      },
      // 自动过期：24 小时后删除（节省存储）
      Expires: new Date(Date.now() + expiresIn * 1000)
    }));
    
    // 2. 生成公开下载链接（R2 公共域名）
    const publicUrl = `https://pub-${process.env.R2_PUBLIC_DOMAIN}.r2.dev/${filename}`;
    
    console.log(`✅ 报告已上传 R2: ${publicUrl}`);
    return { success: true, url: publicUrl, key: filename };

  } catch (error) {
    console.error('❌ R2 上传失败:', error);
    
    // 降级方案：返回 base64 内联（小文件适用） 
    if (pdfBuffer.length < 500 * 1024) { // <500KB 
      const base64 = pdfBuffer.toString('base64'); 
      const dataUrl = `data:application/pdf;base64,${base64}`; 
      console.log('⚠️ 降级：返回 base64 内联报告'); 
      return { success: true, url: dataUrl, fallback: true }; 
    }
    
    return { success: false, error: error.message };
  }
}

export default { uploadReportToR2 };
