# ClassroomOS 2.0.0 — Production Release Build & Packaging Script
# Generates production frontend build, portable desktop bundle, and SHA-256 checksums

$ErrorActionPreference = "Stop"

$ProjectRoot = $PSScriptRoot
$FrontendDir = Join-Path $ProjectRoot "codebase\frontend"
$BackendDir = Join-Path $ProjectRoot "codebase\backend"
$DistReleaseDir = Join-Path $ProjectRoot "dist_release"
$DistInstallerDir = Join-Path $ProjectRoot "dist_installer"
$Version = "2.0.0"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  ClassroomOS v$Version -- Release Build Pipeline" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Build Production Frontend
Write-Host ""
Write-Host "[1/4] Building production frontend with Vite..." -ForegroundColor Yellow
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

# 2. Clean Pycache & Temporary Files (targeted, avoids traversing venv)
Write-Host ""
Write-Host "[2/4] Cleaning Python caches and temporary files..." -ForegroundColor Yellow
$pycacheRel = @("__pycache__", "phase1_students\__pycache__", "phase2_attendance\__pycache__", "phase3_photo\__pycache__", "phase4_quality\__pycache__", "tests\__pycache__", ".pytest_cache")
foreach ($rel in $pycacheRel) {
    $dir = Join-Path $BackendDir $rel
    if (Test-Path $dir) {
        Remove-Item -Path $dir -Recurse -Force -ErrorAction SilentlyContinue
    }
}
Write-Host "[OK] Temporary caches removed" -ForegroundColor Green

# 3. Create Distribution Directories
if (Test-Path $DistReleaseDir) { Remove-Item $DistReleaseDir -Recurse -Force }
New-Item -ItemType Directory -Path $DistReleaseDir -Force | Out-Null

$PortableStaging = Join-Path $DistReleaseDir "ClassroomOS-v$Version-Portable"
New-Item -ItemType Directory -Path $PortableStaging -Force | Out-Null

# Copy Launcher & Root Files
Copy-Item -Path (Join-Path $ProjectRoot "run-desktop.bat") -Destination $PortableStaging -Force
Copy-Item -Path (Join-Path $ProjectRoot "README.md") -Destination $PortableStaging -Force

# Copy Backend Files (core app code only, no venv/tests/instance)
$StagingBackend = Join-Path $PortableStaging "codebase\backend"
New-Item -ItemType Directory -Path $StagingBackend -Force | Out-Null

$backendItems = @(
    "app.py",
    "launcher.py",
    "db.py",
    "database_tools.py",
    "migrations.py",
    "requirements.txt",
    "haarcascade_frontalface_default.xml",
    "phase1_students",
    "phase2_attendance",
    "phase3_photo",
    "phase4_quality"
)
foreach ($item in $backendItems) {
    $src = Join-Path $BackendDir $item
    if (Test-Path $src) {
        Copy-Item -Path $src -Destination $StagingBackend -Recurse -Force
    }
}

# Copy Frontend Dist
$StagingFrontend = Join-Path $PortableStaging "codebase\frontend"
New-Item -ItemType Directory -Path $StagingFrontend -Force | Out-Null
Copy-Item -Path (Join-Path $FrontendDir "dist") -Destination $StagingFrontend -Recurse -Force

Write-Host "[OK] Staged portable files" -ForegroundColor Green

# 4. Inno Setup Compilation (if compiler available)
Write-Host ""
Write-Host "[3/4] Checking Inno Setup Compiler (ISCC.exe)..." -ForegroundColor Yellow
$isccCmd = Get-Command iscc.exe -ErrorAction SilentlyContinue
$isccFromPath = $null
if ($isccCmd) { $isccFromPath = $isccCmd.Source }

$InnoCompilerPaths = @(
    "C:\Program Files (x86)\Inno Setup 6\ISCC.exe",
    "C:\Program Files\Inno Setup 6\ISCC.exe",
    $isccFromPath
)
$Iscc = $InnoCompilerPaths | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1

if ($Iscc) {
    Write-Host "Compiling Inno Setup installer using $Iscc..." -ForegroundColor Cyan
    if (-not (Test-Path $DistInstallerDir)) { New-Item -ItemType Directory -Path $DistInstallerDir -Force | Out-Null }
    & $Iscc (Join-Path $ProjectRoot "packaging\ClassroomOS.iss")
    Write-Host "[OK] Windows Installer generated in dist_installer\" -ForegroundColor Green
} else {
    Write-Host "Notice: ISCC.exe not found on system PATH. Inno Setup script is available at packaging\ClassroomOS.iss." -ForegroundColor Gray
}

# 5. Create Portable Zip Archive
Write-Host ""
Write-Host "[4/4] Generating release zip archive and SHA-256 checksums..." -ForegroundColor Yellow
$ZipPath = Join-Path $DistReleaseDir "ClassroomOS-v$Version-Portable-Windows.zip"
Compress-Archive -Path "$PortableStaging\*" -DestinationPath $ZipPath -CompressionLevel Optimal

# Clean up uncompressed staging directory
Remove-Item $PortableStaging -Recurse -Force

# Calculate Checksums
$ChecksumFile = Join-Path $DistReleaseDir "SHA256SUMS.txt"
$ZipHash = (Get-FileHash -Path $ZipPath -Algorithm SHA256).Hash
$ChecksumLines = @(
    "$ZipHash  ClassroomOS-v$Version-Portable-Windows.zip"
)

# Include installer hash if generated
if (Test-Path $DistInstallerDir) {
    Get-ChildItem -Path $DistInstallerDir -Filter "*.exe" | ForEach-Object {
        $InstallerHash = (Get-FileHash -Path $_.FullName -Algorithm SHA256).Hash
        $ChecksumLines += "$InstallerHash  $($_.Name)"
        Copy-Item -Path $_.FullName -Destination $DistReleaseDir -Force
    }
}

$ChecksumLines | Out-File -FilePath $ChecksumFile -Encoding utf8

Write-Host ""
Write-Host "==========================================================" -ForegroundColor Green
Write-Host "  Release Build Complete!" -ForegroundColor Green
Write-Host "  Package:  $ZipPath" -ForegroundColor White
Write-Host "  SHA-256:  $ZipHash" -ForegroundColor White
Write-Host "  Checksum: $ChecksumFile" -ForegroundColor White
Write-Host "==========================================================" -ForegroundColor Green
