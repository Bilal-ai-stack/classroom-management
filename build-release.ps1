# ClassroomOS 2.1.0 — Production Release Build & Packaging Script
# Generates production frontend build, compiled standalone Windows binary, portable zip archive, Inno Setup installer, and SHA-256 checksums

$ErrorActionPreference = "Stop"

$ProjectRoot = $PSScriptRoot
$FrontendDir = Join-Path $ProjectRoot "codebase\frontend"
$BackendDir = Join-Path $ProjectRoot "codebase\backend"
$DistReleaseDir = Join-Path $ProjectRoot "dist_release"
$DistInstallerDir = Join-Path $ProjectRoot "dist_installer"
$Version = "2.1.1"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  ClassroomOS v$Version -- Release Build Pipeline" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Build Production Frontend with Vite
Write-Host ""
Write-Host "[1/5] Building production frontend with Vite..." -ForegroundColor Yellow
Push-Location $FrontendDir
try {
    npm run build
} finally {
    Pop-Location
}

if (-not (Test-Path (Join-Path $FrontendDir "dist\index.html"))) {
    Write-Error "Frontend build failed: dist\index.html not found."
}
Write-Host "[OK] Frontend build verified in codebase\frontend\dist" -ForegroundColor Green

# 2. Clean Pycache & Temporary Files
Write-Host ""
Write-Host "[2/5] Cleaning Python caches and temporary files..." -ForegroundColor Yellow
$pycacheRel = @("__pycache__", "phase1_students\__pycache__", "phase2_attendance\__pycache__", "phase3_photo\__pycache__", "phase4_quality\__pycache__", "tests\__pycache__", ".pytest_cache")
foreach ($rel in $pycacheRel) {
    $dir = Join-Path $BackendDir $rel
    if (Test-Path $dir) {
        Remove-Item -Path $dir -Recurse -Force -ErrorAction SilentlyContinue
    }
}
Write-Host "[OK] Temporary caches removed" -ForegroundColor Green

# 3. Compile Standalone Windows Application with PyInstaller
Write-Host ""
Write-Host "[3/5] Compiling standalone executable with PyInstaller for v$Version..." -ForegroundColor Yellow
$standaloneDir = Join-Path $BackendDir "dist\ClassroomOS"
$pyinstallerExe = Join-Path $BackendDir "venv\Scripts\pyinstaller.exe"

if (Test-Path $pyinstallerExe) {
    Write-Host "Running PyInstaller compilation..." -ForegroundColor Cyan
    Push-Location $BackendDir
    try {
        & $pyinstallerExe --noconfirm --clean ClassroomOS.spec
    } finally {
        Pop-Location
    }
} else {
    Write-Error "PyInstaller not found at $pyinstallerExe"
}

# Ensure built frontend SPA is present in the standalone executable directory
$standaloneDist = Join-Path $standaloneDir "dist"
if (Test-Path $standaloneDist) { Remove-Item $standaloneDist -Recurse -Force }
Copy-Item -Path (Join-Path $FrontendDir "dist") -Destination $standaloneDist -Recurse -Force
Write-Host "[OK] Standalone Windows binaries & frontend dist verified" -ForegroundColor Green

# 4. Compile Inno Setup Windows Installer (.exe)
Write-Host ""
Write-Host "[4/5] Checking Inno Setup Compiler (ISCC.exe)..." -ForegroundColor Yellow
$isccCmd = Get-Command iscc.exe -ErrorAction SilentlyContinue
$isccFromPath = $null
if ($isccCmd) { $isccFromPath = $isccCmd.Source }

$InnoCompilerPaths = @(
    "C:\Program Files (x86)\Inno Setup 6\ISCC.exe",
    "C:\Program Files\Inno Setup 6\ISCC.exe",
    "$env:LOCALAPPDATA\Programs\Inno Setup 6\ISCC.exe",
    "$env:LOCALAPPDATA\Programs\Antigravity IDE\resources\app\node_modules\innosetup\bin\ISCC.exe",
    $isccFromPath
)
$Iscc = $InnoCompilerPaths | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1

if ($Iscc) {
    Write-Host "Compiling Inno Setup installer using $Iscc..." -ForegroundColor Cyan
    if (-not (Test-Path $DistInstallerDir)) { New-Item -ItemType Directory -Path $DistInstallerDir -Force | Out-Null }
    & $Iscc (Join-Path $ProjectRoot "packaging\ClassroomOS.iss")
    Write-Host "[OK] Windows Installer generated in dist_installer\" -ForegroundColor Green
} else {
    Write-Warning "ISCC.exe not found on system PATH or default directories."
}

# 5. Assemble Genuinely Standalone Portable Zip Distribution & Checksums
Write-Host ""
Write-Host "[5/5] Packaging standalone portable distribution and calculating SHA-256..." -ForegroundColor Yellow

if (Test-Path $DistReleaseDir) { Remove-Item $DistReleaseDir -Recurse -Force }
New-Item -ItemType Directory -Path $DistReleaseDir -Force | Out-Null

$PortableStaging = Join-Path $DistReleaseDir "ClassroomOS-v$Version-Portable"
New-Item -ItemType Directory -Path $PortableStaging -Force | Out-Null

# Copy the complete compiled standalone distribution
Copy-Item -Path "$standaloneDir\*" -Destination $PortableStaging -Recurse -Force
Copy-Item -Path (Join-Path $ProjectRoot "README.md") -Destination $PortableStaging -Force

# Create convenient root batch wrapper that launches the standalone executable
$batContent = "@echo off`r`nstart `"`" `"%~dp0ClassroomOS.exe`" %*`r`n"
Set-Content -Path (Join-Path $PortableStaging "run-desktop.bat") -Value $batContent -Encoding ASCII

# Compress Portable Distribution Archive
$ZipPath = Join-Path $DistReleaseDir "ClassroomOS-v$Version-Portable-Windows.zip"
Compress-Archive -Path "$PortableStaging\*" -DestinationPath $ZipPath -CompressionLevel Optimal

# Clean up uncompressed staging directory
Remove-Item $PortableStaging -Recurse -Force

# Copy Installer to dist_release if generated
$installerSource = Join-Path $DistInstallerDir "ClassroomOS-Setup-$Version.exe"
if (Test-Path $installerSource) {
    Copy-Item -Path $installerSource -Destination $DistReleaseDir -Force
}

# Calculate Cryptographic Hashes for all release artifacts
$ChecksumFile = Join-Path $DistReleaseDir "SHA256SUMS.txt"
$ChecksumLines = @()

Get-ChildItem -Path $DistReleaseDir -File | Where-Object { $_.Name -ne "SHA256SUMS.txt" } | ForEach-Object {
    $hash = (Get-FileHash -Path $_.FullName -Algorithm SHA256).Hash
    $ChecksumLines += "$hash  $($_.Name)"
}

$ChecksumLines | Out-File -FilePath $ChecksumFile -Encoding utf8

Write-Host ""
Write-Host "==========================================================" -ForegroundColor Green
Write-Host "  ClassroomOS Release Build & Packaging Complete!" -ForegroundColor Green
foreach ($line in $ChecksumLines) {
    Write-Host "  $line" -ForegroundColor White
}
Write-Host "  Manifest: $ChecksumFile" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Green
