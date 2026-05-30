---
name: vibecheckbench
description: Turn user preference profiles into Promptfoo regression suites for testing whether an AI setup matches a user's communication, formatting, pushback, factuality, and workflow preferences. Use for preference-fit testing, prompt/config regression tests, and optional judge-based A/B comparisons.
metadata: {"openclaw":{"requires":{"bins":["node","python3"]}},"codex":{"requires":{"bins":["node","python3"]}}}
---

# VibeCheckBench

Use this skill when the user wants to test whether an AI setup "feels right" for their preferences, build a regression suite from preference YAML, or compare prompt/model/config behavior.

## Default Path

Prefer Promptfoo export for normal use:

```text
preferences.yaml + cases.json + system-prompt.txt
  -> scripts/export-promptfoo.mjs
  -> promptfooconfig.yaml
  -> promptfoo eval
```

Promptfoo handles execution, UI, reports, and CI. VibeCheckBench owns the preference schema, examples, and rubric generation.

## Workflow

1. Identify the profile, case file, and system prompt.
2. Run the exporter yourself. Do not merely tell the user to run `node` for local export/chart steps:

```bash
node "{baseDir}/scripts/export-promptfoo.mjs" --provider openai:chat:gpt-4.1-mini --out promptfooconfig.yaml
```

Use `--example complex` when the user wants the richer, public-safe preference suite for sycophancy resistance, concise answers, instruction following, "knows what it knows" behavior, non-refusal, and decision fit.

3. If the user asked for a real model comparison, check whether Promptfoo is already available before running or installing anything:

```bash
promptfoo --version
npx --no-install promptfoo --version
```

If Promptfoo is available and the configured providers are local/offline, run it and save JSON results:

```bash
promptfoo eval -c promptfooconfig.yaml --output reports/results.json
```

If Promptfoo is not available, or if running it would download packages or call hosted providers, ask the user for explicit approval before using `npx promptfoo@latest` or any provider API. Explain that `npx promptfoo@latest` may download code and hosted providers may receive prompts/outputs.

4. Summarize pass/fail patterns by preference id and call out brittle rubric edges.

Use a local provider id such as `ollama:chat:qwen3:8b` when the user wants offline testing.

Repeat `--provider` to compare several models or configs in one suite:

```bash
node "{baseDir}/scripts/export-promptfoo.mjs" --example complex --provider openai:chat:gpt-4.1-mini --provider ollama:chat:qwen3:8b --out promptfooconfig.models.yaml
```

After a Promptfoo run with JSON output, summarize it as a personal skill chart:

```bash
node "{baseDir}/scripts/chart-results.mjs" --input reports/results.json --out reports/skill-chart.html
```

For an offline demo, use the bundled example Promptfoo-shaped results:

```bash
node "{baseDir}/scripts/chart-results.mjs" --input "{baseDir}/examples/promptfoo-results.models.example.json" --out reports/skill-chart.html
```

When using the bundled example results, tell the user the chart is demo data. Its model/config labels come from the example results file and will not match newly exported provider ids until they run Promptfoo and chart the real `reports/results.json`.

For demo requests, create the config and chart artifacts in the current workspace when possible, then report the paths. Do not ask the user to run commands unless the next step requires their provider credentials, local model setup, package installation, or network access.

## Validation

Before presenting a generated suite as ready:

```bash
node --check "{baseDir}/scripts/export-promptfoo.mjs"
node --check "{baseDir}/scripts/chart-results.mjs"
node "{baseDir}/scripts/export-promptfoo.mjs" --example complex --provider echo --out promptfooconfig.yaml
node "{baseDir}/scripts/chart-results.mjs" --input "{baseDir}/examples/promptfoo-results.models.example.json" --stdout
```

The `echo` provider is a plumbing test only. Echoed prompts should fail the generated JavaScript rubrics because non-answers are guarded against.

Use `--stdout` for no-write validation:

```bash
node "{baseDir}/scripts/export-promptfoo.mjs" --example complex --provider echo --stdout
```

For a no-API positive control, use:

```bash
node "{baseDir}/scripts/export-promptfoo.mjs" --example complex --provider "file://{baseDir}/examples/promptfoo-aligned-provider.mjs" --out promptfooconfig.yaml
```

## Optional A/B Runner

Use the legacy runner only when the user explicitly asks for default-vs-custom prompt comparison, judge scoring, or prompt improvement:

```bash
node "{baseDir}/scripts/run-profile.mjs" --profile examples/public-agent-profile.yaml --case-file examples/public-agent-cases.json --prompt-file examples/public-agent-system-prompt.txt --cases 2 --repeat 3 --save-report
```

For serious A/B runs, prefer `--judge-provider` and `--judge-model`; tiny local models often fail JSON judging.

## Guardrails

- Do not send personal profiles, private notes, or business-sensitive prompts to providers that log prompts.
- Keep case counts small for smoke tests.
- Treat deterministic JavaScript rubrics as regression checks, not proof of broad model quality.
- Model outputs may still vary unless provider settings are stable, even when rubric scoring is deterministic.
- OpenClaw should come after the Codex/Claude skill path works locally.
