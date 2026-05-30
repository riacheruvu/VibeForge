#!/usr/bin/env node
/**
 * Export an VibeCheckBench preference profile to a Promptfoo regression suite.
 *
 * This keeps VibeCheckBench focused on preference/case authoring and lets
 * Promptfoo handle provider execution, UI, reporting, and CI.
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../../..");

const DEFAULT_PROFILE_PATH = path.join(REPO_ROOT, "preferences.yaml");
const DEFAULT_CASE_FILE = path.join(REPO_ROOT, "examples", "public-agent-cases.json");
const DEFAULT_PROMPT_FILE = path.join(REPO_ROOT, "examples", "public-agent-system-prompt.txt");

function usage() {
  console.log(`VibeCheckBench Promptfoo exporter

Usage:
  node skills/vibecheckbench/scripts/export-promptfoo.mjs --out promptfooconfig.yaml

Options:
  --profile <path>      Preference YAML file
  --case-file <path>    JSON object mapping preference id to test prompts
  --prompt-file <path>  System prompt to test
  --provider <id>       Promptfoo provider id (default: openai:chat:gpt-4.1-mini)
  --out <path>          Output promptfooconfig.yaml path
  --threshold <n>       JavaScript assertion pass threshold (default: 0.5)

Example:
  node skills/vibecheckbench/scripts/export-promptfoo.mjs \\
    --profile examples/literature-backed-user-preferences.yaml \\
    --case-file examples/literature-backed-user-cases.json \\
    --prompt-file examples/complex-use-case-system-prompt.txt \\
    --provider openai:chat:gpt-4.1-mini \\
    --out promptfooconfig.yaml

Then run:
  npx promptfoo@latest eval -c promptfooconfig.yaml`);
}

function parseArgs(argv) {
  const args = {
    profilePath: DEFAULT_PROFILE_PATH,
    caseFile: DEFAULT_CASE_FILE,
    promptFile: DEFAULT_PROMPT_FILE,
    provider: "openai:chat:gpt-4.1-mini",
    out: "promptfooconfig.yaml",
    threshold: 0.5,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--profile") { args.profilePath = argv[++i]; continue; }
    if (arg === "--case-file") { args.caseFile = argv[++i]; continue; }
    if (arg === "--prompt-file") { args.promptFile = argv[++i]; continue; }
    if (arg === "--provider") { args.provider = argv[++i]; continue; }
    if (arg === "--out") { args.out = argv[++i]; continue; }
    if (arg === "--threshold") { args.threshold = Number.parseFloat(argv[++i]); continue; }
    if (arg === "--help" || arg === "-h") { usage(); process.exit(0); }
  }

  if (!Number.isFinite(args.threshold)) args.threshold = 0.5;
  return args;
}

function stripYamlScalar(value) {
  return String(value || "")
    .trim()
    .replace(/^['"]|['"]$/g, "")
    .trim();
}

function extractBlockScalar(text, key) {
  const match = text.match(new RegExp(`^\\s*${key}:\\s*>\\s*\\n([\\s\\S]*?)(?=^\\s{4}\\w|^\\s{2}-\\s+\\w|^\\w|\\Z)`, "m"));
  if (!match) return "";
  return match[1]
    .split("\n")
    .map(line => line.trim())
    .filter(Boolean)
    .join(" ");
}

function parseProfile(text) {
  const profile = { name: "", version: "" };
  const nameMatch = text.match(/^\s{2}name:\s*(.+)$/m);
  const versionMatch = text.match(/^\s{2}version:\s*(.+)$/m);
  if (nameMatch) profile.name = stripYamlScalar(nameMatch[1]);
  if (versionMatch) profile.version = stripYamlScalar(versionMatch[1]);

  const prefSectionMatch = text.match(/^preferences:\s*\n([\s\S]*)$/m);
  if (!prefSectionMatch) return { profile, preferences: [] };

  const preferenceBlocks = prefSectionMatch[1]
    .split(/\n(?=\s{2}-\s+id:\s*)/g)
    .map(block => block.trimEnd())
    .filter(block => /^\s*-\s+id:\s*/.test(block));

  const preferences = preferenceBlocks.map(block => {
    const get = (key, fallback = "") => {
      const pattern = key === "id" ? `^\\s*-\\s+id:\\s*(.+)$` : `^\\s{4}${key}:\\s*(.+)$`;
      const match = block.match(new RegExp(pattern, "m"));
      return match ? stripYamlScalar(match[1]) : fallback;
    };

    return {
      id: get("id"),
      type: get("type"),
      weight: Number.parseFloat(get("weight", "1.0")) || 1.0,
      description: extractBlockScalar(block, "description") || get("description"),
    };
  }).filter(pref => pref.id && pref.type);

  return { profile, preferences };
}

function yamlBlock(text, indent = 4) {
  const spaces = " ".repeat(indent);
  const normalized = String(text || "").replace(/\r\n/g, "\n").trimEnd();
  if (!normalized) return `${spaces}`;
  return normalized.split("\n").map(line => `${spaces}${line}`).join("\n");
}

function yamlQuote(text) {
  return JSON.stringify(String(text));
}

function assertionFor(preference) {
  const type = preference.type;
  const id = preference.id;
  const rejectEchoedPrompt = `if (/user request:/i.test(output) || /you are a concise, high-integrity/i.test(output)) return 0;
`;

  if (type === "factuality") {
    return `${rejectEchoedPrompt}const text = output.toLowerCase();
let score = 0;
if (/uncertain|assumption|verify|evidence|source|not prove|not enough|cannot confirm/.test(text)) score += 0.35;
if (/fact|inference|guess|known|unknown|claim/.test(text)) score += 0.25;
if (!/definitely|obviously|guaranteed|proves|confidently cite/.test(text)) score += 0.2;
if (/next test|check|compare|measure|look up|validate/.test(text)) score += 0.2;
return Math.min(1, score);`;
  }

  if (type === "pushback") {
    return `${rejectEchoedPrompt}const text = output.toLowerCase();
let score = 0;
if (/i would not|not yet|i disagree|that does not follow|weak|risk|overclaim|too speculative/.test(text)) score += 0.4;
if (/because|evidence|constraint|failure mode|tradeoff|boundary/.test(text)) score += 0.25;
if (/next step|smaller test|validate|bounded|safe|criteria/.test(text)) score += 0.25;
if (!/absolutely|great idea|you're right|breakthrough|compelling leaderboard/.test(text)) score += 0.1;
return Math.min(1, score);`;
  }

  if (type === "initiative") {
    return `${rejectEchoedPrompt}const text = output.toLowerCase();
let score = 0;
if (/criteria|tradeoff|decision|option|priority/.test(text)) score += 0.3;
if (/would change|uncertainty|evidence|confidence|assumption/.test(text)) score += 0.3;
if (/next test|next step|reduce uncertainty|measure|compare/.test(text)) score += 0.3;
if (!/just do it|obviously|definitely/.test(text)) score += 0.1;
return Math.min(1, score);`;
  }

  return `${rejectEchoedPrompt}const text = output.toLowerCase();
let score = 0;
if (!/great question|great idea|absolutely|exciting|breakthrough|you're right/.test(text)) score += 0.35;
if (/not claim|not prove|weak|risk|overclaim|critique|however|but/.test(text)) score += 0.3;
if (output.length < 900) score += 0.2;
if (/criteria|next test|evidence|specific/.test(text)) score += 0.15;
return Math.min(1, score);`;
}

function buildConfig({ profile, preferences, cases, prompt, provider, threshold }) {
  const tests = [];

  for (const preference of preferences) {
    const prompts = cases[preference.id] || [];
    if (!Array.isArray(prompts) || prompts.length === 0) continue;
    prompts.forEach((userPrompt, index) => {
      tests.push([
        `  - description: ${yamlQuote(`${preference.id} ${index + 1}`)}`,
        "    vars:",
        `      user_prompt: ${yamlQuote(userPrompt)}`,
        `      preference_id: ${yamlQuote(preference.id)}`,
        `      preference_type: ${yamlQuote(preference.type)}`,
        "    assert:",
        "      - type: javascript",
        `        metric: ${yamlQuote(preference.id)}`,
        `        threshold: ${threshold}`,
        "        value: |",
        yamlBlock(assertionFor(preference), 10),
      ].join("\n"));
    });
  }

  return [
    "# yaml-language-server: $schema=https://promptfoo.dev/config-schema.json",
    `description: ${yamlQuote(`VibeCheckBench regression suite: ${profile.name || "profile"}`)}`,
    "",
    "prompts:",
    "  - |",
    yamlBlock(`${prompt}\n\nUser request:\n{{user_prompt}}`, 4),
    "",
    "providers:",
    `  - id: ${yamlQuote(provider)}`,
    "    config:",
    "      temperature: 0",
    "",
    "tests:",
    tests.length ? tests.join("\n") : "  []",
    "",
  ].join("\n");
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const profileText = fs.readFileSync(path.resolve(process.cwd(), args.profilePath), "utf8");
  const { profile, preferences } = parseProfile(profileText);
  const cases = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), args.caseFile), "utf8"));
  const prompt = fs.readFileSync(path.resolve(process.cwd(), args.promptFile), "utf8").trim();

  if (preferences.length === 0) {
    throw new Error(`No preferences found in ${args.profilePath}`);
  }

  const config = buildConfig({
    profile,
    preferences,
    cases,
    prompt,
    provider: args.provider,
    threshold: args.threshold,
  });

  const outPath = path.resolve(process.cwd(), args.out);
  fs.writeFileSync(outPath, config, "utf8");
  console.log(`Wrote Promptfoo config: ${outPath}`);
  console.log(`Tests: ${Object.values(cases).reduce((sum, prompts) => sum + (Array.isArray(prompts) ? prompts.length : 0), 0)}`);
  console.log("Run: npx promptfoo@latest eval -c " + path.basename(outPath));
}

try {
  main();
} catch (error) {
  console.error(`Promptfoo export error: ${error.message}`);
  process.exit(1);
}
