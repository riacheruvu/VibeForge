import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { runProfile } from "./run-profile.mjs";

const DEFAULT_OUTPUT_DIR = path.resolve("reports", "optimized-configs");

function parseArgs(argv) {
  const args = {
    profile: "preferences.yaml",
    caseFile: null,
    validationCaseFile: null,
    promptFile: null,
    iterations: 2,
    cases: 1,
    repeat: 1,
    provider: process.env.VIBECHECKBENCH_PROVIDER || null,
    model: process.env.VIBECHECKBENCH_MODEL || null,
    judgeProvider: process.env.VIBECHECKBENCH_JUDGE_PROVIDER || null,
    judgeModel: process.env.VIBECHECKBENCH_JUDGE_MODEL || null,
    outputDir: DEFAULT_OUTPUT_DIR,
    minImprovement: 2,
    maxPreferenceRegression: 8,
    allowSameCases: false,
    json: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--profile") { args.profile = argv[++i]; continue; }
    if (arg === "--case-file") { args.caseFile = argv[++i]; continue; }
    if (arg === "--validation-case-file") { args.validationCaseFile = argv[++i]; continue; }
    if (arg === "--prompt-file") { args.promptFile = argv[++i]; continue; }
    if (arg === "--iterations") { args.iterations = Number.parseInt(argv[++i], 10) || 2; continue; }
    if (arg === "--cases") { args.cases = Number.parseInt(argv[++i], 10) || 1; continue; }
    if (arg === "--repeat") { args.repeat = Number.parseInt(argv[++i], 10) || 1; continue; }
    if (arg === "--provider") { args.provider = argv[++i]; continue; }
    if (arg === "--model") { args.model = argv[++i]; continue; }
    if (arg === "--judge-provider") { args.judgeProvider = argv[++i]; continue; }
    if (arg === "--judge-model") { args.judgeModel = argv[++i]; continue; }
    if (arg === "--output-dir") { args.outputDir = path.resolve(process.cwd(), argv[++i]); continue; }
    if (arg === "--min-improvement") { args.minImprovement = Number.parseFloat(argv[++i]); continue; }
    if (arg === "--max-preference-regression") { args.maxPreferenceRegression = Number.parseFloat(argv[++i]); continue; }
    if (arg === "--allow-same-cases") { args.allowSameCases = true; continue; }
    if (arg === "--json") { args.json = true; continue; }
    if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }
  }

  if (!args.promptFile) throw new Error("Missing --prompt-file.");
  return args;
}

function printHelp() {
  console.log(`VibeCheckBench config optimizer

Usage:
  node skills/vibecheckbench/scripts/optimize-config.mjs --profile examples/public-agent-profile.yaml --case-file train-cases.json --validation-case-file held-out-cases.json --prompt-file examples/config-candidates/generic-supportive.txt --iterations 2

This proposes an improved prompt from training cases, then promotes it only when
held-out validation improves without a large preference-level regression.
Use a reliable, separate judge model. For plumbing-only experiments,
--allow-same-cases permits reuse of the training cases.`);
}

function percentToNumber(value) {
  return Number.parseFloat(String(value || "0").replace("%", "")) || 0;
}

function weightedCandidateRubric(report) {
  const totalWeight = report.preferenceResults.reduce((sum, result) => sum + (result.weight || 1), 0);
  if (totalWeight <= 0) return 0;
  return Math.round(report.preferenceResults.reduce((sum, result) => {
    return sum + percentToNumber(result.rubricScoreB) * (result.weight || 1);
  }, 0) / totalWeight);
}

function preferenceScores(report) {
  const grouped = new Map();
  for (const result of report.preferenceResults || []) {
    const scores = grouped.get(result.preferenceId) || [];
    scores.push(percentToNumber(result.rubricScoreB));
    grouped.set(result.preferenceId, scores);
  }
  return Object.fromEntries([...grouped.entries()].map(([id, scores]) => [
    id,
    scores.reduce((sum, score) => sum + score, 0) / scores.length,
  ]));
}

export function compareValidation(currentReport, candidateReport, args) {
  const currentScore = weightedCandidateRubric(currentReport);
  const candidateScore = weightedCandidateRubric(candidateReport);
  const currentPreferences = preferenceScores(currentReport);
  const candidatePreferences = preferenceScores(candidateReport);
  const regressions = Object.keys(currentPreferences).map(preferenceId => ({
    preferenceId,
    before: currentPreferences[preferenceId],
    after: candidatePreferences[preferenceId] ?? 0,
    delta: (candidatePreferences[preferenceId] ?? 0) - currentPreferences[preferenceId],
  })).filter(item => item.delta < 0);
  const worstRegression = regressions.sort((a, b) => a.delta - b.delta)[0] || null;
  const improvement = candidateScore - currentScore;
  const accepted =
    improvement >= args.minImprovement &&
    (!worstRegression || Math.abs(worstRegression.delta) <= args.maxPreferenceRegression);
  return {
    accepted,
    currentScore,
    candidateScore,
    improvement,
    minImprovement: args.minImprovement,
    maxPreferenceRegression: args.maxPreferenceRegression,
    worstRegression,
    regressions,
  };
}

async function evaluatePrompt(args, promptPath, caseFile) {
  const prompt = fs.readFileSync(promptPath, "utf8").trim();
  return runProfile({
    profilePath: args.profile,
    caseFile,
    promptFile: promptPath,
    prompt,
    casesPerPreference: args.cases,
    repeat: args.repeat,
    json: true,
    saveReport: true,
    reportDir: path.resolve("reports"),
    validateProfile: false,
    smokeTest: false,
    improve: false,
    providerName: args.provider,
    model: args.model,
    judgeProviderName: args.judgeProvider,
    judgeModel: args.judgeModel,
  });
}

async function runIteration(args, promptPath, iteration) {
  const prompt = fs.readFileSync(promptPath, "utf8").trim();
  const report = await runProfile({
    profilePath: args.profile,
    caseFile: args.caseFile,
    promptFile: promptPath,
    prompt,
    casesPerPreference: args.cases,
    repeat: args.repeat,
    json: true,
    saveReport: true,
    reportDir: path.resolve("reports"),
    validateProfile: false,
    smokeTest: false,
    improve: true,
    providerName: args.provider,
    model: args.model,
    judgeProviderName: args.judgeProvider,
    judgeModel: args.judgeModel,
  });

  const score = weightedCandidateRubric(report);
  let nextPromptPath = null;
  if (report.improvedPrompt) {
    nextPromptPath = path.join(args.outputDir, `iteration-${iteration + 1}.txt`);
    fs.writeFileSync(nextPromptPath, `${report.improvedPrompt.trim()}\n`, "utf8");
  }

  return {
    iteration,
    promptPath,
    score: `${score}%`,
    aggregateWinRate: report.aggregate.aggregateWinRate,
    weakestPreference: report.aggregate.weakestPreference,
    reportPath: report.reportPath,
    nextPromptPath,
    trainingReport: report,
  };
}

function formatResult(result) {
  const lines = [
    "VibeCheckBench Config Optimization",
    "===========================",
  ];

  for (const item of result.iterations) {
    lines.push(`- Iteration ${item.iteration}: ${item.score} rubric, ${item.aggregateWinRate} A/B, weakest=${item.weakestPreference}`);
    lines.push(`  Prompt: ${item.promptPath}`);
    if (item.reportPath) lines.push(`  Report: ${item.reportPath}`);
    if (item.promotion) {
      lines.push(`  Promotion: ${item.promotion.accepted ? "accepted" : "rejected"} (${item.promotion.improvement >= 0 ? "+" : ""}${item.promotion.improvement.toFixed(1)} validation points)`);
      if (item.promotion.worstRegression) {
        lines.push(`  Worst regression: ${item.promotion.worstRegression.preferenceId} ${item.promotion.worstRegression.delta.toFixed(1)} points`);
      }
    }
  }

  if (result.best) {
    lines.push("");
    lines.push(`Best prompt: ${result.best.promptPath} (${result.best.score})`);
  }
  if (result.manifestPath) lines.push(`Manifest: ${result.manifestPath}`);

  return lines.join("\n");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.validationCaseFile && !args.allowSameCases) {
    throw new Error("Missing --validation-case-file. Use held-out cases, or --allow-same-cases for a plumbing-only experiment.");
  }
  fs.mkdirSync(args.outputDir, { recursive: true });

  let currentPromptPath = path.resolve(process.cwd(), args.promptFile);
  const iterations = [];
  const validationCaseFile = args.validationCaseFile || args.caseFile;

  for (let iteration = 1; iteration <= args.iterations; iteration += 1) {
    process.stderr.write(`Optimization iteration ${iteration}: ${currentPromptPath}\n`);
    const result = await runIteration(args, currentPromptPath, iteration);
    if (!result.nextPromptPath) {
      delete result.trainingReport;
      iterations.push(result);
      break;
    }

    process.stderr.write(`Validating current and candidate prompts on ${validationCaseFile || "generated cases"}...\n`);
    const currentValidation = await evaluatePrompt(args, currentPromptPath, validationCaseFile);
    const candidateValidation = await evaluatePrompt(args, result.nextPromptPath, validationCaseFile);
    result.promotion = compareValidation(currentValidation, candidateValidation, args);
    result.validation = {
      caseFile: validationCaseFile,
      currentReportPath: currentValidation.reportPath,
      candidateReportPath: candidateValidation.reportPath,
    };
    delete result.trainingReport;
    iterations.push(result);

    if (!result.promotion.accepted) break;
    currentPromptPath = result.nextPromptPath;
  }

  const accepted = iterations.filter(item => item.promotion?.accepted);
  const best = accepted.length
    ? {
        promptPath: accepted.at(-1).nextPromptPath,
        score: `${accepted.at(-1).promotion.candidateScore}%`,
      }
    : iterations[0]
      ? { promptPath: iterations[0].promptPath, score: `${iterations[0].promotion?.currentScore ?? percentToNumber(iterations[0].score)}%` }
      : null;
  const result = {
    version: "vibecheckbench-optimization-loop-v1",
    generatedAt: new Date().toISOString(),
    policy: {
      validationCaseFile,
      heldOutValidation: Boolean(args.validationCaseFile),
      minImprovement: args.minImprovement,
      maxPreferenceRegression: args.maxPreferenceRegression,
      automaticPromotion: false,
      note: "Accepted means eligible for human review, not automatic deployment.",
    },
    iterations,
    best,
  };
  const manifestPath = path.join(args.outputDir, "optimization-manifest.json");
  fs.writeFileSync(manifestPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  result.manifestPath = manifestPath;

  if (args.json) console.log(JSON.stringify(result, null, 2));
  else console.log(formatResult(result));
}

const isMainModule =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url));

if (isMainModule) {
  main().catch(error => {
    console.error(`Config optimization error: ${error.message}`);
    process.exit(1);
  });
}
