param (
    [Parameter(Mandatory = $false)]
    [string]$DockerHubUsername = ""
)

Write-Host "🚀 Docker Hub Push Tool for Classroom Management" -ForegroundColor Cyan

if ([string]::IsNullOrWhiteSpace($DockerHubUsername)) {
    $DockerHubUsername = Read-Host "Enter your Docker Hub username"
}

if ([string]::IsNullOrWhiteSpace($DockerHubUsername)) {
    Write-Host "❌ Docker Hub username is required." -ForegroundColor Red
    exit 1
}

$backendTag = "${DockerHubUsername}/classroom-backend:latest"
$frontendTag = "${DockerHubUsername}/classroom-frontend:latest"

Write-Host "`n🔑 Verifying Docker login status..." -ForegroundColor Yellow
docker login

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Docker login failed. Please run 'docker login' and try again." -ForegroundColor Red
    exit $LASTEXITCODE
}

Write-Host "`n🏷️ Tagging images for Docker Hub..." -ForegroundColor Yellow
docker tag classroom-backend:latest $backendTag
docker tag classroom-frontend:latest $frontendTag

Write-Host "`n📤 Pushing Backend Image to Docker Hub ($backendTag)..." -ForegroundColor Yellow
docker push $backendTag
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to push $backendTag" -ForegroundColor Red
    exit $LASTEXITCODE
}
Write-Host "✅ Backend image pushed: https://hub.docker.com/r/${DockerHubUsername}/classroom-backend" -ForegroundColor Green

Write-Host "`n📤 Pushing Frontend Image to Docker Hub ($frontendTag)..." -ForegroundColor Yellow
docker push $frontendTag
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to push $frontendTag" -ForegroundColor Red
    exit $LASTEXITCODE
}
Write-Host "✅ Frontend image pushed: https://hub.docker.com/r/${DockerHubUsername}/classroom-frontend" -ForegroundColor Green

Write-Host "`n🎉 Successfully published all images to Docker Hub!" -ForegroundColor Cyan
