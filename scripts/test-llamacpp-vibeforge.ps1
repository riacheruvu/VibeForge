param(
  [int]$Port = 8080
)

$ErrorActionPreference = "Stop"

$env:VIBEFORGE_PROVIDER = "llamacpp"
$env:VIBEFORGE_LLAMACPP_URL = "http://127.0.0.1:$Port"
$env:VIBEFORGE_NO_THINK = "1"

node skills\\vibeforge\scripts\run-profile.mjs `
  --profile examples\public-agent-profile.yaml `
  --case-file examples\public-agent-cases.json `
  --prompt-file examples\public-agent-system-prompt.txt `
  --cases 1 `
  --repeat 1
