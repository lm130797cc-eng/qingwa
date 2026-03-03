Param()

$ErrorActionPreference = 'SilentlyContinue'

try {
  [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new()
  $OutputEncoding = [System.Text.UTF8Encoding]::new()
} catch {}

$Url = "https://qingwa.onrender.com/health"
$LogPath = "D:\MAYIJU\logs\ghost_monitor.log"

# 确保日志目录存在
$logDir = Split-Path $LogPath
if (!(Test-Path $logDir)) {
  New-Item -Path $logDir -ItemType Directory -Force | Out-Null
}

while ($true) {
  $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
  try {
    $resp = Invoke-WebRequest -Uri $Url -TimeoutSec 15 -UseBasicParsing
    if ($resp.Content -like "*ok*") {
      Add-Content -Path $LogPath -Value "[$timestamp] 🟢 SUCCESS: Service awake"
      Start-Sleep -Seconds 300
      continue
    }
  } catch {
    # 冷启动/网络波动，静默重试
  }
  Add-Content -Path $LogPath -Value "[$timestamp] 🟡 PENDING: Warming up..."
  Start-Sleep -Seconds 120
}
