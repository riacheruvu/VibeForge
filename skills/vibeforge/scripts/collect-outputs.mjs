import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const DEFAULT_SYSTEM_PROMPT = "You are a helpful assistant.";
const LLAMACPP_API_URL = (process.env.VIBEFORGE_LLAMACPP_URL?.trim() || "http://localhost:8080").replace(/\/$/, "");
const LLAMACPP_API_KEY = process.env.VIBEFORGE_LLAMACPP_API_KEY?.trim();
const USER_PROMPT_PREFIX = process.env.VIBEFORGE_NO_THINK === "1" ? "/no_think " : "";

function parseArgs(argv) {
  const args = {
    profile: "preferences.yaml",
    caseFile: null,
    promptFile: null,
    prompt: null,
    cases: 1,
    model: process.env.VIBEFORGE_MODEL || "local-model",
    output: null,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--profile") { args.profile = argv[++i]; continue; }
    if (arg === "--case-file") { args.caseFile = argv[++i]; continue; }
    if (arg === "--prompt-file") { args.promptFile = argv[++i]; continue; }
    if (arg === "--prompt") { args.prompt = argv[++i]; continue; }
    if (arg === "--cases") { args.cases = Number.parseInt(argv[++i], 10) || 1; continue; }
    if (arg === "--model") { args.model = argv[++i]; continue; }
    if (arg === "--output") { args.output = argv[++i]; continue; }
    if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }
  }

  if (!args.caseFile) throw new Error("Missing --case-file.");
  if (args.promptFile) {
    args.prompt = fs.readFileSync(path.resolve(process.cwd(), args.promptFile), "utf8").trim();
  }
  if (!args.prompt) args.prompt = DEFAULT_SYSTEM_PROMPT;
  return args;
}

function printHelp() {
  console.log(`Collect model outputs without judging

Usage:
  node skills/vibeforge/scripts/collect-outputs.mjs --profile examples/public-agent-profile.yaml --case-file examples/public-agent-cases.json --prompt-file examples/public-agent-system-prompt.txt --cases 1 --output reports/local-outputs.json`);
}

function stripYamlScalar(value) {
  return String(value || "").trim().replace(/^['"]|['"]$/g, "").trim();
}

function extractBlockScalar(text, key) {
  const match = text.match(new RegExp(`^\\s*${key}:\\s*>\\s*\\n([\\s\\S]*?)(?=^\\s{4}\\w|^\\s{2}-\\s+\\w|^\\w|\\Z)`, "m"));
  if (!match) return "";
  return match[1].split("\n").map(line => line.trim()).filter(Boolean).join(" ");
}

function parseProfile(text) {
  const prefSectionMatch = text.match(/^preferences:\s*\n([\s\S]*)$/m);
  if (!prefSectionMatch) return [];
  return prefSectionMatch[1]
    .split(/\n(?=\s{2}-\s+id:\s*)/g)
    .map(block => block.trimEnd())
    .filter(block => /^\s*-\s+id:\s*/.test(block))
    .map(block => {
      const get = (key, fallback = "") => {
        const pattern = key === "id" ? `^\\s*-\\s+id:\\s*(.+)$` : `^\\s{4}${key}:\\s*(.+)$`;
        const match = block.match(new RegExp(pattern, "m"));
        return match ? stripYamlScalar(match[1]) : fallback;
      };
      return {
        id: get("id"),
        type: get("type"),
        weight: Number.parseFloat(get("weight", "1")) || 1,
        description: extractBlockScalar(block, "description") || get("description"),
      };
    });
}

function chatCompletionsUrl(baseUrl) {
  const base = baseUrl.replace(/\/$/, "");
  return base.endsWith("/v1") ? `${base}/chat/completions` : `${base}/v1/chat/completions`;
}

async function llmCall({ model, system, userPrompt, maxTokens = 500 }) {
  const response = await fetch(chatCompletionsUrl(LLAMACPP_API_URL), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(LLAMACPP_API_KEY ? { authorization: `Bearer ${LLAMACPP_API_KEY}` } : {}),
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      temperature: 0,
      messages: [
        { role: "system", content: system },
        { role: "user", content: `${USER_PROMPT_PREFIX}${userPrompt}` },
      ],
    }),
  });

  if (!response.ok) throw new Error(`llama.cpp error ${response.status}: ${await response.text()}`);
  const payload = await response.json();
  const message = payload.choices?.[0]?.message || {};
  return message.content?.trim() || message.reasoning_content?.trim() || "";
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const profileText = fs.readFileSync(path.resolve(process.cwd(), args.profile), "utf8");
  const preferences = parseProfile(profileText);
  const caseBank = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), args.caseFile), "utf8"));
  const results = [];

  for (const preference of preferences) {
    const prompts = [...new Set([
      ...(caseBank[preference.id] || []),
      ...(caseBank[preference.type] || []),
      ...(caseBank["*"] || []),
    ])].slice(0, args.cases);

    for (const prompt of prompts) {
      process.stderr.write(`Running ${preference.id}: ${prompt.slice(0, 60)}...\n`);
      const output = await llmCall({
        model: args.model,
        system: args.prompt,
        userPrompt: prompt,
      });
      results.push({ preference, prompt, output });
    }
  }

  const report = {
    model: args.model,
    profile: args.profile,
    caseFile: args.caseFile,
    prompt: args.prompt,
    results,
  };

  if (args.output) {
    const outputPath = path.resolve(process.cwd(), args.output);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    console.log(outputPath);
  } else {
    console.log(JSON.stringify(report, null, 2));
  }
}

main().catch(error => {
  console.error(`Collect outputs error: ${error.message}`);
  process.exit(1);
});
