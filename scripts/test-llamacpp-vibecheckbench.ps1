param(
  [int]$Port = 8080
)

$ErrorActionPreference = "Stop"

$env:VIBECHECKBENCH_PROVIDER = "llamacpp"
$env:VIBECHECKBENCH_LLAMACPP_URL = "http://127.0.0.1:$Port"
$env:VIBECHECKBENCH_NO_THINK = "1"

node skills\\vibecheckbench\scripts\run-profile.mjs `
  --profile examples\public-agent-profile.yaml `
  --case-file examples\public-agent-cases.json `
  --prompt-file examples\public-agent-system-prompt.txt `
  --cases 1 `
  --repeat 1
