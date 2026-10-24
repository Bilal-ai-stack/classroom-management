# Classroom Management - Local Docker Image Build Script
Write-Host "🐳 Building Classroom Management Docker Images..." -ForegroundColor Cyan

# 1. Build Backend Image
Write-Host "`n📦 [1/2] Building Backend Docker Image (Flask + Gunicorn)..." -ForegroundColor Yellow
docker build -t classroom-backend:latest ./codebase/backend

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Backend image build failed. Please make sure Docker Desktop is running." -ForegroundColor Red
    exit $LASTEXITCODE
}
Write-Host "✅ Backend image built successfully: classroom-backend:latest" -ForegroundColor Green

# 2. Build Frontend Image
Write-Host "`n📦 [2/2] Building Frontend Docker Image (React + Nginx)..." -ForegroundColor Yellow
docker build -t classroom-frontend:latest ./codebase/frontend

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Frontend image build failed." -ForegroundColor Red
    exit $LASTEXITCODE
}
Write-Host "✅ Frontend image built successfully: classroom-frontend:latest" -ForegroundColor Green

Write-Host "`n🎉 All Docker images built successfully!" -ForegroundColor Cyan
Write-Host "👉 Run the stack locally using: docker compose up" -ForegroundColor White
Write-Host "👉 Push to Docker Hub using: .\docker-push.ps1 -DockerHubUsername <your_username>" -ForegroundColor White
