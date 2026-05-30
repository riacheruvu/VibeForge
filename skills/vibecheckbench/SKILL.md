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
2. Run the exporter:

```bash
node "{baseDir}/scripts/export-promptfoo.mjs" --provider openai:chat:gpt-4.1-mini --out promptfooconfig.yaml
```

3. Tell the user to run:

```bash
npx promptfoo@latest eval -c promptfooconfig.yaml
```

`npx promptfoo@latest` may download Promptfoo if it is not already cached or installed. Ask before running it in restricted/no-network contexts.

4. Summarize pass/fail patterns by preference id and call out brittle rubric edges.

Use a local provider id such as `ollama:chat:qwen3:8b` when the user wants offline testing.

## Validation

Before presenting a generated suite as ready:

```bash
node --check "{baseDir}/scripts/export-promptfoo.mjs"
node "{baseDir}/scripts/export-promptfoo.mjs" --provider echo --out promptfooconfig.yaml
```

The `echo` provider is a plumbing test only. Echoed prompts should fail the generated JavaScript rubrics because non-answers are guarded against.

Use `--stdout` for no-write validation:

```bash
node "{baseDir}/scripts/export-promptfoo.mjs" --provider echo --stdout
```

For a no-API positive control, use:

```bash
node "{baseDir}/scripts/export-promptfoo.mjs" --provider "file://{baseDir}/examples/promptfoo-aligned-provider.mjs" --out promptfooconfig.yaml
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
