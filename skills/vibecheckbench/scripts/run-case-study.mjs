#!/usr/bin/env node
/**
 * Run one or all checked-in public-safe case studies end to end.
 *
 * Orchestrates existing scripts with argument arrays — no hosted model APIs.
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { banner, done, fail, helpHeader, listIntro, rel, skillSay } from "./cli-ux.mjs";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, "..", "..", "..");
const CASE_ROOT = path.join(ROOT, "examples", "case-studies");
const REPORT_ROOT = path.join(ROOT, "reports", "case-studies");

function usage() {
  helpHeader("case-study runner", "Offline full fit loop with public-safe data (no model downloads).");
  console.log(`Primary UX — ask the skill:
  Use VibeForge. Run the offline case studies and explain the gate decision.

Implementation:
  node skills/vibecheckbench/scripts/run-case-study.mjs --case feedback-friction-loop
  node skills/vibecheckbench/scripts/run-case-study.mjs --all
  node skills/vibecheckbench/scripts/run-case-study.mjs --list

Options:
  --case <id>  Case-study directory name
  --all        Run every checked-in case study
  --list       List available case studies

Steps per case: mine history → promote reviews → score train/held-out → gate → chart`);
}

function parseArgs(argv) {
  const args = { caseId: "", all: false, list: false };
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg === "--case") args.caseId = argv[++index];
    else if (arg === "--all") args.all = true;
    else if (arg === "--list") args.list = true;
    else if (arg === "--help" || arg === "-h") { usage(); process.exit(0); }
  }
  return args;
}

function availableCases() {
  if (!fs.existsSync(CASE_ROOT)) return [];
  return fs.readdirSync(CASE_ROOT, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name)
    .filter(name => fs.existsSync(path.join(CASE_ROOT, name, "case-study.json")))
    .sort();
}

function runNode(args, { quietChild = true } = {}) {
  const env = { ...process.env };
  if (quietChild) env.VIBEFORGE_QUIET = "1";
  const result = spawnSync(process.execPath, args, {
    cwd: ROOT,
    stdio: quietChild ? ["ignore", "pipe", "inherit"] : "inherit",
    shell: false,
    env,
  });
  if (result.status !== 0) {
    if (result.stdout) process.stdout.write(result.stdout);
    throw new Error(`Command failed: node ${args.join(" ")}`);
  }
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function runCase(caseId) {
  const dir = path.join(CASE_ROOT, caseId);
  const out = path.join(REPORT_ROOT, caseId);
  if (!fs.existsSync(path.join(dir, "case-study.json"))) {
    throw new Error(`Unknown case study: ${caseId}`);
  }
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });

  const relative = file => path.relative(ROOT, file).replaceAll("\\", "/");
  const review = path.join(out, "history-review.json");
  const draftTasks = path.join(out, "draft-tasks");
  const project = path.join(out, "project.json");
  const tasks = path.join(out, "tasks");
  const train = path.join(out, "results.train.json");
  const heldout = path.join(out, "results.heldout.json");
  const gate = path.join(out, "config-gate.json");
  const chart = path.join(out, "heldout-chart.html");
  const caseStudy = readJson(path.join(dir, "case-study.json"));

  banner(`Case study · ${caseId}`, caseStudy.title || "Public-safe offline fit loop");
  console.log("  1/6 Mine conversation history (local, deterministic)");
  runNode([
    "skills/vibecheckbench/scripts/mine-conversation-history.mjs",
    "--input", relative(path.join(dir, "conversation-export.json")),
    "--out", relative(review),
    "--tasks-dir", relative(draftTasks),
  ]);
  console.log("  2/6 Promote reviewed public-safe candidates");
  runNode([
    "skills/vibecheckbench/scripts/promote-history-candidates.mjs",
    "--review", relative(review),
    "--decisions", relative(path.join(dir, "review-decisions.json")),
    "--out", relative(project),
    "--tasks-dir", relative(tasks),
    "--name", caseStudy.title,
  ]);
  console.log("  3/6 Score train (development) answers");
  runNode([
    "skills/vibecheckbench/scripts/score-answers.mjs",
    "--input", relative(path.join(dir, "captured-answers.train.json")),
    "--out", relative(train),
    "--quiet",
  ]);
  console.log("  4/6 Score held-out answers");
  runNode([
    "skills/vibecheckbench/scripts/score-answers.mjs",
    "--input", relative(path.join(dir, "captured-answers.heldout.json")),
    "--out", relative(heldout),
    "--quiet",
  ]);
  console.log("  5/6 Gate baseline vs candidate (held-out first)");
  runNode([
    "skills/vibecheckbench/scripts/gate-config-results.mjs",
    "--train", relative(train),
    "--heldout", relative(heldout),
    "--out", relative(gate),
    "--quiet",
  ]);
  console.log("  6/6 Write held-out fit scorecard");
  runNode([
    "skills/vibecheckbench/scripts/chart-results.mjs",
    "--input", relative(heldout),
    "--out", relative(chart),
    "--quiet",
  ]);

  const gateReport = readJson(gate);
  const eligible = Boolean(gateReport.decision?.eligibleForHumanReview);
  const delta = gateReport.heldout?.delta?.meanScore;
  const deltaText = Number.isFinite(delta)
    ? `${delta >= 0 ? "+" : ""}${delta.toFixed(2)} held-out mean score`
    : "n/a";
  const summary = `# ${caseStudy.title}

${caseStudy.summary}

**Decision:** ${eligible ? "eligible for human review" : "not ready"}

Held-out score change: ${deltaText}

Generated files:
- ${relative(review)}
- ${relative(project)}
- ${relative(train)}
- ${relative(heldout)}
- ${relative(gate)}
- ${relative(chart)}

This is a local, public-safe demonstration. A passing gate means review the
candidate setup; it does not deploy or replace anything automatically.
`;
  const summaryPath = path.join(out, "summary.md");
  fs.writeFileSync(summaryPath, summary, "utf8");
  done({
    title: `Case study complete · ${caseId}`,
    summary: caseStudy.summary || "Offline demonstration of the preference → gate loop.",
    facts: [
      ["Gate", eligible ? "eligible for human review" : "not ready — keep baseline"],
      ["Held-out delta", deltaText],
      ["Reports", rel(out)],
    ],
    files: [summaryPath, chart, gate],
    demoData: true,
    next: [
      `Read ${rel(summaryPath)}`,
      `Open ${rel(chart)} for the held-out scorecard`,
      "Only then consider applying a similar instruction change in your own setup",
      ...skillSay(
        "Use VibeForge. Create a fit review from my real preference.",
        "Use VibeForge. Draft the smallest instruction change as a candidate only.",
      ),
    ],
    trust: [
      "Public-safe synthetic/captured data — not evidence about a live frontier model.",
    ],
  });
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const cases = availableCases();
  if (args.list) {
    listIntro("Case studies", cases);
    return;
  }
  const selected = args.all ? cases : [args.caseId].filter(Boolean);
  if (!selected.length) throw new Error("Use --case <id>, --all, or --list.");
  if (args.all) {
    banner("Case studies", `Running ${selected.length} offline public-safe loops`);
  }
  for (const caseId of selected) runCase(caseId);
}

try {
  main();
} catch (error) {
  fail("case-study", error);
  process.exit(1);
}
