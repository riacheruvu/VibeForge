---
description: VibeForge — measure and improve AI setup fit (fit review, fit eval, case studies).
argument-hint: "[fit review | fit eval | case studies | dashboard | …]"
---

# /vibeforge — personal AI setup fit

## Product UX rule

**This slash command is the interface.**  
You run local scripts. Do **not** tell the user to run `npm run …` for normal work.

- **Product name:** VibeForge  
- **Command:** `/vibeforge` only  
- Measure **setup fit**, not model IQ. Capability ≠ preference alignment.

## Friendly default

Act like a **setup guide**. Clarify intent if unclear:

1. **Draft only** — fit review / public-safe test from a preference  
2. **Offline demo** — chart + case studies (no models)  
3. **Real run** — local Ollama or Promptfoo comparison  

Run safe local commands yourself. Explain results in plain language.  
**Ask before** installing packages, downloading models, `npx`, or hosted APIs.

## Decision tree → you execute

| Intent | You run |
|---|---|
| First look / “show me” | Demo chart via `chart-results.mjs` on checked-in demo JSON |
| One preference sentence | `create-fit-review.mjs` or `draft-test-case.mjs` |
| Full offline loop | `run-case-study.mjs --all` or `--case …` |
| Visual UI | `dashboard/server.mjs` → http://127.0.0.1:4173 |
| **Fit eval / real models** | `run-fit-eval.mjs` on fit-review dir (`--mode mock\|auto\|ollama\|openai\|anthropic`) |
| Local models | Prefer fit eval `--mode ollama` (ask before pull) |
| Promptfoo / CI | Advanced only; ask before install/API |

Always label **preference-fit eval** vs **operator eval**.

## Golden path (you run; no API key)

From repo root:

```bash
node skills/vibeforge/scripts/chart-results.mjs --input examples/promptfoo-results.user-fit-demo.json --out reports/skill-chart.html

node skills/vibeforge/scripts/create-fit-review.mjs "The user prefers concise, high-signal answers that preserve necessary nuance."

node skills/vibeforge/scripts/run-case-study.mjs --all
```

Explain: chart may be **demo data**; fit review is **draft-only**; suggested configs are **candidates**, never auto-applied.

### Model-side fit eval (preferred)

```bash
node skills/vibeforge/scripts/run-fit-eval.mjs --fit-review vibeforge-out --mode mock
node skills/vibeforge/scripts/run-fit-eval.mjs --fit-review vibeforge-out --mode auto
# hosted only after user approves:
# node skills/vibeforge/scripts/run-fit-eval.mjs --fit-review vibeforge-out --mode openai
```

Judge on this path = **deterministic only**. Say so. Do not lead with `run-profile` or raw Promptfoo.

When suggesting a next step to the user, phrase it as:

```text
You can say: “Use VibeForge. Run the offline case studies.”
```

Not a shell one-liner for them to copy unless they are a contributor debugging scripts.

## Local readiness

```bash
node skills/vibeforge/scripts/check-promptfoo.mjs
ollama list
```

Plain language only in the reply.

## Improve setup

```bash
node skills/vibeforge/scripts/run-case-study.mjs --case feedback-friction-loop
```

Optimizer only when they explicitly want it and accept provider implications — confirm first.  
Gate train vs held-out before treating any config as improved. Pass = **human review only**.

## Dashboard

```bash
node skills/vibeforge/dashboard/server.mjs
```

Never claim files were auto-edited from suggested changes.

## Real model comparisons

Check Promptfoo / Ollama yourself. Ask before `npx promptfoo@latest` or hosted APIs.

## Validate plumbing (contributors / operator eval)

```bash
node --check skills/vibeforge/scripts/export-promptfoo.mjs
node --check skills/vibeforge/scripts/chart-results.mjs
node skills/vibeforge/scripts/export-promptfoo.mjs --example complex --provider echo --out promptfooconfig.yaml
node skills/vibeforge/scripts/chart-results.mjs --input examples/promptfoo-results.user-fit-demo.json --stdout
```

Canonical skill: `skills/vibeforge/SKILL.md`  
Human UX: `docs/GETTING-STARTED.md`
