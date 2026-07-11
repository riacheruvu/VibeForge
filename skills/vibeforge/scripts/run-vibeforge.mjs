import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const DEFAULT_OPENAI_MODEL = "gpt-4.1-mini";
const DEFAULT_ANTHROPIC_MODEL = "claude-sonnet-4-20250514";
const DEFAULT_LOCAL_MODEL = "HuggingFaceTB/SmolLM2-135M-Instruct";
const DEFAULT_TEST_CASES = clampInteger(process.env.VIBEFORGE_NUM_CASES, 10, 1, 20);
const DEFAULT_SYSTEM_PROMPT = "You are a helpful assistant.";
const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const LLAMACPP_API_URL = (process.env.VIBEFORGE_LLAMACPP_URL?.trim() || "http://localhost:8080").replace(/\/$/, "");
const LLAMACPP_API_KEY = process.env.VIBEFORGE_LLAMACPP_API_KEY?.trim();
const USER_PROMPT_PREFIX = process.env.VIBEFORGE_NO_THINK === "1" ? "/no_think " : "";
const LOCAL_SCRIPT_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "run-vibeforge-local.py",
);

function clampInteger(value, fallback, min, max) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, parsed));
}

function chatCompletionsUrl(baseUrl) {
  const base = baseUrl.replace(/\/$/, "");
  return base.endsWith("/v1") ? `${base}/chat/completions` : `${base}/v1/chat/completions`;
}

function parseArgs(argv) {
  const args = {
    intent: "",
    prompt: null,
    promptFile: null,
    model: process.env.VIBEFORGE_MODEL || null,
    testCases: DEFAULT_TEST_CASES,
    json: false,
  };
  const positional = [];

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--intent") {
      args.intent = argv[index + 1] || "";
      index += 1;
      continue;
    }

    if (arg === "--prompt") {
      args.prompt = argv[index + 1] || "";
      index += 1;
      continue;
    }

    if (arg === "--prompt-file") {
      args.promptFile = argv[index + 1] || "";
      index += 1;
      continue;
    }

    if (arg === "--model") {
      args.model = argv[index + 1] || process.env.VIBEFORGE_MODEL || null;
      index += 1;
      continue;
    }

    if (arg === "--cases") {
      args.testCases = clampInteger(argv[index + 1], DEFAULT_TEST_CASES, 1, 20);
      index += 1;
      continue;
    }

    if (arg === "--json") {
      args.json = true;
      continue;
    }

    if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }

    positional.push(arg);
  }

  if (!args.intent && positional.length > 0) {
    args.intent = positional.join(" ");
  }

  if (args.prompt && args.promptFile) {
    throw new Error("Use either --prompt or --prompt-file, not both.");
  }

  if (args.promptFile) {
    const promptPath = path.resolve(process.cwd(), args.promptFile);
    args.prompt = fs.readFileSync(promptPath, "utf8").trim();
  }

  if (!args.intent.trim()) {
    throw new Error('Missing benchmark intent. Use --intent "...".');
  }

  return args;
}

function printHelp() {
  console.log(`VibeForge

Usage:
  node scripts/run-vibeforge.mjs --intent "warm email replies"
  node scripts/run-vibeforge.mjs --intent "patient coding help" --prompt-file prompt.txt

Options:
  --intent <text>       Benchmark target behavior
  --prompt <text>       Custom system prompt for config B
  --prompt-file <path>  Read the custom system prompt from a file
  --cases <n>           Number of generated tests (1-20)
  --model <name>        Model override
  --json                Print the raw report as JSON
  --help                Show this help`);
}

function resolveProvider(modelOverride = null) {
  const explicitProvider = (process.env.VIBEFORGE_PROVIDER || "").trim().toLowerCase();
  const openAiKey = process.env.OPENAI_API_KEY?.trim();
  const anthropicKey = process.env.ANTHROPIC_API_KEY?.trim();
  const localModel = process.env.VIBEFORGE_LOCAL_MODEL?.trim() || DEFAULT_LOCAL_MODEL;

  if (explicitProvider === "local") {
    return {
      name: "local",
      apiKey: null,
      model: modelOverride || process.env.VIBEFORGE_MODEL || localModel,
    };
  }

  if (explicitProvider === "llamacpp") {
    return {
      name: "llamacpp",
      apiKey: null,
      model: modelOverride || process.env.VIBEFORGE_MODEL || "local-model",
    };
  }

  if (openAiKey) {
    return {
      name: "openai",
      apiKey: openAiKey,
      model: modelOverride || process.env.VIBEFORGE_MODEL || DEFAULT_OPENAI_MODEL,
    };
  }

  if (anthropicKey) {
    return {
      name: "anthropic",
      apiKey: anthropicKey,
      model: modelOverride || process.env.VIBEFORGE_MODEL || DEFAULT_ANTHROPIC_MODEL,
    };
  }

  return {
    name: "local",
    apiKey: null,
    model: modelOverride || process.env.VIBEFORGE_MODEL || localModel,
  };
}

function buildPythonArgs(userIntent, configBSystemPrompt, options = {}) {
  const args = [LOCAL_SCRIPT_PATH, "--intent", userIntent, "--json"];

  if (configBSystemPrompt) {
    args.push("--prompt", configBSystemPrompt);
  }

  if (options.model) {
    args.push("--model", options.model);
  }

  if (options.testCases) {
    args.push("--cases", String(options.testCases));
  }

  return args;
}

async function runLocalVibeForge(userIntent, configBSystemPrompt = null, options = {}) {
  const args = buildPythonArgs(userIntent, configBSystemPrompt, options);

  return new Promise((resolve, reject) => {
    const child = spawn("python3", args, {
      cwd: process.cwd(),
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });

    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });

    child.on("error", (error) => {
      reject(new Error(`Failed to start local benchmark runner: ${error.message}`));
    });

    child.on("close", (code) => {
      if (code !== 0) {
        const message = stderr.trim() || stdout.trim() || `Python runner exited with code ${code}.`;
        reject(new Error(message));
        return;
      }

      try {
        resolve(JSON.parse(stdout));
      } catch (error) {
        reject(new Error(`Failed to parse local benchmark JSON: ${error.message}`));
      }
    });
  });
}

async function anthropicMessage({ provider, system, userPrompt, maxTokens }) {
  const finalUserPrompt = `${USER_PROMPT_PREFIX}${userPrompt}`;
  if (provider.name === "openai") {
    const response = await fetch(OPENAI_API_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${provider.apiKey}`,
      },
      body: JSON.stringify({
        model: provider.model,
        max_completion_tokens: maxTokens,
        messages: [
          { role: "system", content: system },
          { role: "user", content: finalUserPrompt },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API error ${response.status}: ${errorText}`);
    }

    const payload = await response.json();
    const text = payload.choices?.[0]?.message?.content?.trim();

    if (!text) {
      throw new Error("Model response did not include text content.");
    }

    return text;
  }

  if (provider.name === "llamacpp") {
    const response = await fetch(chatCompletionsUrl(LLAMACPP_API_URL), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(LLAMACPP_API_KEY ? { authorization: `Bearer ${LLAMACPP_API_KEY}` } : {}),
      },
      body: JSON.stringify({
        model: provider.model,
        max_tokens: maxTokens,
        temperature: 0,
        messages: [
          { role: "system", content: system },
          { role: "user", content: finalUserPrompt },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`llama.cpp server error ${response.status}: ${errorText}`);
    }

    const payload = await response.json();
    const message = payload.choices?.[0]?.message || {};
    const text = message.content?.trim() || message.reasoning_content?.trim();

    if (!text) {
      throw new Error("llama.cpp server response did not include text content.");
    }

    return text;
  }

  const response = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": provider.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: provider.model,
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: finalUserPrompt }],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Anthropic API error ${response.status}: ${errorText}`);
  }

  const payload = await response.json();
  const text = (payload.content || [])
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();

  if (!text) {
    throw new Error("Model response did not include text content.");
  }

  return text;
}

function parseJsonPayload(rawText, expectedLabel) {
  const text = rawText.trim();

  try {
    return JSON.parse(text);
  } catch {
    const arrayMatch = text.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      return JSON.parse(arrayMatch[0]);
    }

    const objectMatch = text.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      return JSON.parse(objectMatch[0]);
    }
  }

  throw new Error(`Failed to parse ${expectedLabel} JSON.`);
}

async function generateTestCases(userIntent, provider, testCases) {
  const raw = await anthropicMessage({
    provider,
    maxTokens: 1600,
    system: `You are an AI evaluation expert.
Generate realistic and discriminating prompts for a personal benchmark.

Rules:
- Generate exactly ${testCases} prompts
- Each prompt should feel like a real user request
- Vary style, context, and complexity
- Return only a JSON array of strings`,
    userPrompt: `Generate ${testCases} test prompts to evaluate this user preference:
"${userIntent}"`,
  });

  const parsed = parseJsonPayload(raw, "test case");
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error("The generated test cases were empty.");
  }

  return parsed.slice(0, testCases).map((item) => String(item).trim()).filter(Boolean);
}

async function runPrompt(provider, prompt, systemPrompt) {
  return anthropicMessage({
    provider,
    maxTokens: 700,
    system: systemPrompt || DEFAULT_SYSTEM_PROMPT,
    userPrompt: prompt,
  });
}

async function scoreOutputs(provider, prompt, outputA, outputB, userIntent) {
  const swap = Math.random() >= 0.5;
  const left = swap ? outputB : outputA;
  const right = swap ? outputA : outputB;

  const raw = await anthropicMessage({
    provider,
    maxTokens: 350,
    system: `You are a strict, impartial evaluator.
Judge only against the stated user preference.
Return only valid JSON.`,
    userPrompt: `User preference: "${userIntent}"

Prompt:
${prompt}

Response A:
${left}

Response B:
${right}

Return JSON in this shape:
{"winner":"A"|"B"|"tie","reason":"one short sentence"}`,
  });

  const parsed = parseJsonPayload(raw, "score");
  const externalWinner = parsed?.winner;
  const reason = typeof parsed?.reason === "string" ? parsed.reason.trim() : "No reason provided.";

  if (externalWinner === "tie") {
    return { winner: "tie", reason };
  }

  if (externalWinner !== "A" && externalWinner !== "B") {
    return { winner: "tie", reason: "Judge returned an invalid winner." };
  }

  const internalWinner =
    (externalWinner === "A" && !swap) || (externalWinner === "B" && swap) ? "A" : "B";

  return { winner: internalWinner, reason };
}

async function analyzeLosses(provider, losses, userIntent, configBPrompt) {
  if (losses.length === 0) {
    return null;
  }

  return anthropicMessage({
    provider,
    maxTokens: 450,
    system: `You are an AI prompt engineering expert.
Analyze why a system prompt underperformed.
Be concise and actionable.`,
    userPrompt: `User preference: "${userIntent}"

Current system prompt:
"${configBPrompt}"

Cases where config B lost:
${losses.map((loss, index) => `${index + 1}. Prompt: ${loss.prompt}\nReason: ${loss.reason}`).join("\n\n")}

Write 2-3 sentences describing the main weaknesses.`,
  });
}

async function generateImprovedPrompt(provider, userIntent, configBPrompt, weaknessAnalysis) {
  return anthropicMessage({
    provider,
    maxTokens: 500,
    system: `You are an expert prompt engineer.
Rewrite the system prompt so it better matches the user preference.
Return only the improved prompt text.`,
    userPrompt: `User preference: "${userIntent}"

Current system prompt:
"${configBPrompt}"

Weakness analysis:
${weaknessAnalysis}`,
  });
}

export async function runVibeForge(userIntent, configBSystemPrompt = null, options = {}) {
  const provider = resolveProvider(options.model);

  if (provider.name === "local" || provider.name === "llamacpp-python") {
    return runLocalVibeForge(userIntent, configBSystemPrompt, {
      ...options,
      model: provider.model,
    });
  }

  const model = provider.model;
  const testCasesToGenerate = clampInteger(options.testCases, DEFAULT_TEST_CASES, 1, 20);
  const configB =
    configBSystemPrompt ||
    `You are a helpful AI assistant. Prioritize this user preference: ${userIntent}.`;
  const startTime = Date.now();

  const testCases = await generateTestCases(userIntent, provider, testCasesToGenerate);
  const wins = { A: 0, B: 0, tie: 0 };
  const results = [];
  const losses = [];

  for (let index = 0; index < testCases.length; index += 1) {
    const prompt = testCases[index];
    const [outputA, outputB] = await Promise.all([
      runPrompt(provider, prompt, DEFAULT_SYSTEM_PROMPT),
      runPrompt(provider, prompt, configB),
    ]);
    const score = await scoreOutputs(provider, prompt, outputA, outputB, userIntent);

    if (!Object.prototype.hasOwnProperty.call(wins, score.winner)) {
      score.winner = "tie";
    }

    wins[score.winner] += 1;
    results.push({ prompt, outputA, outputB, score });

    if (score.winner === "A") {
      losses.push({ prompt, reason: score.reason, outputA, outputB });
    }
  }

  const weaknessAnalysis = await analyzeLosses(provider, losses, userIntent, configB);
  const improvedPrompt = weaknessAnalysis
    ? await generateImprovedPrompt(provider, userIntent, configB, weaknessAnalysis)
    : null;
  const durationSeconds = ((Date.now() - startTime) / 1000).toFixed(1);
  const winRate = ((wins.B / testCases.length) * 100).toFixed(0);
  const verdict =
    wins.B > wins.A
      ? "Config B performed better."
      : wins.A > wins.B
        ? "The default assistant performed better."
        : "The benchmark ended in a tie.";

  return {
    intent: userIntent,
    provider: provider.name,
    model,
    testCaseCount: testCases.length,
    scores: wins,
    winRate: `${winRate}%`,
    verdict,
    configBPrompt: configB,
    weaknesses: weaknessAnalysis,
    improvedPrompt,
    duration: `${durationSeconds}s`,
    testCases: results,
  };
}

export function formatReport(report) {
  const lines = [
    "VibeForge Results",
    "================",
    `Intent: ${report.intent}`,
    `Provider: ${report.provider}`,
    `Model: ${report.model}`,
    `Cases: ${report.testCaseCount}`,
    "",
    "Scores",
    `- Config B wins: ${report.scores.B}`,
    `- Config A wins: ${report.scores.A}`,
    `- Ties: ${report.scores.tie}`,
    `- Win rate: ${report.winRate}`,
    "",
    `Verdict: ${report.verdict}`,
  ];

  if (report.weaknesses) {
    lines.push("");
    lines.push("Weaknesses");
    lines.push(report.weaknesses);
  }

  if (report.improvedPrompt) {
    lines.push("");
    lines.push("Suggested prompt");
    lines.push(report.improvedPrompt);
  }

  lines.push("");
  lines.push(`Completed in ${report.duration}`);
  return lines.join("\n");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const report = await runVibeForge(args.intent, args.prompt, {
    model: args.model,
    testCases: args.testCases,
  });

  if (args.json) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log(formatReport(report));
}

const isMainModule =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url));

if (isMainModule) {
  main().catch((error) => {
    console.error(`VibeForge error: ${error.message}`);
    process.exit(1);
  });
}
