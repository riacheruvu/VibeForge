param(
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$PromptfooArgs
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$entrypoint = Join-Path $repoRoot ".promptfoo-runtime\node_modules\promptfoo\dist\src\entrypoint.js"

if (-not (Test-Path -LiteralPath $entrypoint)) {
  throw "Promptfoo is not installed in .promptfoo-runtime."
}

$nodeExe = Get-Command node -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source -First 1
if (-not $nodeExe) {
  throw "Node.js was not found on PATH."
}

$env:PROMPTFOO_CONFIG_DIR = Join-Path $repoRoot ".promptfoo"
$env:PROMPTFOO_DISABLE_TELEMETRY = "1"
$env:PROMPTFOO_DISABLE_UPDATE = "1"
$env:PROMPTFOO_DISABLE_WAL_MODE = "1"
$env:PROMPTFOO_CACHE_ENABLED = "false"

New-Item -ItemType Directory -Force -Path $env:PROMPTFOO_CONFIG_DIR | Out-Null

Push-Location $repoRoot
try {
  & $nodeExe $entrypoint @PromptfooArgs
  exit $LASTEXITCODE
} finally {
  Pop-Location
}
