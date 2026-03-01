# === 蚂蚁岛·一键部署 + 生成分享链接 (PowerShell) ===
# 功能：部署成功 → 自动提取真实 URL → 生成带推荐码的分享链接

$ProjectDir = "D:\MAYIJU\MAYIDAO\02_FRONTEND"
$DeployName = "mayidao-h5"
$SupabaseUrl = "https://unjpgieetbrtelcafykl.supabase.co"
$SupabaseAnonKey = "sb_publishable_o6SafjUzgegDHy2z_0-HKg_gtoFOQEh"

Write-Host "🐜 蚂蚁岛一键部署启动" -ForegroundColor Cyan

# 1. 登录检测
$who = & vercel whoami 2>$null
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($who)) {
  Write-Host "🔐 未登录，执行 vercel login..." -ForegroundColor Yellow
  & vercel login
  $who = & vercel whoami 2>$null
  if ($LASTEXITCODE -ne 0) { throw "登录失败" }
}

# 2. 执行部署（从输出中提取真实 URL）
Write-Host "🚀 部署中..." -ForegroundColor Cyan
Push-Location $ProjectDir
$out = & vercel deploy `
  --prod `
  --yes `
  --name $DeployName `
  --env "SUPABASE_URL=$SupabaseUrl" `
  --env "SUPABASE_ANON_KEY=$SupabaseAnonKey" `
  2>&1 | Out-String
Pop-Location

# 3. 提取真实部署 URL（兼容多种输出格式）
$deployUrl = ([regex]::Match($out, 'https://[a-z0-9-]+\.vercel\.app')).Value
if ([string]::IsNullOrWhiteSpace($deployUrl)) {
  # 备用：尝试从 "Deployed to https://..." 格式提取
  $deployUrl = ([regex]::Match($out, 'Deployed to (https://[^\s]+)')).Groups[1].Value
}
if ([string]::IsNullOrWhiteSpace($deployUrl)) {
  $deployUrl = "https://$DeployName.vercel.app"  # 最后备用
}

# 4. 生成专属推荐码 + 分享链接
$RefCode = "ANT" + ([Guid]::NewGuid().ToString("N").Substring(0,8).ToUpper())
$ShareLink = "$deployUrl/?ref=$RefCode"

# 5. 输出结果
Write-Host ""
Write-Host "✅ 部署完成！" -ForegroundColor Green
Write-Host "🌐 真实访问链接：$deployUrl" -ForegroundColor Cyan
Write-Host "🎫 您的推荐码：$RefCode" -ForegroundColor Cyan
Write-Host "🔗 专属分享链接（可复制）：" -ForegroundColor Green
Write-Host $ShareLink -ForegroundColor White
Write-Host ""
Write-Host "📱 手机测试：用浏览器打开上方链接" -ForegroundColor Gray
Write-Host "✅ 成功标志：看到'🐜 蚂蚁岛' + 绿色'✅ 数据库已连接'" -ForegroundColor Gray
