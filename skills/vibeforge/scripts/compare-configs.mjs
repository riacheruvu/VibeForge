import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { runProfile } from "./run-profile.mjs";

const DEFAULT_REPORTS_DIR = path.resolve("reports");

function parseArgs(argv) {
  const args = {
    configs: [],
    configDir: null,
    profile: "preferences.yaml",
    caseFile: null,
    cases: 1,
    repeat: 1,
    provider: process.env.VIBEFORGE_PROVIDER || null,
    model: process.env.VIBEFORGE_MODEL || null,
    judgeProvider: process.env.VIBEFORGE_JUDGE_PROVIDER || null,
    judgeModel: process.env.VIBEFORGE_JUDGE_MODEL || null,
    saveReport: false,
    json: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--configs") { args.configs = argv[++i].split(",").map(s => s.trim()).filter(Boolean); continue; }
    if (arg === "--config-dir") { args.configDir = argv[++i]; continue; }
    if (arg === "--profile") { args.profile = argv[++i]; continue; }
    if (arg === "--case-file") { args.caseFile = argv[++i]; continue; }
    if (arg === "--cases") { args.cases = Number.parseInt(argv[++i], 10) || 1; continue; }
    if (arg === "--repeat") { args.repeat = Number.parseInt(argv[++i], 10) || 1; continue; }
    if (arg === "--provider") { args.provider = argv[++i]; continue; }
    if (arg === "--model") { args.model = argv[++i]; continue; }
    if (arg === "--judge-provider") { args.judgeProvider = argv[++i]; continue; }
    if (arg === "--judge-model") { args.judgeModel = argv[++i]; continue; }
    if (arg === "--save-report") { args.saveReport = true; continue; }
    if (arg === "--json") { args.json = true; continue; }
    if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }
  }

  if (args.configDir) {
    const dir = path.resolve(process.cwd(), args.configDir);
    args.configs.push(
      ...fs.readdirSync(dir)
        .filter(name => /\.(txt|md)$/i.test(name))
        .map(name => path.join(dir, name)),
    );
  }

  args.configs = [...new Set(args.configs)];
  if (args.configs.length === 0) {
    throw new Error("Provide --configs file1.txt,file2.txt or --config-dir configs/");
  }

  return args;
}

function printHelp() {
  console.log(`VibeForge config comparison

Usage:
  node skills/vibeforge/scripts/compare-configs.mjs --config-dir examples/config-candidates --profile examples/public-agent-profile.yaml --case-file examples/public-agent-cases.json

Options:
  --configs <csv>         Prompt/config files to compare
  --config-dir <path>     Directory of .txt/.md prompt/config files
  --profile <path>        Preference profile
  --case-file <path>      Seeded case bank
  --cases <n>             Cases per preference
  --repeat <n>            Repeats per config
  --provider <name>       Candidate provider
  --model <name>          Candidate model
  --judge-provider <name> Optional separate judge provider
  --judge-model <name>    Optional separate judge model
  --save-report           Save raw reports
  --json                  Print JSON`);
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

async function runConfig(args, configPath) {
  const absolutePath = path.resolve(process.cwd(), configPath);
  const report = await runProfile({
    profilePath: args.profile,
    caseFile: args.caseFile,
    promptFile: absolutePath,
    prompt: fs.readFileSync(absolutePath, "utf8").trim(),
    casesPerPreference: args.cases,
    repeat: args.repeat,
    json: true,
    saveReport: args.saveReport,
    reportDir: DEFAULT_REPORTS_DIR,
    validateProfile: false,
    smokeTest: false,
    improve: false,
    providerName: args.provider,
    model: args.model,
    judgeProviderName: args.judgeProvider,
    judgeModel: args.judgeModel,
  });

  return {
    name: path.basename(configPath),
    path: absolutePath,
    candidateRubricScore: `${weightedCandidateRubric(report)}%`,
    aggregateWinRate: report.aggregate.aggregateWinRate,
    weakestPreference: report.aggregate.weakestPreference,
    strongestPreference: report.aggregate.strongestPreference,
    reportPath: report.reportPath || null,
  };
}

function formatComparison(comparison) {
  const lines = [
    "VibeForge Config Comparison",
    "=========================",
    `Profile: ${comparison.profile}`,
    `Cases per preference: ${comparison.cases}`,
    `Repeats: ${comparison.repeat}`,
    "",
    "Results",
  ];

  for (const result of comparison.results) {
    lines.push(`- ${result.name}: ${result.candidateRubricScore} rubric, ${result.aggregateWinRate} A/B, weakest=${result.weakestPreference}`);
  }

  if (comparison.best) {
    lines.push("");
    lines.push(`Best config: ${comparison.best.name} (${comparison.best.candidateRubricScore})`);
    lines.push(`Path: ${comparison.best.path}`);
  }

  return lines.join("\n");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const results = [];

  for (const config of args.configs) {
    process.stderr.write(`Comparing config: ${config}\n`);
    results.push(await runConfig(args, config));
  }

  results.sort((a, b) => {
    const rubricDelta = percentToNumber(b.candidateRubricScore) - percentToNumber(a.candidateRubricScore);
    return rubricDelta || (percentToNumber(b.aggregateWinRate) - percentToNumber(a.aggregateWinRate));
  });

  const comparison = {
    profile: args.profile,
    caseFile: args.caseFile,
    cases: args.cases,
    repeat: args.repeat,
    results,
    best: results[0] || null,
  };

  if (args.json) console.log(JSON.stringify(comparison, null, 2));
  else console.log(formatComparison(comparison));
}

main().catch(error => {
  console.error(`Config comparison error: ${error.message}`);
  process.exit(1);
});
