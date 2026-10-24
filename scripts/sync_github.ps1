# scripts/sync_github.ps1
# Automates GitHub repository creation, pushing branches, and creating issues via GitHub API

param (
    [string]$Token = $env:GITHUB_TOKEN,
    [string]$RepoName = "classroom-management"
)

$Owner = "Bilal-ai-stack"
$Headers = @{
    "Accept" = "application/vnd.github.v3+json"
    "User-Agent" = "Antigravity-Sync-Script"
}

if ($Token) {
    $Headers["Authorization"] = "Bearer $Token"
} else {
    Write-Host "No GITHUB_TOKEN provided." -ForegroundColor Yellow
    Write-Host "To automatically create the repository and issues on GitHub:"
    Write-Host "  1. Generate a Personal Access Token (classic with 'repo' scope or fine-grained with Repo read/write) at:"
    Write-Host "     https://github.com/settings/tokens"
    Write-Host "  2. Run: .\scripts\sync_github.ps1 -Token <your_token>" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Configuring local git branches and remote URL..." -ForegroundColor Green
    git remote remove origin 2>$null
    git remote add origin "https://github.com/$Owner/$RepoName.git"
    Write-Host "Remote set to https://github.com/$Owner/$RepoName.git"
    exit 0
}

Write-Host "Checking if repository '$Owner/$RepoName' exists..." -ForegroundColor Cyan
try {
    $repo = Invoke-RestMethod -Uri "https://api.github.com/repos/$Owner/$RepoName" -Headers $Headers -Method Get
    Write-Host "Repository exists: $($repo.html_url)" -ForegroundColor Green
} catch {
    if ($_.Exception.Response.StatusCode.value__ -eq 404) {
        Write-Host "Repository not found. Creating repository '$RepoName' under $Owner..." -ForegroundColor Yellow
        $body = @{
            name = $RepoName
            description = "Classroom Management System — Full-Stack AI Practice Project with Flask, React, and SQLite"
            private = $false
            has_issues = $true
            has_projects = $true
        } | ConvertTo-Json

        $repo = Invoke-RestMethod -Uri "https://api.github.com/user/repos" -Headers $Headers -Method Post -Body $body
        Write-Host "Created repository: $($repo.html_url)" -ForegroundColor Green
    } else {
        Write-Error "Error checking/creating repository: $_"
        exit 1
    }
}

# Setup remote
git remote remove origin 2>$null
git remote add origin "https://github.com/$Owner/$RepoName.git"

# Push branches
Write-Host "Pushing branches to remote..." -ForegroundColor Cyan
git push -u origin main
git push -u origin develop
git push origin --all

# Create GitHub Issues from list
$issues = @(
    @{
        title = "[Epic] Backend Foundation & Student CRUD API"
        body = "Setup Flask, SQLite, and Flask-SQLAlchemy with Student model and REST endpoints (GET, POST, PUT, PATCH /archive).`n`n**Acceptance Criteria:**`n- [ ] Student model with roll_number unique constraint per class.`n- [ ] REST API endpoints for student listing, creation, editing, and archiving.`n- [ ] Validation for required fields and proper error codes (400, 404)."
        labels = @("backend", "enhancement", "phase-1")
    },
    @{
        title = "[Epic] React + Vite Frontend Scaffolding & Light UI Design System"
        body = "Initialize React + Vite frontend, establish CSS tokens (background #F8FAFC, primary #2563EB, text #0F172A), and create layout structure.`n`n**Acceptance Criteria:**`n- [ ] Top navigation or sidebar with responsive layout.`n- [ ] Light theme styling with clear contrast and typography.`n- [ ] Reusable UI components (cards, badges, modal, buttons)."
        labels = @("frontend", "ui/ux", "phase-1")
    },
    @{
        title = "[Feature] Student Management & Portfolio View"
        body = "Searchable and filterable student roster with Add/Edit modals and an individual portfolio view.`n`n**Acceptance Criteria:**`n- [ ] Search students by name or roll number.`n- [ ] Add/Edit student modal with form validation.`n- [ ] Portfolio page displaying student details and attendance metrics summary."
        labels = @("frontend", "feature", "phase-1")
    },
    @{
        title = "[Epic] Attendance Data Model & Bulk REST Endpoints"
        body = "Implement Attendance model with composite unique constraint (student_id, date). Endpoints for fetching roster and bulk saving attendance.`n`n**Acceptance Criteria:**`n- [ ] Enforce unique (student_id, date) constraint.`n- [ ] GET /api/attendance returns class roster with current status for the date.`n- [ ] POST /api/attendance/bulk updates records without duplicating."
        labels = @("backend", "enhancement", "phase-2")
    },
    @{
        title = "[Feature] Daily Attendance Roster UI"
        body = "Teacher-friendly daily attendance page with date picker, class selector, and one-click status buttons (Present / Absent / Late).`n`n**Acceptance Criteria:**`n- [ ] Date picker defaults to today.`n- [ ] Quick toggles for Present, Absent, and Late with distinct accessible badges.`n- [ ] Bulk 'Save Attendance' button with instant feedback toast."
        labels = @("frontend", "feature", "phase-2")
    },
    @{
        title = "[Feature] Attendance Analytics & Reports"
        body = "Attendance report views showing daily counts, monthly trends, and CSV export.`n`n**Acceptance Criteria:**`n- [ ] Summary cards on Dashboard showing today's attendance rate.`n- [ ] Monthly attendance breakdown per student.`n- [ ] Export attendance records to CSV file."
        labels = @("fullstack", "analytics", "phase-2")
    },
    @{
        title = "[Epic] Local Face Detection Service (OpenCV)"
        body = "Local Haar Cascade face detection pipeline that generates temporary face thumbnails without biometric identification.`n`n**Acceptance Criteria:**`n- [ ] Extract face bounding boxes from uploaded group photos.`n- [ ] Save temporary cropped thumbnails for teacher review.`n- [ ] Never store face embeddings or biometric profiles."
        labels = @("backend", "ai/ml", "privacy", "phase-3")
    },
    @{
        title = "[Feature] Teacher Photo-Verification Review Screen"
        body = "Review interface pairing detected face crops with a student roster dropdown, letting the teacher confirm matches before saving.`n`n**Acceptance Criteria:**`n- [ ] Prominent UI banner: 'Experimental Photo-Assisted Review (Non-Biometric)'.`n- [ ] Displays detected face crops with student assignment dropdowns.`n- [ ] Unmatched students are clearly displayed for manual review.`n- [ ] Clean-up / purge button to delete temporary session photos."
        labels = @("frontend", "feature", "privacy", "phase-3")
    },
    @{
        title = "[Testing] Backend Pytest Suite & Validation Hardening"
        body = "Unit and integration tests covering student CRUD, duplicate attendance prevention, and error responses.`n`n**Acceptance Criteria:**`n- [ ] pytest tests for /api/students and /api/attendance.`n- [ ] Validation against invalid dates and malformed payloads."
        labels = @("testing", "backend", "phase-4")
    },
    @{
        title = "[Documentation] Complete Setup Guide & Seed Data"
        body = "Write comprehensive README with Windows PowerShell commands, setup steps, and provide fictional student seed data.`n`n**Acceptance Criteria:**`n- [ ] seed.py creates 10+ demo students with sample attendance records.`n- [ ] README.md includes clear steps to run both backend and frontend on Windows."
        labels = @("documentation", "phase-4")
    }
)

Write-Host "Creating issues on GitHub..." -ForegroundColor Cyan
foreach ($item in $issues) {
    try {
        $body = @{
            title = $item.title
            body = $item.body
            labels = $item.labels
        } | ConvertTo-Json
        $createdIssue = Invoke-RestMethod -Uri "https://api.github.com/repos/$Owner/$RepoName/issues" -Headers $Headers -Method Post -Body $body
        Write-Host "Created Issue #$($createdIssue.number): $($createdIssue.title)" -ForegroundColor Green
    } catch {
        Write-Warning "Could not create issue '$($item.title)': $_"
    }
}

Write-Host "`nAll set! View your project at: https://github.com/$Owner/$RepoName" -ForegroundColor Green
