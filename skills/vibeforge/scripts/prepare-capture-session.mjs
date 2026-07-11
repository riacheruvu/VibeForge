#!/usr/bin/env node
/**
 * Create a local capture session for model-picker comparisons.
 *
 * This keeps the prompts, answer template, and session metadata in one local
 * folder so users do not need to rebuild the prompt bundle each time.
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

function usage() {
  console.log(`VibeForge capture-session helper

Usage:
  node skills/vibeforge/scripts/prepare-capture-session.mjs --name codex-model-sweep --model "GPT 5.5 Codex" --model "Claude Sonnet"

Options:
  --name <id>       Session folder name under captures/
  --tasks <dir>     Task directory (default: examples/tasks)
  --model <name>    Subject model label; repeat for multiple models
  --out-dir <dir>   Output root (default: captures)
  --limit <n>       Limit number of tasks for a quick test
  --help            Show help`);
}

function parseArgs(argv) {
  const args = {
    name: "",
    tasksDir: "examples/tasks",
    models: [],
    outDir: "captures",
    limit: 0,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--name") { args.name = argv[++i]; continue; }
    if (arg === "--tasks") { args.tasksDir = argv[++i]; continue; }
    if (arg === "--model") { args.models.push(argv[++i]); continue; }
    if (arg === "--out-dir") { args.outDir = argv[++i]; continue; }
    if (arg === "--limit") { args.limit = Number.parseInt(argv[++i], 10) || 0; continue; }
    if (arg === "--help" || arg === "-h") { usage(); process.exit(0); }
  }

  if (!args.name) {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    args.name = `session-${stamp}`;
  }
  if (args.models.length === 0) args.models = ["MODEL_NAME_HERE"];
  return args;
}

function readTasks(tasksDir, limit) {
  const tasks = fs.readdirSync(tasksDir)
    .filter(file => file.endsWith(".json"))
    .sort()
    .map(file => JSON.parse(fs.readFileSync(path.join(tasksDir, file), "utf8")));
  return limit > 0 ? tasks.slice(0, limit) : tasks;
}

function answerBlock(model, task) {
  return [
    `## ${model}`,
    "",
    `### ${task.preference_id}`,
    "",
    `Task id: ${task.id}`,
    "",
    "User prompt:",
    "",
    "```text",
    task.input.prompt,
    "```",
    "",
    "Output:",
    "",
    "```text",
    "PASTE_MODEL_ANSWER_HERE",
    "```",
    "",
  ].join("\n");
}

function promptBundle(tasks) {
  const sections = [
    "# VibeForge Subject Prompt Bundle",
    "",
    "Paste the instruction below into each model you want to compare, then paste each task prompt one at a time.",
    "",
    "```text",
    "You are being tested for how well your answers fit a user's preferences.",
    "Answer normally. Do not mention that this is a benchmark. Do not optimize for keywords.",
    "Be concise, honest, useful, and clear about uncertainty.",
    "```",
    "",
  ];

  for (const task of tasks) {
    sections.push(
      `## ${task.id}: ${task.title}`,
      "",
      `Preference id: \`${task.preference_id}\``,
      "",
      "User profile:",
      "",
      "```text",
      task.input.user_profile,
      "```",
      "",
      "Prompt:",
      "",
      "```text",
      task.input.prompt,
      "```",
      "",
    );
  }

  return sections.join("\n");
}

function answerTemplate(models, tasks) {
  return [
    "# Captured Model Answers",
    "",
    "Paste each model's answer into the matching Output block. Keep the headings intact.",
    "",
    ...models.flatMap(model => tasks.map(task => answerBlock(model, task))),
  ].join("\n");
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const tasksDir = path.resolve(process.cwd(), args.tasksDir);
  const tasks = readTasks(tasksDir, args.limit);
  if (!tasks.length) throw new Error(`No task JSON files found in ${tasksDir}`);

  const sessionDir = path.resolve(process.cwd(), args.outDir, args.name);
  fs.mkdirSync(sessionDir, { recursive: true });

  const metadata = {
    created_at: new Date().toISOString(),
    tasks_dir: args.tasksDir,
    models: args.models,
    task_ids: tasks.map(task => task.id),
    next_commands: [
      `node skills/vibeforge/scripts/ingest-captured-markdown.mjs --input ${path.join(args.outDir, args.name, "answers.md")} --out ${path.join(args.outDir, args.name, "captured-answers.json")}`,
      `node skills/vibeforge/scripts/score-answers.mjs --input ${path.join(args.outDir, args.name, "captured-answers.json")} --out ${path.join(args.outDir, args.name, "results.json")}`,
      `node skills/vibeforge/scripts/chart-results.mjs --input ${path.join(args.outDir, args.name, "results.json")} --out ${path.join(args.outDir, args.name, "skill-chart.html")}`,
    ],
  };

  fs.writeFileSync(path.join(sessionDir, "subject-prompts.md"), promptBundle(tasks), "utf8");
  fs.writeFileSync(path.join(sessionDir, "answers.md"), answerTemplate(args.models, tasks), "utf8");
  fs.writeFileSync(path.join(sessionDir, "session.json"), JSON.stringify(metadata, null, 2) + "\n", "utf8");

  console.log(`Created capture session: ${sessionDir}`);
  console.log(`Tasks: ${tasks.length}`);
  console.log(`Models: ${args.models.join(", ")}`);
  console.log(`Fill in: ${path.join(sessionDir, "answers.md")}`);
}

try {
  main();
} catch (error) {
  console.error(`Capture-session error: ${error.message}`);
  process.exit(1);
}
