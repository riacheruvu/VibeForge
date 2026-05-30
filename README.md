# VibeCheckBench

VibeCheckBench is a small prototype for turning "this AI feels off" into repeatable checks.

Most AI benchmarks ask which model is best overall. VibeCheckBench asks a more personal question:

> Does this model, prompt, memory file, or agent setup fit the way someone actually wants to work?

It focuses on everyday interaction failures that standard benchmarks often miss: answers that are too long, too agreeable, too vague, too hesitant, too confident, or too poor at following exact instructions.

The goal is practical and user-owned: define preferences, run public-safe cases, compare setups, and visualize where each one fits or misses.

## What it helps test

The bundled complex example checks whether an AI setup:

- **Knows what it knows** - avoids making things up, says what is uncertain, and names what to check
- **Stays concise** - respects length and formatting constraints
- **Gives honest pushback** - does not flatter or agree just to be nice
- **Follows instructions** - handles exact schemas, required words, and checkable directions
- **Stays helpful but safe** - avoids blanket refusals while keeping risky requests bounded
- **Helps the user decide** - shows tradeoffs and next steps without taking over the decision

## How it works

```text
preference profile + test cases + system prompt
        |
        v
VibeCheckBench exporter
        |
        v
Promptfoo config
        |
        v
Promptfoo model/config run
        |
        v
VibeCheckBench skill chart
```

VibeCheckBench owns the preference examples, generated rubrics, and visualization. Promptfoo owns provider execution, reports, UI, and CI.

The older judge-based A/B runner is still included for experiments that need semantic default-vs-custom comparisons, but the default path is the Promptfoo regression suite.

## Quickstart: offline demo

This path does not install packages, call models, or send prompts anywhere. It uses checked-in demo results so you can see the workflow and chart.

```powershell
node skills/vibecheckbench/scripts/chart-results.mjs `
  --input examples/promptfoo-results.models.example.json `
  --out reports/skill-chart.html
```

Open:

```text
reports/skill-chart.html
```

There is also a checked-in example:

```text
examples/skill-chart.example.html
```

The checked-in chart uses demo data, so labels like `careful-hosted-model` and `concise-local-model` are examples. After a real Promptfoo run, the chart reflects the providers/configs in your results file.

## Compare real models or configs

Generate a Promptfoo config from the richer public-safe example profile:

```powershell
node skills/vibecheckbench/scripts/export-promptfoo.mjs `
  --example complex `
  --provider openai:chat:gpt-4.1-mini `
  --provider ollama:chat:qwen3:8b `
  --out promptfooconfig.models.yaml
```

Run Promptfoo and save JSON results:

```powershell
npx promptfoo@latest eval -c promptfooconfig.models.yaml --output reports/results.json
```

Then generate the visual comparison:

```powershell
node skills/vibecheckbench/scripts/chart-results.mjs `
  --input reports/results.json `
  --out reports/skill-chart.html
```

`npx promptfoo@latest` may download Promptfoo. In no-network or privacy-sensitive environments, use an already installed Promptfoo binary instead, or install it only after reviewing where the cases will be sent.

Use any Promptfoo provider id that works in your environment: OpenAI, Anthropic, Ollama, llama.cpp, vLLM, LM Studio, hosted OpenAI-compatible routers, or file-based mock providers.

## Customize the profile

Start from the public examples:

```text
examples/complex-agent-profile.yaml
examples/complex-agent-cases.json
examples/complex-agent-system-prompt.txt
```

Then export your custom suite:

```powershell
node skills/vibecheckbench/scripts/export-promptfoo.mjs `
  --profile path\to\your-profile.yaml `
  --case-file path\to\your-cases.json `
  --prompt-file path\to\your-system-prompt.txt `
  --provider ollama:chat:qwen3:8b `
  --out promptfooconfig.yaml
```

Keep the first cases small and public-safe. The best cases are not generic trivia; they are moments where the AI answer could be technically fine but still wrong for the user's workflow.

## What the chart means

- **Checks passed**: the share of test prompts where a setup met the preference threshold
- **Fit score**: the average score from 0 to 1 for that preference profile
- **Plain read**: a quick label: strong, solid, fragile, or needs work
- **Fit shape**: a radar-style view of where each setup is strong or thin across preference areas

This is a personal-fit chart, not a model leaderboard. A setup can be excellent for one person's workflow and poor for another's. Always inspect failing outputs before making a decision.

## Privacy

- The offline demo uses checked-in example data only.
- Local providers such as Ollama or llama.cpp can keep prompts on your machine.
- Hosted providers may log prompts and outputs depending on their terms.
- Do not send personal profiles, private notes, proprietary prompts, or sensitive work data to providers unless their data policy is acceptable for that content.

## Local and OSS model notes

Ollama example:

```powershell
ollama pull qwen3:8b
node skills/vibecheckbench/scripts/export-promptfoo.mjs `
  --example complex `
  --provider ollama:chat:qwen3:8b `
  --out promptfooconfig.ollama.yaml
```

llama.cpp server example:

```powershell
llama-server.exe -m C:\models\your-model.gguf --host 127.0.0.1 --port 8080
```

Then use a Promptfoo provider id or the legacy runner's OpenAI-compatible settings.

See:

```text
examples/oss-model-presets.json
```

Treat those as editable starter presets, not a fixed leaderboard.

## Codex and Claude Code helpers

This repo includes a Codex-compatible skill:

```text
skills/vibecheckbench/
```

Install it locally:

```powershell
powershell -ExecutionPolicy Bypass -File skills/vibecheckbench/scripts/install-codex-skill.ps1
```

Then in Codex:

```text
Use $vibecheckbench to export the complex example and generate a skill chart.
```

The skill is meant to run the local `node` commands for you. For real model comparisons, it should ask before installing/downloading Promptfoo or sending prompts to hosted providers.

Claude Code files are also included:

```text
CLAUDE.md
.claude/commands/vibecheckbench.md
```

## Legacy judge-based runner

Use this path when you specifically want a judge model to compare a default answer against a custom prompt/config answer.

```text
case
 -> default prompt output
 -> custom prompt output
 -> judge model scores A vs B
```

Example:

```powershell
node skills/vibecheckbench/scripts/run-profile.mjs `
  --profile examples/public-agent-profile.yaml `
  --case-file examples/public-agent-cases.json `
  --prompt-file examples/public-agent-system-prompt.txt `
  --cases 2 `
  --repeat 3 `
  --save-report
```

For higher-quality A/B runs, use a stronger or separate judge model:

```powershell
node skills/vibecheckbench/scripts/run-profile.mjs `
  --provider llamacpp `
  --judge-provider openai `
  --judge-model gpt-4.1-mini `
  --cases 3 `
  --repeat 3 `
  --save-report `
  --improve
```

Tiny local models often fail JSON judging, so the Promptfoo path is usually better for local/offline regression tests.

## Development checks

Run these before sharing changes:

```powershell
node --check skills/vibecheckbench/scripts/export-promptfoo.mjs
node --check skills/vibecheckbench/scripts/chart-results.mjs

node skills/vibecheckbench/scripts/export-promptfoo.mjs `
  --example complex `
  --provider "file://examples/promptfoo-aligned-provider.mjs" `
  --provider echo `
  --out examples/promptfooconfig.models.example.yaml

node skills/vibecheckbench/scripts/chart-results.mjs `
  --input examples/promptfoo-results.models.example.json `
  --out examples/skill-chart.example.html
```

Optional real-model test:

```powershell
npx promptfoo@latest eval -c promptfooconfig.models.yaml --output reports/results.json
node skills/vibecheckbench/scripts/chart-results.mjs --input reports/results.json --out reports/skill-chart.html
```

## Known limitations

- Deterministic rubrics are useful for regression checks, but they can miss semantic nuance or reward keywordy answers.
- Model outputs may still vary unless provider settings and model builds are stable.
- Small case counts are noisy. Use repeats or held-out cases before trusting an apparent improvement.
- The checked-in skill chart is demo data, not fresh model evidence.
- The legacy A/B runner can suffer from circular evaluation bias if the same weak model generates, answers, and judges.
- `--improve` proposes prompt changes from observed losses; rerun the evaluation before trusting those revisions.

## License

MIT
