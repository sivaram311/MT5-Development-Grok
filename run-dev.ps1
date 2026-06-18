# Minimal CIM-style launcher for grok_dev
# Opens Windows Terminal with two tabs:
#   - Backend (Spring Boot)
#   - Frontend (Angular)

$root = Split-Path -Parent $MyInvocation.MyCommand.Definition

$backendPath = Join-Path $root "backend"
$frontendPath = Join-Path $root "frontend"

# Find an available port starting from 8081
$port = 8081
while ($true) {
    try {
        $listener = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Any, $port)
        $listener.Start()
        $listener.Stop()
        break
    } catch {
        $port++
        if ($port -gt 9000) { $port = 8081; break }
    }
}

Write-Host "Using backend port: $port" -ForegroundColor Yellow
Write-Host "Starting grok_dev services..." -ForegroundColor Cyan
Write-Host "Backend : $backendPath"
Write-Host "Frontend: $frontendPath"
Write-Host ""

# Validate paths
if (-not (Test-Path $backendPath)) {
    Write-Error "Backend folder not found: $backendPath"
    exit 1
}
if (-not (Test-Path $frontendPath)) {
    Write-Error "Frontend folder not found: $frontendPath"
    exit 1
}

# Launch using Windows Terminal (same style as your CIM script)
wt `
  new-tab -p "Windows PowerShell" powershell -NoExit -Command "cd '$backendPath'; Write-Host '=== Starting Spring Boot Backend ===' -ForegroundColor Green; mvn spring-boot:run -Dserver.port=$port" `; `
  new-tab -p "Windows PowerShell" powershell -NoExit -Command "cd '$frontendPath'; Write-Host '=== Starting Angular Frontend ===' -ForegroundColor Green; npm run start"

Write-Host ""
Write-Host "Launched tabs in Windows Terminal." -ForegroundColor Green
Write-Host " - Backend  → http://localhost:$port"
Write-Host " - Frontend → http://localhost:4200"
if ($port -ne 8081) {
    Write-Host "   NOTE: port changed — ensure frontend environment.ts uses $port if needed" -ForegroundColor Yellow
}
Write-Host "Close this window when done." -ForegroundColor Gray
