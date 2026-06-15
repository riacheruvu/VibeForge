#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const SKILL_DIR = path.resolve(SCRIPT_DIR, "..");
const ROOT = path.resolve(SKILL_DIR, "..", "..");
const SOURCE = path.join(ROOT, "examples", "promptfoo-results.user-fit-demo.json");
const PUBLIC = path.join(SKILL_DIR, "dashboard", "public");
const DOCS = path.join(ROOT, "docs");

const METRICS = {
  calibrated_factuality_and_sourceability: ["Doesn't overclaim", "Separates evidence from assumptions."],
  concise_length_control: ["Keeps it high-signal", "Stays concise without losing needed nuance."],
  context_sensitive_non_refusal: ["Helps without overstepping", "Provides bounded help on allowed requests."],
  social_sycophancy_resistance: ["Pushes back kindly", "Challenges weak claims without becoming dismissive."],
  user_agency_and_decision_fit: ["Helps me choose", "Shows tradeoffs while leaving the decision with the user."],
  verifiable_instruction_following: ["Respects my asks", "Keeps requested format, length, and constraints."],
};

function rowsFrom(payload) {
  return payload?.results?.results || payload?.results || payload?.outputs || [];
}

function varsOf(row) {
  return row.vars || row.testCase?.vars || {};
}

function providerOf(row) {
  const provider = typeof row.provider === "string"
    ? row.provider
    : row.provider?.id || row.provider?.label || row.providerId || "unknown";
  return provider;
}

function metricInfo(metric) {
  return METRICS[metric] || [metric.replaceAll("_", " "), "Preference check from the selected profile."];
}

function summarize(payload) {
  const rows = rowsFrom(payload);
  const groups = new Map();
  for (const row of rows) {
    const name = providerOf(row);
    const metric = varsOf(row).preference_id || row.metric || "unknown";
    if (!groups.has(name)) groups.set(name, { name, rows: [], metrics: new Map() });
    const group = groups.get(name);
    const item = {
      taskId: varsOf(row).task_id || "",
      metric,
      score: Number(row.score ?? row.gradingResult?.score ?? 0),
      passed: Boolean(row.success ?? row.pass ?? row.gradingResult?.pass),
      latencyMs: Number(row.latencyMs || 0),
      tokens: Number(row.tokenUsage?.total ?? row.response?.tokenUsage?.total ?? 0),
      output: row.response?.output || row.output || "",
    };
    group.rows.push(item);
    if (!group.metrics.has(metric)) group.metrics.set(metric, []);
    group.metrics.get(metric).push(item);
  }

  const setups = [...groups.values()].map(group => {
    const total = group.rows.length || 1;
    const metrics = [...group.metrics.entries()].map(([id, items]) => {
      const [label, description] = metricInfo(id);
      return {
        id,
        label,
        description,
        score: items.reduce((sum, item) => sum + item.score, 0) / items.length,
        passed: items.filter(item => item.passed).length,
        total: items.length,
      };
    });
    const sorted = metrics.slice().sort((a, b) => b.score - a.score);
    const passed = group.rows.filter(row => row.passed).length;
    return {
      name: group.name,
      score: group.rows.reduce((sum, row) => sum + row.score, 0) / total,
      passed,
      total,
      passRate: passed / total,
      averageLatencyMs: group.rows.reduce((sum, row) => sum + row.latencyMs, 0) / total,
      totalTokens: group.rows.reduce((sum, row) => sum + row.tokens, 0),
      strongest: sorted[0]?.label || "Not enough data",
      weakest: sorted.at(-1)?.label || "Not enough data",
      metrics,
      failures: group.rows.filter(row => !row.passed).map(row => ({
        taskId: row.taskId,
        preference: metricInfo(row.metric)[0],
        score: row.score,
        output: row.output,
      })),
    };
  }).sort((a, b) => b.score - a.score);

  return {
    setups,
    winner: setups[0]?.name || "",
    totalChecks: rows.length,
    totalTokens: setups.reduce((sum, setup) => sum + setup.totalTokens, 0),
    averageLatencyMs: rows.length
      ? rows.reduce((sum, row) => sum + Number(row.latencyMs || 0), 0) / rows.length
      : 0,
  };
}

function main() {
  const payload = JSON.parse(fs.readFileSync(SOURCE, "utf8"));
  const record = {
    version: "vibecheckbench-run-v1",
    id: "public-safe-example",
    presetId: "public-demo",
    name: "Public-safe example comparison",
    kind: "model-comparison",
    status: "complete",
    privacy: "Checked-in example data",
    providers: [],
    startedAt: "2026-05-29T18:00:00.000Z",
    finishedAt: "2026-05-29T18:00:18.000Z",
    summary: summarize(payload),
    gate: null,
    files: { source: "examples/promptfoo-results.user-fit-demo.json" },
    error: null,
    demo: true,
  };

  fs.rmSync(DOCS, { recursive: true, force: true });
  fs.cpSync(PUBLIC, DOCS, { recursive: true });
  fs.writeFileSync(path.join(DOCS, "demo-data.json"), `${JSON.stringify([record], null, 2)}\n`, "utf8");
  fs.writeFileSync(path.join(DOCS, ".nojekyll"), "", "utf8");
  console.log(`Built static dashboard demo: ${DOCS}`);
}

main();
