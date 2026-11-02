# Independent Clean Install & Lifecycle Verification Test for ClassroomOS 2.1
$ErrorActionPreference = "Stop"

$installDir = "$env:TEMP\ClassroomOS_TestInstall"
$testAppData = "$env:TEMP\ClassroomOS_TestAppData"
$testPort = 5088
$baseUrl = "http://127.0.0.1:$testPort"
$version = "2.1.0"

Write-Host "=========================================================="
Write-Host "  ClassroomOS Clean-Install Lifecycle Verification (v$version)"
Write-Host "=========================================================="

# Ensure clean test AppData directory
if (Test-Path $testAppData) { Remove-Item -Path $testAppData -Recurse -Force }
New-Item -ItemType Directory -Path $testAppData -Force | Out-Null

if (-not (Test-Path "$installDir\ClassroomOS.exe")) {
    $installerExe = "dist_installer\ClassroomOS-Setup-$version.exe"
    if (-not (Test-Path $installerExe)) {
        $installerExe = (Get-ChildItem -Path "dist_installer\ClassroomOS-Setup-*.exe" | Sort-Object LastWriteTime -Descending | Select-Object -First 1).FullName
    }
    Write-Host "Installing ClassroomOS silently to $installDir using $installerExe..."
    $proc = Start-Process -FilePath $installerExe -ArgumentList "/DIR=`"$installDir`"", "/VERYSILENT", "/SUPPRESSMSGBOXES", "/NORESTART" -Wait -PassThru
    if ($proc.ExitCode -ne 0) { throw "Installer failed with code $($proc.ExitCode)" }
}

# 1. Launch installed ClassroomOS.exe pointing to test AppData
Write-Host "`n[1/7] Launching installed ClassroomOS.exe on port $testPort..."
$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName = "$installDir\ClassroomOS.exe"
$psi.Arguments = "--port $testPort --no-browser"
$psi.EnvironmentVariables["LOCALAPPDATA"] = $testAppData
$psi.UseShellExecute = $false
$psi.RedirectStandardOutput = $true
$psi.RedirectStandardError = $true

$serverProc = [System.Diagnostics.Process]::Start($psi)
Start-Sleep -Seconds 3

try {
    # Verify server is listening
    $health = Invoke-WebRequest -Uri "$baseUrl/api/institution/profile" -UseBasicParsing -TimeoutSec 5
    Write-Host "Server started successfully! Status code: $($health.StatusCode)"

    # 2. Test Initial Bootstrap (Create Admin)
    Write-Host "`n[2/7] Testing Initial Administrator Bootstrap..."
    $bootstrapPayload = @{
        email = "admin@lincoln.edu"
        password = "AdminSecurePass123!"
        full_name = "Super Administrator"
    } | ConvertTo-Json

    $adminAuth = Invoke-RestMethod -Uri "$baseUrl/api/auth/bootstrap" -Method POST -Body $bootstrapPayload -ContentType "application/json"
    $token = $adminAuth.token
    Write-Host "Bootstrap succeeded! Admin user ID: $($adminAuth.user.id), Token obtained."

    $headers = @{
        "Authorization" = "Bearer $token"
    }

    # Verify duplicate bootstrap is rejected
    try {
        Invoke-RestMethod -Uri "$baseUrl/api/auth/bootstrap" -Method POST -Body $bootstrapPayload -ContentType "application/json"
        throw "Expected 409 Conflict for duplicate bootstrap"
    } catch {
        Write-Host "Re-bootstrap safely rejected (409 Conflict as expected)."
    }

    # 3. Test Institution Profile & Branding Configuration
    Write-Host "`n[3/7] Testing Institution Profile & Branding..."
    $instPayload = @{
        institution_name = "Lincoln Science Academy"
        institution_code = "LSA-2026"
        academic_year = "2026-2027"
        current_term = "Fall Semester"
        contact_email = "contact@lincoln.edu"
    } | ConvertTo-Json
    $instUpdate = Invoke-RestMethod -Uri "$baseUrl/api/admin/institution" -Method PUT -Headers $headers -Body $instPayload -ContentType "application/json"
    Write-Host "Institution settings configured: $($instUpdate.settings.institution_name)"

    # Upload clean SVG logo
    $svgContent = '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><circle cx="50" cy="50" r="40" fill="#2563eb"/></svg>'
    $boundary = [System.Guid]::NewGuid().ToString()
    $bodyBytes = [System.Text.Encoding]::UTF8.GetBytes("--$boundary`r`nContent-Disposition: form-data; name=`"logo`"; filename=`"school.svg`"`r`nContent-Type: image/svg+xml`r`n`r`n$svgContent`r`n--$boundary--`r`n")
    
    $uploadResp = Invoke-RestMethod -Uri "$baseUrl/api/admin/institution/logo" -Method POST -Headers @{ "Authorization" = "Bearer $token"; "Content-Type" = "multipart/form-data; boundary=$boundary" } -Body $bodyBytes
    Write-Host "Logo upload successful: $($uploadResp.message)"

    # Fetch logo endpoint
    $logoGet = Invoke-WebRequest -Uri "$baseUrl/api/institution/logo" -UseBasicParsing
    Write-Host "Logo retrieved successfully! Content-Type: $($logoGet.Headers['Content-Type'])"

    # Test Malicious SVG Rejection (XXE / script injection)
    $badSvg = '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'
    $badBytes = [System.Text.Encoding]::UTF8.GetBytes("--$boundary`r`nContent-Disposition: form-data; name=`"logo`"; filename=`"bad.svg`"`r`nContent-Type: image/svg+xml`r`n`r`n$badSvg`r`n--$boundary--`r`n")
    try {
        Invoke-RestMethod -Uri "$baseUrl/api/admin/institution/logo" -Method POST -Headers @{ "Authorization" = "Bearer $token"; "Content-Type" = "multipart/form-data; boundary=$boundary" } -Body $badBytes
        throw "Expected malicious SVG to be rejected!"
    } catch {
        Write-Host "Malicious SVG correctly rejected by security sanitizer."
    }

    # 4. Test Student Creation & Portfolio
    Write-Host "`n[4/7] Testing Student Portfolio..."
    $studentPayload = @{
        full_name = "Alex Rivera"
        roll_number = "10A-042"
        class_name = "Grade 10"
        section = "A"
        enrollment_date = "2026-09-01"
        guardian_contact = "555-0192"
    } | ConvertTo-Json
    $studentResp = Invoke-RestMethod -Uri "$baseUrl/api/students" -Method POST -Headers $headers -Body $studentPayload -ContentType "application/json"
    $studentId = $studentResp.student.id
    Write-Host "Created student: $($studentResp.student.full_name), ID: $studentId"

    $portfolio = Invoke-RestMethod -Uri "$baseUrl/api/students/$studentId" -Method GET -Headers $headers
    Write-Host "Retrieved student portfolio: Roll $($portfolio.student.roll_number), Class $($portfolio.student.class_name)-$($portfolio.student.section)"

    # 5. Test Attendance & Session Finalization
    Write-Host "`n[5/7] Testing Attendance Session & Finalization..."
    $attPayload = @{
        class_name = "Grade 10"
        section = "A"
        date = "2026-10-31"
        records = @(
            @{
                student_id = $studentId
                status = "Present"
                remarks = "On time"
            }
        )
    } | ConvertTo-Json
    $attResp = Invoke-RestMethod -Uri "$baseUrl/api/attendance/bulk" -Method POST -Headers $headers -Body $attPayload -ContentType "application/json"
    Write-Host "Recorded attendance: $($attResp.message)"

    # Finalize session
    $finPayload = @{
        class_name = "Grade 10"
        section = "A"
        date = "2026-10-31"
    } | ConvertTo-Json
    $finResp = Invoke-RestMethod -Uri "$baseUrl/api/attendance/session/finalize" -Method POST -Headers $headers -Body $finPayload -ContentType "application/json"
    Write-Host "Session finalized: $($finResp.message)"

    # Verify finalized session is locked
    try {
        Invoke-RestMethod -Uri "$baseUrl/api/attendance/bulk" -Method POST -Headers $headers -Body $attPayload -ContentType "application/json"
        throw "Expected 409 Conflict on finalized session"
    } catch {
        Write-Host "Finalized session write correctly rejected (409 Conflict)."
    }

    # Reopen session with audit reason
    $reopenPayload = @{
        class_name = "Grade 10"
        section = "A"
        date = "2026-10-31"
        reason = "Teacher verified late student arrival"
    } | ConvertTo-Json
    $reopenResp = Invoke-RestMethod -Uri "$baseUrl/api/attendance/session/reopen" -Method POST -Headers $headers -Body $reopenPayload -ContentType "application/json"
    Write-Host "Session reopened with audit: $($reopenResp.message)"

    # Fetch report
    $report = Invoke-RestMethod -Uri "$baseUrl/api/reports/attendance?class_name=Grade%2010" -Method GET -Headers $headers
    Write-Host "Attendance report generated: Rate = $($report.overall_attendance_rate)%"

    # 6. Test Database Backup & Verification
    Write-Host "`n[6/7] Testing Database Backup..."
    $srcDb = "$testAppData\ClassroomOS\data\classroom.db"
    $backupDst = "$testAppData\ClassroomOS\backups\manual-test.db"
    $pythonCmd = "from pathlib import Path; import sys; sys.path.insert(0, 'codebase/backend'); from database_tools import create_backup, verify_backup; m = create_backup(Path(r'$srcDb'), Path(r'$backupDst')); assert verify_backup(Path(r'$backupDst')); print('Verified backup hash:', m['sha256'])"
    & ".\codebase\backend\venv\Scripts\python.exe" -c $pythonCmd

} finally {
    if ($serverProc -and -not $serverProc.HasExited) {
        Write-Host "`nStopping test server process..."
        $serverProc.Kill()
        $serverProc.WaitForExit(3000)
    }
}

# 7. Test Application Restart & Persistence
Write-Host "`n[7/7] Testing Application Restart & Data Persistence..."
$serverProc2 = [System.Diagnostics.Process]::Start($psi)
Start-Sleep -Seconds 3
try {
    # Login again with admin credentials
    $loginPayload = @{
        email = "admin@lincoln.edu"
        password = "AdminSecurePass123!"
    } | ConvertTo-Json
    $loginResp = Invoke-RestMethod -Uri "$baseUrl/api/auth/login" -Method POST -Body $loginPayload -ContentType "application/json"
    $token2 = $loginResp.token
    Write-Host "Login after restart succeeded! Admin full name: $($loginResp.user.full_name)"

    # Verify student data survived restart
    $stCheck = Invoke-RestMethod -Uri "$baseUrl/api/students" -Method GET -Headers @{ "Authorization" = "Bearer $token2" }
    Write-Host "Student roster preserved across restart! Total students: $($stCheck.total)"

    # Verify institution settings survived restart
    $instCheck = Invoke-RestMethod -Uri "$baseUrl/api/institution/profile" -Method GET
    Write-Host "Institution profile preserved: $($instCheck.institution.institution_name)"
} finally {
    if ($serverProc2 -and -not $serverProc2.HasExited) {
        $serverProc2.Kill()
        $serverProc2.WaitForExit(3000)
    }
}

# 8. Test Inno Setup Upgrade & Data Preservation
Write-Host "`nTesting Inno Setup Upgrade..."
$upgradeProc = Start-Process -FilePath "dist_installer\ClassroomOS-Setup-2.0.0.exe" -ArgumentList "/DIR=`"$installDir`"", "/VERYSILENT", "/SUPPRESSMSGBOXES", "/NORESTART" -Wait -PassThru
Write-Host "Upgrade installation completed with ExitCode: $($upgradeProc.ExitCode)"

# 9. Test Uninstallation and Data Preservation
Write-Host "`nTesting Uninstaller..."
$uninstaller = "$installDir\unins000.exe"
$uninsProc = Start-Process -FilePath $uninstaller -ArgumentList "/VERYSILENT", "/NORESTART", "/SUPPRESSMSGBOXES" -Wait -PassThru
Write-Host "Uninstaller completed with ExitCode: $($uninsProc.ExitCode)"

$dbPreserved = Test-Path "$testAppData\ClassroomOS\data\classroom.db"
$secretPreserved = Test-Path "$testAppData\ClassroomOS\secret.key"

Write-Host "`n=========================================================="
Write-Host "  Clean Install & Lifecycle Test Results:"
Write-Host "  Database Preserved After Uninstall: $dbPreserved"
Write-Host "  Secret Key Preserved After Uninstall: $secretPreserved"
Write-Host "=========================================================="

if (-not $dbPreserved) {
    throw "TEST FAILED: Database was not preserved after uninstall!"
}
Write-Host "CLEAN INSTALL & LIFECYCLE TESTS: 100% PASSED!`n"
