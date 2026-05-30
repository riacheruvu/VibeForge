# VibeCheckBench - Claude Code Integration

This file teaches Claude Code how to work with VibeCheckBench.

## What this repo does

VibeCheckBench turns user preference profiles into runnable AI regression suites.

The preferred path is:

```text
preferences.yaml + cases.json + system-prompt.txt
  -> export-promptfoo.mjs
  -> promptfooconfig.yaml
  -> promptfoo eval
```

The judge-based runner is still available for optional A/B prompt comparison,
but it should not be treated as the default architecture.

## Project layout

```
skills/vibecheckbench/scripts/
  export-promptfoo.mjs        # Preferred: Promptfoo config exporter
  run-vibecheckbench.mjs          # Node runner (llamacpp / openai / anthropic)
  run-profile.mjs          # Full preference profile runner
  run-vibecheckbench-local.py     # Python runner (llama-cpp-python, GGUF direct)
  install-codex-skill.ps1  # Copies this skill into ~/.codex/skills/vibecheckbench
.claude/commands/vibecheckbench.md # Claude Code slash command
skills/vibecheckbench/agents/openai.yaml # Codex UI metadata
docker/
  sandbox.Dockerfile       # Lightweight sandbox - no inference deps
  gateway.Dockerfile       # OpenClaw gateway
docker-compose.yml         # OpenClaw + optional llama-server profile
.env.example               # All config vars documented
```

## Running a benchmark

### Preferred Promptfoo export

```bash
node skills/vibecheckbench/scripts/export-promptfoo.mjs \
  --profile examples/public-agent-profile.yaml \
  --case-file examples/public-agent-cases.json \
  --prompt-file examples/public-agent-system-prompt.txt \
  --provider openai:chat:gpt-4.1-mini \
  --out promptfooconfig.yaml
npx promptfoo@latest eval -c promptfooconfig.yaml
```

This may download Promptfoo if it is not already installed or cached.

### Legacy llama.cpp server on host

```bash
# Make sure llama-server is running on port 8080, then:
VIBECHECKBENCH_PROVIDER=llamacpp node skills/vibecheckbench/scripts/run-vibecheckbench.mjs \
  --intent "concise technical explanations"
```

### With a hosted API

```bash
ANTHROPIC_API_KEY=<your-anthropic-api-key> node skills/vibecheckbench/scripts/run-vibecheckbench.mjs \
  --intent "warm and friendly email replies"
```

### With custom system prompt

```bash
node skills/vibecheckbench/scripts/run-vibecheckbench.mjs \
  --intent "patient coding help" \
  --prompt "You are a patient coding mentor who celebrates small wins."
```

### JSON output

```bash
node skills/vibecheckbench/scripts/run-vibecheckbench.mjs --intent "warm emails" --json
```

## Agent skill workflow

### Claude Code

Use the slash command:

```text
/vibecheckbench "warm emails" --cases 5
/vibecheckbench profile --cases 3 --repeat 3 --save-report
/vibecheckbench validate
/vibecheckbench smoke
```

The implementation lives in `.claude/commands/vibecheckbench.md`; keep that file pointed at the same runner scripts as the Codex skill.

### Codex

The reusable Codex skill lives in `skills/vibecheckbench/SKILL.md`, with UI metadata in `skills/vibecheckbench/agents/openai.yaml`.

Install locally on Windows:

```powershell
powershell -ExecutionPolicy Bypass -File skills/vibecheckbench/scripts/install-codex-skill.ps1
```

After installation, invoke it as `$vibecheckbench` in Codex.

## Docker workflow

```bash
# Build images
docker compose build

# Start OpenClaw only (inference on host)
docker compose up -d openclaw-gateway

# Start OpenClaw + llama-server in Docker
docker compose --profile llama up -d
```

## Environment variables

See `.env.example` for the full list. Key ones:

| Variable | Default | Purpose |
|---|---|---|
| `VIBECHECKBENCH_PROVIDER` | `llamacpp` | Provider: llamacpp / openai / anthropic |
| `VIBECHECKBENCH_MODEL` | blank | Model override |
| `VIBECHECKBENCH_JUDGE_PROVIDER` | blank | Optional separate judge provider |
| `VIBECHECKBENCH_JUDGE_MODEL` | blank | Optional separate judge model |
| `VIBECHECKBENCH_LLAMACPP_URL` | `http://host.docker.internal:8080` | llama.cpp server URL |
| `VIBECHECKBENCH_NUM_CASES` | `10` | Number of test cases per benchmark |
| `VIBECHECKBENCH_REPEAT` | `1` | Repeat count for profile runs |
| `VIBECHECKBENCH_LOCAL_FAST` | `1` | Shorter outputs for speed (set 0 for quality) |

## Common tasks for Claude Code

- **Add a new provider**: edit `resolveProvider()` and provider call helpers in `run-vibecheckbench.mjs` and `run-profile.mjs`
- **Change judge behavior**: edit the `scoreOutputs()` system prompt
- **Add a CLI flag**: edit `parseArgs()` in the relevant runner and document it in `.claude/commands/vibecheckbench.md` plus `skills/vibecheckbench/SKILL.md`
- **Tune Docker sandbox**: edit `docker/sandbox.Dockerfile`
- **Add inference knobs**: add env vars to `docker-compose.yml` and `.env.example`

## Preference profile

Your behavioral preferences live in `preferences.yaml` at the repo root.
Current preferences: factuality, pushback, initiative, anti_sycophancy.

### Run the full profile
```bash
node skills/vibecheckbench/scripts/run-profile.mjs
node skills/vibecheckbench/scripts/run-profile.mjs --prompt-file my-prompt.txt --cases 3
node skills/vibecheckbench/scripts/run-profile.mjs --validate-profile
node skills/vibecheckbench/scripts/run-profile.mjs --smoke-test
node skills/vibecheckbench/scripts/run-profile.mjs --cases 3 --repeat 3 --judge-provider openai --judge-model gpt-4.1-mini --save-report
```

### Profile schema
Each preference has: `id`, `type`, `weight`, `description`, `good_behaviors`, `bad_behaviors`.
Types map to behavioral rubrics in `run-profile.mjs` -> `RUBRICS` object.

To add a new preference type:
1. Add it to `preferences.yaml`
2. Add a matching entry to `RUBRICS` in `run-profile.mjs` with `criteria` and `testCaseInstruction`

### Scoring
- Each test case is scored on a per-criterion rubric (0/1 per criterion) rather than a free-text comparison
- Win rate excludes ties (B wins / (A wins + B wins))
- Aggregate score is weight-normalized across all preferences
- Weakest preference = lowest win rate, used to target prompt improvements
