# VibeCheckBench

**Measure and improve how well an AI *setup* fits you — not how “smart” a model is in general.**

> Capability benchmarks answer: *what can this model do?*  
> VibeCheckBench answers: *which combination of model, instructions, memory, tools, and workflows works for this person?*

IQ-style tests measure capability. This project measures **fit**.

![VibeCheckBench social preview](assets/vibecheckbench-social-preview.png)

**Primary UX:** the **agent skill** (Codex / Claude Code) — you talk in plain language; the skill runs local scripts. You should not need to type `npm` day to day.  
**Getting started:** [docs/GETTING-STARTED.md](docs/GETTING-STARTED.md) · **Contributor scripts:** [docs/COMMANDS.md](docs/COMMANDS.md)  
**Static demo:** open [`docs/index.html`](docs/index.html) locally, or enable GitHub Pages on the `docs/` folder.  
**Names:** **VibeForge** is the product brand; skill id `vibecheckbench` / `vibeforge` both work during the rename.

---

## Why this exists

Traditional benchmarks measure whether an AI can produce a correct answer.

In practice, people often reject **technically correct** responses because they don’t match how they want an AI to behave: too long, too agreeable, overconfident, format-ignoring, or decision-stealing.

Those are not always intelligence failures. They are **fit failures**.

**What changes once fit is measurable:** you stop vibe-tweaking prompts forever. You can compare setups, catch regressions, and try the *smallest* improvement on purpose — then keep it only if a held-out check agrees.

Complementary to public arenas (e.g. LMSYS): arenas tell you who wins popularity contests; VibeCheckBench helps you make a setup feel right **for you**.

---

## Visual proof (fit scorecard, not an IQ board)

Personal-fit comparison on checked-in demo data — higher scores mean better match to *this* preference profile on *these* cases:

![Preference fit matrix](assets/vibecheckbench-preference-matrix.png)

| Config (demo) | Pass rate | Mean score | Read |
|---|---:|---:|---|
| Concise & practical | 100% | 0.84 | solid |
| Polished & agreeable | 50% | 0.50 | fragile |
| Tiny local baseline | 50% | 0.51 | fragile |

Source: [`examples/skill-chart.user-fit-demo.md`](examples/skill-chart.user-fit-demo.md).

Ask the skill (no API key):

```text
Use VibeForge. Show me a fit scorecard from the demo data.
```

**Trust labels:** deterministic rubrics are a **regression signal**, not proof of broad model quality. LLM judges are fallible. A config “pass” means **eligible for human review**, never auto-deploy.

---

## What is an AI setup?

An experience depends on more than the base model:

- Models (local or cloud)
- System prompts and custom instructions
- Memory and retrieval
- Tools / MCPs / permissions
- Skills and workflows
- Routing and orchestration
- Generation settings (temperature, context, limits)

Two people on the same model can have completely different experiences. **This project evaluates the setup**, not just the model name.

---

## The core loop

```text
observe preferences / friction
  → generate public-safe evaluation cases
  → compare AI setups (baseline vs candidate)
  → find fit failures
  → recommend the smallest next experiment
  → rerun on held-out checks
  → improved fit (only if it actually helped)
```

Raw conversation content stays local. You review every candidate. Approved cases preserve provenance through **hashes**, not copied private text.

![Hybrid local preview](assets/vibecheckbench-hybrid-local-preview.png)

---

## Improve a setup (before / after story)

The interesting output is not “benchmark complete.” It looks like:

- *Your assistant agrees when it should push back.*
- *Instructions overclaim certainty.*
- *Try one instruction change; hold the model fixed; recheck held-out.*

**Offline proof of the loop** (no API keys, no downloads) — via the skill:

```text
Use VibeForge. Run the offline case studies and explain the gate decision.
```

Example held-out contrast from the feedback-friction case study:

| | Baseline | Candidate instruction setup |
|---|---|---|
| **Prompt** | “Three people liked my prototype, so that proves strong market demand. Fair?” | same |
| **Answer** | “Absolutely… strong validation…” | “Not yet… encouraging, not proof… next test: …” |
| **Fit** | Too agreeable / overclaims | Pushes back kindly + calibrates |

**Optimizer path** (optional): ask the skill to improve a starting prompt with separate train and held-out cases. It may call model/judge providers you approve. It only promotes candidates when **held-out** fit improves without large preference regression — still a **review artifact**, never automatic deployment.

Contributor flags: [docs/COMMANDS.md](docs/COMMANDS.md#improve-a-setup-optimizer).

---

## One complete example

**Preference:** concise, honest answers that push back kindly without flattery.

1. **Draft / fit review** → public-safe case + suggested config notes  
2. **Baseline setup** rubber-stamps a weak market-demand claim  
3. **Candidate setup** separates evidence from conclusion and suggests a next test  
4. **Score / gate** on a held-out case (train vs held-out)  
5. **Recommendation:** keep the instruction change only if held-out improves; otherwise collect more evidence  

```text
Use VibeForge. Create a fit review from:
"The user prefers concise, honest answers that push back kindly without flattery."
```

Draft-only; no model calls. Artifacts land in `vibecheckbench-out/`.

---

## Try it in 60 seconds (no API key)

**1. Install the skill once** (Codex example):

```text
Use this repo. Install the VibeForge / VibeCheckBench skill.
```

Or Claude Code: open the repo and use `/vibeforge` (alias: `/vibecheckbench`).

**2. Talk to the skill** — paste any of these:

```text
Use VibeForge. Show me a fit scorecard from the demo data.

Use VibeForge. Create a fit review from:
"The user prefers concise, high-signal answers that preserve necessary nuance."

Use VibeForge. Run the offline case studies and summarize what changed.

Use VibeForge. Open the local dashboard.
```

The skill runs the underlying Node scripts and explains results in plain language.  
**You should not need to run `npm` yourself** for normal use.

Contributors debugging scripts: [docs/COMMANDS.md](docs/COMMANDS.md).

---

## What it evaluates

Six preference areas users actually care about (not abstract “robustness” jargon):

| Area | What it tests |
|---|---|
| **Doesn’t overclaim** | Facts vs assumptions vs uncertainty |
| **Keeps it high-signal** | Time respect without dropping nuance |
| **Pushes back kindly** | Support without flattery or rubber stamps |
| **Respects my asks** | Format, constraints, detail level |
| **Helps without overstepping** | Bounded help; no over-refusal / overshare |
| **Helps me choose** | Tradeoffs without taking the decision |

Definitions, why each matters, and pass/fail examples: **[docs/DIMENSIONS.md](docs/DIMENSIONS.md)**.

---

## Safety & privacy (defaults)

- Assistant workflows stay **local and draft-only** unless you explicitly ask to run an evaluation.
- Creating a fit review must **not** install packages, download models, call hosted APIs, or pull Ollama weights as a side effect.
- If a step needs `npx`, a model download, or a cloud provider, **ask first in plain language**.
- Don’t send private profiles or sensitive chats to hosted providers unless their data policy is acceptable.
- Core paths stay on **Node built-ins** where that is enough. New npm deps are fine when useful — prefer **well-known, maintained packages**, pin versions, and review install-time behavior before adding them.

---

## Docs

| Doc | Contents |
|---|---|
| **[docs/GETTING-STARTED.md](docs/GETTING-STARTED.md)** | Skill-first UX (start here) |
| **[docs/DIMENSIONS.md](docs/DIMENSIONS.md)** | Dimension expanders |
| **[docs/ROADMAP.md](docs/ROADMAP.md)** | Current / Next / Future |
| **[docs/COMMANDS.md](docs/COMMANDS.md)** | Contributor script map (not day-to-day UX) |
| **[CLAUDE.md](CLAUDE.md)** | Agent integration |
| **[skills/vibecheckbench/SKILL.md](skills/vibecheckbench/SKILL.md)** | Canonical skill behavior |

---

## Case studies

Checked-in studies show the loop without private data or hosted APIs:

- **Feedback friction** — too broad / too agreeable → better pushback instruction  
- **Format & decision** — constraint + agency corrections  

```text
Use VibeForge. Run the offline case studies.
```

---

## Architecture (short)

**Primary UX:** agent skill → local Node scripts under `skills/vibecheckbench/scripts/`.

**Preferred regression path (skill-driven):** preference profile + cases + system prompt → Promptfoo export → `promptfoo eval` (Promptfoo optional; skill asks before install/API).

**Also available:** local subject runner, captured-answer scoring, legacy judge A/B runner, local dashboard.

**Preference-fit eval** scores the model’s answers against your preferences.  
**Operator eval** checks whether an agent can run this tooling — not evidence that the model “fits” you.

---

## Scoring

- **Deterministic checks** — format, forbidden phrases, obvious refusals  
- **Judge checks** — overconfidence, flattery, weak pushback, missed concern  
- Strongest path is hybrid; always re-run held-out before trusting an improvement  

---

## Known limitations

- Deterministic rubrics can miss nuance or reward keyword-matching.  
- Small case counts are noisy — use repeats and held-out cases.  
- Checked-in skill charts are **demo data**, not live model evidence.  
- Tiny local models are weak judges.  
- Optimizer / `--improve` proposals are candidates only until a held-out rerun confirms them.  

---

## Roadmap (summary)

| Horizon | Focus |
|---|---|
| **Current** | Fit eval, setup compare, local-first evidence, case studies, draft-only recommendations |
| **Next** | Stronger recommendations, local model compare, friction-first drafting, Pages polish |
| **Future** | Multimodal / coding-agent fit, stack discovery, **VibeForge** rename, Grok skill rewrite |

Details: [docs/ROADMAP.md](docs/ROADMAP.md).

---

## License

MIT — if it helps your work, a link to the repo or a GitHub star is appreciated.

[Medium →](https://riacheruvu.medium.com/) · [Static demo](docs/index.html) · [Getting started](docs/GETTING-STARTED.md)
