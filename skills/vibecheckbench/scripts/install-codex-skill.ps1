param(
  [string]$DestinationRoot = "$env:USERPROFILE\.codex\skills"
)

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$skillDir = Resolve-Path (Join-Path $scriptDir "..")

New-Item -ItemType Directory -Force -Path $DestinationRoot | Out-Null

$excludeDirs = @("__pycache__", "reports", ".openclaw-local", ".openclaw", "state")
$excludeFiles = @("*.pyc", "npm-debug.log*")
$skillNames = @("vibecheckbench", "vibeforge")

foreach ($name in $skillNames) {
  $destination = Join-Path $DestinationRoot $name

  if (Test-Path $destination) {
    Remove-Item -Recurse -Force -LiteralPath $destination
  }

  Copy-Item -Recurse -LiteralPath $skillDir -Destination $destination -Exclude $excludeFiles

  foreach ($dir in $excludeDirs) {
    Get-ChildItem -Recurse -Force -Directory -LiteralPath $destination |
      Where-Object { $_.Name -eq $dir } |
      Remove-Item -Recurse -Force
  }

  if ($name -eq "vibeforge") {
    $skillMd = Join-Path $destination "SKILL.md"
    if (Test-Path $skillMd) {
      $text = Get-Content -Raw -LiteralPath $skillMd
      $text = $text -replace '(?m)^name:\s*vibecheckbench\s*$', 'name: vibeforge'
      Set-Content -LiteralPath $skillMd -Value $text -NoNewline
    }
  }

  Write-Host "Installed VibeForge Codex skill as '$name' to $destination"
}

Write-Host "Both vibecheckbench and vibeforge point at the same skill content."
