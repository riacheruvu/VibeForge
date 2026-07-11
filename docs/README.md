# Docs

Local documentation for VibeForge (product name **VibeForge** under consideration).

| Doc | What it is |
|---|---|
| [GETTING-STARTED.md](./GETTING-STARTED.md) | Skill-first UX (start here) |
| [COMMANDS.md](./COMMANDS.md) | Contributor script map (not day-to-day UX) |
| [DIMENSIONS.md](./DIMENSIONS.md) | Preference dimensions with pass/fail examples |
| [ROADMAP.md](./ROADMAP.md) | Current / Next / Future |
| [PRODUCT-FEEDBACK-COMPILATION.md](./PRODUCT-FEEDBACK-COMPILATION.md) | Consolidated product feedback used for restructuring |
| [index.html](./index.html) | Static dashboard demo (GitHub Pages / open locally) |

The main product story lives in the root [README.md](../README.md). Prefer that for first-time readers; use this folder for reference depth.

## Security notes for docs readers

- Prefer **local, draft-only** workflows unless you explicitly run an evaluation.
- Do not paste private conversation exports into hosted models unless their data policy is acceptable.
- Optional tools (`npx promptfoo`, Ollama pulls, cloud APIs) may download code or send prompts — **approve those steps deliberately**.
- **Dependencies:** new packages are welcome when they clearly help — prefer well-known, actively maintained libraries, pin versions, and skip obscure one-off packages. Review install scripts and permission surface before adding anything that runs at install time or phones home.
