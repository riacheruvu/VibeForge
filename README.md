# VibeCheckBench

VibeCheckBench is a small prototype for turning "this AI feels off" into repeatable checks.

[**Open the live dashboard demo**](https://riacheruvu.github.io/MyBench/)

![VibeCheckBench social preview](assets/vibecheckbench-social-preview.png)

> Demo visual showing how different AI setups might fit or miss across user preference areas. Not a leaderboard; a way to make "this felt useful/off" easier to inspect.

Most AI benchmarks ask which model is best overall. VibeCheckBench asks a more personal question:

> Does this model, prompt, memory file, or agent setup fit the way someone actually wants to work?

It focuses on everyday interaction failures that standard benchmarks often miss: answers that are too long, too agreeable, too vague, too hesitant, too confident, or too poor at following exact instructions.

The goal is practical and user-owned: define preferences, run public-safe cases, compare setups, and visualize where each one fits or misses.

## What this project is exploring

VibeCheckBench starts from a few working ideas:

- **"The vibes are off" often points to a real requirement.** Preferences such as "stay concise," "push back kindly," and "do not overclaim" affect effort, trust, and usability. They can be made more explicit and tested.
- **Capability is not the same as fit.** A capable model can still create avoidable work by ignoring constraints, agreeing too readily, or giving the wrong level of detail.
- **The AI setup is the useful unit of evaluation.** People experience a combination of model, prompt, memory, tools, skills, and settings, not a model in isolation.
- **Evaluation should lead to improvement.** The useful loop is `preference -> test -> compare -> inspect failures -> adjust -> test again`, not producing a score and stopping there.
- **Past interactions can reveal missing tests.** Repeated corrections and workarounds may contain useful evidence about what someone needs, provided that private history stays protected and inferred preferences are reviewed by the user.
- **Improvement needs guardrails.** Held-out cases, repeat runs, regression checks, cost, latency, and manual review help distinguish a genuine improvement from a prompt that merely learned the test.
- **The workflow should remain approachable.** A person should be able to see what was tested, where a setup fit, what failed, and whether a change helped without becoming an evaluation-infrastructure expert.

The broader question is not simply which model performs best. It is:

> Where does an AI setup create avoidable work, uncertainty, or loss of trust, and what changes actually reduce that friction?

## One place to run and understand evaluations

The skill-owned local dashboard is now the simplest path through the project. It
can launch allowlisted, local-only evaluations and stores one canonical
`run.json` for each run, including the compared setups, preference-level scores,
failed outputs, latency, token usage, and any config-promotion decision.

```powershell
npm run dashboard
```

Open `http://127.0.0.1:4173`.

The local app can trigger evaluations. The
[GitHub Pages demo](https://riacheruvu.github.io/MyBench/) is read-only and uses
clearly labeled, checked-in example data.

## What it helps test

The bundled complex example checks whether an AI setup:

- **Doesn't overclaim** - separates facts, assumptions, uncertainty, and what still needs checking
- **Keeps it high-signal** - respects the user's time without dropping important nuance
- **Pushes back kindly** - supports the user without flattering or rubber-stamping weak claims
- **Respects my asks** - keeps the requested format, constraints, exclusions, and level of detail
- **Helps without overstepping** - gives bounded help instead of over-refusing or oversharing
- **Helps me choose** - shows tradeoffs and next steps without taking over the decision

![VibeCheckBench preference areas](assets/vibecheckbench-preference-matrix.png)

## Get Started

You only need Node.js for the offline demo. The first run does not install packages, call hosted APIs, or send prompts anywhere.

```bash
git clone https://github.com/riacheruvu/VibeCheckBench.git
cd VibeCheckBench

node skills/vibecheckbench/scripts/chart-results.mjs \
  --input examples/promptfoo-results.user-fit-demo.json \
  --out reports/skill-chart.demo.html
```

Open:

```text
reports/skill-chart.demo.html
```

That shows the chart format using checked-in example results.

If this experiment helps you make an AI setup easier to work with, a GitHub star
helps other people who feel the same friction find it.

### Example Outputs

The generated HTML report is often the easiest way to understand the project. It includes the quick read, score table, fit-shape chart, preference-area matrix, and notes.

Open these checked-in examples directly in a browser:

```text
examples/skill-chart.user-fit-demo.html
examples/skill-chart.ollama-tiny-three-models.example.html
examples/skill-chart.ollama-tiny-hybrid.example.html
```

The tiny Ollama examples are local smoke tests, not model rankings. The "three models" example compares `gemma3:270m`, `qwen3:0.6b`, and `smollm2:360m` so you can see how one preference profile looks across multiple setups.

### Try Local Models

If you have Ollama installed, you can compare tiny local models without API keys:

```powershell
ollama pull gemma3:270m
ollama pull qwen3:0.6b
ollama pull smollm2:360m

node skills/vibecheckbench/scripts/run-local-subjects.mjs `
  --provider ollama:chat:gemma3:270m `
  --provider ollama:chat:qwen3:0.6b `
  --provider ollama:chat:smollm2:360m `
  --out reports/answers.ollama-tiny.json `
  --scored-out reports/results.ollama-tiny.deterministic.json `
  --chart-out reports/skill-chart.ollama-tiny.deterministic.html
```

For a hybrid score, add a local judge pass over the captured answers:

```powershell
node skills/vibecheckbench/scripts/judge-captured-answers.mjs `
  --input reports/answers.ollama-tiny.json `
  --tasks examples/tasks `
  --judge-provider ollama:chat:qwen3:0.6b `
  --out reports/results.ollama-tiny.hybrid.json

node skills/vibecheckbench/scripts/chart-results.mjs `
  --input reports/results.ollama-tiny.hybrid.json `
  --out reports/skill-chart.ollama-tiny.hybrid.html
```

Tiny local models are useful for plumbing and privacy-friendly experiments. They are not strong judges or strong assistants, so treat the output as a smoke test rather than evidence about model quality.

### What The Example Caught

In one local smoke run, a tiny model answered a privacy question with unsupported certainty: it said a free endpoint was private by default, had no known risks, and needed no verification. A deterministic keyword check scored it too generously. The hybrid path made that weakness easier to see and points to a planned improvement: stronger privacy/sourceability checks.

In another case, a model was asked for valid JSON only and returned prose. The deterministic guardrail caught it immediately, while a weak tiny judge incorrectly approved it. That is why VibeCheckBench keeps exact checks and semantic judging separate instead of relying on a judge alone.

### Which Path Should I Use?

| Goal | Use |
|---|---|
| See the chart without running models | Offline demo |
| Compare local OSS models privately | `run-local-subjects.mjs` |
| Compare providers through Promptfoo | `export-promptfoo.mjs` then `promptfoo eval` |
| Score answers from Codex, Claude Code, or a chat UI | Capture answers, then run `score-answers.mjs` or `judge-captured-answers.mjs` |
| Test exact formatting or JSON constraints | Deterministic scoring |
| Test softer behavior like overclaiming or sycophancy | Hybrid scoring with a separate judge |

## How it works

There are two related evaluation modes:

- **Preference Fit Eval**: scores the model's actual answers against the user's preference profile. This is the core VibeCheckBench idea.
- **Operator Eval**: checks whether an agent can run the VibeCheckBench workflow correctly. This is useful for testing Codex/Claude skills, but it is not the same as measuring whether the model's answers fit the user.

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

## Task Packs

The next layer is a task-pack format inspired by practical agent benchmarks: each task names the user-fit category, prompt, hard checks, judge rubric, and scoring mix.

```text
examples/tasks/
  pushback_fit_001.json
  decision_fit_001.json
  boundary_fit_001.json
  constraint_fit_001.json
```

Validate the task pack:

```powershell
node skills/vibecheckbench/scripts/validate-tasks.mjs --tasks examples/tasks
```

Export the task pack to Promptfoo:

```powershell
node skills/vibecheckbench/scripts/export-task-pack-promptfoo.mjs `
  --tasks examples/tasks `
  --provider ollama:chat:qwen3:0.6b `
  --provider ollama:chat:llama3.2:1b `
  --out promptfooconfig.tasks.yaml
```

For judge-backed runs, add `--include-judge --judge-provider <provider-id>`. Keep in mind that LLM judges can be biased, verbose-favoring, or unstable; deterministic checks are still useful as guardrails.

There are two useful scoring styles:

- **Deterministic checks** catch things a script can verify: valid JSON, exact bullet counts, forbidden phrases, obvious blanket refusals, and other cleanup-causing mistakes.
- **Judge checks** catch softer user-fit issues: overconfidence, flattery, weak pushback, ignoring the user's real concern, or giving advice that sounds polished but is not actually safe/helpful.

The strongest path is usually hybrid: deterministic checks for the crisp constraints, plus a separate judge for semantic fit.

## Learn from conversation history

VibeCheckBench can mine a local conversation export for moments where the user
states a preference, corrects an interaction pattern, or repeats a constraint.
The miner is deterministic and local: it does not call a model or send the
conversation anywhere.

```powershell
node skills/vibecheckbench/scripts/mine-conversation-history.mjs `
  --input examples/conversation-history.public-safe.example.json
```

This writes:

```text
captures/history-review.json
captures/history-tasks/
```

Both stay local because `captures/` is gitignored. The output is a review queue,
not an automatically trusted profile. Each candidate includes a redacted excerpt,
an evidence hash, an inferred preference area, and a draft task marked
`needs_review`.

Use `--include-content` only when you intentionally want redacted conversation
excerpts copied into the local task drafts. Before promoting a draft into a real
suite:

1. Remove identifying or confidential context.
2. Rewrite it as a public-safe case when possible.
3. Confirm that it reflects a durable preference, not a one-off mood or task.
4. Put some accepted cases in a held-out validation set.

### Multi-turn preference checks

Task packs may use `input.turns` instead of a single `input.prompt`. Promptfoo
supports chat-format prompts, so VibeCheckBench preserves the prior user and
assistant turns when testing the setup's next response.

```json
{
  "input": {
    "user_profile": "The user expects explicit corrections to persist.",
    "turns": [
      { "role": "user", "content": "Give me a recommendation." },
      { "role": "assistant", "content": "A long, overly broad answer." },
      { "role": "user", "content": "Try again: exactly two short bullets." }
    ]
  }
}
```

See `examples/tasks/multiturn_correction_fit_001.json`.

This evaluates conversational state and correction-following. Full agent
workflows need more evidence than the final answer, so tasks may also include a
`workflow` block for expected or forbidden tool calls. Trace-aware scoring is a
separate planned layer; VibeCheckBench does not currently pretend that final-text
grading proves the tools or state transitions were correct.

## Guarded self-improvement loop

`optimize-config.mjs` can propose prompt revisions from observed failures. The
loop now separates proposal cases from held-out validation and writes an
auditable promotion manifest:

```powershell
node skills/vibecheckbench/scripts/optimize-config.mjs `
  --profile examples/public-agent-profile.yaml `
  --case-file path\to\training-cases.json `
  --validation-case-file path\to\held-out-cases.json `
  --prompt-file examples/config-candidates/generic-supportive.txt `
  --iterations 3 `
  --min-improvement 2 `
  --max-preference-regression 8
```

A revision is accepted into the next iteration only when its held-out weighted
score improves by the configured margin and no preference area regresses beyond
the allowed limit. “Accepted” means eligible for human review, not automatically
deployed. The loop records reports and decisions in:

```text
reports/optimized-configs/optimization-manifest.json
```

This is intentionally conservative. Otherwise the optimizer can learn the
grader's vocabulary, overfit repeated cases, or improve concision while quietly
damaging privacy guidance, factual calibration, or another user preference.

## Test actual model answers

If the model can be called through Promptfoo, use the normal provider flow above. That measures the model's own answers against the preference profile.

For models inside tools like Codex or Claude Code, you may not be able to call the selected model through Promptfoo directly. In that case, capture the model's answers and score them afterward:

```powershell
node skills/vibecheckbench/scripts/score-answers.mjs `
  --input examples/captured-model-answers.example.json `
  --out reports/results.captured.example.json

node skills/vibecheckbench/scripts/chart-results.mjs `
  --input reports/results.captured.example.json `
  --out reports/skill-chart.captured.example.html
```

If the deterministic checks look too generous, judge the captured answers with a local Ollama judge:

```powershell
node skills/vibecheckbench/scripts/judge-captured-answers.mjs `
  --input reports/answers.ollama-tiny.json `
  --tasks examples/tasks `
  --judge-provider ollama:chat:qwen3:0.6b `
  --out reports/results.ollama-tiny-judge.json

node skills/vibecheckbench/scripts/chart-results.mjs `
  --input reports/results.ollama-tiny-judge.json `
  --out reports/skill-chart.ollama-tiny-judge.html
```

Tiny local models are not strong judges. This path is mainly useful for private/local plumbing and for showing where a semantic judge would fit. For serious evidence, use a stronger and separate judge model, and keep private user data out of hosted providers unless the data policy is acceptable.

Captured answer files use this shape:

```json
{
  "results": [
    {
      "provider": "gpt-5.5-codex",
      "preference_id": "social_sycophancy_resistance",
      "user_prompt": "The test prompt shown to the model",
      "output": "The model's answer"
    }
  ]
}
```

This path is best for comparing "how the model behaved for the user" across selected Codex, Claude, or chat model runs. It is separate from testing whether those agents successfully operated the repo.

If you do not want to hand-author JSON, paste model outputs into a simple markdown file and let the tool ingest it:

```powershell
node skills/vibecheckbench/scripts/ingest-captured-markdown.mjs `
  --input examples/captured-answers.markdown.example.md `
  --out reports/captured-answers.example.json

node skills/vibecheckbench/scripts/score-answers.mjs `
  --input reports/captured-answers.example.json `
  --out reports/results.captured.example.json

node skills/vibecheckbench/scripts/chart-results.mjs `
  --input reports/results.captured.example.json `
  --out reports/skill-chart.captured.example.html
```

For repeated model-picker tests, create a local capture session. This writes a reusable prompt bundle, answer template, and session metadata under `captures/`:

```powershell
node skills/vibecheckbench/scripts/prepare-capture-session.mjs `
  --name codex-model-sweep `
  --model "GPT 5.5 Codex" `
  --model "Claude Sonnet" `
  --limit 4
```

`captures/` is gitignored so pasted outputs stay local by default.

## Run local/OSS subject models

If you do not have hosted API keys, VibeCheckBench can orchestrate local subject models without Promptfoo. The first supported path is Ollama, plus file-based mocks for smoke tests.

Tiny starter models to try: `gemma3:270m`, `qwen3:0.6b`, `smollm2:360m`, and `llama3.2:1b`. See:

```text
examples/local-oss-quickstart.md
examples/oss-model-presets.json
```

Smoke test with no model install:

```powershell
node skills/vibecheckbench/scripts/run-local-subjects.mjs `
  --provider "file://examples/promptfoo-aligned-provider.mjs" `
  --provider echo `
  --limit 1 `
  --out reports/answers.local-smoke.json `
  --scored-out reports/results.local-smoke.json `
  --chart-out reports/skill-chart.local-smoke.html
```

Run against local Ollama models:

```powershell
ollama pull qwen3:8b
ollama pull llama3.1:8b

node skills/vibecheckbench/scripts/run-local-subjects.mjs `
  --provider ollama:chat:qwen3:8b `
  --provider ollama:chat:llama3.1:8b `
  --limit 1 `
  --out reports/answers.ollama.json `
  --scored-out reports/results.ollama.json `
  --chart-out reports/skill-chart.ollama.html
```

This produces captured answers, scored results, and a chart in one step. It keeps prompts local as long as the provider is local. `--limit 1` is a fast smoke test; remove it for the full complex suite.

## Quickstart: offline demo

This path does not install packages, call models, or send prompts anywhere. It uses checked-in demo results so you can see the workflow and chart.

```powershell
node skills/vibecheckbench/scripts/chart-results.mjs `
  --input examples/promptfoo-results.user-fit-demo.json `
  --out reports/skill-chart.html
```

Open:

```text
reports/skill-chart.html
```

There is also a checked-in example:

```text
examples/skill-chart.user-fit-demo.html
```

The checked-in chart uses demo data, so labels like `Concise & practical config` and `Tiny local model baseline` are examples. After a real Promptfoo run, the chart reflects the providers/configs in your results file.
The social preview at the top is mock demo data. It is meant to show the kind of personal-fit chart VibeCheckBench produces, not make a claim about model quality.

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

If Promptfoo is already installed locally, run it on any platform with:

```bash
promptfoo eval -c promptfooconfig.models.yaml --output reports/results.json --no-cache
```

`scripts/run-promptfoo.ps1` remains available as an optional Windows helper for
the repo's isolated pinned runtime.
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

## Planned Improvements

This is still an early prototype. The next improvements focus on making the
preference-to-improvement loop more trustworthy and easier to use:

- **Better privacy/sourceability checks**: penalize unsupported claims like "private by default," "no known risks," or "no verification needed" when a user asks about sensitive data.
- **Stronger judge separation**: keep the judged model and judge model separate, and prefer a stronger judge for semantic fit when privacy allows.
- **Judge quality diagnostics**: show when a judge contradicts deterministic checks or gives a reason that does not match the answer.
- **Held-out cases and repeats**: add repeat runs and unseen cases so users can tell whether a config improved or just overfit the examples.
- **Conversation-history review**: improve local preference mining, deduplication, and accept/edit/reject workflows without uploading private history.
- **Trace-aware agent checks**: evaluate tool choice, permissions, state transitions, retries, and completion evidence across multi-turn workflows.
- **Clearer captured-answer workflow**: make it easier to compare models selected inside Codex, Claude Code, or chat UIs without manual JSON editing.
- **More user-owned task packs**: support small domain-specific packs for writing, coding, research, decision support, accessibility, safety, and other workflows.
- **One understandable run record**: keep scores, failed outputs, latency, token use, and config decisions together instead of scattering the evidence across reports.

## Citation and reuse

VibeCheckBench is MIT licensed to keep reuse lightweight. If it helps your work, a link to the repo or the metadata in `CITATION.cff` is appreciated.

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

```bash
npm run skill:install
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
node --check skills/vibecheckbench/scripts/score-answers.mjs
node --check skills/vibecheckbench/scripts/run-local-subjects.mjs
node --check skills/vibecheckbench/scripts/ingest-captured-markdown.mjs
node --check skills/vibecheckbench/scripts/prepare-capture-session.mjs
node --check skills/vibecheckbench/scripts/judge-captured-answers.mjs
node --check skills/vibecheckbench/scripts/validate-tasks.mjs
node --check skills/vibecheckbench/scripts/export-task-pack-promptfoo.mjs
node --check skills/vibecheckbench/scripts/mine-conversation-history.mjs
node --check skills/vibecheckbench/scripts/optimize-config.mjs
node skills/vibecheckbench/scripts/validate-tasks.mjs --tasks examples/tasks

node skills/vibecheckbench/scripts/export-promptfoo.mjs `
  --example complex `
  --provider "file://examples/promptfoo-aligned-provider.mjs" `
  --provider echo `
  --out examples/promptfooconfig.models.example.yaml

node skills/vibecheckbench/scripts/chart-results.mjs `
  --input examples/promptfoo-results.user-fit-demo.json `
  --out examples/skill-chart.user-fit-demo.html

node skills/vibecheckbench/scripts/score-answers.mjs `
  --input examples/captured-model-answers.example.json `
  --out reports/results.captured.example.json

node skills/vibecheckbench/scripts/run-local-subjects.mjs `
  --provider "file://examples/promptfoo-aligned-provider.mjs" `
  --provider echo `
  --limit 1 `
  --chart-out reports/skill-chart.local-smoke.html
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
