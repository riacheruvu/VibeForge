#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const NODE = process.execPath;

function usage() {
  console.log(`VibeForge — personal AI setup fit (not model IQ)

Primary UX (preferred):
  Talk to the agent skill — do not send end users to npm.
    Codex:  $vibeforge
    Claude: /vibeforge
  Example: "Use VibeForge. Create a fit review from: I want concise answers."

What this dispatcher is:
  Thin contributor/debug CLI the skill may call.

Dispatcher commands:
  vibeforge draft "I want concise, honest answers"
  vibeforge friction "I hate when it starts with Sure I can help..."
  vibeforge demo pushback
  vibeforge eval [--mode mock|auto|ollama|openai|anthropic]
  vibeforge run
  vibeforge capture --setup codex
  vibeforge report
  vibeforge recommend

  eval = model-side fit eval on vibeforge-out (or --fit-review)
  run  = plumbing smoke only (mock vs echo)

Skill UX guide:   docs/GETTING-STARTED.md
Script reference: docs/COMMANDS.md  (contributors)
Product story:    README.md
`);
}

function script(name) {
  return path.join(ROOT, "skills", "vibeforge", "scripts", name);
}

function runNode(args) {
  const result = spawnSync(NODE, args, {
    cwd: ROOT,
    stdio: "inherit",
    windowsHide: true,
  });
  process.exitCode = result.status ?? 1;
}

function preferenceText(argv) {
  return argv.filter(Boolean).join(" ").trim();
}

function ensureDir(dir) {
  fs.mkdirSync(path.resolve(ROOT, dir), { recursive: true });
}

function readJsonIfExists(file) {
  const resolved = path.resolve(ROOT, file);
  if (!fs.existsSync(resolved)) return null;
  return JSON.parse(fs.readFileSync(resolved, "utf8"));
}

function commandDraft(argv) {
  const text = preferenceText(argv);
  if (!text) {
    console.error("Please provide a preference, for example: vibeforge draft \"I want concise, honest answers\"");
    process.exitCode = 1;
    return;
  }
  runNode([script("draft-test-case.mjs"), "--preference", text, "--stdout"]);
}

function commandFriction(argv) {
  const text = preferenceText(argv);
  if (!text) {
    console.error("Please provide a friction statement, for example: vibeforge friction \"I hate when it is too wordy\"");
    process.exitCode = 1;
    return;
  }
  runNode([script("draft-test-case.mjs"), "--friction", text, "--stdout"]);
}

function commandDemo(argv) {
  const kind = argv[0] || "pushback";
  const demos = {
    pushback: "The user prefers concise, honest answers that push back kindly without flattery.",
    concise: "The user prefers concise, high-signal answers that preserve necessary nuance.",
    privacy: "The user prefers privacy-aware answers that separate facts, assumptions, and what still needs checking.",
  };
  const preference = demos[kind];
  if (!preference) {
    console.error(`Unknown demo "${kind}". Try: pushback, concise, or privacy.`);
    process.exitCode = 1;
    return;
  }
  runNode([script("create-fit-review.mjs"), preference, "--out", path.join("vibeforge-out", `demo-${kind}`), "--force"]);
}

function commandRun(argv) {
  const limitIndex = argv.indexOf("--limit");
  const limit = limitIndex >= 0 ? argv[limitIndex + 1] || "1" : "1";
  ensureDir("vibeforge-out");
  console.log("");
  console.log("VibeForge · plumbing smoke (mock aligned provider vs echo)");
  console.log("  Prefer: vibeforge eval  (model-side fit eval on your cases)");
  console.log("");
  runNode([
    script("run-local-subjects.mjs"),
    "--provider",
    `file://${path.join(ROOT, "examples", "promptfoo-aligned-provider.mjs").replaceAll("\\", "/")}`,
    "--provider",
    "echo",
    "--limit",
    limit,
    "--out",
    path.join("vibeforge-out", "answers.local-demo.json"),
    "--scored-out",
    path.join("vibeforge-out", "run-results.json"),
    "--chart-out",
    path.join("vibeforge-out", "fit-report.html"),
  ]);
  console.log("Next (ask the skill): “Use VibeForge. Run a fit eval on my dual-case pack.”");
  console.log("");
}

function commandEval(argv) {
  const args = [
    script("run-fit-eval.mjs"),
    ...argv,
  ];
  if (!argv.includes("--fit-review") && !argv.includes("--cases")) {
    const defaultReview = path.join(ROOT, "vibeforge-out");
    if (fs.existsSync(path.join(defaultReview, "eval-cases.json"))) {
      args.push("--fit-review", "vibeforge-out");
    }
  }
  if (!argv.includes("--mode") && !argv.some((a, i) => argv[i - 1] === "--provider" || a === "--provider")) {
    // leave mode default (auto) inside script
  }
  runNode(args);
}

function commandCapture(argv) {
  const setupIndex = argv.indexOf("--setup");
  const setup = setupIndex >= 0 ? argv[setupIndex + 1] || "codex" : "codex";
  const defaults = {
    codex: ["Codex selected model"],
    claude: ["Claude selected model"],
    chat: ["Model A", "Model B"],
  };
  const models = defaults[setup] || [setup];
  const args = [
    script("prepare-capture-session.mjs"),
    "--name",
    `${setup}-capture`,
    "--limit",
    "4",
  ];
  for (const model of models) args.push("--model", model);
  runNode(args);
}

function commandReport() {
  const runResults = readJsonIfExists(path.join("vibeforge-out", "run-results.json"));
  if (!runResults) {
    console.log("No run results found yet. Start with:");
    console.log('  vibeforge draft "I want concise, honest answers"');
    console.log("  vibeforge run");
    return;
  }
  if (runResults.status === "not_run") {
    console.log("A fit review exists, but no model/config comparison has been run yet.");
    console.log("Next: vibeforge run");
    return;
  }
  runNode([
    script("chart-results.mjs"),
    "--input",
    path.join("vibeforge-out", "run-results.json"),
    "--out",
    path.join("vibeforge-out", "fit-report.html"),
  ]);
}

function commandRecommend() {
  const runResults = readJsonIfExists(path.join("vibeforge-out", "run-results.json"));
  if (runResults && runResults.status !== "not_run") {
    runNode([
      script("recommend-next-experiment.mjs"),
      "--input",
      path.join("vibeforge-out", "run-results.json"),
      "--out",
      path.join("vibeforge-out", "next-experiment.json"),
    ]);
    return;
  }

  const planned = readJsonIfExists(path.join("vibeforge-out", "next-experiment.json"));
  if (planned?.candidateSetup) {
    console.log("Next experiment:");
    console.log(`- Goal: ${planned.goal}`);
    console.log(`- Try: ${planned.candidateSetup.proposedChange}`);
    console.log(`- Gate: require held-out rerun and at least +${planned.gate.minimumMeaningfulImprovement.toFixed(2)} meaningful improvement.`);
    console.log("- Status: candidate only; do not apply automatically.");
    return;
  }

  if (!runResults || runResults.status === "not_run") {
    console.log("No completed run results found yet. Create a fit review or run a local comparison first.");
    return;
  }
}

const [command, ...argv] = process.argv.slice(2);

if (!command || command === "--help" || command === "-h") {
  usage();
} else if (command === "draft") {
  commandDraft(argv);
} else if (command === "friction") {
  commandFriction(argv);
} else if (command === "demo") {
  commandDemo(argv);
} else if (command === "run") {
  commandRun(argv);
} else if (command === "eval") {
  commandEval(argv);
} else if (command === "capture") {
  commandCapture(argv);
} else if (command === "report") {
  commandReport();
} else if (command === "recommend") {
  commandRecommend();
} else {
  console.error(`Unknown command "${command}".`);
  usage();
  process.exitCode = 1;
}
