# Getting started

**Goal:** measure and improve how well an **AI setup** fits *you* — not who wins a general model leaderboard.

**Names:** product + GitHub repo **VibeForge** (`github.com/riacheruvu/VibeForge`). Skill/path ids still accept **VibeCheckBench** / `vibecheckbench` during the transition.

---

## Primary interface: the skill (not npm)

**Users should not need to type `npm` or shell commands.**

Talk to an assistant that has the skill installed (Codex, Claude Code, etc.):

| You say… | The skill does… | Network? |
|---|---|---|
| “Use VibeForge — show me a fit scorecard” | Builds the demo skill chart and explains it | No |
| “Create a fit review: I want concise high-signal answers” | Writes `vibecheckbench-out/` draft artifacts | No |
| “Run the offline case studies / improve-setup loop” | Runs public-safe case studies, summarizes gate | No |
| “Open the local dashboard” | Starts dashboard, gives you the URL | No |
| “Smoke-test the tooling” | Mock fit eval on your cases (or plumbing smoke) | No |
| “Run a fit eval on my cases” | **Unified model path:** subjects → deterministic score → chart | No for mock/Ollama; key only for OpenAI/Anthropic |
| “Compare with Ollama” | Fit eval `--mode ollama` (ask before pull) | Local only |
| “Compare with OpenAI / Anthropic” | Fit eval `--mode openai|anthropic` after you approve keys | **Yes** (that provider) |
| “Export a Promptfoo suite for CI” | Advanced / contributor path; skill asks before `npx` | Optional |

### How to invoke

**Claude Code**

```text
/vibeforge
/vibecheckbench
```

Or in natural language: *Use VibeForge. Create a fit review from: “…”*

**Codex**

```text
$vibecheckbench
$vibeforge
```

After install: `npm run skill:install` once (contributor/setup step), then stay in skill language.

**Install skill once (setup only)**

```text
Ask the agent: Install the VibeForge / VibeCheckBench skill for Codex.
```

That runs the installer under the hood. Day-to-day work is skill utterances, not package scripts.

---

## What “good skill UX” looks like

When the user says “use VibeCheckBench” / “use VibeForge”:

1. **Clarify intent** if needed: draft only, offline demo, or real model run?
2. **Default to draft-only** unless they asked to evaluate models.
3. **Run scripts yourself** — do not paste `npm run …` for the user to execute.
4. **Explain artifacts in plain language** (“I created a review folder; nothing left this machine”).
5. **Never auto-apply** prompt/memory/skill changes.
6. **Ask before** package installs, model pulls, or hosted APIs.
7. When suggesting a follow-up, phrase it as a **skill request**, e.g.  
   *“Say: use VibeForge to run the offline case studies”*  
   not *“run `npm run case:studies`”*.

Scripts under `skills/vibecheckbench/scripts/` are the **implementation** the skill calls.  
`docs/COMMANDS.md` is a **contributor reference**, not the product UI.

---

## Headless output (when the skill runs scripts)

Scripts print a short **VibeForge** block:

1. What just happened  
2. Key facts (paths, scores, gate)  
3. **Next** — skill-phrased follow-ups  
4. **Trust** — demo data? not auto-deploy? fit ≠ IQ?

Shared helper: `skills/vibecheckbench/scripts/cli-ux.mjs`  
Quiet nested runs: `--quiet` / `VIBEFORGE_QUIET=1`

---

## The loop

```text
friction or preference
  → public-safe test (draft, no model)
  → fit eval on subject model(s)  ← model side
  → compare baseline vs candidate setup (optional)
  → held-out gate
  → keep only if it helped (human review; never auto-deploy)
```

### Model side (one path)

| Piece | Default | Needs key? |
|---|---|---|
| **Subject** (answers) | `auto`: Ollama if up, else mock | No (hosted modes need key) |
| **Judge** | Deterministic JS rubrics | **Never** on this path |
| **Script** | `run-fit-eval.mjs` / skill “run a fit eval” | — |

**Demoted (don’t lead with these):** legacy `run-profile` A/B judge loop, raw Promptfoo for first runs, dashboard multi-preset as the only model UI, separate capture/score/chart homework for the happy path.

**Still valid advanced:** Promptfoo CI, capture sessions for in-app model pickers, optional LLM judge when you explicitly want one.

---

## Fit vs operator eval

| Mode | Question |
|---|---|
| **Preference fit** | Do this setup’s *answers* match my preferences? |
| **Operator** | Can the agent run this tooling correctly? |

Do not present operator success as personal fit.

---

## Next docs

- Product story: [../README.md](../README.md)
- Dimensions: [DIMENSIONS.md](./DIMENSIONS.md)
- Contributor command map: [COMMANDS.md](./COMMANDS.md)
- Roadmap: [ROADMAP.md](./ROADMAP.md)
