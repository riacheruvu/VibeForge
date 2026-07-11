#!/usr/bin/env node

import { spawnSync } from "node:child_process";

function run(command, args) {
  return spawnSync(command, args, {
    encoding: "utf8",
    shell: false,
    windowsHide: true,
  });
}

function summarize(result) {
  const text = `${result.stdout || ""}${result.stderr || ""}`.trim();
  return text.split(/\r?\n/).find(Boolean) || "";
}

const direct = run("promptfoo", ["--version"]);
if (direct.status === 0) {
  console.log(JSON.stringify({
    available: true,
    method: "promptfoo",
    message: `Promptfoo is already installed (${summarize(direct)}). I can use it for provider comparisons.`,
  }, null, 2));
  process.exit(0);
}

const cached = run("npx", ["--no-install", "promptfoo", "--version"]);
if (cached.status === 0) {
  console.log(JSON.stringify({
    available: true,
    method: "npx --no-install promptfoo",
    message: `Promptfoo is available from the local npm cache (${summarize(cached)}). I can use it without downloading a package.`,
  }, null, 2));
  process.exit(0);
}

console.log(JSON.stringify({
  available: false,
  method: null,
  message: "Promptfoo is not installed or cached locally. I can still use VibeForge's built-in local runner for Ollama. If you want Promptfoo, I should ask before downloading a pinned package.",
  nextStep: "Ask for permission before running npx with a pinned promptfoo version.",
}, null, 2));
