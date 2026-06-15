#!/usr/bin/env node
/**
 * Turn personal-fit result rows into an auditable next-experiment decision.
 * This does not modify or deploy a model/configuration.
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

function usage() {
  console.log(`VibeCheckBench next-experiment recommender

Usage:
  node skills/vibecheckbench/scripts/recommend-next-experiment.mjs --input reports/results.json

Options:
  --input <path>         Promptfoo-shaped result JSON
  --out <path>           Decision JSON (default: reports/next-experiment.json)
  --project <path>       Optional personal-fit project manifest
  --min-cases <n>        Minimum cases per setup (default: 3)
  --min-preference-cases <n> Minimum cases per setup/preference (default: 2)
  --meaningful-delta <n> Score difference worth acting on (default: 0.08)`);
}

function parseArgs(argv) {
  const args = {
    input: "",
    out: "reports/next-experiment.json",
    project: "",
    minCases: 3,
    minPreferenceCases: 2,
    meaningfulDelta: 0.08,
  };
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg === "--input") args.input = argv[++index];
    else if (arg === "--out") args.out = argv[++index];
    else if (arg === "--project") args.project = argv[++index];
    else if (arg === "--min-cases") args.minCases = Number.parseInt(argv[++index], 10);
    else if (arg === "--min-preference-cases") args.minPreferenceCases = Number.parseInt(argv[++index], 10);
    else if (arg === "--meaningful-delta") args.meaningfulDelta = Number.parseFloat(argv[++index]);
    else if (arg === "--help" || arg === "-h") { usage(); process.exit(0); }
  }
  if (!args.input) throw new Error("--input is required.");
  return args;
}

function readRows(file) {
  const payload = JSON.parse(fs.readFileSync(path.resolve(file), "utf8"));
  const rows = payload.results?.results || payload.results?.outputs || payload.outputs || payload.results || payload;
  if (!Array.isArray(rows) || !rows.length) throw new Error("No result rows found.");
  return rows;
}

function varsOf(row) {
  return row.vars || row.testCase?.vars || row.test?.vars || row.test?.options?.vars || {};
}

function setupOf(row) {
  const provider = row.provider || row.providerId || row.providerResponse?.provider;
  const providerName = typeof provider === "string" ? provider : provider?.label || provider?.id || "unknown-setup";
  const config = varsOf(row).config_label;
  return config && config !== "default" ? `${providerName} / ${config}` : providerName;
}

function preferenceOf(row) {
  return varsOf(row).preference_id || row.metric || "unknown_preference";
}

function scoreOf(row) {
  const value = Number(row.score ?? row.gradingResult?.score ?? row.result?.score);
  if (Number.isFinite(value)) return Math.max(0, Math.min(1, value));
  return (row.success ?? row.pass ?? row.gradingResult?.pass) ? 1 : 0;
}

function passOf(row) {
  const value = row.success ?? row.pass ?? row.gradingResult?.pass;
  return typeof value === "boolean" ? value : scoreOf(row) >= 0.5;
}

function summarize(rows) {
  const grouped = new Map();
  for (const row of rows) {
    const setup = setupOf(row);
    const preference = preferenceOf(row);
    if (!grouped.has(setup)) grouped.set(setup, []);
    grouped.get(setup).push({
      preference,
      score: scoreOf(row),
      pass: passOf(row),
      latencyMs: Number(row.latencyMs || 0),
      tokens: Number(row.tokenUsage?.total ?? row.response?.tokenUsage?.total ?? 0),
    });
  }
  return [...grouped.entries()].map(([name, setupRows]) => {
    const preferences = [...new Set(setupRows.map(row => row.preference))].map(id => {
      const selected = setupRows.filter(row => row.preference === id);
      return {
        id,
        cases: selected.length,
        meanScore: selected.reduce((sum, row) => sum + row.score, 0) / selected.length,
        passRate: selected.filter(row => row.pass).length / selected.length,
      };
    });
    return {
      name,
      cases: setupRows.length,
      meanScore: setupRows.reduce((sum, row) => sum + row.score, 0) / setupRows.length,
      passRate: setupRows.filter(row => row.pass).length / setupRows.length,
      averageLatencyMs: setupRows.reduce((sum, row) => sum + row.latencyMs, 0) / setupRows.length,
      totalTokens: setupRows.reduce((sum, row) => sum + row.tokens, 0),
      preferences,
    };
  }).sort((a, b) => b.meanScore - a.meanScore);
}

function preferenceWinners(setups, meaningfulDelta) {
  const ids = [...new Set(setups.flatMap(setup => setup.preferences.map(item => item.id)))];
  return ids.map(id => {
    const ranked = setups.map(setup => ({
      setup: setup.name,
      ...(setup.preferences.find(item => item.id === id) || { cases: 0, meanScore: 0, passRate: 0 }),
    })).sort((a, b) => b.meanScore - a.meanScore);
    return {
      preferenceId: id,
      winner: ranked[0],
      runnerUp: ranked[1] || null,
      meaningful: !ranked[1] || ranked[0].meanScore - ranked[1].meanScore >= meaningfulDelta,
    };
  });
}

function decide(setups, winners, args, project) {
  const top = setups[0];
  const runnerUp = setups[1];
  const enoughEvidence = setups.every(setup => setup.cases >= args.minCases);
  const enoughPreferenceEvidence = winners.every(item =>
    item.winner.cases >= args.minPreferenceCases &&
    (!item.runnerUp || item.runnerUp.cases >= args.minPreferenceCases));
  const heldOutCases = project?.summary?.heldOutCases ?? null;
  const lowPreferences = top.preferences.filter(item => item.meanScore < 0.65).map(item => item.id);
  const meaningfulWins = winners.filter(item => item.meaningful);
  const differentWinners = new Set(meaningfulWins.map(item => item.winner.setup));
  const overallDelta = runnerUp ? top.meanScore - runnerUp.meanScore : 0;

  if (!enoughEvidence || !enoughPreferenceEvidence || heldOutCases === 0) {
    return {
      action: "collect_more_evidence",
      headline: "Strengthen the evidence before changing the setup",
      rationale: heldOutCases === 0
        ? "The project has no held-out personal-fit cases, so an apparent gain could be test overfitting."
        : !enoughEvidence
          ? `At least one setup has fewer than ${args.minCases} evaluated cases.`
          : `At least one preference has fewer than ${args.minPreferenceCases} cases per compared setup.`,
      nextExperiment: "Review more conversation-derived candidates, approve public-safe rewrites, and reserve some as held-out cases.",
    };
  }
  if (setups.length === 1) {
    return {
      action: "test_config_change",
      headline: "Run a controlled config comparison",
      rationale: lowPreferences.length
        ? `The current setup is weakest on: ${lowPreferences.join(", ")}.`
        : "One setup cannot reveal whether a prompt, memory, skill, or model change improves personal fit.",
      nextExperiment: "Keep the model fixed, change one config layer, and compare baseline versus candidate on development and held-out cases.",
    };
  }
  if (differentWinners.size > 1) {
    return {
      action: "test_workflow_routing",
      headline: "Different setups fit different parts of the user's workflow",
      rationale: meaningfulWins.map(item => `${item.winner.setup} leads on ${item.preferenceId}`).join("; "),
      nextExperiment: "Test a simple routing rule by task or preference area instead of forcing one model/config to handle every workflow.",
    };
  }
  if (overallDelta >= args.meaningfulDelta && top.passRate >= runnerUp.passRate) {
    return {
      action: "validate_setup_choice",
      headline: `${top.name} is the leading personal-fit candidate`,
      rationale: `It leads mean fit by ${overallDelta.toFixed(2)} with a ${(top.passRate * 100).toFixed(0)}% pass rate. Latency and token tradeoffs still need review.`,
      nextExperiment: "Repeat the comparison on held-out cases and inspect every regression before adopting this setup.",
    };
  }
  if (lowPreferences.length) {
    return {
      action: "test_targeted_config_change",
      headline: "Model choice is inconclusive; target the weak behavior",
      rationale: `The leading setups are close, while these preference areas remain weak: ${lowPreferences.join(", ")}.`,
      nextExperiment: "Keep the model fixed and test one prompt, memory, or skill change aimed only at the weak preference area.",
    };
  }
  return {
    action: "keep_and_monitor",
    headline: "No change is supported yet",
    rationale: "The compared setups are close on the current personal-fit evidence.",
    nextExperiment: "Keep the simpler or cheaper setup, collect naturally occurring corrections, and rerun when the profile gains discriminating cases.",
  };
}

export function recommend({ rows, args, project = null }) {
  const setups = summarize(rows);
  const winners = preferenceWinners(setups, args.meaningfulDelta);
  const decision = decide(setups, winners, args, project);
  return {
    version: "vibecheckbench-next-experiment-v1",
    generatedAt: new Date().toISOString(),
    evidence: {
      resultRows: rows.length,
      setupCount: setups.length,
      projectVersion: project?.version || null,
      heldOutCases: project?.summary?.heldOutCases ?? null,
    },
    setups,
    preferenceWinners: winners,
    decision: {
      ...decision,
      automaticDeployment: false,
      humanReviewRequired: true,
    },
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const project = args.project ? JSON.parse(fs.readFileSync(path.resolve(args.project), "utf8")) : null;
  const report = recommend({ rows: readRows(args.input), args, project });
  const outPath = path.resolve(args.out);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(`Wrote next-experiment decision: ${outPath}`);
  console.log(`${report.decision.headline}.`);
  console.log(`Next: ${report.decision.nextExperiment}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  try {
    main();
  } catch (error) {
    console.error(`Recommendation error: ${error.message}`);
    process.exit(1);
  }
}
