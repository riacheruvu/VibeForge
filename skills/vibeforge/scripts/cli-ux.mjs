/**
 * Shared headless CLI UX for VibeForge / VibeForge.
 * No dependencies — Node stdlib only. Import from sibling scripts.
 */

import path from "node:path";
import process from "node:process";

export const PRODUCT = "VibeForge";
export const PRODUCT_LEGACY = "VibeForge";

/** Quiet mode for nested subprocesses (case-study orchestration). */
export function isQuiet() {
  return process.env.VIBEFORGE_QUIET === "1"
    || process.env.VIBEFORGE_QUIET === "1"
    || process.argv.includes("--quiet");
}

export function rel(filePath, cwd = process.cwd()) {
  if (!filePath) return "";
  const absolute = path.resolve(filePath);
  const relative = path.relative(cwd, absolute);
  return relative && !relative.startsWith("..") ? relative.replaceAll("\\", "/") : absolute.replaceAll("\\", "/");
}

export function hr() {
  if (isQuiet()) return;
  console.log("─".repeat(56));
}

export function banner(commandTitle, oneLiner) {
  if (isQuiet()) return;
  console.log("");
  hr();
  console.log(`${PRODUCT} · ${commandTitle}`);
  if (oneLiner) console.log(oneLiner);
  hr();
}

export function helpHeader(commandTitle, oneLiner) {
  console.log(`${PRODUCT} (${PRODUCT_LEGACY}) — ${commandTitle}`);
  if (oneLiner) console.log(oneLiner);
  console.log("");
}

export function section(title) {
  if (isQuiet()) return;
  console.log("");
  console.log(title);
}

export function bullet(text) {
  if (isQuiet()) return;
  console.log(`  • ${text}`);
}

export function kv(label, value) {
  if (isQuiet()) return;
  console.log(`  ${label}: ${value}`);
}

export function ok(message) {
  if (isQuiet()) return;
  console.log(`✓ ${message}`);
}

export function note(message) {
  if (isQuiet()) return;
  console.log(`  ${message}`);
}

export function warn(message) {
  // Always show warnings even in quiet-ish nested runs unless fully quiet
  if (isQuiet()) return;
  console.log(`! ${message}`);
}

export function nextSteps(steps) {
  if (isQuiet() || !steps?.length) return;
  section("Next (ask the VibeForge skill)");
  for (const step of steps) bullet(step);
}

/** Prefer skill utterances over shell/npm in user-facing next steps. */
export function skillSay(...utterances) {
  return utterances.map(text => `Ask: “${text}”`);
}

export function trustFooter(extraLines = []) {
  if (isQuiet()) return;
  section("Trust");
  bullet("Fit signal for review — not a general model IQ ranking.");
  bullet("Candidates are never auto-deployed; held-out checks before keeping a change.");
  for (const line of extraLines) bullet(line);
  console.log("");
}

/**
 * Full success block used by golden-path scripts.
 * @param {object} opts
 * @param {string} opts.title
 * @param {string} [opts.summary]
 * @param {Array<[string, string]>} [opts.facts] label/value pairs
 * @param {string[]} [opts.files]
 * @param {string[]} [opts.next]
 * @param {string[]} [opts.trust]
 * @param {boolean} [opts.demoData]
 */
export function done({
  title,
  summary,
  facts = [],
  files = [],
  next = [],
  trust = [],
  demoData = false,
}) {
  if (isQuiet()) {
    if (files[0]) console.log(files[0]);
    return;
  }
  section(`✓ ${title}`);
  if (summary) note(summary);
  for (const [label, value] of facts) kv(label, value);
  if (files.length) {
    section("Files");
    for (const file of files) bullet(rel(file));
  }
  if (demoData) {
    section("Data");
    bullet("This used checked-in demo / public-safe example data — not a live model run.");
  }
  nextSteps(next);
  trustFooter(trust);
}

export function fail(prefix, error) {
  console.error("");
  console.error(`${PRODUCT} error (${prefix}): ${error?.message || error}`);
  console.error("See docs/GETTING-STARTED.md or docs/COMMANDS.md");
  console.error("");
}

export function listIntro(title, items) {
  banner(title, `${items.length} available`);
  for (const item of items) bullet(item);
  console.log("");
}
