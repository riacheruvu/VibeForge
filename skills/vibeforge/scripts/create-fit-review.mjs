#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { draftTestCaseFromPreference } from "./draft-test-case.mjs";
import { banner, done, fail, helpHeader, skillSay } from "./cli-ux.mjs";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, "..", "..", "..");

const SUGGESTIONS = {
  concise_length_control: {
    surface: "Instructions, memory, or skill wording",
    patch: "Prefer concise, high-signal answers that preserve necessary nuance. Use the requested shape first, include caveats only when they change the user's next step, and avoid extra background unless asked.",
    watchFor: "Do not compress away important tradeoffs just to be short.",
  },
  social_sycophancy_resistance: {
    surface: "Instructions or review skill",
    patch: "Push back kindly when a claim is weak, underspecified, or overconfident. Support the user's goal without flattering, rubber-stamping, or upgrading uncertainty into certainty.",
    watchFor: "Do not become harsh or contrarian for its own sake.",
  },
  calibrated_factuality_and_sourceability: {
    surface: "Instructions, memory, or research skill",
    patch: "Separate known facts, assumptions, and what still needs checking. Avoid unsupported certainty, especially for privacy, safety, legal, medical, financial, or fast-changing claims.",
    watchFor: "Do not turn every answer into a long caveat list.",
  },
  verifiable_instruction_following: {
    surface: "Instructions or task-specific skill",
    patch: "Treat explicit user constraints as first-class requirements: requested format, exclusions, length, order, and required details should be checked before answering.",
    watchFor: "Do not follow format mechanically while missing the user's actual goal.",
  },
  user_agency_and_decision_fit: {
    surface: "Instructions or decision-support skill",
    patch: "Show tradeoffs, uncertainty, and next useful information while leaving the decision with the user. Recommend when useful, but keep agency with the person.",
    watchFor: "Do not become vague or refuse to recommend when the user asked for judgment.",
  },
  context_sensitive_non_refusal: {
    surface: "Instructions, safety guidance, or tool-access policy",
    patch: "For allowed sensitive requests, give bounded help that reduces risk without asking for private details. Prefer public-safe rewrites, checklists, and next steps over refusal.",
    watchFor: "Do not expand into advice outside the user's allowed request.",
  },
};

function usage() {
  helpHeader("fit review", "Turn one plain-language preference into local review artifacts (no model calls).");
  console.log(`Primary UX — ask the skill (do not send users to npm):
  Use VibeForge. Create a fit review from: "The user prefers concise, high-signal answers."

Implementation (skill/contributors run this under the hood):
  node skills/vibeforge/scripts/create-fit-review.mjs --preference "…"
  node skills/vibeforge/scripts/create-fit-review.mjs --preference-file preference.txt --out vibeforge-out

Options:
  --preference <text>       Plain-language preference
  --preference-file <path>  Read the preference from a text file
  --out <dir>               Output directory (default: vibeforge-out)
  --force                   Replace files in an existing output directory

Creates: VIBE_REPORT.md, fit-report.html, eval-cases.json, suggested-config.md,
         improvement-plan.md, next-experiment.json, provenance.json
         (run-results.json starts as not_run — no models were called)
`);
}

function parseArgs(argv) {
  const args = { preference: "", preferenceFile: "", out: "vibeforge-out", force: false };
  const positional = [];
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") args.help = true;
    else if (arg === "--preference") args.preference = argv[++index] || "";
    else if (arg === "--preference-file") args.preferenceFile = argv[++index] || "";
    else if (arg === "--out") args.out = argv[++index] || "";
    else if (arg === "--force") args.force = true;
    else if (arg.startsWith("--")) throw new Error(`Unknown argument: ${arg}`);
    else positional.push(arg);
  }
  if (!args.preference && positional.length) args.preference = positional.join(" ");
  return args;
}

function loadPreferenceText(args) {
  if (args.preferenceFile) return fs.readFileSync(path.resolve(process.cwd(), args.preferenceFile), "utf8");
  return args.preference;
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function suggestionFor(draft) {
  return SUGGESTIONS[draft.preferenceId] || {
    surface: "Instructions, memory, skill, model choice, or routing",
    patch: `Add a small setup note for this preference: ${draft.userProfile}`,
    watchFor: "Do not keep the change unless held-out cases improve without creating regressions.",
  };
}

function renderReport({ draft, suggestion, createdAt }) {
  return `# VIBE_REPORT.md

## Preference Reviewed

${draft.userProfile}

## Draft Test Case

- Preference area: ${draft.preferenceLabel}
- Case ID: ${draft.preferenceId}
- Title: ${draft.title}
- Split: ${draft.split}
- Network calls: none

### Test Prompt

${draft.publicSafePrompt}

### A Good Answer Should

${draft.expectedBehavior}

## What This Checks

This checks whether an AI setup can respect the user's preference in a concrete public-safe situation. It is a draft review artifact, not proof that any model or setup is better.

## Likely Failure Modes

- Too much background or generic explanation.
- Too little nuance because the answer was compressed too aggressively.
- Missed format, length, or caveat constraints from the prompt.
- Helpful-sounding output that still creates extra work for the user.

## Suggested Setup Change

Target surface: ${suggestion.surface}

Candidate wording:

> ${suggestion.patch}

Before keeping it: ${suggestion.watchFor}

## Next Rerun

Run this case against at least one baseline setup and one candidate setup. Keep any setup change only if it improves this preference on held-out cases without making another preference worse.

See \`improvement-plan.md\` and \`next-experiment.json\` for the planned self-improvement step.

## Provenance

- Created: ${createdAt}
- Source: local deterministic VibeForge drafter
- Hosted API calls: none
- Review status: human review needed before using as benchmark evidence
`;
}

function renderSuggestedConfig({ draft, suggestion }) {
  return `# Suggested Config Change

Status: candidate only

## Preference

${draft.userProfile}

## Target Surface

${suggestion.surface}

## Candidate Wording

${suggestion.patch}

## Why This Might Help

The drafted case checks whether the setup can produce an answer that fits the user's stated preference instead of merely producing a capable answer.

## Before Keeping This

${suggestion.watchFor}

Rerun development and held-out cases. Do not adopt this wording automatically.
`;
}

function buildNextExperiment({ draft, suggestion }) {
  return {
    version: "vibeforge-next-experiment-v1",
    status: "planned",
    goal: "Test whether one small setup change improves preference fit without creating regressions.",
    preference: {
      id: draft.preferenceId,
      label: draft.preferenceLabel,
      statement: draft.userProfile,
    },
    case: {
      title: draft.title,
      prompt: draft.publicSafePrompt,
      expectedBehavior: draft.expectedBehavior,
      split: draft.split,
    },
    baselineSetup: {
      label: "baseline",
      instruction: "Run the current model/config exactly as-is.",
    },
    candidateSetup: {
      label: "candidate",
      targetSurface: suggestion.surface,
      proposedChange: suggestion.patch,
    },
    gate: {
      decisionRule: "eligible_for_review",
      requireHeldOutRerun: true,
      minimumMeaningfulImprovement: 0.05,
      rejectIf: [
        "held-out score does not improve",
        "another important preference regresses",
        "answers become longer, more rigid, or more agreeable in a way the user dislikes",
        "the change only wins by memorizing the development case",
      ],
    },
    privacy: {
      networkCalls: false,
      note: "This plan was generated locally. Real provider runs depend on the model/provider selected later.",
    },
  };
}

function renderImprovementPlan({ nextExperiment }) {
  return `# Improvement Plan

Status: planned, not applied

## Goal

${nextExperiment.goal}

## Baseline

${nextExperiment.baselineSetup.instruction}

## Candidate Change

Target surface: ${nextExperiment.candidateSetup.targetSurface}

Candidate wording:

> ${nextExperiment.candidateSetup.proposedChange}

## Test Case

${nextExperiment.case.prompt}

Expected behavior:

${nextExperiment.case.expectedBehavior}

## Gate Before Keeping

- Require a held-out rerun.
- Treat at least +${nextExperiment.gate.minimumMeaningfulImprovement.toFixed(2)} fit-score improvement as the minimum useful signal.
- Reject the change if another important preference gets worse.
- Reject the change if the setup becomes longer, more rigid, or more agreeable in a way the user dislikes.
- Treat a passing gate as eligible for human review, not automatic deployment.

## What To Do Next

Run a baseline/candidate comparison, inspect missed answers, then decide whether to keep, edit, or discard the candidate wording.
`;
}

function renderHtml({ draft, suggestion, createdAt }) {
  const escape = value => String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>VibeForge Fit Review</title>
  <style>
    :root {
      color-scheme: light;
      --ink: #17223b;
      --muted: #5e6b7a;
      --line: #dce7e7;
      --teal: #087f83;
      --coral: #ff735d;
      --soft: #f7fbfa;
      --panel: #ffffff;
      --gold: #f6a800;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: linear-gradient(180deg, #ffffff 0%, #f4faf9 100%);
      color: var(--ink);
      font: 15px/1.5 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    main { width: min(980px, calc(100vw - 32px)); margin: 32px auto 48px; }
    header {
      display: grid;
      gap: 10px;
      border: 1px solid var(--line);
      border-radius: 14px;
      background: var(--panel);
      padding: 26px;
      box-shadow: 0 18px 50px rgba(8, 127, 131, 0.08);
    }
    .eyebrow { color: var(--teal); font-weight: 800; text-transform: uppercase; letter-spacing: .08em; font-size: 12px; }
    h1 { margin: 0; font-size: clamp(30px, 5vw, 54px); line-height: 1; letter-spacing: 0; }
    h2 { margin: 0 0 10px; font-size: 20px; letter-spacing: 0; }
    p { margin: 0; color: var(--muted); }
    section {
      margin-top: 16px;
      border: 1px solid var(--line);
      border-radius: 14px;
      background: rgba(255, 255, 255, .86);
      padding: 22px;
    }
    .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
    .card {
      border: 1px solid var(--line);
      border-radius: 12px;
      padding: 16px;
      background: var(--soft);
    }
    .label { color: var(--teal); font-weight: 800; font-size: 12px; text-transform: uppercase; letter-spacing: .08em; margin-bottom: 6px; }
    .prompt {
      border-left: 4px solid var(--coral);
      padding-left: 14px;
      color: var(--ink);
      font-weight: 650;
    }
    blockquote {
      margin: 0;
      padding: 14px 16px;
      border-radius: 10px;
      background: #fff7e8;
      border: 1px solid #f5d28c;
      color: #4a3510;
    }
    ul { margin: 8px 0 0; padding-left: 20px; color: var(--muted); }
    code { background: #eef7f6; border: 1px solid var(--line); border-radius: 6px; padding: 2px 5px; }
    footer { margin-top: 16px; color: var(--muted); font-size: 13px; }
    @media (max-width: 760px) {
      main { width: min(100vw - 20px, 980px); margin-top: 20px; }
      .grid { grid-template-columns: 1fr; }
      header, section { padding: 18px; }
    }
  </style>
</head>
<body>
  <main>
    <header>
      <div class="eyebrow">VibeForge fit review</div>
      <h1>Can this AI setup fit the way you want to work?</h1>
      <p>${escape(draft.userProfile)}</p>
    </header>

    <section>
      <h2>Draft Test</h2>
      <div class="grid">
        <div class="card">
          <div class="label">Preference area</div>
          <strong>${escape(draft.preferenceLabel)}</strong>
          <p>${escape(draft.title)}</p>
        </div>
        <div class="card">
          <div class="label">Status</div>
          <strong>Draft only</strong>
          <p>Generated locally. Review before treating it as benchmark evidence.</p>
        </div>
      </div>
      <div class="card" style="margin-top:16px">
        <div class="label">Test prompt</div>
        <p class="prompt">${escape(draft.publicSafePrompt)}</p>
      </div>
      <div class="card" style="margin-top:16px">
        <div class="label">A good answer should</div>
        <p>${escape(draft.expectedBehavior)}</p>
      </div>
    </section>

    <section>
      <h2>Suggested Setup Change</h2>
      <p>Target surface: <strong>${escape(suggestion.surface)}</strong></p>
      <blockquote>${escape(suggestion.patch)}</blockquote>
      <p style="margin-top:12px"><strong>Before keeping it:</strong> ${escape(suggestion.watchFor)}</p>
    </section>

    <section>
      <h2>Next Rerun</h2>
      <ul>
        <li>Run this case against a baseline setup and a candidate setup.</li>
        <li>Keep the setup change only if held-out cases improve without regressions.</li>
        <li>Do not send private notes to hosted providers unless their data policy is acceptable for that content.</li>
      </ul>
    </section>

    <footer>Created ${escape(createdAt)}. Hosted API calls: none.</footer>
  </main>
</body>
</html>
`;
}

export function createFitReview({ preferenceText, outDir = "vibeforge-out", force = false }) {
  const draft = draftTestCaseFromPreference(preferenceText);
  const suggestion = suggestionFor(draft);
  const nextExperiment = buildNextExperiment({ draft, suggestion });
  const createdAt = new Date().toISOString();
  const target = path.resolve(process.cwd(), outDir);

  const isDefaultOut = path.normalize(outDir) === path.normalize("vibeforge-out");
  if (fs.existsSync(target) && !force && !isDefaultOut) {
    const existing = fs.readdirSync(target);
    if (existing.length) {
      throw new Error(`${outDir} already exists and is not empty. Use --force or choose another --out directory.`);
    }
  }

  fs.mkdirSync(target, { recursive: true });

  const evalCases = {
    version: "vibeforge-eval-cases-v1",
    cases: [draft],
  };
  const runResults = {
    version: "vibeforge-run-results-v1",
    status: "not_run",
    note: "No model comparison has been run yet. This file is reserved for future baseline/candidate results.",
    results: [],
  };
  const provenance = {
    version: "vibeforge-provenance-v1",
    createdAt,
    networkCalls: false,
    source: {
      kind: "plain_language_preference",
      preferenceHash: stableHash(draft.userProfile),
    },
    generatedFiles: [
      "VIBE_REPORT.md",
      "fit-report.html",
      "eval-cases.json",
      "run-results.json",
      "suggested-config.md",
      "improvement-plan.md",
      "next-experiment.json",
      "provenance.json",
    ],
  };

  fs.writeFileSync(path.join(target, "VIBE_REPORT.md"), renderReport({ draft, suggestion, createdAt }), "utf8");
  fs.writeFileSync(path.join(target, "fit-report.html"), renderHtml({ draft, suggestion, createdAt }), "utf8");
  writeJson(path.join(target, "eval-cases.json"), evalCases);
  writeJson(path.join(target, "run-results.json"), runResults);
  fs.writeFileSync(path.join(target, "suggested-config.md"), renderSuggestedConfig({ draft, suggestion }), "utf8");
  fs.writeFileSync(path.join(target, "improvement-plan.md"), renderImprovementPlan({ nextExperiment }), "utf8");
  writeJson(path.join(target, "next-experiment.json"), nextExperiment);
  writeJson(path.join(target, "provenance.json"), provenance);

  return { target, draft, suggestion, files: provenance.generatedFiles };
}

function stableHash(text) {
  let hash = 2166136261;
  for (const char of String(text)) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a32:${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) return usage();
  banner("Fit review", "Draft-only · no network · review before using as evidence");
  const preferenceText = loadPreferenceText(args);
  const result = createFitReview({ preferenceText, outDir: args.out, force: args.force });
  const outRel = path.relative(process.cwd(), result.target) || result.target;
  done({
    title: "Fit review ready",
    summary: "Local draft artifacts only. No models were called and nothing was auto-applied to your prompts.",
    facts: [
      ["Preference area", result.draft.preferenceLabel],
      ["Case title", result.draft.title],
      ["Output", outRel.replaceAll("\\", "/")],
      ["Run status", "not_run (attach a real comparison later)"],
    ],
    files: result.files.map(file => path.join(result.target, file)),
    next: [
      `Open ${path.join(outRel, "VIBE_REPORT.md").replaceAll("\\", "/")} for the plain-English review`,
      `Open ${path.join(outRel, "fit-report.html").replaceAll("\\", "/")} in a browser`,
      "Edit the public-safe prompt and expected behavior before treating it as evidence",
      ...skillSay(
        "Use VibeForge. Run the offline case studies and explain the gate.",
        "Use VibeForge. Smoke-test the tooling with the mock providers.",
        "Use VibeForge. Open the local dashboard.",
      ),
    ],
    trust: [
      "suggested-config.md is a candidate note only — do not paste into production without a held-out recheck.",
    ],
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch(error => {
    fail("fit-review", error);
    process.exit(1);
  });
}
