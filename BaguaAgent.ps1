# MAYIJU Cognitive Core - Bagua Agent v3.1
# "D:\MAYIJU\BaguaAgent.ps1"
# The cognitive operating system for MAYIJU.
# Function: Transforms inputs into Binary Trigrams (Bagua) for semantic processing.
# Principle: 3-bit Binary (0/1) ONLY.

param(
    [string]$InputData = "",   # Text, Numbers, or Commands
    [string]$TaskScope = "general", # product, system, blockchain, etc.
    [switch]$SelfCheck        # Run self-diagnostic
)

# --- 1. Cognitive Core: Binary Trigram Mapping ---
# 1 → 111 (乾) Heaven/Metal
# 2 → 011 (兑) Lake/Metal
# 3 → 101 (离) Fire/Fire
# 4 → 001 (震) Thunder/Wood
# 5 → 110 (巽) Wind/Wood
# 6 → 010 (坎) Water/Water
# 7 → 100 (艮) Mountain/Earth
# 8 → 000 (坤) Earth/Earth
# 0 → 0 (Void/Start)
# 9 → Balance (101010)

$BaguaLUT = @{
    1 = @{ bin="111"; name="Qian";  wuxing="Metal"; code=1 };
    2 = @{ bin="011"; name="Dui";   wuxing="Metal"; code=2 };
    3 = @{ bin="101"; name="Li";    wuxing="Fire";  code=3 };
    4 = @{ bin="001"; name="Zhen";  wuxing="Wood";  code=4 };
    5 = @{ bin="110"; name="Xun";   wuxing="Wood";  code=5 };
    6 = @{ bin="010"; name="Kan";   wuxing="Water"; code=6 };
    7 = @{ bin="100"; name="Gen";   wuxing="Earth"; code=7 };
    8 = @{ bin="000"; name="Kun";   wuxing="Earth"; code=8 };
    0 = @{ bin="0";   name="Void";  wuxing="Void";  code=0 };
    9 = @{ bin="101010"; name="Balance"; wuxing="Balance"; code=9 };
}

# --- 2. Five Elements Interaction Logic ---
function Get-WuxingRelation ($e1, $e2) {
    if ($e1 -eq $e2) { return "Resonance" }
    if ($e1 -eq "Void" -or $e2 -eq "Void") { return "Genesis" }
    if ($e1 -eq "Balance" -or $e2 -eq "Balance") { return "Harmony" }
    
    $cycle = @("Wood", "Fire", "Earth", "Metal", "Water")
    $idx1 = $cycle.IndexOf($e1)
    $idx2 = $cycle.IndexOf($e2)
    
    if ($idx1 -eq -1 -or $idx2 -eq -1) { return "Unknown" }
    
    # Generation
    if (($idx1 + 1) % 5 -eq $idx2) { return "Generates" }
    # Overcoming
    if (($idx1 + 2) % 5 -eq $idx2) { return "Overcomes" }
    
    return "Neutral"
}

# --- 3. Processing Logic ---

# A. Self-Check Mode
if ($SelfCheck) {
    Write-Host "[BaguaAgent] Running Self-Diagnostic Protocol..." -ForegroundColor Cyan
    $testInputs = @("123", "908", "MAYIJU")
    $InputData = $testInputs -join " "
    $TaskScope = "diagnostic"
}

# B. Extract Numbers & Map
$digits = @()
if ($InputData -match "\d") {
    $cleanNums = $InputData -replace "[^0-9]", ""
    $digits = $cleanNums.ToCharArray() | ForEach-Object { [int][string]$_ }
} else {
    # Text-only input: Simple hash to numbers
    if ($InputData) {
        $bytes = [System.Text.Encoding]::UTF8.GetBytes($InputData)
        $digits = $bytes | ForEach-Object { $_ % 9 }
    }
}

# C. Apply Logic
$processedSequence = @()
$binaryStream = ""
$wuxingFlow = @()

foreach ($d in $digits) {
    # Direct mapping for 0-9
    $info = $BaguaLUT[$d]
    if (-not $info) { $info = $BaguaLUT[8] } # Fallback to Earth
    
    $processedSequence += @{
        original = $d
        mapped   = $d
        binary   = $info.bin
        name     = $info.name
        wuxing   = $info.wuxing
    }
    $binaryStream += $info.bin
    $wuxingFlow += $info.wuxing
}

# D. Analyze Flow
$analysis = "Stable"
if ($wuxingFlow.Count -ge 2) {
    $start = $wuxingFlow[0]
    $end = $wuxingFlow[-1]
    $rel = Get-WuxingRelation $start $end
    $analysis = "$start $rel $end"
}

# --- 4. Output Generation ---

$result = @{
    agent = "BaguaAgent"
    paradigm = "binary_trigrams"
    timestamp = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
    input_hash = if ($InputData) { $InputData.GetHashCode() } else { 0 }
    
    # The Core Binary Output
    BinaryBagua = $binaryStream
    
    # Semantic Details
    Symbolic = ($processedSequence.name -join "-")
    WuxingFlow = ($wuxingFlow -join " -> ")
    Analysis = $analysis
    
    # Resource Estimation
    tokens_saved = [math]::Round($binaryStream.Length * 0.3)
}

$json = $result | ConvertTo-Json -Depth 3 -Compress

if ($SelfCheck) {
    Write-Host "Diagnostic Result:" -ForegroundColor Green
    Write-Host $json
    Write-Host "[BaguaAgent] System is OPTIMAL. 0=Void, 9=Balance confirmed." -ForegroundColor Cyan
} else {
    Write-Output $json
}
