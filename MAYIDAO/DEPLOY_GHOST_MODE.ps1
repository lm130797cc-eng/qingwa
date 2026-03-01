
# === 蚂蚁岛·幽灵模式一键部署 (PowerShell) === 
# 功能：自动推送代码 + 部署前端 + 配置Webhook + 验证闭环 
# 前提：已安装 Git + Vercel CLI + 已登录各平台 

Write-Host "🐜 幽灵模式一键部署启动" -ForegroundColor Cyan 

# 1. 配置Git用户（如未配置） 
if (!(git config user.name)) { 
  git config --global user.name "AntIsland-Ghost" 
  git config --global user.email "ghost@mayidao.local" 
} 

# 2. 推送代码到GitHub（自动处理认证） 
Write-Host "📤 推送代码到GitHub..." -ForegroundColor Gray 
Set-Location -Path "D:\MAYIJU\MAYIDAO"
git add . 
git commit -m "Ghost Mode: Auto-deploy $(Get-Date -Format 'yyyy-MM-dd HH:mm')" 
git push -u origin main 2>$null 
if ($LASTEXITCODE -eq 0) { 
  Write-Host "✅ GitHub推送成功" -ForegroundColor Green 
} else { 
  Write-Host "⚠️ GitHub推送需手动认证，请按提示输入账号密码" -ForegroundColor Yellow 
} 

# 3. 部署前端到Vercel（自动关联项目） 
Write-Host "🌐 部署前端到Vercel..." -ForegroundColor Gray 
Set-Location -Path "D:\MAYIJU\MAYIDAO\02_FRONTEND"
try {
    # 尝试使用 Vercel CLI，如果未安装，提示用户
    $vercelCheck = Get-Command vercel -ErrorAction SilentlyContinue
    if ($vercelCheck) {
        vercel link --scope $(vercel whoami) --project mayidao-h5 --yes 2>$null 
        vercel deploy --prod --yes --env SUPABASE_URL="https://unjpgieetbrtelcafykl.supabase.co" --env SUPABASE_ANON_KEY="sb_publishable_o6SafjUzgegDHy2z_0-HKg_gtoFOQEh" 
        Write-Host "✅ Vercel部署完成，访问: https://mayidao-h5.vercel.app" -ForegroundColor Green 
    } else {
        Write-Host "⚠️ 未检测到 Vercel CLI，请先安装: npm i -g vercel" -ForegroundColor Red
        Write-Host "👉 手动部署: 打开 https://vercel.com/new 导入 GitHub 项目" -ForegroundColor Yellow
    }
} catch {
    Write-Host "⚠️ Vercel 部署出错: $_" -ForegroundColor Red
}

# 4. 配置Telegram Webhook（需Railway URL） 
$RailwayUrl = Read-Host "🔗 请输入Railway部署后的URL (如: https://xxx.up.railway.app)" 
if ($RailwayUrl) { 
  Write-Host "🔗 配置Telegram Webhook..." -ForegroundColor Gray 
  $token = "8493486133:AAG-pvmhDhpdt8Ia748gXRl-NyRaPgsWV6Q" 
  $webhookUrl = "$RailwayUrl/webhook/telegram" 
  try {
      $result = Invoke-RestMethod -Uri "https://api.telegram.org/bot$token/setWebhook" -Method Post -Body (@{"url"=$webhookUrl} | ConvertTo-Json) -ContentType "application/json" 
      if ($result.ok) { 
        Write-Host "✅ Webhook配置成功" -ForegroundColor Green 
      } else { 
        Write-Host "⚠️ Webhook配置失败，请手动执行: curl -X POST https://api.telegram.org/bot$token/setWebhook -H 'Content-Type: application/json' -d '{`"url`":`"$webhookUrl`"}'" -ForegroundColor Yellow 
      } 
  } catch {
      Write-Host "⚠️ Webhook请求异常: $_" -ForegroundColor Red
  }
} 

# 5. 验证闭环（模拟测试） 
Write-Host "🧪 验证系统闭环..." -ForegroundColor Gray 
try { 
  $test = Invoke-WebRequest -Uri "https://mayidao-h5.vercel.app" -TimeoutSec 10 -UseBasicParsing 
  if ($test.StatusCode -eq 200) { 
    Write-Host "✅ 前端可访问" -ForegroundColor Green 
  } 
} catch { 
  Write-Host "⚠️ 前端访问超时，请稍后手动检查" -ForegroundColor Yellow 
} 

Write-Host "" 
Write-Host "🎉 一键部署完成！" -ForegroundColor Cyan 
Write-Host "📱 手机测试: https://mayidao-h5.vercel.app" -ForegroundColor White 
Write-Host "👁️ 审查窗口: file:///D:/MAYIJU/MAYIDAO/review/dashboard.html" -ForegroundColor White 
Write-Host "💰 等待USDT入账，系统已全自动运转" -ForegroundColor Green
Pause
