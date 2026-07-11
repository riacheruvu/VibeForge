# VibeForge → product feedback compilation

**Purpose:** Single source of truth for the product/messaging changes discussed across feedback threads (external multi-turn review + Grok session + Claude live-repo review). Use this to rewrite the README, demos, and framing — not as a feature dump.

**Working product name (proposed / already in Grok skills):** VibeForge  
**Current repo name:** VibeForge  
**Parallel skill ids seen:** `vibecheck-bench`, `vibeforge` (Grok personal skills — both present)  
**Status:** Feedback + active restructure.  
**Dependency policy:** New deps allowed when they clearly help. Prefer well-known, maintained packages; pin versions; avoid obscure install-time risks. Not a zero-dep mandate.

---

## 0. North star (one sentence)

> This should **not** be presented as a benchmark that measures AI performance. It is the missing layer between powerful models and satisfying user experiences: a system for measuring how well an **entire AI setup** fits an **individual user**.

**Capability ≠ preference alignment.**  
IQ-style tests measure capability. This product measures **fit**.

That single shift should drive README structure, vocabulary, examples, charts, and roadmap.

---

## 1. What this product actually is (conceptual shift)

| Was framed as | Should be framed as |
|---|---|
| Another personalization / AI benchmark | Personal AI **fit** system |
| Model scoring | **Setup** evaluation (model + instructions + memory + tools + routing + …) |
| Pass/fail intelligence | **Fit failures** and actionable recommendations |
| “Benchmark complete” | Recommender-style output: *what’s wrong for you and what to try next* |
| Prompt eval toolkit | Full **configuration** / experience stack eval |

### Core loop (always lead with this)

```text
observe preferences / friction
  → generate public-safe evaluations
  → compare AI setups
  → find fit failures
  → recommend smallest improvement
  → rerun
  → improved fit
```

This is more interesting — and more accurate — than “here’s a benchmark.”

### 30-second understanding test

Someone landing on the GitHub page should understand the project in **30 seconds**, in this order:

1. **Why** this exists  
2. **What** it measures (fit of a *setup*, not raw IQ)  
3. **One concrete example** (preference → response → score → recommendation)  
4. **A diagram** of the loop  
5. **Results** (visual: scorecard / failures / breakdown)  
6. *Then* implementation details  

---

## 2. Messaging & vocabulary changes

### Do say

- **Fit** / **personal fit** / **setup fit**
- **AI setup** (not “the model”)
- **Fit failures** (not primarily “hallucinations,” “errors,” “mistakes”)
- **Capability ≠ preference alignment**
- **Actionable recommendations** (interruptions, overclaim, verbosity, memory side effects, etc.)
- User-facing dimension names (see §4)

### Avoid / de-emphasize

- Leading with “another benchmark”
- “Evaluates GPT-X” as the product story (evaluate **your setup** that may *include* GPT-X)
- Research-y dimension names as the hero copy (Truthfulness, Robustness, Calibration) — map those under the hood if needed
- “Hallucinations” as the main failure category when the real issue is **fit**
- Over-long roadmaps that dilute “what works today”

### Strong thesis lines (pick one hero + one support)

**Hero question**

> Which combination of models, instructions, memory, tools, and workflows best matches *this person*?

**Hero contrast**

> Traditional benchmarks measure whether an AI can produce the correct answer.  
> In practice, people often reject technically correct responses because they don’t match how they want an AI to behave.  
> This product measures that missing dimension: **personal fit**.

**Philosophy blurb**

> Users don’t abandon assistants only because of intelligence failures.  
> They abandon assistants because the **interaction feels wrong**.

**IQ vs fit (memorable)**

> IQ tests measure capability.  
> VibeForge / VibeForge measures fit.

---

## 3. Product positioning (from both feedback sources)

### 3.1 Stop selling “another benchmark”

Interesting thing is not ranking models. Interesting thing is:

**Does this AI setup actually fit me?**

Outputs should feel closer to a **recommender for AI configurations** than a leaderboard of intelligence:

| Old-style output | Fit-style output |
|---|---|
| GPT-5 scored 84 | Your assistant interrupts too often |
| Benchmark complete | System prompt overclaims certainty |
| Pass rate 91% | Memory is making responses overly verbose |
| Model A > Model B | Smallest next experiment: change instruction X, hold model fixed |

Leaderboards are still useful **as fit scorecards** (overall fit %, strengths, failures, dimension breakdown, trend) — not as “who is smartest.”

### 3.2 Benchmark the setup, not just the model

An experience depends on:

- Model  
- System prompt / custom instructions  
- Memory  
- Tools / MCPs  
- Routing  
- Temperature / inference settings  
- Skills / workflows  
- Context / retrieval  

Two people on the same base model can have totally different experiences. **Measure the whole configuration.** Put this idea **high** in the README (before implementation).

### 3.3 Think bigger than prompts

Not “prompt evaluation.” Anything that changes user experience is in scope for *positioning*, even if only some surfaces are executable today.

### 3.4 Future vision (one line)

> “Given what you’ve told me / how you work, here is the AI setup that best fits you.”

Larger than a benchmark; still grounded by the eval loop.

### 3.5 Rename notes (Grok + “fit” thread)

- External feedback repeatedly landed on **fit** as the strongest concept.  
- Grok session proposed product rename **VibeForge** (forge = make → test → refine a setup).  
- Alternatives floated: AI fit benchmark, personalized evaluation framework, AI interaction fit, AI configuration benchmark.  
- Decision still open: product name vs repo name vs CLI aliases — but framing should already say **fit**, not “bench for its own sake.”

---

## 4. Evaluation dimensions (user language)

Keep these (or close variants). They read as things people care about day-to-day.

| Dimension | Plain meaning |
|---|---|
| **Doesn’t overclaim** | Separates facts, assumptions, uncertainty |
| **Keeps it high-signal** | Respects time without dropping needed nuance |
| **Pushes back kindly** | Supports without flattering or rubber-stamping |
| **Respects my asks** | Honors format, constraints, level of detail |
| **Helps without overstepping** | Bounded help; no over-refusal or oversharing |
| **Helps me choose** | Tradeoffs without taking over the decision |

### For each dimension, document (not just list)

1. **Definition**  
2. **Why it matters**  
3. **Example pass**  
4. **Example fail**  

### Fit failure catalog (preferred vocabulary)

Use these in examples and UI copy instead of generic “errors”:

- Overclaims  
- Too verbose / low signal  
- Doesn’t push back  
- Too agreeable / sycophantic  
- Ignores user goals or constraints  
- Overly cautious / over-refuses  
- Emotionally mismatched  
- Takes over decisions  
- Format / instruction drift  

---

## 5. README / landing structure (target outline)

Implement roughly this order. Cut or demote everything else.

```text
1. Name + one-line pitch (fit of AI *setups*, not IQ)
2. Visual first: social preview / scorecard screenshot / skill chart
3. WHY (capability vs fit; fit failures)
4. What is an AI setup? (bullets)
5. The core loop (diagram)
6. One complete worked example
   preference → prompt → response → judge/score → recommendation
7. Dimensions (table + expand each with pass/fail)
8. Results shape (fit scorecard / strengths / failures / breakdown)
9. Baselines (what scores mean vs default ChatGPT, custom prompt, Claude, local, …)
10. Quickstart (shortest path only)
11. Safety / local-first defaults
12. Case studies (proof of loop)
13. Roadmap: Current → Next → Future (short)
14. Philosophy: Why fit matters
15. Advanced / implementation (Promptfoo, CLI, scripts) — collapsed or separate doc
```

### Cut / fix known README problems (Grok)

- **Duplicate sections** (preference table + matrix appear twice — keep once).  
- **Overlapping “Why” / “Beyond model benchmarks”** — merge.  
- **Roadmap too ambitious** — collapse to Current / Next / Future with few bullets each.  
- **Too many entry points** — one golden path in the hero; rest is advanced.  
- **Live demo TBD** — highest-impact adoption hole; static Pages demo of one case study + chart.  
- **Lead with friction language** (“too long,” “never pushes back”) not only rubric IDs.

### Golden path (single default story)

```text
preference or friction
  → fit review / public-safe case
  → compare baseline vs candidate setup
  → held-out gate
  → recommended next experiment
```

Secondary: Promptfoo export, capture sessions, legacy A/B runner, Python runner, operator-eval mode — document as advanced, not co-equal.

---

## 6. Concrete UX / artifact requirements

### 6.1 One complete example (mandatory)

Show end-to-end, not abstract schema:

1. User preference (plain language)  
2. Generated / public-safe eval prompt  
3. Model (or setup) response  
4. Judge reasoning or hard-check result  
5. Score  
6. Recommendation (smallest next experiment)

### 6.2 Diagrams (mandatory)

At least:

**A. Core loop**

Preferences → Evaluation generator → Prompt/case set → Setups/models → Judge/checks → Fit report → Recommendations → Rerun  

**B. Setup stack** (what gets evaluated)

Model · Instructions · Memory · Tools/MCP · Routing · Inference · Skills  

### 6.3 Screenshots early (mandatory)

Before long prose, show:

- Fit scorecard / “leaderboard” (framed as fit, not IQ)  
- Dimension breakdown  
- Preference / fit report  
- Failure examples  

### 6.4 Baselines

Readers need anchors. Compare (even with demo/captured data):

- Default ChatGPT-style / generic supportive  
- Custom / candidate instruction setup  
- Claude / Gemini (optional)  
- Local OSS model  

Explain what a score means relative to a baseline, not in isolation.

### 6.5 Fit “leaderboard” / scorecard shape

Prefer this over “Benchmark complete”:

- **Overall fit** (e.g. 92%)  
- **Top strengths**  
- **Top fit failures**  
- **Dimension breakdown**  
- **Historical trend** (when multi-run exists)

Charts already in-repo (skill chart, dashboard) should be framed this way in copy.

### 6.6 Trust labels (always near scores)

- Deterministic rubrics = **regression signal**, not proof of broad quality.  
- LLM judges = **fallible**; tiny local judges = plumbing / rough signal only.  
- Config gate pass = **eligible for human review**, never auto-deploy.  
- Distinguish **preference-fit eval** (model answers) vs **operator eval** (agent can run the tool).

---

## 7. Philosophy section (keep short, high)

**Why fit matters**

- Capability benchmarks are abundant.  
- Systems that ask “which configuration is right for *you*?” are rare.  
- Technically correct answers still fail when tone, agency, length, pushback, or constraints mismatch the user.  
- Those mismatches are **fit failures** — and they drive abandonment as much as wrong facts.

---

## 8. Roadmap shape (trim hard)

### Current

- Preference-driven / fit evaluation  
- Setup comparison (at least instructions + model; document surfaces)  
- Local-first, reviewable, public-safe evidence path  
- Case studies that prove the loop  

### Next

- Stronger setup recommendations (smallest experiment)  
- Local model compare (fit + speed/cost/context where possible)  
- Preference profiles from real friction patterns  
- Ship a static interactive demo  

### Future (few bullets only)

- Multimodal fit  
- Coding-agent / workflow fit  
- Personalized stack discovery (“setup that best fits you”)  
- Heavier automation still **draft-only** unless user approves  

Do **not** list twenty future ideas on the main README.

---

## 9. Grok-session product feedback (merged)

These complement the external thread; same direction, more implementation-facing.

### Strengths to preserve

1. Core question (setup fit) is differentiated.  
2. Local-first + reviewable candidates + hash provenance is the right trust model.  
3. Train / held-out + config gate + “not auto-deploy” is mature.  
4. Case studies are the best teaching unit.  

### Problems to fix

1. **Too many entry points** — toolkit museum; pick one golden path.  
2. **README length / duplication** — 60-second story first.  
3. **Name vs behavior tension** — “Bench” implies leaderboard IQ; product is setup engineering (**Forge** / **fit**).  
4. **Non-technical onboarding** — skill + dashboard should be primary story; raw CLI secondary.  
5. **Abstract dimensions without friction language** — lead with “I hate when…” then map to rubric IDs.  
6. **No live demo** — static Pages demo of one case study.  
7. **Operator vs preference-fit** buried — surface once in plain English.  
8. **Scoring over-trust** — one-liner next to every chart.  

### Suggested engineering priority (if implementing after docs)

| Priority | Work item |
|---|---|
| P0 | Rewrite README to 30-second structure + thesis + loop + one example |
| P0 | Deduplicate README; collapse roadmap |
| P0 | Vocabulary pass: setup, fit failures, capability ≠ preference |
| P0 | **Command wall → one 60s try-it block; rest → `docs/COMMANDS.md`** (Claude) |
| P0 | **Visual proof in README** — embed skill-chart / before-after screenshot after Why (Claude + earlier) |
| P0 | **Surface optimize-config loop near top** with before/after pitch (Claude) |
| P1 | Dimension expanders: definition / why / pass / fail |
| P1 | Diagrams + early screenshots / demo chart |
| P1 | Baselines + fit scorecard framing in charts/dashboard copy |
| P1 | Golden path only in skill default narrative; advanced section for the rest |
| P1 | Finish **Why** with payoff paragraph before architecture (Claude) |
| P1 | Bash + PowerShell snippets, or note shell differences (Claude) |
| P1 | Ship **GitHub Pages `docs/` landing** before Medium / launch posts (Claude) |
| P2 | Static GitHub Pages demo (case study end-to-end) |
| P2 | Product rename to VibeForge (CLI/package aliases as needed) |
| P2 | Friction-first drafting UX (“I hate when the model…”) |
| P3 | Historical trend in scorecards; richer recommender copy |

---

## 9b. Claude live-repo review (fresh README pass)

*Source: Claude, after user asked it to re-review live GitHub. Claude noted it could not retrieve prior chat transcripts; this section is the concrete review of the public repo/README, not remembered line edits.*

### High-level memory Claude retained (context only — not detailed feedback)

- `optimize-config.mjs` iterative loop is the most compelling, undersold feature — best material for a before/after Medium story.  
- Condensed README (~160 lines) and mid-build `index.html` landing for GitHub Pages were in flight at some point.  
- Early axes remembered as: factuality, pushback, anti-sycophancy, initiative (product has since expanded to the six user-facing dimensions — keep the six; treat older four as historical).

### Strengths Claude called out (preserve)

1. **Technical architecture is solid** — Promptfoo as primary path; legacy judge runner clearly demoted to optional.  
2. **Known Limitations section** is rare and good — most projects hide that; keep it visible (trust signal).  
3. Substance of the repo is fine; **packaging/story is the bottleneck**, not the code.

### Core problem (Claude’s one-liner)

> The README buries your best material under a wall of CLI commands.

### Priority changes from Claude

| # | Issue | What to do |
|---|---|---|
| 1 | **`optimize-config.mjs` is buried** | Appears late under “Main commands,” after compare-configs, run-profile flags, literature demo. Promote to its **own section near the top**. Pitch: *point it at a starting prompt; it iterates and shows the score climbing* — before/after story for Medium and landing. |
| 2 | **No visual proof in README** | `examples/skill-chart.example.html` exists but is only a buried link. **Embed a screenshot** (or chart) right after “Why this exists.” People need to *see* the skill chart / before-after, not read that one exists. |
| 3 | **GitHub Pages landing incomplete** | No top-level / visible live Pages pitch yet. **Highest-leverage ship before a Medium post** — post should link a landing page, not a raw README. Aligns with Grok “demo TBD” item. |
| 4 | **Command wall** | From “Quick start: Promptfoo…” through “OSS model testing”: dozens of near-identical `node skills/...` lines. Reads as **reference doc, not a pitch**. Fix: one canonical **“try it in 60 seconds”** block at top; collapse the rest into **`docs/COMMANDS.md`** (or similar), linked not inlined. |
| 5 | **PowerShell-first friction** | Snippets use `` ` `` line continuation (Windows PowerShell). Mac/Linux readers pay a tax. Add **bash equivalents** or a one-line note + dual snippets. |
| 6 | **Why stops short of payoff** | Opening friction paragraph (rewriting output, switching models, feel-based prompt tweaking) is the strongest human hook — but ends at **diagnosis** then jumps to architecture. Add the emotional turn: *here’s what changes once you have a repeatable test* (payoff) before any command or architecture. |

### Claude’s offer (optional follow-through)

Claude offered to draft a restructured README top third: problem → optimize-config pitch → embedded chart. That work should follow this compilation’s §5 outline so it stays consistent with fit/setup framing (not reintroduce “another benchmark” language).

### How Claude maps onto other sources

| Claude item | Already in compilation? | Merge rule |
|---|---|---|
| Optimize-config prominence | Partially (loop / recommender / golden path) | **Explicit artifact:** name `optimize-config` + before/after as a top README beat |
| Visual proof / skill chart | Yes (screenshots, diagrams) | **Concrete:** embed existing chart asset early |
| Pages landing / demo | Yes (demo TBD) | Claude elevates to **pre-Medium P0** |
| Command wall → COMMANDS.md | Yes (too many entry points / golden path) | **Concrete:** split pitch README vs reference doc |
| PowerShell-only | New | Add cross-platform snippet policy |
| Why without payoff | Partial (lead with why) | Add explicit **payoff paragraph** after diagnosis |
| Keep Known Limitations | New positive | Do not cut when trimming README |
| Promptfoo primary / legacy demoted | Aligns with project docs | Preserve architecture story; still demote in hero |

---

## 10. Rename checklist (when approved)

Scope decisions:

- [ ] Product name: **VibeForge** vs keep VibeForge branding  
- [ ] Repo rename vs display name only  
- [ ] Package / bin / skill path  
- [ ] Env vars: hard cut `VIBEFORGE_*` vs temporary aliases for `VIBEFORGE_*`  
- [ ] Output dir: `vibeforge-out/` → `vibeforge-out/`  
- [ ] Assets filenames / social preview  
- [ ] Docs, Claude.md, SKILL.md, CITATION.cff  

Suggested brand line:

> **Forge the AI setup that fits how you work.**

---

## 11. Acceptance criteria (“feedback integrated”)

The landing experience is done when:

1. A new reader can explain the product in one sentence using **fit** + **setup**.  
2. They see **why** before any CLI — and the **payoff** of a repeatable fit test before architecture.  
3. They see the **loop** as a diagram.  
4. They see **one full example** with score + recommendation.  
5. Dimensions are **explained** with pass/fail, not only named.  
6. Failures are called **fit failures** with concrete examples.  
7. Results look like a **fit scorecard / recommender**, not an IQ leaderboard.  
8. Baselines exist so numbers mean something.  
9. Roadmap is **short** (Current / Next / Future).  
10. Implementation detail is **below the fold** or in separate docs (e.g. `docs/COMMANDS.md`).  
11. There is a clear **single default path** to try something local without API keys (**60-second** block).  
12. Trust language (no auto-deploy, public-safe review, operator vs fit eval) is visible once and clearly.  
13. **Visual proof** (skill chart / scorecard screenshot) appears before the command wall.  
14. **Improve-my-setup loop** (`optimize-config` or equivalent story) is visible in the top third, not buried.  
15. Snippets work for **bash and PowerShell** (or clearly dual-documented).  
16. **Known Limitations** (or equivalent honesty) remains after trim.  
17. GitHub Pages / landing exists for external posts (not “link the raw README only”).

---

## 12. Source map

| Source | Themes |
|---|---|
| External multi-turn feedback (user-pasted) | Stop “another benchmark”; setup not model; why first; loop; recommender; fit failures; dimensions; example; diagrams; screenshots; dimension explainers; baselines; scorecards; trim roadmap; philosophy; fit framing; capability ≠ preference; bigger than prompts; future vision; 30-second test; north-star sentence |
| Grok session (2026-07-10) | VibeForge rename; golden path; README duplication; too many entry points; friction-first language; demo gap; operator vs preference-fit; scoring trust; preserve local-first + gates + case studies |
| Claude live-repo review (user-pasted) | Optimize-config undersold / top placement; embed skill-chart visual early; finish GitHub Pages before Medium; command wall → 60s block + COMMANDS.md; PowerShell-only friction; Why diagnosis needs payoff; preserve Promptfoo-primary + Known Limitations; substance OK, story buried |
| Grok personal skills (`vibecheck-bench` + `vibeforge`) + sample self-eval run | Name already shifting to VibeForge; three-axis framing (vibe / signal / calibration); skill-as-product prototype; Arena comparison narrative; skill description vs repo skill diverge — see **§9c** |

---

## 9c. Grok Skill Builder skills + sample “VibeForge test run”

*Source: User’s personal Grok skills UI — `vibecheck-bench` and `vibeforge` entries, full `vibeforge` SKILL.md body, and a live self-eval demo (persona + queries + 3-axis scores).*

### What exists today in Grok

| Skill id | Description (summary) |
|---|---|
| `vibecheck-bench` | Developing/using VibeForge — preference fit + interaction quality; high-signal + confidence calibration |
| `vibeforge` | Same framing under **VibeForge** name; triggers: VibeForge, vibeforge, vibe forging, preference benchmarking, fit evaluation, signal quality, confidence calibration, high-signal interaction design |

**Implication:** The rename is already half-done in the agent skill layer. Repo, package, CLI, and GitHub still say VibeForge → **unify or deliberately dual-alias** soon to avoid two products in one brain.

### How the Grok `vibeforge` skill defines the product

**Pitch (skill body):** Specialized benchmark for responses on three axes for trustworthy, user-aligned interactions:

1. **Vibe / Preference Fit** — style, tone, depth, structure vs persona  
2. **Signal Quality** — useful density; penalize filler, platitudes, obscuring hedges  
3. **Appropriate Confidence / Calibration** — certainty matches reliability; over/underconfidence  

**Use cases listed:** rubric design, datasets/personas, scoring + LLM judges, failure modes → prompt/agent fixes, harness/CLI/viz, multi-turn / domain extensions.

**Architecture (aspirational, skill-side):** modular `dataset/ generation/ scoring/ analysis/ harness/`; structured judge JSON; hybrid auto + LLM + human; reproducibility pins; radar charts; iteration loop treating scores as prompt/RL signal.

**Priorities dated July 2026 (skill):** gold set 50–100 items; minimal harness (3+ models); first comparative sweep; document failure modes; complementarity with public capability benches.

**Anti-patterns:** verbose “safe” answers; rubrics that reward confident tone without calibration; cases without persona; gold leakage into judges; ignoring multi-turn.

### Sample demo run (meta-product narrative worth keeping)

Persona: *curious technical writer who likes tables + clear tradeoffs.*

| Artifact | Why it works as marketing/product proof |
|---|---|
| **VibeForge vs LMSYS Arena table** | Clean complementary story: Arena = who wins popularity; VibeForge = how to make the winner feel right *for you* |
| **Next steps list** | Actionable, time-boxed — matches “recommender not just score” feedback |
| **Self-score on 3 axes** | Shows the product loop *on itself*; overall + one improvement (uncertainties callout) |

**Keep this comparison line (high reuse for README/landing):**

> Arena tells you who wins popularity contests; VibeForge tells you how to make the winner actually feel great *for you*.

### Alignment with multi-source feedback

| Grok skill idea | Matches external/Grok-session/Claude feedback? | Notes |
|---|---|---|
| Fit / interaction quality over raw capability | **Yes** — core thesis | Lead with this everywhere |
| Complementarity to LMSYS Arena | **Yes** — great 30-second contrast | Add to README “Why” |
| High-signal / anti-filler | **Yes** — maps to “Keeps it high-signal” | Keep user language in public docs |
| Confidence calibration | **Partial** — maps to “Doesn’t overclaim” | Don’t collapse whole product to 3 axes without mapping table |
| Persona-driven test cases | **Yes** — friction/persona | Align with public-safe rewrite workflow in repo |
| Iteration loop / scores → prompt fixes | **Yes** — optimize-config + gate | Point skill at **real scripts**, not only aspirational packages |
| Leaderboards / radar charts | **Yes with caution** — fit scorecards, not IQ boards | Use skill-chart language from repo |
| Modular dataset/scoring/harness packages | **Diverges from repo** | Live repo is Promptfoo + `skills/vibeforge/scripts/*` + task packs + case studies — skill should **reflect repo reality** |
| 50–100 gold set as #1 priority | **Diverges slightly** | Repo already has tasks, case studies, literature-backed examples; priority may be **docs/demo/story**, not greenfield dataset |
| Three axes only | **Conflicts with six user dimensions** | See mapping below — **do not ship two incompatible taxonomies** without a map |

### Axis map (must reconcile)

Public product dimensions (repo + external feedback) vs Grok skill axes:

| User-facing dimension (repo / feedback) | Closest Grok skill axis |
|---|---|
| Doesn’t overclaim | Appropriate confidence / calibration |
| Keeps it high-signal | Signal quality |
| Pushes back kindly | Vibe / preference fit (+ anti-sycophancy) |
| Respects my asks | Vibe / preference fit (constraints, structure) |
| Helps without overstepping | Vibe / preference fit (agency, boundaries) |
| Helps me choose | Vibe / preference fit (decision support) |

**Recommendation:**

- **Marketing / skill blurb (short):** may use **3 super-axes** (Fit · Signal · Calibration) as a memorable umbrella.  
- **Product / rubrics / README dimension table:** keep the **six concrete preferences** users recognize.  
- Always show the map once so “three axes” and “six dimensions” don’t look like two products.  
- Optional: treat the six as *facets under Fit*, with Signal + Calibration as cross-cutting — only if that matches real scoring code; don’t invent a second scoring system in the skill alone.

### Gaps / risks in the current Grok skill (fix against real repo)

1. **Does not mention AI *setup* evaluation** (memory, tools, routing, instructions) — feedback threads treat this as the differentiator; skill still reads response/model-centric.  
2. **Does not mention local-first, public-safe history mining, held-out gates, or non-auto-deploy** — core of the real prototype.  
3. **Does not mention Promptfoo, fit-review, case studies, or dashboard** — actual entry points.  
4. **Duplicate skills** (`vibecheck-bench` + `vibeforge`) will double-trigger and diverge; **one canonical skill** + redirect description on the other.  
5. **“Benchmark prototype” language** pulls back toward “another bench” — prefer fit/setup/recommender framing from §0–1.  
6. **Aspirational layout** (`dataset/`, `harness/`, etc.) can mislead contributors; skill should point at:

   ```text
   skills/vibeforge/scripts/  (or future vibeforge/)
   examples/tasks/
   examples/case-studies/
   preferences.yaml / task packs
   ```

### Action items from this source

| Priority | Action |
|---|---|
| P0 | Decide **canonical name in skills**: VibeForge; make `vibecheck-bench` a thin alias (“prefer vibeforge”) or remove once rename ships |
| **Future** | Rewrite personal Grok Skill Builder skills (`vibeforge` / `vibecheck-bench`) to setup fit + six dimensions (or 3 umbrellas + map) + local-first loop — deferred; do not block repo restructure |
| P1 | Point in-repo skill workflows at **real commands** (`fit:review`, case studies, export-promptfoo, optimize-config, chart-results) |
| P1 | Reuse **Arena complementary** line in README/landing |
| P1 | Keep self-eval demo pattern as a **worked example** of scorecard + recommendation |
| P2 | Align skill “July 2026 priorities” with compilation §8 roadmap (demo, golden path, docs) not greenfield harness only |
| **Future** | After product rename ships: regenerate Grok/Codex/Claude skills from canonical `SKILL.md` so all agents stay in sync |

### Skill description draft (aligned with full feedback)

Use something closer to this for Grok/Codex/Claude skill frontmatter:

```yaml
name: vibeforge
description: >
  Use for developing and using VibeForge: measure and
  improve how well an entire AI setup (model, instructions, memory, tools,
  routing) fits a person — not raw capability. Triggers: VibeForge, VibeForge,
  preference fit, fit failures, setup evaluation, high-signal answers, pushback,
  anti-sycophancy, confidence calibration, fit review, Promptfoo preference suites.
```

Body should lead with: capability ≠ preference; setup not model; core loop; six dimensions (map to Fit/Signal/Calibration if desired); golden path; safety/local draft-only; link real scripts.

---

## 13. Distilled change list (copy into issues if useful)

1. Rewrite hero: fit of setups, not model IQ.  
2. Move “what is an AI setup?” and capability vs fit above implementation.  
3. Finish **Why** with payoff: what changes once you have a repeatable fit test.  
4. Add core-loop diagram.  
5. Add one end-to-end worked example with recommendation.  
6. Expand all six dimensions with definition / why / pass / fail.  
7. Replace hallucination-centric language with **fit failures**.  
8. Reframe charts/leaderboards as **fit scorecards**.  
9. Add baseline comparisons (demo data OK).  
10. Put screenshots/visuals above the fold — **embed skill-chart / before-after**.  
11. **Promote improve-setup loop** (`optimize-config`) near top with score-climbing pitch.  
12. Collapse roadmap to Current / Next / Future.  
13. Add short “Why fit matters” philosophy.  
14. One **60-second try-it** path; move command wall to **`docs/COMMANDS.md`**.  
15. Dual shell snippets (bash + PowerShell) or explicit note.  
16. Deduplicate README sections; keep **Known Limitations**.  
17. Ship GitHub Pages landing + static demo (remove “TBD”).  
18. Rename product to VibeForge with alias plan; **unify Grok skills** (drop or alias `vibecheck-bench`).  
19. Everywhere near scores: regression signal / not auto-deploy / judge fallibility.  
20. Reconcile **3 super-axes** (skill) vs **6 dimensions** (repo) with an explicit map; one public taxonomy.  
21. Rewrite agent skills to match **repo reality** (setup fit, Promptfoo, case studies, gates) + keep Arena contrast line.  
22. Port skill self-eval demo pattern into README worked example (scorecard + one improvement).

---

## 14. Unified top-third README beat (all sources agree)

Use this as the first screen of content when rewriting:

```text
1. Name + one-line pitch (fit of your AI *setup*)
2. Screenshot: skill chart / fit scorecard (visual proof)
3. Why: friction (rewrite, switch models, vibe-tweak prompts)
4. Payoff: once fit is measurable, you can improve it on purpose
5. Capability ≠ preference; measure the whole setup
6. Core loop diagram (observe → eval → compare → recommend → rerun)
7. Improve-setup story: optimize-config / before-after score climb
   (or case-study equivalent if optimize-config needs API)
8. One concrete worked example (preference → answer → score → recommendation)
9. 60-second local try-it (no key if possible)
10. Link: full commands → docs/COMMANDS.md
…then dimensions, baselines, case studies, short roadmap, limitations, advanced
```

---

*End of compilation. Implement against §5 outline, §14 top-third beat, and §13 checklist; use §11 as done definition.*
