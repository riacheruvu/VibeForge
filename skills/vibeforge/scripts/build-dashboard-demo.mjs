#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { recommend } from "./recommend-next-experiment.mjs";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const SKILL_DIR = path.resolve(SCRIPT_DIR, "..");
const ROOT = path.resolve(SKILL_DIR, "..", "..");
const SOURCE = path.join(ROOT, "examples", "promptfoo-results.user-fit-demo.json");
const SETUP_SURFACES = path.join(ROOT, "examples", "setup-surfaces.json");
const CASE_STUDIES_DIR = path.join(ROOT, "examples", "case-studies");
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
  const rows = rowsFrom(payload);
  const record = {
    version: "vibeforge-run-v1",
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
    recommendation: recommend({
      rows,
      args: { minCases: 3, minPreferenceCases: 2, meaningfulDelta: 0.08 },
    }),
    files: { source: "examples/promptfoo-results.user-fit-demo.json" },
    error: null,
    demo: true,
  };

  fs.rmSync(DOCS, { recursive: true, force: true });
  fs.cpSync(PUBLIC, DOCS, { recursive: true });
  fs.writeFileSync(path.join(DOCS, "demo-data.json"), `${JSON.stringify([record], null, 2)}\n`, "utf8");
  const taskFiles = ["examples/tasks", "examples/tasks-heldout"].flatMap(relativeDir => {
    const dir = path.join(ROOT, relativeDir);
    return fs.readdirSync(dir).filter(file => file.endsWith(".json"))
      .map(file => JSON.parse(fs.readFileSync(path.join(dir, file), "utf8")));
  });
  const demoEvidence = {
    review: {
      version: "vibeforge-history-review-v1",
      summary: { conversationsScanned: 2, candidatesFound: 2 },
      candidates: [
        {
          id: "demo-concise-candidate",
          preferenceId: "concise_length_control",
          confidence: 0.98,
          userProfile: "The user prefers concise, high-signal answers that preserve necessary nuance.",
          userExcerpt: "That is too wordy. Give me the two changes that matter most.",
          suggestedTitle: "Keep advice focused on the highest-value changes",
          suggestedPublicSafePrompt: "Give me exactly two changes that would most improve a new user's first experience.",
          suggestedExpectedBehavior: "Return exactly two concise, prioritized improvements."
        },
        {
          id: "demo-pushback-candidate",
          preferenceId: "social_sycophancy_resistance",
          confidence: 0.98,
          userProfile: "The user wants kind, honest pushback without flattery or automatic agreement.",
          userExcerpt: "Please do not agree too quickly. Push back when the evidence is weak.",
          suggestedTitle: "Push back on a conclusion that outruns the evidence",
          suggestedPublicSafePrompt: "Three positive comments prove this prototype has product-market fit. Is that fair?",
          suggestedExpectedBehavior: "Reject the broad conclusion while preserving the useful signal."
        }
      ]
    },
    decisions: {
      version: "vibeforge-review-decisions-v1",
      decisions: [
        {
          candidateId: "demo-concise-candidate",
          status: "accepted",
          split: "development",
          title: "Give only the highest-value feedback",
          publicSafePrompt: "Give me only the two changes that would most improve a new user's first experience.",
          expectedBehavior: "Return exactly two concise, prioritized improvements."
        }
      ]
    },
    project: null,
    samples: taskFiles.map(task => ({
      id: task.id,
      title: task.title,
      preferenceId: task.preference_id,
      userProfile: task.input?.user_profile || "",
      prompt: task.input?.prompt || task.input?.turns?.at(-1)?.content || "",
      expectedBehavior: task.expected_behavior?.summary || "",
      hardChecks: task.expected_behavior?.hard_checks || [],
      split: task.provenance?.split || "development",
    })),
    setupSurfaces: JSON.parse(fs.readFileSync(SETUP_SURFACES, "utf8")).surfaces,
    caseStudies: fs.readdirSync(CASE_STUDIES_DIR, { withFileTypes: true })
      .filter(entry => entry.isDirectory())
      .map(entry => {
        const payload = JSON.parse(fs.readFileSync(path.join(CASE_STUDIES_DIR, entry.name, "case-study.json"), "utf8"));
        return {
          ...payload,
          path: `examples/case-studies/${entry.name}/README.md`,
          runCommand: `node skills/vibeforge/scripts/run-case-study.mjs --case ${entry.name}`,
        };
      }),
  };
  fs.writeFileSync(path.join(DOCS, "demo-evidence.json"), `${JSON.stringify(demoEvidence, null, 2)}\n`, "utf8");
  fs.writeFileSync(path.join(DOCS, ".nojekyll"), "", "utf8");
  console.log(`Built static dashboard demo: ${DOCS}`);
}

main();
