# Deploy Grok Dev MQL5 Expert Advisors to all local MT5 terminals.
# Usage (from repo):
#   .\python\mt5_scripts\deploy-mt5-eas.ps1
#   .\python\mt5_scripts\deploy-mt5-eas.ps1 -TerminalId 903AFBEA36629AEC9838022C670CC5D2

[CmdletBinding()]
param(
    [string]$TerminalId = "",
    [switch]$WhatIf
)

$ErrorActionPreference = "Stop"
$ScriptDir = $PSScriptRoot
$EaFiles = @(
    "GrokDevOrderRsiExport.mq5",
    "GrokDevOrderRsiExport.ex5",
    "GrokDevGannScanner.mq5",
    "GrokDevGannScanner.ex5"
)

foreach ($name in $EaFiles) {
    $path = Join-Path $ScriptDir $name
    if (-not (Test-Path $path)) {
        throw "Missing required file: $path (compile with MetaEditor first if .ex5 is absent)"
    }
}

$terminalRoot = Join-Path $env:APPDATA "MetaQuotes\Terminal"
if (-not (Test-Path $terminalRoot)) {
    throw "MT5 terminal data not found at $terminalRoot - log into MetaTrader 5 once, then retry."
}

$expertsDirs = @()
if ($TerminalId) {
    $dir = Join-Path $terminalRoot "$TerminalId\MQL5\Experts"
    if (-not (Test-Path $dir)) {
        throw "Experts folder not found for terminal ${TerminalId}: $dir"
    }
    $expertsDirs += $dir
} else {
    $expertsDirs = Get-ChildItem -Path $terminalRoot -Directory -ErrorAction SilentlyContinue |
        ForEach-Object {
            $experts = Join-Path $_.FullName "MQL5\Experts"
            if (Test-Path $experts) { $experts }
        }
}

if ($expertsDirs.Count -eq 0) {
    throw "No MQL5\Experts folders found under $terminalRoot"
}

Write-Host "Grok Dev - deploy EAs to MT5 Experts" -ForegroundColor Cyan
Write-Host "Source: $ScriptDir"
Write-Host ""

foreach ($experts in $expertsDirs) {
    $tid = Split-Path (Split-Path (Split-Path $experts -Parent) -Parent) -Leaf
    Write-Host "Terminal $tid" -ForegroundColor Yellow
    Write-Host "  -> $experts"

    foreach ($name in $EaFiles) {
        $src = Join-Path $ScriptDir $name
        $dst = Join-Path $experts $name
        if ($WhatIf) {
            Write-Host "  [WhatIf] Copy $name"
        } else {
            Copy-Item $src $dst -Force
            Write-Host "  Copied $name"
        }
    }
    Write-Host ""
}

if ($WhatIf) {
    Write-Host "WhatIf only - no files were copied." -ForegroundColor DarkYellow
} else {
    Write-Host "Done. In MT5: Navigator -> Expert Advisors -> Refresh, then attach EAs." -ForegroundColor Green
    Write-Host "  GrokDevOrderRsiExport -> XAUUSD (Analyzer MT5 built-in RSI)"
    Write-Host "  GrokDevGannScanner    -> XAUUSD M5/M15 (Gann intraday scanner)"
}
