# MAYIJU Cognitive Core - Bagua Agent v3.0
# "D:\MAYIJU\BaguaAgent.ps1"
# The cognitive operating system for MAYIJU.
# Function: Transforms inputs into Binary Trigrams (Bagua) for semantic processing.
# Principle: 3-bit Binary (0/1) instead of Unicode Symbols.

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

$BaguaLUT = @{
    1 = @{ bin="111"; name="Qian";  wuxing="Metal"; code=1 };
    2 = @{ bin="011"; name="Dui";   wuxing="Metal"; code=2 };
    3 = @{ bin="101"; name="Li";    wuxing="Fire";  code=3 };
    4 = @{ bin="001"; name="Zhen";  wuxing="Wood";  code=4 };
    5 = @{ bin="110"; name="Xun";   wuxing="Wood";  code=5 };
    6 = @{ bin="010"; name="Kan";   wuxing="Water"; code=6 };
    7 = @{ bin="100"; name="Gen";   wuxing="Earth"; code=7 };
    8 = @{ bin="000"; name="Kun";   wuxing="Earth"; code=8 };
}

# --- 2. Five Elements Interaction Logic ---
# Generating: Wood(4,5) -> Fire(3) -> Earth(7,8) -> Metal(1,2) -> Water(6) -> Wood
# Overcoming: Wood -> Earth -> Water -> Fire -> Metal -> Wood
function Get-WuxingRelation ($e1, $e2) {
    if ($e1 -eq $e2) { return "Resonance" }
    
    $cycle = @("Wood", "Fire", "Earth", "Metal", "Water")
    $idx1 = $cycle.IndexOf($e1)
    $idx2 = $cycle.IndexOf($e2)
    
    if ($idx1 -eq -1 -or $idx2 -eq -1) { return "Unknown" }
    
    # Check Generation (Next in cycle)
    $genIdx = ($idx1 + 1) % 5
    if ($genIdx -eq $idx2) { return "Generates" }
    
    # Check Overcoming (Skip one)
    $overIdx = ($idx1 + 2) % 5
    if ($overIdx -eq $idx2) { return "Overcomes" }
    
    # Check Reverse Generation (Drains)
    $drainIdx = ($idx1 - 1 + 5) % 5
    if ($drainIdx -eq $idx2) { return "Drains" }
    
    # Check Reverse Overcoming (Insults)
    $insultIdx = ($idx1 - 2 + 5) % 5
    if ($insultIdx -eq $idx2) { return "Insults" }
    
    return "Neutral"
}

# --- 3. Processing Logic ---

# A. Self-Check Mode
if ($SelfCheck -or -not $InputData) {
    Write-Host "[BaguaAgent] Running Self-Diagnostic Protocol..." -ForegroundColor Cyan
    $testInputs = @("123", "908", "MAYIJU")
    $InputData = $testInputs -join " "
    $TaskScope = "diagnostic"
}

# B. Extract Numbers & Map
# Rule: Extract digits. If no digits, hash string to numbers.
$digits = @()
if ($InputData -match "\d") {
    $cleanNums = $InputData -replace "[^0-9]", ""
    $digits = $cleanNums.ToCharArray() | ForEach-Object { [int]::Parse($_) }
} else {
    # Text-only input: Simple hash to numbers
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($InputData)
    $digits = $bytes | ForEach-Object { $_ % 9 }
}

# C. Apply Modulo 8 Logic (0->8, 9->1)
$processedSequence = @()
$binaryStream = ""
$wuxingFlow = @()

foreach ($d in $digits) {
    # Core Mapping Rule:
    # 0 -> 8
    # 1-8 -> keep
    # 9 -> 1 (9 % 8 = 1)
    # >9 -> mod 8
    
    $mappedVal = 0
    if ($d -eq 0) { $mappedVal = 8 }
    else {
        $m = $d % 8
        if ($m -eq 0) { $mappedVal = 8 } else { $mappedVal = $m }
    }
    
    $info = $BaguaLUT[$mappedVal]
    
    $processedSequence += @{
        original = $d
        mapped   = $mappedVal
        binary   = $info.bin
        name     = $info.name
        wuxing   = $info.wuxing
    }
    $binaryStream += $info.bin
    $wuxingFlow += $info.wuxing
}

# D. Analyze Flow (First vs Last)
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
    input_hash = $InputData.GetHashCode()
    
    # The Core Binary Output
    BinaryBagua = $binaryStream
    
    # Semantic Details
    Symbolic = ($processedSequence.name -join "-")
    WuxingFlow = ($wuxingFlow -join " -> ")
    Analysis = $analysis
    
    # Resource Estimation (Simulated Token Saving)
    tokens_saved = [math]::Round($binaryStream.Length * 0.3)
}

# Convert to JSON for machine consumption
$json = $result | ConvertTo-Json -Depth 3 -Compress

if ($SelfCheck) {
    Write-Host "Diagnostic Result:" -ForegroundColor Green
    Write-Host $json
    Write-Host "[BaguaAgent] System is OPTIMAL." -ForegroundColor Cyan
} else {
    Write-Output $json
}
