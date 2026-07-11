import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { runProfile } from "./run-profile.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_REPORTS_DIR = path.resolve(__dirname, "../../..", "reports");

function parseArgs(argv) {
  const args = {
    models: [],
    profile: "preferences.yaml",
    caseFile: null,
    promptFile: null,
    prompt: null,
    cases: 1,
    repeat: 1,
    provider: process.env.VIBEFORGE_PROVIDER || null,
    judgeProvider: process.env.VIBEFORGE_JUDGE_PROVIDER || null,
    judgeModel: process.env.VIBEFORGE_JUDGE_MODEL || null,
    improve: false,
    saveReport: false,
    json: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--models") { args.models = argv[++i].split(",").map(s => s.trim()).filter(Boolean); continue; }
    if (arg === "--profile") { args.profile = argv[++i]; continue; }
    if (arg === "--case-file") { args.caseFile = argv[++i]; continue; }
    if (arg === "--prompt-file") { args.promptFile = argv[++i]; continue; }
    if (arg === "--prompt") { args.prompt = argv[++i]; continue; }
    if (arg === "--cases") { args.cases = Number.parseInt(argv[++i], 10) || 1; continue; }
    if (arg === "--repeat") { args.repeat = Number.parseInt(argv[++i], 10) || 1; continue; }
    if (arg === "--provider") { args.provider = argv[++i]; continue; }
    if (arg === "--judge-provider") { args.judgeProvider = argv[++i]; continue; }
    if (arg === "--judge-model") { args.judgeModel = argv[++i]; continue; }
    if (arg === "--improve") { args.improve = true; continue; }
    if (arg === "--save-report") { args.saveReport = true; continue; }
    if (arg === "--json") { args.json = true; continue; }
    if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }
  }

  if (args.models.length === 0) {
    throw new Error('Missing models. Use --models "gpt-5.5,gpt-5.4,gpt-5.4-mini".');
  }

  return args;
}

function printHelp() {
  console.log(`VibeForge model comparison

Usage:
  node skills/vibeforge/scripts/compare-models.mjs --models "gpt-5.5,gpt-5.4,gpt-5.4-mini" --provider openai --profile preferences.yaml --cases 3

Options:
  --models <csv>          Candidate models to compare
  --provider <name>       Provider for candidate models: openai, anthropic, or llamacpp
  --judge-provider <name> Optional separate judge provider
  --judge-model <name>    Optional separate judge model
  --profile <path>        Preference profile, default preferences.yaml
  --case-file <path>      Optional JSON case bank keyed by preference id/type
  --prompt <text>         Prompt to test as Config B
  --prompt-file <path>    Prompt file to test as Config B
  --cases <n>             Cases per preference
  --repeat <n>            Repeats per model
  --improve               Include improved prompt generation per candidate
  --save-report           Save each raw profile report
  --json                  Print JSON comparison`);
}

function runProfileForModel(args, model) {
  return runProfile({
    profilePath: args.profile,
    caseFile: args.caseFile,
    promptFile: args.promptFile,
    prompt: args.promptFile ? fs.readFileSync(path.resolve(process.cwd(), args.promptFile), "utf8").trim() : args.prompt,
    casesPerPreference: args.cases,
    repeat: args.repeat,
    json: true,
    saveReport: args.saveReport,
    reportDir: DEFAULT_REPORTS_DIR,
    validateProfile: false,
    smokeTest: false,
    improve: args.improve,
    providerName: args.provider,
    model,
    judgeProviderName: args.judgeProvider,
    judgeModel: args.judgeModel,
  });
}

function percentToNumber(value) {
  return Number.parseFloat(String(value || "0").replace("%", "")) || 0;
}

function summarizeReport(report) {
  const totalWeight = report.preferenceResults.reduce((sum, result) => sum + (result.weight || 1), 0);
  const weightedRubricScore = totalWeight > 0
    ? Math.round(report.preferenceResults.reduce((sum, result) => {
        return sum + percentToNumber(result.rubricScoreB) * (result.weight || 1);
      }, 0) / totalWeight)
    : 0;

  const preferences = Object.fromEntries(
    Object.entries(report.repeatSummary || {}).map(([id, summary]) => [
      id,
      {
        meanWinRate: summary.meanWinRate,
        stdevWinRate: summary.stdevWinRate,
      },
    ]),
  );

  return {
    model: report.model,
    provider: report.provider,
    judge: `${report.judgeProvider}/${report.judgeModel}`,
    aggregateWinRate: report.aggregate.aggregateWinRate,
    candidateRubricScore: `${weightedRubricScore}%`,
    weakestPreference: report.aggregate.weakestPreference,
    strongestPreference: report.aggregate.strongestPreference,
    preferences,
    improvedPrompt: report.improvedPrompt || null,
    reportPath: report.reportPath || null,
  };
}

function formatComparison(comparison) {
  const lines = [
    "VibeForge Model Comparison",
    "========================",
    `Profile: ${comparison.profile}`,
    `Cases per preference: ${comparison.cases}`,
    `Repeats: ${comparison.repeat}`,
    "",
    "Results",
  ];

  for (const result of comparison.results) {
    lines.push(`- ${result.model}: ${result.candidateRubricScore} rubric, ${result.aggregateWinRate} A/B aggregate, weakest=${result.weakestPreference}`);
  }

  if (comparison.best) {
    lines.push("");
    lines.push(`Best by candidate rubric score: ${comparison.best.model} (${comparison.best.candidateRubricScore})`);
  }

  lines.push("");
  lines.push("Note: For strongest evidence, use a separate judge model and enough repeats to reduce variance.");
  return lines.join("\n");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const reports = [];
  for (const model of args.models) {
    process.stderr.write(`Comparing model: ${model}\n`);
    reports.push(await runProfileForModel(args, model));
  }

  const results = reports.map(summarizeReport).sort((a, b) => {
    const rubricDelta = percentToNumber(b.candidateRubricScore) - percentToNumber(a.candidateRubricScore);
    return rubricDelta || (percentToNumber(b.aggregateWinRate) - percentToNumber(a.aggregateWinRate));
  });

  const comparison = {
    profile: args.profile,
    provider: args.provider,
    judgeProvider: args.judgeProvider,
    judgeModel: args.judgeModel,
    cases: args.cases,
    repeat: args.repeat,
    results,
    best: results[0] || null,
  };

  if (args.json) {
    console.log(JSON.stringify(comparison, null, 2));
  } else {
    console.log(formatComparison(comparison));
  }
}

main().catch(error => {
  console.error(`Model comparison error: ${error.message}`);
  process.exit(1);
});
