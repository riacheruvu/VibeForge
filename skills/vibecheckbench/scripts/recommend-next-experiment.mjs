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
  console.log(`VibeForge next-experiment recommender

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

const PREFERENCE_LABELS = {
  calibrated_factuality_and_sourceability: "Doesn't overclaim",
  concise_length_control: "Keeps it high-signal",
  context_sensitive_non_refusal: "Helps without overstepping",
  social_sycophancy_resistance: "Pushes back kindly",
  user_agency_and_decision_fit: "Helps me choose",
  verifiable_instruction_following: "Respects my asks",
};

function preferenceLabel(id) {
  return PREFERENCE_LABELS[id] || String(id).replaceAll("_", " ");
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
      targetSurface: "evidence",
      headline: "Add a few more tests before changing the setup",
      rationale: heldOutCases === 0
        ? "No tests have been saved for a final unseen check, so an apparent improvement may only fit the examples used during development."
        : !enoughEvidence
          ? `At least one setup has answered fewer than ${args.minCases} tests.`
          : `At least one preference has fewer than ${args.minPreferenceCases} tests for each setup.`,
      nextExperiment: "Review more suggested tests, remove private details, and save some for a final unseen check.",
    };
  }
  if (setups.length === 1) {
    return {
      action: "test_config_change",
      targetSurface: "instructions",
      headline: "Compare one focused setup change",
      rationale: lowPreferences.length
        ? `The current setup is weakest on: ${lowPreferences.map(preferenceLabel).join(", ")}.`
        : "A single result cannot show whether changing the prompt, memory, skill, or model would improve the experience.",
      nextExperiment: "Keep the model fixed, change one part of the setup, and compare it on both improvement tests and final unseen tests.",
    };
  }
  if (differentWinners.size > 1) {
    return {
      action: "test_workflow_routing",
      targetSurface: "routing",
      headline: "Different setups may suit different kinds of work",
      rationale: meaningfulWins.map(item => `${item.winner.setup} leads on ${preferenceLabel(item.preferenceId)}`).join("; "),
      nextExperiment: "Try a simple rule that selects a setup by task or preference instead of forcing one setup to handle everything.",
    };
  }
  if (overallDelta >= args.meaningfulDelta && top.passRate >= runnerUp.passRate) {
    return {
      action: "validate_setup_choice",
      targetSurface: "model",
      headline: `${top.name} matched these preferences best`,
      rationale: `It leads the average score by ${overallDelta.toFixed(2)} and passed ${(top.passRate * 100).toFixed(0)}% of the checks. Response time and token use still matter.`,
      nextExperiment: "Repeat the comparison on final unseen tests and review every behavior that became worse before adopting it.",
    };
  }
  if (lowPreferences.length) {
    return {
      action: "test_targeted_config_change",
      targetSurface: "instructions",
      headline: "The models are close; focus on the weak behavior",
      rationale: `The leading setups are close, while these preferences remain weak: ${lowPreferences.map(preferenceLabel).join(", ")}.`,
      nextExperiment: "Keep the model fixed and test one prompt, memory, or skill change aimed at that preference.",
    };
  }
  return {
    action: "keep_and_monitor",
      targetSurface: "monitoring",
      headline: "There is not enough evidence to change the setup yet",
      rationale: "The compared setups performed similarly on the current tests.",
      nextExperiment: "Keep the simpler or cheaper setup, save new moments of friction, and rerun when the test set can better separate the options.",
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
  console.log("");
  console.log("VibeForge · next experiment (candidate only — never auto-applied)");
  console.log("─".repeat(56));
  console.log(`✓ ${report.decision.headline}`);
  console.log(`  Try: ${report.decision.nextExperiment}`);
  console.log(`  File: ${outPath}`);
  console.log("  Trust: human review required · automaticDeployment=false");
  console.log("");
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  try {
    main();
  } catch (error) {
    console.error(`VibeForge error (recommend): ${error.message}`);
    process.exit(1);
  }
}
