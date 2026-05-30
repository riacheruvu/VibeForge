# VibeCheckBench

VibeCheckBench is a small prototype for testing whether an AI setup actually behaves the way you want.

Most of us have personal, hard-to-articulate preferences for how AI should behave. Sometimes the answer is technically fine, but it still feels wrong: too verbose, too agreeable, too generic, too hesitant, or not direct enough.

Usually that friction turns into manual workarounds: rewriting the output, switching models, copy-pasting into another tool, or tweaking prompts by feel.

VibeCheckBench tries to turn that friction into a repeatable test: capture preferences, run examples, score the behavior, and use failures to improve the setup.

Current focus areas in `preferences.yaml`:

- factuality - catches false premises and uncertainty
- pushback - disagrees when the user is wrong
- initiative - volunteers useful context or related work when it matters
- anti-sycophancy - avoids empty validation and unearned praise

## Why this exists

System prompts, memory files, and personality settings are easy to write but hard to verify. Under the hood, VibeCheckBench turns preferences into profiles, seeded cases, and deterministic eval configs that can run locally through Promptfoo. The older judge-based runner is still included for optional A/B prompt comparison, but it is not the main path.

## Related ideas

VibeCheckBench is a small prototype, not a claim of firstness. It sits near work on personalized LLM evaluation, behavioral preference rubrics, model-as-judge workflows, sycophancy tests, instruction-following evals, and agent configuration testing.

The narrow goal is practical: make it easy to turn your own interaction preferences into repeatable smoke tests for prompts, memory files, model choices, and agent configs.

## Architecture

```text
preferences.yaml + cases.json + system-prompt.txt
        |
        v
VibeCheckBench exporter
        |
        v
promptfooconfig.yaml
        |
        v
promptfoo eval
        |
        v
deterministic regression results
```

This keeps the project small: VibeCheckBench owns the preference schema and examples; Promptfoo owns execution, providers, UI, reports, and CI. The custom judge runner remains available under `skills/vibecheckbench/scripts/` for experiments that need A/B semantic comparison.

## Quick start: Promptfoo regression suite

Generate a Promptfoo config from the public-safe example profile:

```powershell
node skills/vibecheckbench/scripts/export-promptfoo.mjs `
  --profile examples/public-agent-profile.yaml `
  --case-file examples/public-agent-cases.json `
  --prompt-file examples/public-agent-system-prompt.txt `
  --provider openai:chat:gpt-4.1-mini `
  --out promptfooconfig.yaml
```

Run it:

```powershell
npx promptfoo@latest eval -c promptfooconfig.yaml
```

An exported example is checked in at `examples/promptfooconfig.example.yaml`.

For local models, point Promptfoo at your local provider instead of changing the profile:

```powershell
node skills/vibecheckbench/scripts/export-promptfoo.mjs `
  --provider ollama:chat:qwen3:8b `
  --out promptfooconfig.yaml
```

Promptfoo's JavaScript assertions are deterministic: they score the model output with code. The model output itself can still vary unless you use temperature `0`, a stable model build, and a fixed local backend.

## Optional: judge-based A/B runner

Use the custom runner when you specifically want to compare a default prompt against a custom prompt and have a judge decide which response better matches the profile.

```text
case
 -> default prompt output
 -> custom prompt output
 -> judge model scores A vs B
```

This is useful with a strong separate judge. It is brittle with tiny local models that struggle to return valid JSON.

## llama.cpp server on Windows host

1. Copy the environment file:

```powershell
copy .env.example .env
```

2. Start `llama-server` on your host machine:

```powershell
llama-server.exe -m C:\models\your-model.gguf --host 0.0.0.0 --port 8080
```

3. Run a quick single-intent benchmark:

```powershell
$env:VIBECHECKBENCH_PROVIDER="llamacpp"
$env:VIBECHECKBENCH_LLAMACPP_URL="http://localhost:8080"
node skills/vibecheckbench/scripts/run-vibecheckbench.mjs --intent "push back when my premise is wrong" --cases 3
```

4. Run the full preference profile:

```powershell
node skills/vibecheckbench/scripts/run-profile.mjs --cases 2
```

Use small case counts first. Local models can be slow, especially when the same model generates, answers, and judges.

## Quick start: hosted or remote models

### OpenAI

```powershell
$env:OPENAI_API_KEY="<your-openai-api-key>"
node skills/vibecheckbench/scripts/run-profile.mjs --cases 3
```

### Anthropic

```powershell
$env:ANTHROPIC_API_KEY="<your-anthropic-api-key>"
node skills/vibecheckbench/scripts/run-profile.mjs --cases 3
```

### OpenAI-compatible APIs

For Together, Fireworks, Groq, Ollama, vLLM, or a remote llama.cpp server:

```powershell
$env:VIBECHECKBENCH_PROVIDER="llamacpp"
$env:VIBECHECKBENCH_LLAMACPP_URL="https://your-endpoint.example/v1"
$env:VIBECHECKBENCH_LLAMACPP_API_KEY="your-token-if-needed"
node skills/vibecheckbench/scripts/run-profile.mjs --cases 3
```

## Docker / OpenClaw workflow

Build the images:

```powershell
docker compose build
```

Start OpenClaw with inference on your Windows host:

```powershell
docker compose up -d openclaw-gateway
```

In this mode, the sandbox calls:

```text
http://host.docker.internal:8080
```

Start OpenClaw plus a Dockerized llama.cpp sidecar instead:

```powershell
docker compose --profile llama up -d
```

When using the sidecar, set this in `.env`:

```text
VIBECHECKBENCH_LLAMACPP_URL=http://llama-server:8080
VIBECHECKBENCH_MODELS_DIR=./models
VIBECHECKBENCH_MODEL_FILE=your-model.gguf
```

## Main commands

Export a Promptfoo regression suite:

```bash
node skills/vibecheckbench/scripts/export-promptfoo.mjs \
  --profile examples/literature-backed-user-preferences.yaml \
  --case-file examples/literature-backed-user-cases.json \
  --prompt-file examples/complex-use-case-system-prompt.txt \
  --provider openai:chat:gpt-4.1-mini \
  --out promptfooconfig.yaml
```

Run the suite:

```bash
npx promptfoo@latest eval -c promptfooconfig.yaml
```

Legacy single preference / intent:

```bash
node skills/vibecheckbench/scripts/run-vibecheckbench.mjs --intent "warm but direct emails" --cases 5
```

Test a custom system prompt:

```bash
node skills/vibecheckbench/scripts/run-vibecheckbench.mjs \
  --intent "patient coding help" \
  --prompt-file prompt.txt \
  --cases 5
```

Legacy full behavioral profile:

```bash
node skills/vibecheckbench/scripts/run-profile.mjs --profile preferences.yaml --prompt-file prompt.txt --cases 3
```

Validate the profile parser without calling a model:

```bash
node skills/vibecheckbench/scripts/run-profile.mjs --validate-profile
```

Check provider connectivity before a real run:

```bash
node skills/vibecheckbench/scripts/run-profile.mjs --smoke-test
```

Use a separate judge and repeat noisy runs:

```bash
node skills/vibecheckbench/scripts/run-profile.mjs \
  --provider llamacpp \
  --judge-provider openai \
  --judge-model gpt-4.1-mini \
  --cases 3 \
  --repeat 3 \
  --save-report \
  --improve
```

Compare OpenAI model versions:

```bash
node skills/vibecheckbench/scripts/compare-models.mjs \
  --provider openai \
  --models "gpt-5.5,gpt-5.4,gpt-5.4-mini" \
  --profile examples/public-agent-profile.yaml \
  --prompt-file examples/public-agent-system-prompt.txt \
  --cases 3 \
  --repeat 3 \
  --judge-provider openai \
  --judge-model gpt-5.5
```

For model-version comparisons, read candidate rubric score first. A/B aggregate win rate is still shown, but it was originally designed for prompt comparisons.

Run a seeded public-safe interaction profile:

```bash
node skills/vibecheckbench/scripts/run-profile.mjs \
  --profile examples/public-agent-profile.yaml \
  --case-file examples/public-agent-cases.json \
  --prompt-file examples/public-agent-system-prompt.txt \
  --cases 2 \
  --repeat 3 \
  --save-report
```

Use `--case-file` when you have real user-research examples and want stable tests instead of generated cases.

Compare prompt/memory/skill config candidates:

```powershell
node skills/vibecheckbench/scripts/compare-configs.mjs `
  --config-dir examples/config-candidates `
  --profile examples/public-agent-profile.yaml `
  --case-file examples/public-agent-cases.json `
  --cases 2 `
  --repeat 3
```

Iteratively improve a config:

```powershell
node skills/vibecheckbench/scripts/optimize-config.mjs `
  --profile examples/public-agent-profile.yaml `
  --case-file examples/public-agent-cases.json `
  --prompt-file examples/config-candidates/generic-supportive.txt `
  --iterations 3 `
  --cases 2 `
  --repeat 2
```

For best results, use a stronger or separate judge model. Very small local models may fail the JSON judge step.

Run the literature-backed complex user preference demo:

```powershell
node skills/vibecheckbench/scripts/run-profile.mjs `
  --profile examples/literature-backed-user-preferences.yaml `
  --case-file examples/literature-backed-user-cases.json `
  --prompt-file examples/complex-use-case-system-prompt.txt `
  --cases 2 `
  --repeat 3 `
  --judge-provider openai `
  --judge-model gpt-5.5 `
  --save-report
```

This profile targets common documented preference failures: social sycophancy, length/format control, verifiable instruction following, calibrated factuality, over-refusal, and user agency in decisions.

## OSS model testing

VibeCheckBench can test OSS/open-weight models through any OpenAI-compatible local or hosted router.

Ollama example:

```powershell
ollama pull qwen3:8b
ollama pull llama3.1:8b
$env:VIBECHECKBENCH_PROVIDER="llamacpp"
$env:VIBECHECKBENCH_LLAMACPP_URL="http://127.0.0.1:11434/v1"
node skills/vibecheckbench/scripts/compare-models.mjs `
  --provider llamacpp `
  --models "qwen3:8b,llama3.1:8b" `
  --profile examples/public-agent-profile.yaml `
  --case-file examples/public-agent-cases.json `
  --prompt-file examples/public-agent-system-prompt.txt `
  --cases 2 `
  --repeat 3
```

llama.cpp example:

```powershell
llama-server -m C:\models\your-model.gguf --host 127.0.0.1 --port 8080
$env:VIBECHECKBENCH_PROVIDER="llamacpp"
$env:VIBECHECKBENCH_LLAMACPP_URL="http://127.0.0.1:8080"
node skills/vibecheckbench/scripts/run-profile.mjs `
  --profile examples/public-agent-profile.yaml `
  --case-file examples/public-agent-cases.json `
  --prompt-file examples/public-agent-system-prompt.txt `
  --cases 2 `
  --repeat 3
```

See `examples/oss-model-presets.json` for starter model/router presets. Treat those as editable examples, not a fixed leaderboard.

This repo also includes helper scripts for the local llama.cpp setup:

```powershell
# Start official Qwen3-0.6B GGUF through llama.cpp.
# First run downloads the model from Hugging Face.
powershell -ExecutionPolicy Bypass -File scripts/start-llamacpp-qwen.ps1

# Run a tiny VibeCheckBench smoke profile against the local server.
powershell -ExecutionPolicy Bypass -File scripts/test-llamacpp-vibecheckbench.ps1

# Stop the local server.
powershell -ExecutionPolicy Bypass -File scripts/stop-llamacpp.ps1
```

Privacy note:

- Local llama.cpp keeps prompts on your machine after the model is downloaded.
- The helper binds to `127.0.0.1`, not the LAN.
- Use `VIBECHECKBENCH_NO_THINK=1` with Qwen3-style reasoning models if you want final answers instead of reasoning-only responses.
- Do not send personal profiles, private notes, or business-sensitive prompts to OpenRouter free routes; their free endpoint warns that prompts and outputs may be logged and used for provider improvement.

JSON output:

```bash
node skills/vibecheckbench/scripts/run-profile.mjs --json > report.json
```

Direct GGUF path without a server:

```bash
pip install llama-cpp-python
python3 skills/vibecheckbench/scripts/run-vibecheckbench-local.py \
  --model /path/to/model.gguf \
  --intent "concise technical explanations"
```

## Claude Code integration

This repo includes:

- `CLAUDE.md` - project instructions for Claude Code
- `.claude/commands/vibecheckbench.md` - slash-command workflow

In Claude Code, use:

```text
/vibecheckbench "warm and friendly email replies"
/vibecheckbench profile --cases 3
/vibecheckbench profile --prompt-file prompt.txt
```

## Codex skill prototype

This repo also includes a Codex-compatible skill at:

```text
skills/vibecheckbench/
```

It contains:

- `SKILL.md` - Codex/OpenClaw skill instructions
- `agents/openai.yaml` - Codex UI metadata
- `scripts/install-codex-skill.ps1` - Windows installer that copies the skill to `~/.codex/skills/vibecheckbench`

Install it locally:

```powershell
powershell -ExecutionPolicy Bypass -File skills/vibecheckbench/scripts/install-codex-skill.ps1
```

Then invoke it in Codex as:

```text
Use $vibecheckbench to run my full preference profile with 3 cases and save a report.
```

## Known limitations

- Deterministic rubrics are intentionally simple. They are good for regression tests and CI, but they can miss semantic nuance or reward keywordy answers.
- Promptfoo scoring is deterministic; model outputs are deterministic only if the provider/backend is configured that way.
- A single local model acting as generator, responder, and judge can create circular evaluation bias in the legacy A/B runner. For higher-quality A/B runs, use a stronger or separate judge model.
- Small local models may struggle to produce valid JSON in the legacy judge runner. The runner includes fallback JSON extraction, but very weak models can still fail.
- Win rate excludes ties, but small case counts are noisy. Use `--repeat N` for mean/stdev, and treat smoke tests as debugging, not final evidence.
- `--improve` proposes a revised prompt from observed losses; rerun the benchmark against that prompt before trusting the revision.
- `workspaceAccess=none` is intentional for OpenClaw safety; keep GGUF files on the host or in the dedicated Docker model mount, not inside the sandbox workspace.
