
$RootDir = "D:\MAYIJU"
Write-Host "Searching for HTML files in $RootDir..."

$AllFiles = Get-ChildItem -Path $RootDir -Recurse -Filter "*.html" -ErrorAction SilentlyContinue

foreach ($file in $AllFiles) {
    $path = $file.FullName
    if ($path -match "node_modules" -or $path -match "\.git" -or $path -match "\.vercel") {
        continue
    }
    
    if ($file.DirectoryName -eq $RootDir) {
        continue
    }

    $NewPath = Join-Path $RootDir $file.Name
    
    if (Test-Path $NewPath) {
        $Base = $file.BaseName
        $Ext = $file.Extension
        $Counter = 1
        do {
            $NewPath = Join-Path $RootDir "${Base}_$Counter$Ext"
            $Counter++
        } while (Test-Path $NewPath)
    }
    
    Write-Host "Moving $($file.Name) to $NewPath"
    Move-Item -Path $file.FullName -Destination $NewPath -Force
}

Write-Host "Done."
Get-ChildItem -Path $RootDir -Filter "*.html" | Select-Object Name
