# Command reference (contributors)

> **Day-to-day product UX is the agent skill**, not this page.  
> Users should say *“Use VibeForge…”* — see [GETTING-STARTED.md](./GETTING-STARTED.md).  
> This file maps scripts the skill runs under the hood (and for debugging).

Product story: root [README.md](../README.md).  
**CLI names:** `vibeforge` and `vibeforge` are the same dispatcher (`bin/vibeforge.mjs`).

**Shells:** examples in **bash**. On **PowerShell**, continue lines with a backtick (`` ` ``) instead of `\`.

**Security defaults**

- Local draft/fit-review commands do not call hosted APIs.
- Anything that installs packages (`npx`), pulls models, or hits cloud providers needs **explicit approval**.
- Prefer checked-in demo data and mock providers for smoke tests.
- **Dependencies OK when justified:** popular, maintained packages; pin versions.

Paths below assume the repo root as the working directory.

---

## Skill → script map (golden path)

| User says to the skill… | Script the skill runs |
|---|---|
| Show a fit scorecard (demo) | `chart-results.mjs` + demo JSON |
| Create a fit review from “…” | `create-fit-review.mjs` |
| Run offline case studies | `run-case-study.mjs --all` |
| **Run a fit eval / test models** | **`run-fit-eval.mjs`** (`--mode mock\|auto\|ollama\|openai\|anthropic`) |
| Smoke plumbing only | `bin/vibeforge.mjs run` |
| Open the dashboard | `dashboard/server.mjs` |
| Install Codex skill | `install-codex-skill.mjs` |

### Model-side defaults

| | |
|---|---|
| Subject | mock / Ollama / OpenAI / Anthropic via `--mode` |
| Judge | **Deterministic only** on `run-fit-eval.mjs` |
| Fit-review dual pack | Auto baseline vs candidate if `suggested-config.md` has Candidate Wording |

```bash
node skills/vibeforge/scripts/run-fit-eval.mjs --fit-review vibeforge-out --mode mock
node bin/vibeforge.mjs eval --mode auto
```

Optional npm aliases (`npm run chart:demo`, etc.) exist only as shortcuts for contributors.  
**Agents should call `node …/scripts/….mjs` (or the dispatcher), not teach users npm.**

Headless scripts print a **VibeForge** summary: what happened, files, **Next (ask the skill)**, **Trust**.  
Nested runs: `--quiet` / `VIBEFORGE_QUIET=1`.

---

## npm scripts

| Script | What it runs |
|---|---|
| `npm run vibeforge -- <cmd>` | `bin/vibeforge.mjs` |
| `npm run vibeforge -- <cmd>` | Same dispatcher (VibeForge alias) |
| `npm start` | Print golden-path help |
| `npm run dashboard` | Local dashboard server (`127.0.0.1:4173`) |
| `npm run dashboard:demo` | Build static dashboard demo assets |
| `npm run chart:demo` | Skill chart from checked-in demo JSON |
| `npm run fit:review` | `create-fit-review.mjs` |
| `npm run fit:draft` | `draft-test-case.mjs` |
| `npm run fit:mine` | `mine-conversation-history.mjs` |
| `npm run fit:promote` | `promote-history-candidates.mjs` |
| `npm run fit:recommend` | `recommend-next-experiment.mjs` |
| `npm run fit:plan` | `plan-setup-experiment.mjs` |
| `npm run fit:optimize` | `optimize-config.mjs` (needs provider/judge; see below) |
| `npm run case:studies` | All checked-in case studies |
| `npm run promptfoo:check` | Check whether Promptfoo is available **without** installing |
| `npm run skill:install` | Install Codex skill locally |

---

## Dispatcher (`bin/vibeforge.mjs`)

```bash
node bin/vibeforge.mjs draft "I want concise, honest answers"
node bin/vibeforge.mjs demo pushback
node bin/vibeforge.mjs run
node bin/vibeforge.mjs capture --setup codex
node bin/vibeforge.mjs report
node bin/vibeforge.mjs recommend
```

| Command | Effect |
|---|---|
| `draft` | Public-safe starter case from one preference sentence |
| `demo pushback` / `concise` / `privacy` | Fit-review folder under `vibeforge-out/` |
| `run` | No-key smoke compare (aligned mock provider vs echo) |
| `capture --setup codex` | Local answer-capture session for model-picker flows |
| `report` | Rebuild fit chart from local results |
| `recommend` | Print planned next experiment (candidate only) |

---

## Fit review & drafting

```bash
# One preference → review artifacts in vibeforge-out/
npm run fit:review -- "The user prefers concise, high-signal answers that preserve necessary nuance."

# Draft a single public-safe case to stdout
npm run fit:draft -- --preference "The user prefers concise, honest answers." --stdout
```

Outputs typically include `VIBE_REPORT.md`, `fit-report.html`, `eval-cases.json`, `suggested-config.md`, `improvement-plan.md`, `next-experiment.json`, `provenance.json`.

`run-results.json` starts as `not_run` until a real comparison is attached.

---

## Improve a setup (optimizer)

Point at a starting prompt; iterate with a **separate train and held-out** case file.  
Promotions require held-out improvement without large preference regression.  
**Candidates are for human review — never auto-deploy.**

```bash
npm run fit:optimize -- \
  --profile examples/public-agent-profile.yaml \
  --case-file train-cases.json \
  --validation-case-file held-out-cases.json \
  --prompt-file examples/config-candidates/generic-supportive.txt \
  --iterations 2
```

This path may call model/judge providers depending on env (`VIBEFORGE_PROVIDER`, `VIBEFORGE_JUDGE_*`). Use a reliable separate judge for real claims.

Offline alternative that demonstrates the same *story* without the optimizer:

```bash
npm run case:studies
# or one study:
node skills/vibeforge/scripts/run-case-study.mjs --case feedback-friction-loop
```

---

## Case studies

```bash
npm run case:studies
node skills/vibeforge/scripts/run-case-study.mjs --list
node skills/vibeforge/scripts/run-case-study.mjs --case feedback-friction-loop
node skills/vibeforge/scripts/run-case-study.mjs --case format-decision-loop
```

---

## Conversation history → public-safe cases

Local and deterministic by default (no model calls):

```bash
npm run fit:mine -- --input examples/conversation-history.public-safe.example.json

npm run fit:promote -- \
  --review captures/history-review.json \
  --decisions examples/history-review-decisions.public-safe.example.json \
  --out captures/personal-fit/project.json \
  --tasks-dir captures/personal-fit/tasks
```

Review every candidate. Prefer public-safe rewrites; provenance uses hashes, not private text in the project manifest.

---

## Setup experiment planner

```bash
npm run fit:plan -- \
  --baseline examples/setup-manifests/baseline.example.json \
  --candidate examples/setup-manifests/instruction-candidate.example.json \
  --out reports/setup-experiment.json
```

Surfaces: model, instructions, memory, skills, tools, generation settings, context/retrieval, routing.

---

## Charts & local subjects

```bash
# Demo chart from checked-in JSON (no models)
npm run chart:demo

# Or explicit paths
node skills/vibeforge/scripts/chart-results.mjs \
  --input examples/promptfoo-results.user-fit-demo.json \
  --out reports/skill-chart.html

# Local Ollama subjects (only if Ollama is installed and models are already present)
node skills/vibeforge/scripts/run-local-subjects.mjs \
  --provider ollama:chat:qwen3:0.6b \
  --out reports/answers.json \
  --scored-out reports/results.json \
  --chart-out reports/skill-chart.html
```

Do **not** `ollama pull` or download weights unless the user approved the download.

Smoke test without models:

```bash
node skills/vibeforge/scripts/run-local-subjects.mjs \
  --provider "file://examples/promptfoo-aligned-provider.mjs" \
  --provider echo \
  --limit 1 \
  --out reports/answers.local-smoke.json \
  --scored-out reports/results.local-smoke.json \
  --chart-out reports/skill-chart.local-smoke.html
```

---

## Promptfoo (optional)

Preferred for CI and multi-provider regression. Promptfoo is **not** a required dependency of this repo.

```bash
# Check availability without installing
npm run promptfoo:check

node skills/vibeforge/scripts/export-promptfoo.mjs \
  --example complex \
  --provider ollama:chat:qwen3:0.6b \
  --out promptfooconfig.yaml
```

Only if Promptfoo is already installed (or you explicitly approve `npx`):

```bash
promptfoo eval -c promptfooconfig.yaml --output reports/results.json
# or, with explicit approval to download:
# npx promptfoo@latest eval -c promptfooconfig.yaml --output reports/results.json

node skills/vibeforge/scripts/chart-results.mjs \
  --input reports/results.json \
  --out reports/skill-chart.html
```

Gate train vs held-out before treating a config as improved:

```bash
node skills/vibeforge/scripts/gate-config-results.mjs \
  --train reports/results.train.json \
  --heldout reports/results.heldout.json \
  --out reports/config-gate.json
```

---

## Captured answers (model picker / chat UI)

When the model is not callable from Promptfoo (e.g. in-app picker):

```bash
node skills/vibeforge/scripts/prepare-capture-session.mjs \
  --name codex-model-sweep \
  --model "GPT 5.5 Codex" \
  --model "Claude Sonnet" \
  --limit 4

node skills/vibeforge/scripts/ingest-captured-markdown.mjs \
  --input captures/codex-model-sweep/answers.md \
  --out reports/captured-answers.json

node skills/vibeforge/scripts/score-answers.mjs \
  --input reports/captured-answers.json \
  --out reports/results.captured.json

node skills/vibeforge/scripts/chart-results.mjs \
  --input reports/results.captured.json \
  --out reports/skill-chart.captured.html
```

Optional LLM judge over captured answers (provider approval required):

```bash
node skills/vibeforge/scripts/judge-captured-answers.mjs \
  --input reports/answers.ollama.json \
  --tasks examples/tasks \
  --judge-provider ollama:chat:qwen3:0.6b \
  --out reports/results.ollama.judged.json
```

Tiny local models are weak judges — plumbing and rough signal only.

---

## Task packs

```bash
node skills/vibeforge/scripts/validate-tasks.mjs --tasks examples/tasks

node skills/vibeforge/scripts/export-task-pack-promptfoo.mjs \
  --tasks examples/tasks \
  --provider ollama:chat:qwen3:0.6b \
  --out promptfooconfig.tasks.yaml
```

---

## Legacy profile / A/B runner

Use only when you explicitly want default-vs-custom prompt comparison with a judge:

```bash
node skills/vibeforge/scripts/run-profile.mjs \
  --profile examples/public-agent-profile.yaml \
  --case-file examples/public-agent-cases.json \
  --prompt-file examples/public-agent-system-prompt.txt \
  --cases 2 \
  --repeat 3 \
  --save-report
```

Prefer a separate strong `--judge-provider` / `--judge-model` for serious runs.

---

## Direct benchmark helper

```bash
node scripts/direct-benchmark.mjs --gen
node scripts/direct-benchmark.mjs --judge-score answers.json \
  --judge-provider ollama:chat:qwen3:0.6b \
  --ollama-url http://127.0.0.1:11434
```

---

## Dashboard

```bash
npm run dashboard
# open http://127.0.0.1:4173

# rebuild static Pages-style demo from public-safe data
npm run dashboard:demo
```

The dashboard should not expose arbitrary shell or unapproved hosted providers.

---

## Environment variables

See `.env.example` when present. Common ones:

| Variable | Purpose |
|---|---|
| `VIBEFORGE_PROVIDER` | Subject provider (`llamacpp` / `openai` / `anthropic` / …) |
| `VIBEFORGE_MODEL` | Model override |
| `VIBEFORGE_JUDGE_PROVIDER` | Separate judge provider |
| `VIBEFORGE_JUDGE_MODEL` | Separate judge model |
| `VIBEFORGE_LLAMACPP_URL` | llama.cpp server URL |
| `VIBEFORGE_NUM_CASES` | Case count defaults |
| `VIBEFORGE_REPEAT` | Repeat count for profile runs |

Never commit API keys. Prefer local providers for private profiles.

---

## Agent entry points

| Surface | How |
|---|---|
| Claude Code | `/vibeforge` — see `.claude/commands/vibeforge.md` |
| Codex | `skills/vibeforge/` after `npm run skill:install` |
| Project guide | `CLAUDE.md` |

Operator eval (can the agent run the tooling?) is **not** the same as preference-fit eval (do the model’s answers fit the user?).
