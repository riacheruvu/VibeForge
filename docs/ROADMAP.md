# Roadmap

Short version. Capability leaderboards are abundant; this project focuses on **personal AI setup fit**.

## Current

- Preference-driven evaluation (six user-facing dimensions)
- Setup comparison (instructions, models, and modeled surfaces)
- Local-first, reviewable, public-safe evidence path
- Case studies that demonstrate the full loop offline
- Fit review artifacts and next-experiment recommendations (draft-only, not auto-deploy)
- Promptfoo export as the primary regression path; legacy judge runner optional
- **UX restructure:** pitch README, `docs/GETTING-STARTED.md`, command reference split, golden path npm scripts
- **Dual branding:** VibeForge product name + `vibeforge` / `vibeforge` CLI and skill aliases
- Agent skill + Claude slash commands aligned to draft-first decision tree

## Next

- Make **fit eval** the only default model path in dashboard + skill (done: `run-fit-eval.mjs`)
- Soft-remove / hide legacy `run-profile` from primary docs (keep for power users)
- Optional LLM judge flag on fit eval (`--judge ollama|openai`) behind explicit approval
- Friction-first drafting (“I hate when…”)
- Soft-read `VIBEFORGE_*` env aliases
- Hard rename of package paths when ready

## Future

- Multimodal fit (screenshots, PDFs, decks, UI)
- Coding-agent / workflow fit
- Personalized stack discovery (“given how you work, try this setup”)
- Heavier automation that remains **draft-only** unless the user approves apply/run
- Full filesystem rename (`skills/vibeforge`, repo name) after aliases prove stable
- Rewriting personal Grok Skill Builder skills (out-of-repo) — **future item**

## Explicitly deferred

- Rewriting personal Grok Skill Builder skills (`vibeforge` / `vibecheck-bench`) — **future item**
- Auto-deploying prompt or config changes without a held-out gate and human review
