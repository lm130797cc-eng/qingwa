# D:/MAYIJU/MAYIDAO/06_MONITORING/health_check.ps1
# 功能：每日健康检查 + 异常Telegram通知

param (
    [string]$SupabaseUrl = $env:SUPABASE_URL,
    [string]$SupabaseKey = $env:SUPABASE_ANON_KEY,
    [string]$TelegramBot = $env:TELEGRAM_BOT_TOKEN,
    [string]$AdminChatId, # 需在运行时传入或配置环境变量
    [string]$BotUrl # Railway Bot URL
)

function Send-TelegramAlert($message) {
    if (-not $TelegramBot -or -not $AdminChatId) {
        Write-Host "⚠️ Skip Telegram Alert: Missing Token or ChatId"
        return
    }
    $url = "https://api.telegram.org/bot$($TelegramBot)/sendMessage"
    $body = @{ chat_id = $AdminChatId; text = "🐜 蚂蚁岛告警`n`n$message"; parse_mode = "HTML" } | ConvertTo-Json -Depth 10
    try {
        Invoke-RestMethod -Uri $url -Method Post -Body $body -ContentType "application/json"
    } catch {
        Write-Error "Failed to send alert: $_"
    }
}

Write-Host "🔍 Starting Health Check..."

# 1. 检查前端
try {
    $frontend = Invoke-WebRequest -Uri "https://mayidao-h5.vercel.app" -TimeoutSec 10 -UseBasicParsing
    if ($frontend.StatusCode -eq 200) {
        Write-Host "✅ Frontend: OK"
    } else {
        Write-Host "❌ Frontend: $($frontend.StatusCode)"
        Send-TelegramAlert "❌ 前端异常: HTTP $($frontend.StatusCode)"
    }
} catch {
    Write-Host "❌ Frontend: Connection Failed - $($_.Exception.Message)"
    Send-TelegramAlert "❌ 前端连接失败: $($_.Exception.Message)"
}

# 2. 检查数据库
if ($SupabaseUrl -and $SupabaseKey) {
    try {
        $resp = Invoke-RestMethod -Uri "$($SupabaseUrl)/rest/v1/users?select=count&limit=1" `
            -Headers @{ "apikey" = $SupabaseKey; "Authorization" = "Bearer $SupabaseKey" } -TimeoutSec 10
        Write-Host "✅ Database: OK"
    } catch {
        Write-Host "❌ Database: Connection Failed - $($_.Exception.Message)"
        Send-TelegramAlert "❌ 数据库连接失败: $($_.Exception.Message)"
    }
} else {
    Write-Host "⚠️ Skip Database Check: Missing Credentials"
}

# 3. 检查支付Bot
if ($BotUrl) {
    try {
        $botHealth = Invoke-WebRequest -Uri "$($BotUrl)/health" -TimeoutSec 10 -UseBasicParsing
        if ($botHealth.StatusCode -eq 200) {
            Write-Host "✅ Payment Bot: OK"
        } else {
            Write-Host "❌ Payment Bot: $($botHealth.StatusCode)"
            Send-TelegramAlert "❌ 支付Bot异常: HTTP $($botHealth.StatusCode)"
        }
    } catch {
        Write-Host "❌ Payment Bot: Connection Failed - $($_.Exception.Message)"
        Send-TelegramAlert "❌ 支付Bot连接失败: $($_.Exception.Message)"
    }
} else {
    Write-Host "⚠️ Skip Bot Check: Missing Bot URL"
}

# 4. 检查配额（示例逻辑，需配合 RPC）
# $quota = Invoke-RestMethod ... 
# Write-Host "ℹ️ Quota Check Skipped (RPC not configured)"

Write-Host "🏁 Health Check Completed."
