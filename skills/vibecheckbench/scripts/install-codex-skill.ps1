param(
  [string]$DestinationRoot = "$env:USERPROFILE\.codex\skills"
)

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$skillDir = Resolve-Path (Join-Path $scriptDir "..")
$destination = Join-Path $DestinationRoot "vibecheckbench"

New-Item -ItemType Directory -Force -Path $DestinationRoot | Out-Null

if (Test-Path $destination) {
  Remove-Item -Recurse -Force -LiteralPath $destination
}

$excludeDirs = @("__pycache__", "reports", ".openclaw-local", ".openclaw", "state")
$excludeFiles = @("*.pyc", "npm-debug.log*")

Copy-Item -Recurse -LiteralPath $skillDir -Destination $destination -Exclude $excludeFiles

foreach ($dir in $excludeDirs) {
  Get-ChildItem -Recurse -Force -Directory -LiteralPath $destination |
    Where-Object { $_.Name -eq $dir } |
    Remove-Item -Recurse -Force
}

Write-Host "Installed VibeCheckBench Codex skill to $destination"
