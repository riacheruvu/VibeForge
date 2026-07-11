#!/usr/bin/env node
/**
 * VibeForge unified fit eval (model side).
 *
 * One path for the skill:
 *   fit-review cases → subject model(s) → deterministic score → chart
 *
 * Judge: deterministic JS by default (no judge model, no key).
 * Subjects: mock (no key) | ollama (local) | openai | anthropic.
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { scoreAnswersFile } from "./score-answers.mjs";
import { chartResultsFile } from "./chart-results.mjs";
import { banner, done, fail, helpHeader, rel, skillSay } from "./cli-ux.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../../..");
const DEFAULT_OPENAI = "gpt-4.1-mini";
const DEFAULT_ANTHROPIC = "claude-sonnet-4-20250514";
const DEFAULT_SYSTEM = "You are a helpful assistant. Be concise and honest. Do not flatter or rubber-stamp weak claims.";

function usage() {
  helpHeader(
    "fit eval (model side)",
    "Run subject model(s) on fit-review cases, score with deterministic rubrics, chart fit.",
  );
  console.log(`Primary UX — ask the skill:
  Use VibeForge. Run a fit eval on my dual-case pack (mock smoke).
  Use VibeForge. Run a fit eval with Ollama on vibecheckbench-out.
  Use VibeForge. Run a fit eval with OpenAI (I approve using OPENAI_API_KEY).

Implementation:
  node skills/vibecheckbench/scripts/run-fit-eval.mjs --fit-review vibecheckbench-out --mode mock
  node skills/vibecheckbench/scripts/run-fit-eval.mjs --fit-review vibecheckbench-out --mode ollama
  node skills/vibecheckbench/scripts/run-fit-eval.mjs --fit-review vibecheckbench-out --mode openai

Options:
  --fit-review <dir>     Fit-review folder (reads eval-cases.json)
  --cases <path>         eval-cases.json path (alternative to --fit-review)
  --mode <name>          mock | auto | ollama | openai | anthropic  (default: auto)
  --provider <id>        Repeatable override (ollama:chat:…, openai:…, anthropic:…, echo, file://…)
  --system <text>        Single system prompt for all subjects
  --system-file <path>   System prompt file
  --baseline-system <p>  Label baseline setup (file path or raw text if short)
  --candidate-system <p> Label candidate setup (file path or text)
  --out-dir <dir>        Output directory (default: <fit-review>/eval or reports/fit-eval)
  --ollama-url <url>     Default http://127.0.0.1:11434
  --ollama-model <name>  Default: first installed, else qwen3:0.6b
  --limit <n>            Max cases (smoke)
  --no-chart             Skip HTML chart
  --help

Judge: always deterministic JS on this path (no judge model / no judge key).
Hosted modes require OPENAI_API_KEY or ANTHROPIC_API_KEY. Ask the user before using them.
`);
}

function parseArgs(argv) {
  const args = {
    fitReview: "",
    cases: "",
    mode: "auto",
    providers: [],
    system: "",
    systemFile: "",
    baselineSystem: "",
    candidateSystem: "",
    outDir: "",
    ollamaUrl: "http://127.0.0.1:11434",
    ollamaModel: "",
    limit: 0,
    chart: true,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--fit-review") args.fitReview = argv[++i] || "";
    else if (arg === "--cases") args.cases = argv[++i] || "";
    else if (arg === "--mode") args.mode = (argv[++i] || "auto").toLowerCase();
    else if (arg === "--provider") args.providers.push(argv[++i] || "");
    else if (arg === "--system") args.system = argv[++i] || "";
    else if (arg === "--system-file") args.systemFile = argv[++i] || "";
    else if (arg === "--baseline-system") args.baselineSystem = argv[++i] || "";
    else if (arg === "--candidate-system") args.candidateSystem = argv[++i] || "";
    else if (arg === "--out-dir") args.outDir = argv[++i] || "";
    else if (arg === "--ollama-url") args.ollamaUrl = (argv[++i] || "").replace(/\/$/, "");
    else if (arg === "--ollama-model") args.ollamaModel = argv[++i] || "";
    else if (arg === "--limit") args.limit = Number.parseInt(argv[++i], 10) || 0;
    else if (arg === "--no-chart") args.chart = false;
    else if (arg === "--help" || arg === "-h") {
      usage();
      process.exit(0);
    } else if (arg.startsWith("--")) throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function readTextMaybeFile(value) {
  if (!value) return "";
  const asPath = path.resolve(process.cwd(), value);
  if (fs.existsSync(asPath) && fs.statSync(asPath).isFile()) {
    return fs.readFileSync(asPath, "utf8").trim();
  }
  return String(value).trim();
}

function loadCases(args) {
  let casesPath = args.cases;
  if (!casesPath && args.fitReview) {
    casesPath = path.join(args.fitReview, "eval-cases.json");
  }
  if (!casesPath) {
    throw new Error("Provide --fit-review <dir> or --cases <eval-cases.json>.");
  }
  const resolved = path.resolve(process.cwd(), casesPath);
  if (!fs.existsSync(resolved)) throw new Error(`Cases not found: ${resolved}`);
  const payload = JSON.parse(fs.readFileSync(resolved, "utf8"));
  let cases = Array.isArray(payload.cases) ? payload.cases : Array.isArray(payload) ? payload : [];
  if (!cases.length) throw new Error(`No cases in ${resolved}`);
  if (args.limit > 0) cases = cases.slice(0, args.limit);
  return { cases, casesPath: resolved };
}

function resolveSystemPrompts(args) {
  const setups = [];
  if (args.baselineSystem || args.candidateSystem) {
    const baseline = readTextMaybeFile(args.baselineSystem) || DEFAULT_SYSTEM;
    setups.push({ label: "baseline", system: baseline });
    if (args.candidateSystem) {
      setups.push({ label: "candidate", system: readTextMaybeFile(args.candidateSystem) });
    }
    return setups;
  }
  let system = args.system || "";
  if (args.systemFile) system = readTextMaybeFile(args.systemFile);
  if (!system && args.fitReview) {
    const suggested = path.join(args.fitReview, "suggested-config.md");
    if (fs.existsSync(suggested)) {
      // Prefer explicit candidate wording block if present; else default baseline only
      const text = fs.readFileSync(suggested, "utf8");
      const match = text.match(/## Candidate Wording\s*\n+([\s\S]*?)\n+## /i);
      if (match) {
        setups.push({ label: "baseline", system: DEFAULT_SYSTEM });
        setups.push({
          label: "candidate",
          system: `${DEFAULT_SYSTEM}\n\nAdditional preference instructions:\n${match[1].trim()}`,
        });
        return setups;
      }
    }
  }
  setups.push({ label: "default", system: system || DEFAULT_SYSTEM });
  return setups;
}

async function ollamaTags(baseUrl) {
  try {
    const response = await fetch(`${baseUrl}/api/tags`, { signal: AbortSignal.timeout(3000) });
    if (!response.ok) return [];
    const data = await response.json();
    return (data.models || []).map(m => m.name).filter(Boolean);
  } catch {
    return [];
  }
}

async function resolveProviders(args) {
  if (args.providers.length) return args.providers.filter(Boolean);

  if (args.mode === "mock") {
    const mock = pathToFileURL(path.join(REPO_ROOT, "examples", "promptfoo-aligned-provider.mjs")).href;
    return [mock, "echo"];
  }

  if (args.mode === "openai") {
    if (!process.env.OPENAI_API_KEY?.trim()) {
      throw new Error("mode=openai requires OPENAI_API_KEY. Ask the user before setting it.");
    }
    return [`openai:${process.env.VIBECHECKBENCH_MODEL?.trim() || DEFAULT_OPENAI}`];
  }

  if (args.mode === "anthropic") {
    if (!process.env.ANTHROPIC_API_KEY?.trim()) {
      throw new Error("mode=anthropic requires ANTHROPIC_API_KEY. Ask the user before setting it.");
    }
    return [`anthropic:${process.env.VIBECHECKBENCH_MODEL?.trim() || DEFAULT_ANTHROPIC}`];
  }

  if (args.mode === "ollama" || args.mode === "auto") {
    const models = await ollamaTags(args.ollamaUrl);
    if (models.length) {
      const pick = args.ollamaModel
        || models.find(n => /qwen/i.test(n))
        || models[0];
      return [`ollama:chat:${pick}`];
    }
    if (args.mode === "ollama") {
      throw new Error(
        `Ollama not reachable at ${args.ollamaUrl} (or no models). Start Ollama and pull a model, or use --mode mock.`,
      );
    }
    // auto → mock fallback
    const mock = pathToFileURL(path.join(REPO_ROOT, "examples", "promptfoo-aligned-provider.mjs")).href;
    return [mock, "echo"];
  }

  throw new Error(`Unknown --mode ${args.mode}. Use mock | auto | ollama | openai | anthropic.`);
}

async function callOllama(model, system, user, args) {
  const response = await fetch(`${args.ollamaUrl}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model,
      stream: false,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Ollama ${model} failed (${response.status}): ${body.slice(0, 300)}`);
  }
  const data = await response.json();
  return data.message?.content || data.response || "";
}

async function callOpenAI(model, system, user) {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) throw new Error("OPENAI_API_KEY missing.");
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.2,
    }),
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenAI ${model} failed (${response.status}): ${body.slice(0, 300)}`);
  }
  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
}

async function callAnthropic(model, system, user) {
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key) throw new Error("ANTHROPIC_API_KEY missing.");
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 800,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Anthropic ${model} failed (${response.status}): ${body.slice(0, 300)}`);
  }
  const data = await response.json();
  const parts = data.content || [];
  return parts.map(p => p.text || "").join("\n").trim();
}

async function callFileProvider(providerId, system, user) {
  let importUrl = providerId;
  if (providerId.startsWith("file://")) {
    // Already a file URL (may be file:///C:/... on Windows) — import directly.
    importUrl = providerId;
  } else {
    const resolved = path.isAbsolute(providerId) ? providerId : path.resolve(REPO_ROOT, providerId);
    importUrl = pathToFileURL(resolved).href;
  }
  const mod = await import(importUrl);
  const Provider = mod.default || mod;
  const provider = typeof Provider === "function" ? new Provider() : Provider;
  const fullPrompt = `${system}\n\nUser request:\n${user}`;
  const response = await provider.callApi(fullPrompt, { vars: {} });
  return typeof response === "string" ? response : response?.output || JSON.stringify(response);
}

async function callSubject(providerId, system, user, args) {
  if (providerId === "echo") return `${system}\n\n${user}`;
  if (providerId.startsWith("file://")) return callFileProvider(providerId, system, user);
  if (providerId.startsWith("ollama:chat:")) {
    return callOllama(providerId.slice("ollama:chat:".length), system, user, args);
  }
  if (providerId.startsWith("ollama:")) {
    return callOllama(providerId.slice("ollama:".length), system, user, args);
  }
  if (providerId.startsWith("openai:")) {
    return callOpenAI(providerId.slice("openai:".length), system, user);
  }
  if (providerId.startsWith("anthropic:")) {
    return callAnthropic(providerId.slice("anthropic:".length), system, user);
  }
  throw new Error(`Unsupported provider "${providerId}".`);
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const { cases, casesPath } = loadCases(args);
  const setups = resolveSystemPrompts(args);
  const providers = await resolveProviders(args);

  const outDir = path.resolve(
    process.cwd(),
    args.outDir
      || (args.fitReview ? path.join(args.fitReview, "eval") : "reports/fit-eval"),
  );
  fs.mkdirSync(outDir, { recursive: true });

  const usedHosted = providers.some(p => p.startsWith("openai:") || p.startsWith("anthropic:"));
  const modeLabel = args.providers.length ? "custom-providers" : args.mode;

  banner("Fit eval (model side)", "Subjects generate answers · judge = deterministic JS (no judge model)");
  console.log(`  Cases: ${cases.length} from ${rel(casesPath)}`);
  console.log(`  Mode: ${modeLabel}`);
  console.log(`  Subjects: ${providers.join(", ")}`);
  console.log(`  Setups: ${setups.map(s => s.label).join(", ")}`);
  console.log(`  Judge: deterministic rubrics only (no API key for scoring)`);
  if (usedHosted) console.log("  ! Hosted subject API will be called with your configured key.");
  console.log("");

  const results = [];
  for (const setup of setups) {
    for (const provider of providers) {
      for (const testCase of cases) {
        const preferenceId = testCase.preferenceId || testCase.preference_id;
        const userPrompt = testCase.publicSafePrompt || testCase.user_prompt || testCase.prompt;
        if (!preferenceId || !userPrompt) {
          throw new Error("Each case needs preferenceId and publicSafePrompt.");
        }
        process.stdout.write(`  → ${setup.label} / ${provider} / ${preferenceId}… `);
        const output = await callSubject(provider, setup.system, userPrompt, args);
        console.log("ok");
        results.push({
          provider,
          config_label: setup.label,
          preference_id: preferenceId,
          user_prompt: userPrompt,
          output,
          task_id: testCase.title || preferenceId,
          split: testCase.split || "development",
        });
      }
    }
  }

  const answersPath = path.join(outDir, "answers.json");
  const scoredPath = path.join(outDir, "results.json");
  const chartPath = path.join(outDir, "skill-chart.html");
  const metaPath = path.join(outDir, "eval-meta.json");

  writeJson(answersPath, {
    metadata: {
      evaluation_mode: "vibeforge fit eval",
      source: "run-fit-eval.mjs",
      casesPath: rel(casesPath),
      providers,
      setups: setups.map(s => s.label),
      judge: "deterministic",
      mode: modeLabel,
    },
    results,
  });

  process.env.VIBEFORGE_QUIET = "1";
  scoreAnswersFile({ input: answersPath, out: scoredPath, quiet: true });
  delete process.env.VIBEFORGE_QUIET;

  let chartWritten = "";
  if (args.chart) {
    process.env.VIBEFORGE_QUIET = "1";
    chartResultsFile({ input: scoredPath, out: chartPath, quiet: true });
    delete process.env.VIBEFORGE_QUIET;
    chartWritten = chartPath;
  }

  // Mirror into fit-review run-results if present
  if (args.fitReview) {
    const runResults = path.join(args.fitReview, "run-results.json");
    fs.copyFileSync(scoredPath, runResults);
  }

  writeJson(metaPath, {
    version: "vibeforge-fit-eval-v1",
    generatedAt: new Date().toISOString(),
    judge: { type: "deterministic", model: null, apiKeyRequired: false },
    subjects: providers.map(id => ({
      id,
      hosted: id.startsWith("openai:") || id.startsWith("anthropic:"),
    })),
    setups: setups.map(s => ({ label: s.label, systemChars: s.system.length })),
    caseCount: cases.length,
    answerCount: results.length,
    outputs: { answersPath, scoredPath, chartPath: chartWritten || null },
  });

  done({
    title: "Fit eval complete",
    summary: "Subject model(s) answered your cases. Scoring used deterministic rubrics — not an LLM judge.",
    facts: [
      ["Subjects", providers.join(", ")],
      ["Setups", setups.map(s => s.label).join(", ")],
      ["Judge", "deterministic JS (no model, no key)"],
      ["Answers", String(results.length)],
      ["Mode", modeLabel],
    ],
    files: [answersPath, scoredPath, chartWritten, metaPath].filter(Boolean),
    demoData: providers.some(p => p === "echo" || p.includes("promptfoo-aligned")),
    next: [
      chartWritten ? `Open ${rel(chartWritten)} for the fit scorecard` : "Re-run with chart enabled",
      ...skillSay(
        "Use VibeForge. Explain which setup/model was weakest on pushback vs high-signal.",
        "Use VibeForge. Re-run fit eval with Ollama (local models).",
        "Use VibeForge. Re-run fit eval with OpenAI after I confirm the API key is OK to use.",
      ),
    ],
    trust: [
      "Deterministic scores are a regression signal, not ground truth.",
      "Optional LLM judges exist on other paths; this unified path intentionally skips them for simplicity.",
      "Hosted subjects send prompts/outputs to the provider — only when you chose openai/anthropic mode.",
    ],
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    fail("fit-eval", error);
    process.exit(1);
  });
}
