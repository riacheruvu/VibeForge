---
name: vibecheckbench
description: Turn user preference profiles into Promptfoo regression suites for testing whether an AI setup matches a user's communication, formatting, pushback, factuality, and workflow preferences. Use for preference-fit testing, prompt/config regression tests, and optional judge-based A/B comparisons.
metadata: {"openclaw":{"requires":{"bins":["node","python3"]}},"codex":{"requires":{"bins":["node","python3"]}}}
---

# VibeCheckBench

Use this skill when the user wants to test whether an AI setup "feels right" for their preferences, build a regression suite from preference YAML, or compare prompt/model/config behavior.

## Two Evaluation Modes

- Preference Fit Eval: score the model's actual answers against the user's preference profile. This is the core VibeCheckBench use case.
- Operator Eval: check whether an agent can run VibeCheckBench correctly. This is useful for validating Codex/Claude workflows, but do not present it as evidence that the model's own answers fit the user.

When the user asks whether different models match their preferences, prefer Preference Fit Eval. When they ask whether the skill works in Codex or Claude, use Operator Eval.

## Default Path

Prefer Promptfoo export for normal use:

```text
preferences.yaml + cases.json + system-prompt.txt
  -> scripts/export-promptfoo.mjs
  -> promptfooconfig.yaml
  -> promptfoo eval
```

Promptfoo handles execution, UI, reports, and CI. VibeCheckBench owns the preference schema, examples, and rubric generation.

For benchmark-design work, prefer the task-pack format in `examples/tasks`. It makes each case explicit: category, user profile, prompt, hard checks, judge rubric, and scoring mix.

Task packs may use `input.turns` for multi-turn chat context. The final turn must
be from the user. Use optional `workflow` expectations only as metadata until a
trace-aware provider or agent grader is configured; do not claim final-answer
scoring verifies tool execution.

Validate and export task packs:

```bash
node "{baseDir}/scripts/validate-tasks.mjs" --tasks examples/tasks
node "{baseDir}/scripts/export-task-pack-promptfoo.mjs" --tasks examples/tasks --provider ollama:chat:qwen3:0.6b --out promptfooconfig.tasks.yaml
```

Use `--include-judge --judge-provider <provider-id>` only when the user has approved any provider/API implications. LLM judges are useful for nuance but should be treated as fallible.

## Conversation History

When the user wants new tests derived from past conversations, keep the first
pass local and deterministic:

```bash
node "{baseDir}/scripts/mine-conversation-history.mjs" --input conversations.json
```

When the user only has a plain-language preference and does not know what test
prompt to write, draft a starter case locally:

```bash
node "{baseDir}/scripts/draft-test-case.mjs" --preference "The user prefers concise, high-signal answers that preserve necessary nuance." --stdout
```

Treat the result as a review draft. The user should still edit or approve the
preference, public-safe prompt, expected behavior, and development/held-out
split before it becomes benchmark evidence.

This writes a gitignored review queue and draft tasks under `captures/`. Treat
every result as a candidate. Do not automatically merge inferred preferences
into a public profile or send raw history to a hosted model. Ask the user to
accept, edit, or reject candidates before using them as benchmark evidence.

Prefer public-safe rewrites over replaying raw personal conversations. Preserve
an evidence hash and provenance so the source can be audited without exposing
the original text.

After the user reviews candidates, promote only explicitly accepted public-safe
rewrites into a canonical personal-fit project:

```bash
node "{baseDir}/scripts/promote-history-candidates.mjs" --review captures/history-review.json --decisions review-decisions.json --out captures/personal-fit/project.json --tasks-dir captures/personal-fit/tasks
```

Require some accepted cases to use the `held_out` split before recommending a
configuration replacement. The project manifest is the local source of truth;
it stores hashes and review decisions, not raw conversation excerpts.

The local dashboard exposes this as the **Evidence** workspace. Use it to import
JSON/JSONL/text/Markdown exports, review mined candidates, create manual
public-safe cases, and build the approved personal-fit project. Automatic mining
must stop at candidates; it must not approve or publish inferred preferences.

## Config Improvement

Use the optimizer only with a separate held-out case file:

```bash
node "{baseDir}/scripts/optimize-config.mjs" --profile preferences.yaml --case-file train-cases.json --validation-case-file held-out-cases.json --prompt-file system-prompt.txt
```

An accepted iteration is a candidate for human review, not permission to deploy.
Inspect the manifest, preference-level regressions, judge disagreements, and
failed outputs before replacing a prompt, memory file, or skill.

For model/config comparisons, produce an explicit next-experiment decision:

```bash
node "{baseDir}/scripts/recommend-next-experiment.mjs" --input reports/results.json --project captures/personal-fit/project.json --out reports/next-experiment.json
```

Prefer the smallest supported intervention. Distinguish among collecting more
evidence, changing a prompt/memory/skill while holding the model fixed, choosing
a different model, or routing different workflows to different setups. Never
present the recommendation as automatic deployment.

When "config" could mean several things, model the setup explicitly and plan a
one-surface experiment:

```bash
node "{baseDir}/scripts/plan-setup-experiment.mjs" --baseline baseline-setup.json --candidate candidate-setup.json --out reports/setup-experiment.json
```

Setup surfaces are model, instructions, memory, skills, tools/access, inference
settings, context/retrieval, and routing/orchestration. Only claim execution for
surfaces supported by the active provider or trace adapter.

For public-safe demonstrations of the full loop, prefer checked-in case studies:

```bash
node "{baseDir}/scripts/run-case-study.mjs" --list
node "{baseDir}/scripts/run-case-study.mjs" --case feedback-friction-loop
```

Case studies start from synthetic conversation exports, promote reviewed
public-safe rewrites, score captured baseline/candidate setup outputs, and run a
guarded config gate. Treat the generated reports as examples of workflow shape,
not broad model evidence.

## Workflow

1. Identify the profile, case file, and system prompt.
2. When the user wants one place to run and review local evaluations, start the
skill-owned dashboard:

```bash
node "{baseDir}/dashboard/server.mjs"
```

Open `http://127.0.0.1:4173`. The dashboard only exposes allowlisted local
presets and stores one canonical `run.json` under the gitignored
`captures/dashboard-runs/<run-id>/` directory. Do not add arbitrary shell
commands or hosted providers to its HTTP API.

Build the read-only GitHub Pages demo from checked-in public-safe results with:

```bash
node "{baseDir}/scripts/build-dashboard-demo.mjs"
```

The static demo is illustrative and cannot trigger evaluations.
3. Run the exporter yourself. Do not merely tell the user to run `node` for local export/chart steps:

```bash
node "{baseDir}/scripts/export-promptfoo.mjs" --provider openai:chat:gpt-4.1-mini --out promptfooconfig.yaml
```

Use `--example complex` when the user wants the richer, public-safe preference suite for sycophancy resistance, concise answers, instruction following, "knows what it knows" behavior, non-refusal, and decision fit.

4. If the user asked for a real model comparison, check whether Promptfoo is already available before running or installing anything:

```bash
promptfoo --version
npx --no-install promptfoo --version
```

If Promptfoo is available and the configured providers are local/offline, run it and save JSON results:

```bash
promptfoo eval -c promptfooconfig.yaml --output reports/results.json
```

Prefer the cross-platform `promptfoo` command. Store Promptfoo state under the
ignored `.promptfoo/` directory and disable telemetry, update checks, WAL mode,
and disk caching for privacy-sensitive local runs. The repository may include
platform-specific convenience wrappers, but the skill must not depend on them.

If Promptfoo is not available, or if running it would download packages or call hosted providers, ask the user for explicit approval before using `npx promptfoo@latest` or any provider API. Explain that `npx promptfoo@latest` may download code and hosted providers may receive prompts/outputs.

5. Summarize pass/fail patterns by preference id and call out brittle rubric edges.

Use a local provider id such as `ollama:chat:qwen3:8b` when the user wants offline testing.

Repeat `--provider` to compare several models or configs in one suite:

```bash
node "{baseDir}/scripts/export-promptfoo.mjs" --example complex --provider openai:chat:gpt-4.1-mini --provider ollama:chat:qwen3:8b --out promptfooconfig.models.yaml
```

After a Promptfoo run with JSON output, summarize it as a personal skill chart:

```bash
node "{baseDir}/scripts/chart-results.mjs" --input reports/results.json --out reports/skill-chart.html
```

When comparing a baseline and candidate config, export development and held-out
suites with repeatable `--config label=path` arguments. Gate the real Promptfoo
results before recommending a replacement:

```bash
node "{baseDir}/scripts/gate-config-results.mjs" --train reports/results.train.json --heldout reports/results.heldout.json --out reports/config-gate.json
```

The gate reports fit-score, pass-rate, latency, and token changes. A passing
decision means eligible for human review, never automatic deployment.

For an offline demo, use the bundled example Promptfoo-shaped results:

```bash
node "{baseDir}/scripts/chart-results.mjs" --input "{baseDir}/examples/promptfoo-results.models.example.json" --out reports/skill-chart.html
```

When using the bundled example results, tell the user the chart is demo data. Its model/config labels come from the example results file and will not match newly exported provider ids until they run Promptfoo and chart the real `reports/results.json`.

For demo requests, create the config and chart artifacts in the current workspace when possible, then report the paths. Do not ask the user to run commands unless the next step requires their provider credentials, local model setup, package installation, or network access.

## Captured Model Answers

Use this path when the user is comparing models selected inside Codex, Claude Code, or a chat UI and the model itself is not directly callable through Promptfoo.

Ask the user to capture each model's answers into this JSON shape, or create the file yourself from pasted outputs:

```json
{
  "results": [
    {
      "provider": "gpt-5.5-codex",
      "preference_id": "social_sycophancy_resistance",
      "user_prompt": "The prompt shown to the model",
      "output": "The model's answer"
    }
  ]
}
```

Then score and chart it:

```bash
node "{baseDir}/scripts/score-answers.mjs" --input captured-answers.json --out reports/results.captured.json
node "{baseDir}/scripts/chart-results.mjs" --input reports/results.captured.json --out reports/skill-chart.captured.html
```

If the user is asking whether the benchmark is actually catching user-fit problems, or deterministic checks look too keyword-driven, run a judge pass over the captured answers:

```bash
node "{baseDir}/scripts/judge-captured-answers.mjs" --input reports/answers.ollama.json --tasks examples/tasks --judge-provider ollama:chat:qwen3:0.6b --out reports/results.ollama.judged.json
node "{baseDir}/scripts/chart-results.mjs" --input reports/results.ollama.judged.json --out reports/skill-chart.ollama.judged.html
```

Explain that this is judging the model's answer behavior, not the agent's ability to run tools. Tiny local models are weak judges; use them for private plumbing and rough signal only. For serious claims, use a stronger separate judge or Promptfoo's judge-backed path after confirming provider privacy.

Explain clearly that this scores the model's own answer behavior. It is different from scoring whether an agent successfully ran the VibeCheckBench tooling.

If the user pastes raw answers in markdown/text form, do not ask them to manually build JSON. Save the paste to a markdown file using this structure, then run the ingester:

~~~markdown
## gpt-5.5-codex

### social_sycophancy_resistance

User prompt:

```text
...
```

Output:

```text
...
```
~~~

Then run:

```bash
node "{baseDir}/scripts/ingest-captured-markdown.mjs" --input captured-answers.md --out reports/captured-answers.json
node "{baseDir}/scripts/score-answers.mjs" --input reports/captured-answers.json --out reports/results.captured.json
node "{baseDir}/scripts/chart-results.mjs" --input reports/results.captured.json --out reports/skill-chart.captured.html
```

For repeated model-picker comparisons, create a local capture session instead of making the user copy the whole structure each time:

```bash
node "{baseDir}/scripts/prepare-capture-session.mjs" --name codex-model-sweep --model "GPT 5.5 Codex" --model "Claude Sonnet" --limit 4
```

This creates `captures/<name>/subject-prompts.md`, `captures/<name>/answers.md`, and `captures/<name>/session.json`. The user can fill in `answers.md`, then the skill should ingest, score, and chart it. Treat `captures/` as local memory and avoid committing it.

## Local/OSS Subject Runner

When the user wants the tool to orchestrate local models and they do not have hosted API keys, use `run-local-subjects.mjs`. This avoids Promptfoo and supports Ollama, file-based mock providers, and echo.

Smoke test with no model dependency:

```bash
node "{baseDir}/scripts/run-local-subjects.mjs" --provider "file://examples/promptfoo-aligned-provider.mjs" --provider echo --limit 1 --out reports/answers.local-smoke.json --scored-out reports/results.local-smoke.json --chart-out reports/skill-chart.local-smoke.html
```

Ollama example:

```bash
node "{baseDir}/scripts/run-local-subjects.mjs" --provider ollama:chat:qwen3:8b --provider ollama:chat:llama3.1:8b --limit 1 --out reports/answers.ollama.json --scored-out reports/results.ollama.json --chart-out reports/skill-chart.ollama.html
```

Before using Ollama, check whether `ollama` is installed and the requested models are present. Do not pull models unless the user approves the download. If Ollama is unavailable, offer the file/mock smoke test or captured-answer workflow.

## Friendly Local Setup Behavior

When a nontechnical user says "use VibeCheckBench" or asks whether a local model
works, act like a setup guide:

1. Check what is already installed before suggesting installation.
2. Explain results in plain language: "Ollama is running and I found Qwen,
   Gemma, and SmolLM" or "I cannot reach Ollama yet, so local model runs will
   not work until it is started."
3. Ask for permission before installing packages, downloading Promptfoo, pulling
   model weights, or using a hosted provider.
4. If a model fails, say what failed and the next practical fix. Prefer:
   "This model is not installed locally; I can pull it if you approve the
   download" over raw stack traces.
5. If the user asks about non-Ollama local models, explain that the dashboard
   direct runner currently supports Ollama. llama.cpp, LM Studio, vLLM, TGI,
   SGLang, and hosted/self-hosted OpenAI-compatible routers can be used through
   Promptfoo/export paths. Local Hugging Face Transformers support is a planned
   adapter, not a built-in dashboard runner yet.
6. Treat model names such as Hermes, Qwen, Gemma, SmolLM, Llama, Phi, and Mistral
   as model families. They need a local runner such as Ollama, llama.cpp, LM
   Studio, vLLM, or a future Hugging Face adapter before VibeCheckBench can run
   them directly.

## Validation

Before presenting a generated suite as ready:

```bash
node --check "{baseDir}/scripts/export-promptfoo.mjs"
node --check "{baseDir}/scripts/chart-results.mjs"
node --check "{baseDir}/scripts/score-answers.mjs"
node --check "{baseDir}/scripts/run-local-subjects.mjs"
node --check "{baseDir}/scripts/ingest-captured-markdown.mjs"
node --check "{baseDir}/scripts/prepare-capture-session.mjs"
node --check "{baseDir}/scripts/judge-captured-answers.mjs"
node --check "{baseDir}/scripts/validate-tasks.mjs"
node --check "{baseDir}/scripts/export-task-pack-promptfoo.mjs"
node --check "{baseDir}/scripts/mine-conversation-history.mjs"
node --check "{baseDir}/scripts/draft-test-case.mjs"
node --check "{baseDir}/scripts/promote-history-candidates.mjs"
node --check "{baseDir}/scripts/optimize-config.mjs"
node --check "{baseDir}/scripts/gate-config-results.mjs"
node --check "{baseDir}/scripts/recommend-next-experiment.mjs"
node --check "{baseDir}/scripts/plan-setup-experiment.mjs"
node --check "{baseDir}/scripts/run-case-study.mjs"
node --check "{baseDir}/dashboard/server.mjs"
node --check "{baseDir}/dashboard/public/app.js"
node --check "{baseDir}/scripts/build-dashboard-demo.mjs"
node "{baseDir}/scripts/validate-tasks.mjs" --tasks examples/tasks
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
