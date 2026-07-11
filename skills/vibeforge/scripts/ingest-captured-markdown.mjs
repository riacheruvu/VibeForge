#!/usr/bin/env node
/**
 * Convert a simple markdown paste of model outputs into captured-answer JSON.
 *
 * Expected format:
 *   ## provider-name
 *   ### preference_id
 *   User prompt:
 *   ```text
 *   ...
 *   ```
 *   Output:
 *   ```text
 *   ...
 *   ```
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

function usage() {
  console.log(`VibeForge captured markdown ingester

Usage:
  node skills/vibeforge/scripts/ingest-captured-markdown.mjs --input captured.md --out reports/captured-answers.json

Options:
  --input <path>  Markdown/text file with captured model answers
  --out <path>    Captured answer JSON output path
  --stdout        Print JSON instead of writing a file`);
}

function parseArgs(argv) {
  const args = { input: "", out: "reports/captured-answers.json", stdout: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--input") { args.input = argv[++i]; continue; }
    if (arg === "--out") { args.out = argv[++i]; continue; }
    if (arg === "--stdout") { args.stdout = true; continue; }
    if (arg === "--help" || arg === "-h") { usage(); process.exit(0); }
  }
  if (!args.input) throw new Error("--input is required.");
  return args;
}

function stripFence(value) {
  return String(value || "")
    .replace(/^\s*```[a-zA-Z0-9_-]*\s*/, "")
    .replace(/\s*```\s*$/, "")
    .trim();
}

function parseMarkdown(text) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const results = [];
  let provider = "";
  let preferenceId = "";
  let section = "";
  let buffer = [];
  let userPrompt = "";
  let output = "";

  function flushBuffer() {
    const value = stripFence(buffer.join("\n"));
    if (section === "prompt") userPrompt = value;
    if (section === "output") output = value;
    buffer = [];
  }

  function flushRow() {
    flushBuffer();
    if (provider && preferenceId && output) {
      results.push({
        provider,
        preference_id: preferenceId,
        user_prompt: userPrompt,
        output,
      });
    }
    userPrompt = "";
    output = "";
    section = "";
    buffer = [];
  }

  for (const line of lines) {
    const providerMatch = line.match(/^##\s+(.+?)\s*$/);
    if (providerMatch) {
      flushRow();
      provider = providerMatch[1].trim();
      preferenceId = "";
      continue;
    }

    const preferenceMatch = line.match(/^###\s+(.+?)\s*$/);
    if (preferenceMatch) {
      flushRow();
      preferenceId = preferenceMatch[1].replace(/`/g, "").trim();
      continue;
    }

    if (/^User prompt:\s*$/i.test(line.trim())) {
      flushBuffer();
      section = "prompt";
      continue;
    }

    if (/^Output:\s*$/i.test(line.trim())) {
      flushBuffer();
      section = "output";
      continue;
    }

    if (section) buffer.push(line);
  }

  flushRow();
  return results;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const inputPath = path.resolve(process.cwd(), args.input);
  const results = parseMarkdown(fs.readFileSync(inputPath, "utf8"));
  if (!results.length) {
    throw new Error("No captured answers found. Expected ## provider, ### preference_id, User prompt, and Output sections.");
  }

  const payload = {
    metadata: {
      evaluation_mode: "captured model answers",
      source: args.input,
    },
    results,
  };
  const json = JSON.stringify(payload, null, 2) + "\n";

  if (args.stdout) {
    process.stdout.write(json);
    return;
  }

  const outPath = path.resolve(process.cwd(), args.out);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, json, "utf8");
  console.log(`Wrote captured answer JSON: ${outPath}`);
  console.log(`Rows: ${results.length}`);
}

try {
  main();
} catch (error) {
  console.error(`Captured markdown ingest error: ${error.message}`);
  process.exit(1);
}
