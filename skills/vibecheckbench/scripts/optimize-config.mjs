import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { runProfile } from "./run-profile.mjs";

const DEFAULT_OUTPUT_DIR = path.resolve("reports", "optimized-configs");

function parseArgs(argv) {
  const args = {
    profile: "preferences.yaml",
    caseFile: null,
    promptFile: null,
    iterations: 2,
    cases: 1,
    repeat: 1,
    provider: process.env.VIBECHECKBENCH_PROVIDER || null,
    model: process.env.VIBECHECKBENCH_MODEL || null,
    judgeProvider: process.env.VIBECHECKBENCH_JUDGE_PROVIDER || null,
    judgeModel: process.env.VIBECHECKBENCH_JUDGE_MODEL || null,
    outputDir: DEFAULT_OUTPUT_DIR,
    json: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--profile") { args.profile = argv[++i]; continue; }
    if (arg === "--case-file") { args.caseFile = argv[++i]; continue; }
    if (arg === "--prompt-file") { args.promptFile = argv[++i]; continue; }
    if (arg === "--iterations") { args.iterations = Number.parseInt(argv[++i], 10) || 2; continue; }
    if (arg === "--cases") { args.cases = Number.parseInt(argv[++i], 10) || 1; continue; }
    if (arg === "--repeat") { args.repeat = Number.parseInt(argv[++i], 10) || 1; continue; }
    if (arg === "--provider") { args.provider = argv[++i]; continue; }
    if (arg === "--model") { args.model = argv[++i]; continue; }
    if (arg === "--judge-provider") { args.judgeProvider = argv[++i]; continue; }
    if (arg === "--judge-model") { args.judgeModel = argv[++i]; continue; }
    if (arg === "--output-dir") { args.outputDir = path.resolve(process.cwd(), argv[++i]); continue; }
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
  node skills/vibecheckbench/scripts/optimize-config.mjs --profile examples/public-agent-profile.yaml --case-file examples/public-agent-cases.json --prompt-file examples/config-candidates/generic-supportive.txt --iterations 2

This runs a profile, asks for an improved prompt with --improve, saves the improved
prompt, then reruns it for the next iteration. Use a reliable judge model.`);
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
  }

  if (result.best) {
    lines.push("");
    lines.push(`Best prompt: ${result.best.promptPath} (${result.best.score})`);
  }

  return lines.join("\n");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  fs.mkdirSync(args.outputDir, { recursive: true });

  let currentPromptPath = path.resolve(process.cwd(), args.promptFile);
  const iterations = [];

  for (let iteration = 1; iteration <= args.iterations; iteration += 1) {
    process.stderr.write(`Optimization iteration ${iteration}: ${currentPromptPath}\n`);
    const result = await runIteration(args, currentPromptPath, iteration);
    iterations.push(result);
    if (!result.nextPromptPath) break;
    currentPromptPath = result.nextPromptPath;
  }

  const best = [...iterations].sort((a, b) => percentToNumber(b.score) - percentToNumber(a.score))[0] || null;
  const result = { iterations, best };

  if (args.json) console.log(JSON.stringify(result, null, 2));
  else console.log(formatResult(result));
}

main().catch(error => {
  console.error(`Config optimization error: ${error.message}`);
  process.exit(1);
});
