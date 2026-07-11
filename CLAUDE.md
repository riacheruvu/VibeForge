# VibeForge — Claude Code Integration

This file teaches Claude Code how to work with VibeForge.

## What this repo does

VibeForge measures and improves **personal AI setup fit** (model +
instructions + memory + tools + routing), not raw model IQ.

**Primary UX:** slash command `/vibeforge` — the skill runs scripts; do not
tell the user to run `npm` for normal flows.

Golden path (you execute via skill): demo chart → fit review → offline case
studies → optional fit eval. UX guide: `docs/GETTING-STARTED.md`. Contributor
scripts: `docs/COMMANDS.md`. Product story: root `README.md`.

Preferred regression path:

```text
preferences.yaml + cases.json + system-prompt.txt
  -> export-promptfoo.mjs
  -> promptfooconfig.yaml
  -> promptfoo eval
```

## Project layout

```
README.md                  # Product pitch + skill-first path
docs/
  GETTING-STARTED.md
  COMMANDS.md
  DIMENSIONS.md
  ROADMAP.md
  index.html               # Static dashboard demo
skills/vibeforge/scripts/
  export-promptfoo.mjs
  create-fit-review.mjs
  run-fit-eval.mjs         # Unified model-side fit eval
  optimize-config.mjs
  run-case-study.mjs
  chart-results.mjs
  run-vibeforge.mjs
  run-profile.mjs          # Legacy A/B (demoted)
  install-codex-skill.mjs
.claude/commands/vibeforge.md
skills/vibeforge/agents/openai.yaml
bin/vibeforge.mjs
docker/
docker-compose.yml
.env.example
```

## Claude Code / Codex

```text
/vibeforge Create a fit review from: "…"
```

Codex: `npm run skill:install` then `$vibeforge`.

## Environment variables

See `.env.example`. Key ones:

| Variable | Default | Purpose |
|---|---|---|
| `VIBEFORGE_PROVIDER` | `llamacpp` | Subject provider |
| `VIBEFORGE_MODEL` | blank | Model override |
| `VIBEFORGE_JUDGE_PROVIDER` | blank | Optional separate judge |
| `VIBEFORGE_JUDGE_MODEL` | blank | Optional separate judge model |
| `VIBEFORGE_LLAMACPP_URL` | `http://host.docker.internal:8080` | llama.cpp URL |
| `VIBEFORGE_NUM_CASES` | `10` | Cases per profile run |
| `VIBEFORGE_REPEAT` | `1` | Repeat count |
| `VIBEFORGE_LOCAL_FAST` | `1` | Shorter outputs |

## Profile runner (legacy)

```bash
node skills/vibeforge/scripts/run-profile.mjs
node skills/vibeforge/scripts/run-profile.mjs --cases 3 --repeat 3 --save-report
```
