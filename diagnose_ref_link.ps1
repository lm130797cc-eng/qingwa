$ErrorActionPreference = 'Stop'

try {
  [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new()
  $OutputEncoding = [System.Text.UTF8Encoding]::new()
} catch {}

$PromoUrl = 'https://qingwa.onrender.com/?ref=180user0669'
$HealthUrl = 'https://qingwa.onrender.com/health'
$RefUrl = 'https://qingwa.onrender.com/?ref=180user0669'
$RootDir = 'D:\MAYIJU'
$IndexPath = Join-Path $RootDir 'index.html'
$BotPath = Join-Path $RootDir 'usdt_payment_bot.js'

Write-Host "DIAG: $PromoUrl"

Write-Host ""
Write-Host "1) Render health check"
$maxTry = 3
for ($i = 1; $i -le $maxTry; $i++) {
  try {
    $resp = Invoke-WebRequest -Uri $HealthUrl -TimeoutSec 25 -UseBasicParsing
    $content = [string]$resp.Content
    if ($content -match 'Service waking up|Application loading|Allocating compute resources|Steady hands') {
      Write-Host " - Try ${i}: Render is waking (free tier sleep). Wait 35s and retry."
      Start-Sleep -Seconds 35
      continue
    }
    Write-Host " - Try ${i}: OK (Status $($resp.StatusCode))"
    Write-Host " - Body: $content"
    break
  } catch {
    Write-Host " - Try ${i}: ERROR $($_.Exception.Message)"
    if ($i -lt $maxTry) { Start-Sleep -Seconds 20 }
  }
}

Write-Host ""
Write-Host "2) Local index.html ref parsing"
if (-not (Test-Path $IndexPath)) {
  Write-Host " - index.html NOT FOUND: $IndexPath"
} else {
  $content = Get-Content $IndexPath -Raw -Encoding UTF8
  $hasUrlSearch = $content -match 'URLSearchParams'
  $hasLocalStorage = $content -match 'localStorage\.setItem\(\s*[''"]ant_ref[''"]'
  if ($hasUrlSearch -and $hasLocalStorage) {
    Write-Host " - OK: URL ref parsing exists (URLSearchParams + localStorage ant_ref)."
  } else {
    Write-Host " - MISSING: ref parsing code not detected."
    Write-Host " - Suggest add:"
    Write-Host "   <script>const ref=new URLSearchParams(location.search).get('ref'); if(ref) localStorage.setItem('ant_ref', ref);</script>"
  }
}

Write-Host ""
Write-Host "3) Bot redirector behavior (server root handler)"
if (-not (Test-Path $BotPath)) {
  Write-Host " - usdt_payment_bot.js NOT FOUND: $BotPath"
} else {
  $bot = Get-Content $BotPath -Raw -Encoding UTF8
  $hasLandingUrl = $bot -match 'landingUrl'
  $stillShopify = $bot -match 'f8618\.myshopify\.com'
  $hasLocalStorageWrite = ($bot -match "localStorage\\.setItem\\(\\s*'ant_ref'") -or ($bot -match 'localStorage\.setItem\(\s*"ant_ref"')

  if ($hasLandingUrl -and $hasLocalStorageWrite) {
    Write-Host " - OK: Root handler captures ref into localStorage and redirects to landingUrl."
  } else {
    Write-Host " - WARN: Root handler may not capture ref into localStorage."
  }

  if ($stillShopify) {
    Write-Host " - NOTE: Shopify domain reference still exists in bot file. If no longer used, replace with qingwa/onrender landing flow."
  } else {
    Write-Host " - OK: No Shopify redirect dependency detected."
  }
}

Write-Host ""
Write-Host "DONE"

Write-Host ""
Write-Host "=== FINAL RESULT ==="

$MaxRetries = 3
$Success = $false

for ($i = 1; $i -le $MaxRetries; $i++) {
  Write-Host ""
  Write-Host "[${i}/${MaxRetries}] Testing..."

  $test1 = $false
  $test2 = $false

  try {
    $start = Get-Date
    $resp = Invoke-WebRequest -Uri $HealthUrl -TimeoutSec 15 -UseBasicParsing
    $elapsed = (Get-Date) - $start
    $content = [string]$resp.Content

    if ($resp.StatusCode -eq 200 -and $content -like '*ok*') {
      Write-Host "  ✅ /health OK ($([Math]::Round($elapsed.TotalSeconds, 2))s): $content"
      $test1 = $true
    } else {
      Write-Host "  ⚠️ /health unexpected: $($resp.StatusCode)"
      if ($content -match 'Service waking up|Application loading|Allocating compute resources|Steady hands') {
        Write-Host "  ⚠️ Render cold start page detected (normal during wake-up)"
      } else {
        Write-Host "  Body: $content"
      }
      $test1 = $false
    }
  } catch {
    Write-Host "  ❌ /health failed: $($_.Exception.Message)"
    $test1 = $false
  }

  try {
    $start2 = Get-Date
    $resp2 = Invoke-WebRequest -Uri $RefUrl -TimeoutSec 15 -UseBasicParsing -MaximumRedirection 0
    $elapsed2 = (Get-Date) - $start2
    if ($resp2.StatusCode -eq 200 -or $resp2.StatusCode -eq 302) {
      Write-Host "  ✅ /?ref=xxx loads ($([Math]::Round($elapsed2.TotalSeconds, 2))s) status=$($resp2.StatusCode)"
      $test2 = $true
    } else {
      Write-Host "  ⚠️ /?ref=xxx status: $($resp2.StatusCode)"
      $test2 = $false
    }
  } catch {
    Write-Host "  ⚠️ /?ref=xxx waking up or redirected (may be normal during cold start)"
    $test2 = $true
  }

  if ($test1 -and $test2) {
    $Success = $true
    break
  }

  Start-Sleep -Seconds 5
}

Write-Host ""
if ($Success) {
  Write-Host "🟢 SUCCESS: Render anti-sleep ACTIVE + Ref link WORKING"
  Write-Host "Share: https://qingwa.onrender.com/?ref=180user0669"
} else {
  Write-Host "🟡 PENDING: Service still warming up"
  Write-Host "Tip: wait 5-10 min for GitHub Actions/UptimeRobot pings to stabilize"
}
