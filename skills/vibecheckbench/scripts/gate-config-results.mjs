#!/usr/bin/env node
/**
 * Compare baseline and candidate Promptfoo results and record a guarded
 * promotion decision. Accepted means eligible for human review, never deploy.
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

function usage() {
  console.log(`VibeCheckBench Promptfoo config gate

Usage:
  node skills/vibecheckbench/scripts/gate-config-results.mjs --train train.json --heldout heldout.json --out reports/config-gate.json

Options:
  --train <path>             Development-set Promptfoo results
  --heldout <path>           Held-out Promptfoo results
  --out <path>               JSON report path
  --baseline <label>         Baseline config label (default: baseline)
  --candidate <label>        Candidate config label (default: candidate)
  --min-improvement <score>  Required held-out mean-score gain (default: 0.05)
  --max-train-regression <n> Allowed development-set mean-score loss (default: 0.05)`);
}

function parseArgs(argv) {
  const args = {
    train: "",
    heldout: "",
    out: "reports/config-gate.json",
    baseline: "baseline",
    candidate: "candidate",
    minImprovement: 0.05,
    maxTrainRegression: 0.05,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--train") args.train = argv[++i];
    else if (arg === "--heldout") args.heldout = argv[++i];
    else if (arg === "--out") args.out = argv[++i];
    else if (arg === "--baseline") args.baseline = argv[++i];
    else if (arg === "--candidate") args.candidate = argv[++i];
    else if (arg === "--min-improvement") args.minImprovement = Number(argv[++i]);
    else if (arg === "--max-train-regression") args.maxTrainRegression = Number(argv[++i]);
    else if (arg === "--help" || arg === "-h") { usage(); process.exit(0); }
  }
  if (!args.train || !args.heldout) throw new Error("--train and --heldout are required.");
  if (!Number.isFinite(args.minImprovement) || !Number.isFinite(args.maxTrainRegression)) {
    throw new Error("Gate thresholds must be numbers.");
  }
  return args;
}

function rowsFrom(file) {
  const payload = JSON.parse(fs.readFileSync(file, "utf8"));
  const rows = payload.results?.results || payload.results || payload.outputs;
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error(`No Promptfoo result rows found in ${file}.`);
  }
  return rows;
}

function labelOf(row) {
  return row.vars?.config_label || row.testCase?.vars?.config_label || "default";
}

function numberOrZero(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function summarize(rows, label) {
  const selected = rows.filter(row => labelOf(row) === label);
  if (!selected.length) throw new Error(`No results found for config label "${label}".`);
  const total = selected.length;
  const passed = selected.filter(row => row.success ?? row.gradingResult?.pass).length;
  const score = selected.reduce((sum, row) => sum + numberOrZero(row.score ?? row.gradingResult?.score), 0);
  const latency = selected.reduce((sum, row) => sum + numberOrZero(row.latencyMs), 0);
  const tokens = selected.reduce((sum, row) => sum + numberOrZero(row.tokenUsage?.total ?? row.response?.tokenUsage?.total), 0);
  return {
    cases: total,
    passed,
    passRate: passed / total,
    meanScore: score / total,
    averageLatencyMs: latency / total,
    totalTokens: tokens,
  };
}

function delta(candidate, baseline) {
  return {
    passRate: candidate.passRate - baseline.passRate,
    meanScore: candidate.meanScore - baseline.meanScore,
    averageLatencyMs: candidate.averageLatencyMs - baseline.averageLatencyMs,
    totalTokens: candidate.totalTokens - baseline.totalTokens,
  };
}

function markdown(report) {
  const pct = value => `${(value * 100).toFixed(0)}%`;
  const signed = value => `${value >= 0 ? "+" : ""}${value.toFixed(2)}`;
  return `# VibeCheckBench Config Gate

**Decision:** ${report.decision.eligibleForHumanReview ? "eligible for human review" : "rejected"}

| Split | Config | Passed | Mean score | Avg latency | Tokens |
|---|---|---:|---:|---:|---:|
| Development | ${report.labels.baseline} | ${report.development.baseline.passed}/${report.development.baseline.cases} | ${report.development.baseline.meanScore.toFixed(2)} | ${Math.round(report.development.baseline.averageLatencyMs)} ms | ${report.development.baseline.totalTokens} |
| Development | ${report.labels.candidate} | ${report.development.candidate.passed}/${report.development.candidate.cases} | ${report.development.candidate.meanScore.toFixed(2)} | ${Math.round(report.development.candidate.averageLatencyMs)} ms | ${report.development.candidate.totalTokens} |
| Held-out | ${report.labels.baseline} | ${report.heldout.baseline.passed}/${report.heldout.baseline.cases} | ${report.heldout.baseline.meanScore.toFixed(2)} | ${Math.round(report.heldout.baseline.averageLatencyMs)} ms | ${report.heldout.baseline.totalTokens} |
| Held-out | ${report.labels.candidate} | ${report.heldout.candidate.passed}/${report.heldout.candidate.cases} | ${report.heldout.candidate.meanScore.toFixed(2)} | ${Math.round(report.heldout.candidate.averageLatencyMs)} ms | ${report.heldout.candidate.totalTokens} |

Held-out score change: ${signed(report.heldout.delta.meanScore)}. Held-out pass-rate change: ${pct(report.heldout.delta.passRate)}.

Reasons:
${report.decision.reasons.map(reason => `- ${reason}`).join("\n")}

This gate records benchmark evidence only. Even an accepted candidate still requires output review before replacing a prompt, memory file, skill, or deployed configuration.
`;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const trainRows = rowsFrom(path.resolve(args.train));
  const heldoutRows = rowsFrom(path.resolve(args.heldout));
  const development = {
    baseline: summarize(trainRows, args.baseline),
    candidate: summarize(trainRows, args.candidate),
  };
  development.delta = delta(development.candidate, development.baseline);
  const heldout = {
    baseline: summarize(heldoutRows, args.baseline),
    candidate: summarize(heldoutRows, args.candidate),
  };
  heldout.delta = delta(heldout.candidate, heldout.baseline);

  const failures = [];
  if (heldout.delta.meanScore < args.minImprovement) {
    failures.push(`Held-out mean score improved by ${heldout.delta.meanScore.toFixed(2)}, below the required ${args.minImprovement.toFixed(2)}.`);
  }
  if (heldout.candidate.passRate < heldout.baseline.passRate) {
    failures.push("Held-out pass rate regressed.");
  }
  if (development.delta.meanScore < -args.maxTrainRegression) {
    failures.push(`Development mean score regressed by ${Math.abs(development.delta.meanScore).toFixed(2)}.`);
  }
  const eligibleForHumanReview = failures.length === 0;
  const reasons = eligibleForHumanReview
    ? ["The candidate cleared the configured evidence gates."]
    : failures;

  const report = {
    version: "vibecheckbench-config-gate-v1",
    generatedAt: new Date().toISOString(),
    labels: { baseline: args.baseline, candidate: args.candidate },
    thresholds: {
      minHeldoutImprovement: args.minImprovement,
      maxDevelopmentRegression: args.maxTrainRegression,
    },
    development,
    heldout,
    decision: {
      eligibleForHumanReview,
      automaticDeployment: false,
      reasons,
    },
  };

  const outPath = path.resolve(args.out);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  const markdownPath = outPath.replace(/\.json$/i, ".md");
  fs.writeFileSync(markdownPath, markdown(report), "utf8");
  console.log(`Wrote config gate: ${outPath}`);
  console.log(`Wrote config gate summary: ${markdownPath}`);
  if (!eligibleForHumanReview) process.exitCode = 1;
}

try {
  main();
} catch (error) {
  console.error(`Config gate error: ${error.message}`);
  process.exit(1);
}
