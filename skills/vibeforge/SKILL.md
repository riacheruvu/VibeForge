---
name: vibeforge
description: >
  Measure and improve how well an AI setup (model, instructions, memory, tools,
  routing) fits a person — not raw model IQ. Use for preference fit, fit reviews,
  setup comparison, case studies, Promptfoo preference suites, high-signal answers,
  pushback, anti-sycophancy, confidence calibration, and local-first evaluation.
  Triggers: VibeForge, vibeforge, /vibeforge, fit review, preference fit, setup evaluation.
metadata: {"openclaw":{"requires":{"bins":["node","python3"]}},"codex":{"requires":{"bins":["node","python3"]}}}
---

# VibeForge

**Product / skill / slash command:** VibeForge · `$vibeforge` · `/vibeforge`

## This skill *is* the product UI

Users talk to **you** (this skill). You run local scripts.  
**Do not** tell the user to run `npm run …` or paste shell homework for normal flows.

| Layer | Role |
|---|---|
| User | Natural language / `$vibeforge` / `/vibeforge` |
| Skill (you) | Decide path, run scripts, explain results |
| Scripts | Implementation under `{baseDir}/scripts/` |
| `docs/COMMANDS.md` | Contributor reference only |

Act like a **setup guide**, not a command dump. Measure **fit of an AI setup**,
not general model capability.

```text
observe preferences / friction
  → public-safe eval cases
  → compare setups
  → find fit failures
  → recommend smallest experiment
  → held-out rerun
  → keep only if it helped (human review)
```

Capability ≠ preference alignment. Public arenas rank popularity; this skill
helps make a setup feel right **for this user**.

Human docs: `README.md`, `docs/GETTING-STARTED.md`, `docs/DIMENSIONS.md`.

## UX decision tree (do this first)

| User says… | You run (yourself) | Network / install? |
|---|---|---|
| “Try it” / “show me” / first time | Demo chart + optional offline case study | No |
| One preference / “fit review” / draft tests | `create-fit-review.mjs` or `draft-test-case.mjs` only | No |
| “Improve my setup” offline | `run-case-study.mjs` or start dashboard | No |
| **“Run a fit eval” / test models** | **`run-fit-eval.mjs`** (unified model path) | mock/auto/ollama = no key; openai/anthropic = ask first |
| Compare installed local models | Prefer `run-fit-eval.mjs --mode ollama` | Local only; ask before pull |
| Promptfoo / CI | Advanced only: `check-promptfoo.mjs` then export; ask before `npx` | Ask first |
| “Did the agent run the tool?” | Operator eval (tooling works) — **not** personal fit | — |

Always say which mode you used: **preference-fit** vs **operator**.

When offering follow-ups, use skill language:

```text
Say: “Use VibeForge. Run the offline case studies.”
```

Not: “Run `npm run case:studies`.”

## Default safety posture

Default to **local, draft-only** unless the user explicitly asks to run model
evaluations. Do not install packages, download weights, pull Ollama models, run
`npx`, call hosted providers, or send prompts/outputs externally without
explicit approval.

Fit review / draft / chart-from-demo-data must **not** also start Ollama,
Promptfoo, or hosted calls.

If a step needs anything beyond local file/script execution, stop and ask in
plain language first. Prefer **pinned, well-known** tools when the user approves
an install (e.g. Promptfoo).

## Golden path (skill executes)

### A) Draft only (no model, no key)

```bash
node "{baseDir}/scripts/chart-results.mjs" --input examples/promptfoo-results.user-fit-demo.json --out reports/skill-chart.html
node "{baseDir}/scripts/create-fit-review.mjs" "The user prefers concise, high-signal answers…"
node "{baseDir}/scripts/run-case-study.mjs" --all
```

### B) Model side — **one** command (prefer this over legacy runners)

```bash
# mock smoke (no key) — uses fit-review cases + baseline vs suggested candidate if present
node "{baseDir}/scripts/run-fit-eval.mjs" --fit-review vibeforge-out --mode mock

# auto: Ollama if available, else mock
node "{baseDir}/scripts/run-fit-eval.mjs" --fit-review vibeforge-out --mode auto

# local models
node "{baseDir}/scripts/run-fit-eval.mjs" --fit-review vibeforge-out --mode ollama

# hosted — ONLY after user approves API use
node "{baseDir}/scripts/run-fit-eval.mjs" --fit-review vibeforge-out --mode openai
node "{baseDir}/scripts/run-fit-eval.mjs" --fit-review vibeforge-out --mode anthropic
```

**Judge on this path = deterministic JS only** (no judge model, no judge key).  
Say that clearly. Optional LLM judges are advanced and separate.

Dispatcher:

```bash
node bin/vibeforge.mjs eval --mode mock
node bin/vibeforge.mjs eval --mode ollama
```

### Demote (do not lead with these)

- `run-profile.mjs` / free-form LLM judge A/B  
- Raw Promptfoo for first-time users  
- `run-local-subjects.mjs` alone (use `run-fit-eval.mjs` instead)  
- Multi-step capture → score → chart homework when fit-review cases already exist  

Still OK as advanced: Promptfoo CI, capture for in-app pickers, explicit LLM judge.

Explain outputs in plain language. Treat suggested configs as **candidates for
review**, never auto-applied changes. A gate “pass” means eligible for human
review only.

## What “setup” means

Evaluate more than the model name: instructions, memory, tools/MCP, skills,
routing, generation settings, context/retrieval. Change **one surface at a time**
when improving.

Fit failures (preferred vocabulary): overclaims, low signal/verbosity, no
pushback, too agreeable, ignores constraints, over-refuses, takes over
decisions, format drift. See `docs/DIMENSIONS.md`.

## Two evaluation modes

- **Preference fit eval:** score the setup’s *answers* against the user’s preferences. Core product use case.
- **Operator eval:** can the agent run this tooling? Useful for Codex/Claude checks — **not** evidence the model fits the user.

## Default technical path (when they want real regression)

Prefer Promptfoo export for multi-provider / CI-shaped runs:

```text
preferences.yaml + cases.json + system-prompt.txt
  -> scripts/export-promptfoo.mjs
  -> promptfooconfig.yaml
  -> promptfoo eval
```

This skill owns preference schema, examples, rubrics, and fit framing.
Promptfoo is optional and not bundled — check first, ask before `npx`.

For benchmark-design work, prefer task packs in `examples/tasks`:

```bash
node "{baseDir}/scripts/validate-tasks.mjs" --tasks examples/tasks
node "{baseDir}/scripts/export-task-pack-promptfoo.mjs" --tasks examples/tasks --provider ollama:chat:qwen3:0.6b --out promptfooconfig.tasks.yaml
```

Use `--include-judge` only with approved providers. Judges are fallible; tiny
local judges are rough signal only.

## Conversation history

Keep the first pass local and deterministic:

```bash
node "{baseDir}/scripts/mine-conversation-history.mjs" --input conversations.json
```

Plain-language preference only:

```bash
node "{baseDir}/scripts/draft-test-case.mjs" --preference "The user prefers concise, high-signal answers that preserve necessary nuance." --stdout
```

Nontechnical fit review folder:

```bash
node "{baseDir}/scripts/create-fit-review.mjs" "The user prefers concise, high-signal answers that preserve necessary nuance."
```

Writes `vibeforge-out/` with `VIBE_REPORT.md`, `fit-report.html`,
`eval-cases.json`, `run-results.json` (`not_run` until a real comparison),
`suggested-config.md`, `improvement-plan.md`, `next-experiment.json`,
`provenance.json`.

Treat every mined item as a **candidate**. Prefer public-safe rewrites; keep
provenance via hashes. After review:

```bash
node "{baseDir}/scripts/promote-history-candidates.mjs" --review captures/history-review.json --decisions review-decisions.json --out captures/personal-fit/project.json --tasks-dir captures/personal-fit/tasks
```

Require some `held_out` cases before recommending a configuration replacement.
Dashboard **Build tests** workspace is the UI for this flow.

## Improve setup

Optimizer (train + held-out; may call providers you configure):

```bash
node "{baseDir}/scripts/optimize-config.mjs" --profile preferences.yaml --case-file train-cases.json --validation-case-file held-out-cases.json --prompt-file system-prompt.txt
```

Next experiment from results:

```bash
node "{baseDir}/scripts/recommend-next-experiment.mjs" --input reports/results.json --project captures/personal-fit/project.json --out reports/next-experiment.json
```

One-surface plan:

```bash
node "{baseDir}/scripts/plan-setup-experiment.mjs" --baseline baseline-setup.json --candidate candidate-setup.json --out reports/setup-experiment.json
```

Offline story (prefer for demos):

```bash
node "{baseDir}/scripts/run-case-study.mjs" --list
node "{baseDir}/scripts/run-case-study.mjs" --case feedback-friction-loop
```

Never present recommendations as automatic deployment.

## Workflow detail

1. Clarify intent (draft / offline demo / real run).
2. Dashboard when they want a visual workspace:

```bash
node "{baseDir}/dashboard/server.mjs"
```

Open `http://127.0.0.1:4173`. Allowlisted local presets only; store runs under
gitignored `captures/dashboard-runs/`. Do not expose arbitrary shell or unapproved
hosted providers on the HTTP API.

Static Pages demo:

```bash
node "{baseDir}/scripts/build-dashboard-demo.mjs"
```

3. For real comparisons, export Promptfoo yourself (do not only tell the user to):

```bash
node "{baseDir}/scripts/export-promptfoo.mjs" --example complex --provider "$PROVIDER" --out promptfooconfig.yaml
```

4. Check Promptfoo before install:

```bash
node "{baseDir}/scripts/check-promptfoo.mjs"
promptfoo --version
npx --no-install promptfoo --version
```

If available and providers are local, run eval and chart `reports/results.json`.
If install or hosted APIs are needed, **ask first**.

5. Summarize by preference id; call out brittle rubrics and demo vs real data.

Gate train vs held-out before treating a config as improved:

```bash
node "{baseDir}/scripts/gate-config-results.mjs" --train reports/results.train.json --heldout reports/results.heldout.json --out reports/config-gate.json
```

Offline demo chart:

```bash
node "{baseDir}/scripts/chart-results.mjs" --input "{baseDir}/examples/promptfoo-results.user-fit-demo.json" --out reports/skill-chart.html
```

Always label demo data clearly.

## Captured model answers

When models live inside a chat UI / model picker, capture answers then score:

```bash
node "{baseDir}/scripts/prepare-capture-session.mjs" --name codex-model-sweep --model "Model A" --model "Model B" --limit 4
node "{baseDir}/scripts/ingest-captured-markdown.mjs" --input captures/codex-model-sweep/answers.md --out reports/captured-answers.json
node "{baseDir}/scripts/score-answers.mjs" --input reports/captured-answers.json --out reports/results.captured.json
node "{baseDir}/scripts/chart-results.mjs" --input reports/results.captured.json --out reports/skill-chart.captured.html
```

Optional judge pass only with approved judge provider. This scores **answer fit**,
not operator success.

## Local / OSS subjects

```bash
node "{baseDir}/scripts/run-local-subjects.mjs" --provider "file://examples/promptfoo-aligned-provider.mjs" --provider echo --limit 1 --out reports/answers.local-smoke.json --scored-out reports/results.local-smoke.json --chart-out reports/skill-chart.local-smoke.html
```

Ollama only if installed and models present; never pull without approval.

## Friendly local setup behavior

1. Check what is already installed before suggesting installs.
2. Explain in plain language (what works, what is blocked, what to approve next).
3. Ask before packages, Promptfoo download, model pulls, or hosted providers.
4. Prefer actionable fixes over raw stack traces.
5. Dashboard direct runner: Ollama today; other runners via Promptfoo/export.
6. Model family names (Qwen, Gemma, …) need a local runner before direct use.

## Validation (contributors)

```bash
node --check "{baseDir}/scripts/export-promptfoo.mjs"
node --check "{baseDir}/scripts/create-fit-review.mjs"
node --check "{baseDir}/scripts/chart-results.mjs"
node --check "{baseDir}/scripts/optimize-config.mjs"
node --check "{baseDir}/scripts/run-case-study.mjs"
node --check "{baseDir}/dashboard/server.mjs"
node "{baseDir}/scripts/validate-tasks.mjs" --tasks examples/tasks
node "{baseDir}/scripts/export-promptfoo.mjs" --example complex --provider echo --out promptfooconfig.yaml
node "{baseDir}/scripts/chart-results.mjs" --input "{baseDir}/examples/promptfoo-results.user-fit-demo.json" --stdout
```

`echo` is plumbing only (should fail rubrics). Positive control:
`file://{baseDir}/examples/promptfoo-aligned-provider.mjs`.

## Optional A/B runner

Legacy `run-profile.mjs` only when the user explicitly wants default-vs-custom
prompt comparison with a judge. Prefer a strong separate judge model.

## Guardrails

- Do not send personal profiles or sensitive prompts to providers that log data.
- Keep smoke case counts small.
- Deterministic rubrics = regression signal, not proof of broad quality.
- Outputs may vary even when scoring is deterministic.
- Never auto-deploy config changes.
- OpenClaw after local Codex/Claude skill path works.
