#!/usr/bin/env node
/**
 * Run local/OSS subject models against VibeForge cases without Promptfoo.
 *
 * Supported providers:
 *   - ollama:chat:<model>  (uses http://127.0.0.1:11434/api/chat)
 *   - ollama:<model>
 *   - file://path/to/provider.mjs  (Promptfoo-style provider with callApi)
 *   - echo
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { scoreAnswersFile } from "./score-answers.mjs";
import { chartResultsFile } from "./chart-results.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../../..");

function usage() {
  console.log(`VibeForge local subject runner

Usage:
  node skills/vibeforge/scripts/run-local-subjects.mjs --example complex --provider ollama:chat:qwen3:8b

Options:
  --example <complex>      Use bundled complex public-safe cases
  --case-file <path>       JSON object mapping preference ids to prompts
  --prompt-file <path>     System prompt file
  --provider <id>          Repeatable. Supports ollama:chat:<model>, ollama:<model>, file://..., echo
  --out <path>             Captured answers JSON (default: reports/answers.local-subjects.json)
  --scored-out <path>      Scored results JSON (default: reports/results.local-subjects.json)
  --chart-out <path>       Skill chart HTML/MD path (default: reports/skill-chart.local-subjects.html)
  --limit <n>              Limit prompts per preference for smoke tests
  --ollama-url <url>       Ollama base URL (default: http://127.0.0.1:11434)
  --no-score               Only write captured answers
  --help                   Show help`);
}

function parseArgs(argv) {
  const args = {
    caseFile: path.join(REPO_ROOT, "examples", "complex-agent-cases.json"),
    promptFile: path.join(REPO_ROOT, "examples", "complex-agent-system-prompt.txt"),
    providers: [],
    out: "reports/answers.local-subjects.json",
    scoredOut: "reports/results.local-subjects.json",
    chartOut: "reports/skill-chart.local-subjects.html",
    limit: 0,
    ollamaUrl: "http://127.0.0.1:11434",
    score: true,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--example") {
      const example = argv[++i];
      if (example !== "complex") throw new Error("Only --example complex is currently supported.");
      continue;
    }
    if (arg === "--case-file") { args.caseFile = argv[++i]; continue; }
    if (arg === "--prompt-file") { args.promptFile = argv[++i]; continue; }
    if (arg === "--provider") { args.providers.push(argv[++i]); continue; }
    if (arg === "--out") { args.out = argv[++i]; continue; }
    if (arg === "--scored-out") { args.scoredOut = argv[++i]; continue; }
    if (arg === "--chart-out") { args.chartOut = argv[++i]; continue; }
    if (arg === "--limit") { args.limit = Number.parseInt(argv[++i], 10) || 0; continue; }
    if (arg === "--ollama-url") { args.ollamaUrl = argv[++i].replace(/\/$/, ""); continue; }
    if (arg === "--no-score") { args.score = false; continue; }
    if (arg === "--help" || arg === "-h") { usage(); process.exit(0); }
  }

  if (args.providers.length === 0) {
    args.providers = [`file://${path.join(REPO_ROOT, "examples", "promptfoo-aligned-provider.mjs").replaceAll("\\", "/")}`, "echo"];
  }
  return args;
}

function promptFor(systemPrompt, userPrompt) {
  return `${systemPrompt.trim()}\n\nUser request:\n${userPrompt}`;
}

function rowsFromCases(cases, limit) {
  const rows = [];
  for (const [preferenceId, prompts] of Object.entries(cases)) {
    const selected = limit > 0 ? prompts.slice(0, limit) : prompts;
    for (const userPrompt of selected) {
      rows.push({ preferenceId, userPrompt });
    }
  }
  return rows;
}

function ollamaModel(providerId) {
  if (providerId.startsWith("ollama:chat:")) return providerId.slice("ollama:chat:".length);
  if (providerId.startsWith("ollama:")) return providerId.slice("ollama:".length);
  return "";
}

async function callOllama(providerId, fullPrompt, args) {
  const model = ollamaModel(providerId);
  const response = await fetch(`${args.ollamaUrl}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model,
      stream: false,
      options: { temperature: 0 },
      messages: [
        { role: "user", content: fullPrompt },
      ],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Ollama ${model} failed: ${response.status} ${text}`);
  }

  const payload = await response.json();
  return payload.message?.content || payload.response || "";
}

async function callFileProvider(providerId, fullPrompt, context) {
  const filePath = providerId.replace(/^file:\/\//, "");
  const resolved = path.resolve(process.cwd(), filePath);
  const module = await import(pathToFileURL(resolved).href);
  const Provider = module.default;
  const provider = typeof Provider === "function" ? new Provider() : Provider;
  const response = await provider.callApi(fullPrompt, context);
  return response?.output || response?.text || "";
}

async function callProvider(providerId, fullPrompt, context, args) {
  if (providerId === "echo") return fullPrompt;
  if (providerId.startsWith("file://")) return callFileProvider(providerId, fullPrompt, context);
  if (providerId.startsWith("ollama:")) return callOllama(providerId, fullPrompt, args);
  throw new Error(`Unsupported provider "${providerId}". Use ollama:chat:<model>, ollama:<model>, file://..., or echo.`);
}

function writeJson(filePath, payload) {
  const outPath = path.resolve(process.cwd(), filePath);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2) + "\n", "utf8");
  return outPath;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const cases = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), args.caseFile), "utf8"));
  const systemPrompt = fs.readFileSync(path.resolve(process.cwd(), args.promptFile), "utf8");
  const caseRows = rowsFromCases(cases, args.limit);
  const results = [];

  for (const provider of args.providers) {
    for (const row of caseRows) {
      const fullPrompt = promptFor(systemPrompt, row.userPrompt);
      const context = {
        vars: {
          preference_id: row.preferenceId,
          user_prompt: row.userPrompt,
        },
      };
      const output = await callProvider(provider, fullPrompt, context, args);
      results.push({
        provider,
        preference_id: row.preferenceId,
        user_prompt: row.userPrompt,
        output,
      });
    }
  }

  const answersPath = writeJson(args.out, {
    metadata: {
      evaluation_mode: "local subject model answers",
      source: "run-local-subjects.mjs",
      providers: args.providers,
    },
    results,
  });
  console.log("");
  console.log("VibeForge · local subject run");
  console.log("─".repeat(56));
  console.log(`✓ Captured answers: ${answersPath}`);
  console.log(`  Rows: ${results.length}`);
  console.log(`  Providers: ${args.providers.join(", ")}`);

  if (!args.score) {
    console.log("  Next: score + chart with score-answers.mjs / chart-results.mjs");
    console.log("");
    return;
  }

  scoreAnswersFile({ input: args.out, out: args.scoredOut });
  chartResultsFile({ input: args.scoredOut, out: args.chartOut });
  console.log("  Trust: preference-fit on these answers only — not an IQ leaderboard.");
  console.log("");
}

main().catch(error => {
  console.error(`VibeForge error (local subjects): ${error.message}`);
  process.exit(1);
});
