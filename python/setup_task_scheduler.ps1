# Helper script to create a Windows Task Scheduler entry for the XAUUSD Data Sync Daemon
# Run this as Administrator in PowerShell for best results ("Run whether user is logged on or not").

$taskName = "GrokDev-MT5-XAUUSD-Sync"
$scriptPath = Join-Path $PSScriptRoot "run_data_downloader.py"
$workingDir = $PSScriptRoot

Write-Host "=== GrokDev MT5 XAUUSD Sync - Task Scheduler Setup ===" -ForegroundColor Cyan
Write-Host "Working dir : $workingDir"
Write-Host "Script      : $scriptPath"
Write-Host ""

# Auto-detect python executable (python, py, python3). Prefers full path.
function Find-Python {
    $candidates = @(
        "python.exe",
        "py.exe",
        "python3.exe",
        "$env:LOCALAPPDATA\Programs\Python\Python3*\python.exe",
        "C:\Python*\python.exe",
        "C:\Python314\python.exe",
        "C:\Python313\python.exe",
        "C:\Python312\python.exe"
    )

    foreach ($c in $candidates) {
        try {
            $found = Get-Command $c -ErrorAction SilentlyContinue
            if ($found) {
                $full = $found.Source
                if ($full -and (Test-Path $full)) { return $full }
            }
        } catch {}
    }

    # Fallback glob search
    $globs = @(
        "$env:LOCALAPPDATA\Programs\Python\Python3*\python.exe",
        "C:\Python3*\python.exe"
    )
    foreach ($g in $globs) {
        $match = Get-Item $g -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($match) { return $match.FullName }
    }

    return $null
}

$pythonPath = Find-Python
if (-not $pythonPath) {
    Write-Host "Could not auto-detect Python. Please edit this script or provide full path." -ForegroundColor Yellow
    $pythonPath = Read-Host "Enter full path to python.exe (e.g. C:\Python312\python.exe)"
}

if (-not (Test-Path $pythonPath)) {
    Write-Error "Python not found at: $pythonPath"
    exit 1
}
Write-Host "Using Python: $pythonPath" -ForegroundColor Green

# Check if task exists
$existingTask = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($existingTask) {
    Write-Host "Task '$taskName' already exists. Deleting old task..."
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
}

# Action: run the python wrapper (defaults to daemon + smart per-TF or 45s)
$action = New-ScheduledTaskAction -Execute $pythonPath -Argument "`"$scriptPath`"" -WorkingDirectory $workingDir

# Triggers: startup + on logon (so it survives reboots + user sessions)
$triggerStartup = New-ScheduledTaskTrigger -AtStartup
$triggerLogon   = New-ScheduledTaskTrigger -AtLogOn

# Settings for robustness (24/7 daemon)
$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -RunOnlyIfNetworkAvailable `
    -DontStopOnIdleEnd `
    -RestartCount 3 `
    -RestartInterval (New-TimeSpan -Minutes 1)

# Principal: highest privileges, run whether logged on or not (may prompt for password)
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -RunLevel Highest -LogonType InteractiveOrService

# Register
try {
    Register-ScheduledTask `
        -TaskName $taskName `
        -Action $action `
        -Trigger $triggerStartup, $triggerLogon `
        -Settings $settings `
        -Principal $principal `
        -Description "Continuously syncs completed XAUUSD candles (all TFs) from MT5 to Postgres grok_dev schema. Uses smart per-TF intervals by default. Run from python/ dir." `
        -Force | Out-Null

    Write-Host ""
    Write-Host "✅ Task '$taskName' created/updated successfully." -ForegroundColor Green
    Write-Host "   Triggers: At system startup + At logon"
    Write-Host "   Runs with: $pythonPath $scriptPath"
    Write-Host "   Working dir: $workingDir"
    Write-Host ""
    Write-Host "Manage in Task Scheduler or use:"
    Write-Host "  Start-ScheduledTask -TaskName '$taskName'"
    Write-Host "  Stop-ScheduledTask  -TaskName '$taskName'"
    Write-Host "  Get-ScheduledTask   -TaskName '$taskName' | Get-ScheduledTaskInfo"
    Write-Host ""
    Write-Host "IMPORTANT: If 'Run whether user is logged on or not' is required," -ForegroundColor Yellow
    Write-Host "you may be prompted for your Windows password during registration."
} catch {
    Write-Error "Failed to register task: $_"
    Write-Host "Tip: Right-click PowerShell and 'Run as Administrator'."
}