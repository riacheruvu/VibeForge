#!/usr/bin/env node
/**
 * Run one or all checked-in public-safe case studies end to end.
 *
 * This orchestrates existing VibeCheckBench scripts with argument arrays, so it
 * works across shells and does not require hosted model APIs.
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, "..", "..", "..");
const CASE_ROOT = path.join(ROOT, "examples", "case-studies");
const REPORT_ROOT = path.join(ROOT, "reports", "case-studies");

function usage() {
  console.log(`VibeCheckBench case-study runner

Usage:
  node skills/vibecheckbench/scripts/run-case-study.mjs --case feedback-friction-loop
  node skills/vibecheckbench/scripts/run-case-study.mjs --all

Options:
  --case <id>  Case-study directory name
  --all        Run every checked-in case study
  --list       List available case studies`);
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

function runNode(args) {
  const result = spawnSync(process.execPath, args, {
    cwd: ROOT,
    stdio: "inherit",
    shell: false,
  });
  if (result.status !== 0) {
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

  runNode([
    "skills/vibecheckbench/scripts/mine-conversation-history.mjs",
    "--input", relative(path.join(dir, "conversation-export.json")),
    "--out", relative(review),
    "--tasks-dir", relative(draftTasks),
  ]);
  runNode([
    "skills/vibecheckbench/scripts/promote-history-candidates.mjs",
    "--review", relative(review),
    "--decisions", relative(path.join(dir, "review-decisions.json")),
    "--out", relative(project),
    "--tasks-dir", relative(tasks),
    "--name", readJson(path.join(dir, "case-study.json")).title,
  ]);
  runNode([
    "skills/vibecheckbench/scripts/score-answers.mjs",
    "--input", relative(path.join(dir, "captured-answers.train.json")),
    "--out", relative(train),
  ]);
  runNode([
    "skills/vibecheckbench/scripts/score-answers.mjs",
    "--input", relative(path.join(dir, "captured-answers.heldout.json")),
    "--out", relative(heldout),
  ]);
  runNode([
    "skills/vibecheckbench/scripts/gate-config-results.mjs",
    "--train", relative(train),
    "--heldout", relative(heldout),
    "--out", relative(gate),
  ]);
  runNode([
    "skills/vibecheckbench/scripts/chart-results.mjs",
    "--input", relative(heldout),
    "--out", relative(chart),
  ]);

  const gateReport = readJson(gate);
  const caseStudy = readJson(path.join(dir, "case-study.json"));
  const summary = `# ${caseStudy.title}

${caseStudy.summary}

**Decision:** ${gateReport.decision.eligibleForHumanReview ? "eligible for human review" : "not ready"}

Held-out score change: ${gateReport.heldout.delta.meanScore >= 0 ? "+" : ""}${gateReport.heldout.delta.meanScore.toFixed(2)}

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
  fs.writeFileSync(path.join(out, "summary.md"), summary, "utf8");
  console.log(`\nCase study complete: ${caseId}`);
  console.log(`Summary: ${relative(path.join(out, "summary.md"))}`);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const cases = availableCases();
  if (args.list) {
    console.log(cases.join("\n"));
    return;
  }
  const selected = args.all ? cases : [args.caseId].filter(Boolean);
  if (!selected.length) throw new Error("Use --case <id>, --all, or --list.");
  for (const caseId of selected) runCase(caseId);
}

try {
  main();
} catch (error) {
  console.error(`Case-study error: ${error.message}`);
  process.exit(1);
}
