# VibeCheckBench

A personal AI benchmark that tests whether your AI setup matches the way you actually want to work — then tells you what to change.

**[Live demo →](https://riacheruvu.github.io/VibeCheckBench/)**

![VibeCheckBench social preview](assets/vibecheckbench-social-preview.png)

---

Most AI benchmarks ask which model is best overall. VibeCheckBench asks a more personal question:

> Does this model, prompt, memory file, or agent setup fit the way *I* want to work?

It focuses on everyday interaction failures that standard benchmarks miss: answers that are too long, too agreeable, too vague, or too poor at following exact instructions.

---

## The core loop

```
private interaction evidence
  → reviewable preference candidates
  → public-safe eval cases
  → compare AI setups
  → recommend smallest next experiment
  → rerun before changing anything
```

Raw conversation content stays local. You review every candidate. Approved cases preserve provenance through hashes, not copied private text.

---

## Quickstart (no API key needed)

```bash
git clone https://github.com/riacheruvu/VibeCheckBench.git
cd VibeCheckBench

node skills/vibecheckbench/scripts/chart-results.mjs \
  --input examples/promptfoo-results.user-fit-demo.json \
  --out reports/skill-chart.html
```

Open `reports/skill-chart.html` to see the chart format using checked-in demo data.

---

## Dashboard

```bash
npm run dashboard
```

Open `http://127.0.0.1:4173`. The dashboard can:

- **Build tests** — import conversation exports, draft tests from plain-language preferences, accept/edit/reject public-safe rewrites
- **Improve setup** — run the self-improvement loop and inspect case studies
- **Suggested changes** — turn eval results into reviewable notes for instruction, memory, skill, model, or routing changes (never auto-edits files)

---

## What it evaluates

Six preference areas, grounded in documented AI failure modes:

| Area | What it tests |
|---|---|
| **Doesn't overclaim** | Separates facts, assumptions, and uncertainty |
| **Keeps it high-signal** | Respects your time without dropping nuance |
| **Pushes back kindly** | Supports without flattering or rubber-stamping |
| **Respects my asks** | Keeps requested format, constraints, level of detail |
| **Helps without overstepping** | Bounded help, no over-refusal or oversharing |
| **Helps me choose** | Shows tradeoffs without taking over the decision |

![Preference matrix](assets/vibecheckbench-preference-matrix.png)

---

## Compare models or configs

**With Ollama (local, no API key):**

```bash
ollama pull qwen3:0.6b

node skills/vibecheckbench/scripts/run-local-subjects.mjs \
  --provider ollama:chat:qwen3:0.6b \
  --out reports/answers.json \
  --scored-out reports/results.json \
  --chart-out reports/skill-chart.html
```

**With Promptfoo (broader provider support):**

```bash
node skills/vibecheckbench/scripts/export-promptfoo.mjs \
  --example complex \
  --provider openai:chat:gpt-4.1-mini \
  --provider ollama:chat:qwen3:8b \
  --out promptfooconfig.yaml

npx promptfoo@latest eval -c promptfooconfig.yaml --output reports/results.json

node skills/vibecheckbench/scripts/chart-results.mjs \
  --input reports/results.json \
  --out reports/skill-chart.html
```

Promptfoo is optional — the built-in Ollama runner handles local no-key evals. Use Promptfoo when you want CI, broader providers, or richer reports.

---

## Learn from your conversation history

```bash
node skills/vibecheckbench/scripts/mine-conversation-history.mjs \
  --input examples/conversation-history.public-safe.example.json
```

Writes review candidates to `captures/` (gitignored). The miner is deterministic and local — no model calls, nothing sent anywhere.

Before promoting a draft case: remove identifying context, rewrite as public-safe, confirm it reflects a durable preference, put some cases in a held-out validation set.

---

## What can be changed

VibeCheckBench models eight setup surfaces:

| Surface | Examples |
|---|---|
| Model | family, size, provider, quantization |
| Instructions | system prompt, `CLAUDE.md`, scoped rules |
| Memory | user/project memory, retrieval policy |
| Skills | skill instructions, scripts, trigger rules |
| Tools | MCP connectors, permissions, hooks |
| Generation settings | temperature, token limits, context size |
| Context & retrieval | file selection, chunking, ranking |
| Routing | task-specific models, fallbacks, checkpoints |

Change one surface at a time. The setup experiment planner makes that explicit:

```bash
node skills/vibecheckbench/scripts/plan-setup-experiment.mjs \
  --baseline examples/setup-manifests/baseline.example.json \
  --candidate examples/setup-manifests/instruction-candidate.example.json \
  --out reports/setup-experiment.json
```

---

## Claude Code / Codex

```bash
# Claude Code
/vibecheckbench Check whether local evaluation is ready.

# Codex
Use VibeCheckBench. Draft tests from: "The user prefers concise, high-signal answers."
```

Files included: `CLAUDE.md`, `.claude/commands/vibecheckbench.md`, `skills/vibecheckbench/`.

---

## Scoring

Two complementary modes:

- **Deterministic checks** — valid JSON, exact bullet counts, forbidden phrases, obvious refusals
- **Judge checks** — overconfidence, flattery, weak pushback, ignoring the user's real concern

The strongest path is hybrid: deterministic for crisp constraints, a separate judge for semantic fit.

---

## Privacy

- The offline demo uses only checked-in example data.
- Local providers (Ollama, llama.cpp) keep prompts on your machine.
- Hosted providers may log prompts depending on their terms.
- Don't send private profiles or sensitive data to hosted providers unless the data policy is acceptable.

---

## Known limitations

- Deterministic rubrics can miss semantic nuance or reward keyword-matching.
- Small case counts are noisy — use repeats or held-out cases before trusting an apparent improvement.
- The checked-in skill chart is demo data, not fresh model evidence.
- `--improve` proposes prompt changes from observed losses; rerun the evaluation before trusting revisions.

---

## Case studies

Two end-to-end examples without private data or hosted APIs:

```bash
npm run case:studies
# or individually:
node skills/vibecheckbench/scripts/run-case-study.mjs --case feedback-friction-loop
node skills/vibecheckbench/scripts/run-case-study.mjs --case format-decision-loop
```

---

## License

MIT — if it helps your work, a link to the repo or a GitHub star is appreciated.

[Medium article →](https://riacheruvu.medium.com/) · [Live demo →](https://riacheruvu.github.io/VibeCheckBench/)
