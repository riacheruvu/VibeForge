#!/usr/bin/env node
/**
 * Compare two complete AI setup manifests and create a controlled experiment
 * plan. This plans the intervention; provider adapters execute it.
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const SURFACE_KEYS = ["model", "instructions", "memory", "skills", "tools", "inference", "context", "routing"];

function usage() {
  console.log(`VibeForge setup experiment planner

Usage:
  node skills/vibeforge/scripts/plan-setup-experiment.mjs --baseline baseline.json --candidate candidate.json

Options:
  --baseline <path>   Baseline setup manifest
  --candidate <path>  Candidate setup manifest
  --out <path>        Experiment plan (default: reports/setup-experiment.json)
  --catalog <path>    Setup surface catalog (default: examples/setup-surfaces.json)`);
}

function parseArgs(argv) {
  const args = {
    baseline: "",
    candidate: "",
    out: "reports/setup-experiment.json",
    catalog: "examples/setup-surfaces.json",
  };
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg === "--baseline") args.baseline = argv[++index];
    else if (arg === "--candidate") args.candidate = argv[++index];
    else if (arg === "--out") args.out = argv[++index];
    else if (arg === "--catalog") args.catalog = argv[++index];
    else if (arg === "--help" || arg === "-h") { usage(); process.exit(0); }
  }
  if (!args.baseline || !args.candidate) throw new Error("--baseline and --candidate are required.");
  return args;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.resolve(file), "utf8"));
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  }
  return value;
}

function equal(left, right) {
  return JSON.stringify(canonical(left ?? null)) === JSON.stringify(canonical(right ?? null));
}

function changedFields(left, right, prefix = "") {
  const keys = new Set([...Object.keys(left || {}), ...Object.keys(right || {})]);
  return [...keys].flatMap(key => {
    const field = prefix ? `${prefix}.${key}` : key;
    const a = left?.[key];
    const b = right?.[key];
    if (equal(a, b)) return [];
    if (a && b && typeof a === "object" && typeof b === "object" && !Array.isArray(a) && !Array.isArray(b)) {
      return changedFields(a, b, field);
    }
    return [field];
  });
}

export function planSetupExperiment({ baseline, candidate, catalog }) {
  if (baseline.version !== "vibeforge-setup-v1" || candidate.version !== "vibeforge-setup-v1") {
    throw new Error("Both manifests must use vibeforge-setup-v1.");
  }
  const catalogById = new Map((catalog.surfaces || []).map(surface => [surface.id, surface]));
  const changes = SURFACE_KEYS.filter(surface => !equal(baseline[surface], candidate[surface])).map(surface => ({
    surface,
    label: catalogById.get(surface)?.label || surface,
    support: catalogById.get(surface)?.support || "unknown",
    fields: changedFields(baseline[surface], candidate[surface], surface),
    measures: catalogById.get(surface)?.measures || [],
    executableFields: catalogById.get(surface)?.executableFields || [],
  }));
  const controlled = changes.length === 1;
  const executable = controlled && changes[0].fields.every(field =>
    changes[0].executableFields.some(supported =>
      field === supported || field.startsWith(`${supported}.`)));
  return {
    version: "vibeforge-setup-experiment-v1",
    generatedAt: new Date().toISOString(),
    baseline: { id: baseline.id, label: baseline.label },
    candidate: { id: candidate.id, label: candidate.label },
    changes,
    decision: {
      controlled,
      executableWithCurrentAdapters: executable,
      humanReviewRequired: true,
      headline: changes.length === 0
        ? "The setup manifests are identical"
        : controlled
          ? `Controlled ${changes[0].label.toLowerCase()} experiment`
          : "Split this into smaller experiments",
      rationale: changes.length === 0
        ? "There is no intervention to evaluate."
        : controlled
          ? `Only ${changes[0].label.toLowerCase()} changed, so a result can be attributed more credibly.`
          : `${changes.length} setup surfaces changed: ${changes.map(change => change.label).join(", ")}.`,
      nextStep: changes.length === 0
        ? "Change one setup surface and plan again."
        : controlled
          ? `Run development and held-out personal-fit cases; measure ${changes[0].measures.join(", ")}.`
          : "Create separate candidates that each change one surface while holding the others fixed.",
    },
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const report = planSetupExperiment({
    baseline: readJson(args.baseline),
    candidate: readJson(args.candidate),
    catalog: readJson(args.catalog),
  });
  const outPath = path.resolve(args.out);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(`Wrote setup experiment plan: ${outPath}`);
  console.log(report.decision.headline);
  console.log(report.decision.nextStep);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  try {
    main();
  } catch (error) {
    console.error(`Setup experiment planning error: ${error.message}`);
    process.exit(1);
  }
}
