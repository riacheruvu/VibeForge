#!/usr/bin/env node
/**
 * Validate VibeForge task definitions.
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

function usage() {
  console.log(`VibeForge task validator

Usage:
  node skills/vibeforge/scripts/validate-tasks.mjs --tasks examples/tasks

Options:
  --tasks <dir>  Directory containing *.json task files
  --help         Show help`);
}

function parseArgs(argv) {
  const args = { tasksDir: "examples/tasks" };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--tasks") { args.tasksDir = argv[++i]; continue; }
    if (arg === "--help" || arg === "-h") { usage(); process.exit(0); }
  }
  return args;
}

function taskFiles(dir) {
  return fs.readdirSync(dir)
    .filter(file => file.endsWith(".json"))
    .sort()
    .map(file => path.join(dir, file));
}

function requireString(task, key, errors) {
  if (!task[key] || typeof task[key] !== "string") errors.push(`missing string: ${key}`);
}

function validateTurns(turns, errors) {
  if (!Array.isArray(turns) || turns.length === 0) {
    errors.push("input.turns must be a non-empty array");
    return;
  }

  for (const [index, turn] of turns.entries()) {
    if (!["user", "assistant", "system", "tool"].includes(turn?.role)) {
      errors.push(`input.turns[${index}].role must be user, assistant, system, or tool`);
    }
    if (!turn?.content || typeof turn.content !== "string") {
      errors.push(`input.turns[${index}].content must be a string`);
    }
  }

  if (turns.at(-1)?.role !== "user") {
    errors.push("input.turns must end with a user turn so the tested setup produces the next response");
  }
}

function validateTask(task, file) {
  const errors = [];
  requireString(task, "id", errors);
  requireString(task, "title", errors);
  requireString(task, "category", errors);
  requireString(task, "preference_id", errors);

  if (!task.grading || !["deterministic", "llm_judge", "hybrid"].includes(task.grading.mode)) {
    errors.push("grading.mode must be deterministic, llm_judge, or hybrid");
  }

  const hasPrompt = typeof task.input?.prompt === "string" && task.input.prompt.trim();
  const hasTurns = Array.isArray(task.input?.turns);
  if (!hasPrompt && !hasTurns) errors.push("input.prompt or input.turns is required");
  if (hasTurns) validateTurns(task.input.turns, errors);

  if (!task.input?.user_profile || typeof task.input.user_profile !== "string") {
    errors.push("input.user_profile must be a string");
  }

  if (task.workflow) {
    if (task.workflow.expected_tool_calls && !Array.isArray(task.workflow.expected_tool_calls)) {
      errors.push("workflow.expected_tool_calls must be an array");
    }
    if (task.workflow.forbidden_tool_calls && !Array.isArray(task.workflow.forbidden_tool_calls)) {
      errors.push("workflow.forbidden_tool_calls must be an array");
    }
  }

  const hardChecks = task.expected_behavior?.hard_checks;
  if (!Array.isArray(hardChecks)) errors.push("expected_behavior.hard_checks must be an array");

  const judgeRubric = task.expected_behavior?.judge_rubric;
  if (!Array.isArray(judgeRubric)) errors.push("expected_behavior.judge_rubric must be an array");

  const deterministic = Number(task.scoring?.deterministic);
  const llmJudge = Number(task.scoring?.llm_judge);
  if (!Number.isFinite(deterministic) || !Number.isFinite(llmJudge)) {
    errors.push("scoring.deterministic and scoring.llm_judge must be numbers");
  } else if (Math.abs((deterministic + llmJudge) - 1) > 0.001) {
    errors.push("scoring weights must sum to 1");
  }

  if (task.grading?.mode === "deterministic" && llmJudge !== 0) {
    errors.push("deterministic tasks should set scoring.llm_judge to 0");
  }

  if (["llm_judge", "hybrid"].includes(task.grading?.mode) && (!judgeRubric || judgeRubric.length === 0)) {
    errors.push("judge or hybrid tasks need at least one judge_rubric item");
  }

  return errors.map(error => `${file}: ${error}`);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const tasksDir = path.resolve(process.cwd(), args.tasksDir);
  const files = taskFiles(tasksDir);
  if (files.length === 0) throw new Error(`No task JSON files found in ${tasksDir}`);

  const errors = [];
  const ids = new Set();
  for (const file of files) {
    const task = JSON.parse(fs.readFileSync(file, "utf8"));
    if (ids.has(task.id)) errors.push(`${file}: duplicate id ${task.id}`);
    ids.add(task.id);
    errors.push(...validateTask(task, file));
  }

  if (errors.length) {
    console.error(errors.join("\n"));
    process.exit(1);
  }

  console.log(`Validated ${files.length} VibeForge task(s).`);
}

try {
  main();
} catch (error) {
  console.error(`Task validation error: ${error.message}`);
  process.exit(1);
}
