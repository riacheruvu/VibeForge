#!/usr/bin/env node
/**
 * Convert Promptfoo JSON/JSONL output into a compact VibeForge fit scorecard.
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { banner, done, fail, helpHeader, isQuiet, rel, skillSay } from "./cli-ux.mjs";

function usage() {
  helpHeader("fit scorecard / skill chart", "Personal fit chart — not a general model leaderboard.");
  console.log(`Primary UX — ask the skill:
  Use VibeForge. Show me a fit scorecard from the demo data.

Implementation:
  node skills/vibecheckbench/scripts/chart-results.mjs --input results.json --out reports/skill-chart.html

Options:
  --input <path>   Promptfoo / scored-results JSON or JSONL
  --out <path>     Markdown or HTML output path
  --stdout         Print output instead of writing a file
  --quiet          Minimal output (for nested orchestration)`);
}

function parseArgs(argv) {
  const args = { input: "", out: "reports/skill-chart.md", stdout: false, quiet: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--input") { args.input = argv[++i]; continue; }
    if (arg === "--out") { args.out = argv[++i]; continue; }
    if (arg === "--stdout") { args.stdout = true; continue; }
    if (arg === "--quiet") { args.quiet = true; continue; }
    if (arg === "--help" || arg === "-h") { usage(); process.exit(0); }
  }
  if (!args.input) throw new Error("--input is required.");
  return args;
}

function overallRanking(summary) {
  return [...summary.keys()].map(provider => {
    const all = [...summary.get(provider).values()].flat();
    const passRate = all.length ? all.reduce((s, i) => s + (i.pass ? 1 : 0), 0) / all.length : 0;
    const mean = all.length ? all.reduce((s, i) => s + i.score, 0) / all.length : 0;
    return { provider, passRate, mean };
  }).sort((a, b) => b.mean - a.mean);
}

function looksLikeDemoInput(inputPath, metadata) {
  const normalized = String(inputPath).replaceAll("\\", "/");
  if (/examples\/|user-fit-demo|models\.example|promptfoo-results\./i.test(normalized)) return true;
  const source = String(metadata.source || metadata.evaluation_mode || "");
  return /demo|example|hand-authored|public-safe example/i.test(source);
}

export function readInput(inputPath) {
  const text = fs.readFileSync(inputPath, "utf8").trim();
  if (!text) return { rows: [], metadata: {} };

  if (inputPath.endsWith(".jsonl")) {
    return {
      rows: text.split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line)),
      metadata: { evaluation_mode: "jsonl results" },
    };
  }

  const payload = JSON.parse(text);
  const metadata = payload.metadata || {};
  if (payload.version === "vibecheckbench-captured-answers-v1") {
    metadata.evaluation_mode = metadata.evaluation_mode || "captured model answers";
  }
  if (Array.isArray(payload)) return { rows: payload, metadata };
  if (Array.isArray(payload.results?.results)) return { rows: payload.results.results, metadata };
  if (Array.isArray(payload.results?.outputs)) return { rows: payload.results.outputs, metadata };
  if (Array.isArray(payload.outputs)) return { rows: payload.outputs, metadata };
  if (Array.isArray(payload.results)) return { rows: payload.results, metadata };
  return { rows: [], metadata };
}

function providerOf(row) {
  const provider = row.provider || row.providerId || row.providerResponse?.provider;
  const providerName = typeof provider === "string"
    ? provider
    : provider?.label || provider?.id || "unknown-provider";
  const configLabel = varsOf(row).config_label;
  return configLabel && configLabel !== "default"
    ? `${providerName} / ${configLabel}`
    : providerName;
}

function varsOf(row) {
  return row.vars || row.testCase?.vars || row.test?.vars || row.test?.options?.vars || {};
}

function metricOf(row) {
  const vars = varsOf(row);
  if (vars.preference_id) return vars.preference_id;

  const component = row.gradingResult?.componentResults?.find(result => result.assertion?.metric);
  if (component?.assertion?.metric) return component.assertion.metric;

  return row.metric || "unknown_skill";
}

function scoreOf(row) {
  const raw = row.score ?? row.gradingResult?.score ?? row.result?.score;
  const score = Number(raw);
  if (Number.isFinite(score)) return Math.max(0, Math.min(1, score));
  return passOf(row) ? 1 : 0;
}

function passOf(row) {
  if (typeof row.pass === "boolean") return row.pass;
  if (typeof row.success === "boolean") return row.success;
  if (typeof row.gradingResult?.pass === "boolean") return row.gradingResult.pass;
  return scoreOf(row) >= 0.5;
}

function labelFor(score) {
  if (score >= 0.85) return "strong";
  if (score >= 0.65) return "solid";
  if (score >= 0.5) return "fragile";
  return "needs work";
}

function bar(score) {
  const filled = Math.round(score * 10);
  return `${"#".repeat(filled)}${"-".repeat(10 - filled)}`;
}

const METRIC_INFO = {
  calibrated_factuality_and_sourceability: {
    label: "Doesn't overclaim",
    description: "Keeps trust calibrated: separates facts, assumptions, and what still needs checking.",
  },
  concise_length_control: {
    label: "Keeps it high-signal",
    description: "Respects the user's time by staying concise without dropping needed nuance.",
  },
  context_sensitive_non_refusal: {
    label: "Helps without overstepping",
    description: "Gives bounded help for allowed requests instead of over-refusing or oversharing.",
  },
  mechanism_first_framing: {
    label: "Explains mechanisms",
    description: "Grounds answers in evidence, constraints, and causal reasoning instead of vague stories.",
  },
  operational_reality_check: {
    label: "Keeps it realistic",
    description: "Names practical limits, risks, and what would break in the real world.",
  },
  social_sycophancy_resistance: {
    label: "Pushes back kindly",
    description: "Supports the user without flattering, rubber-stamping, or validating weak claims.",
  },
  user_agency_and_decision_fit: {
    label: "Helps me choose",
    description: "Shows tradeoffs, uncertainty, and next steps while leaving the decision with the user.",
  },
  verifiable_instruction_following: {
    label: "Respects my asks",
    description: "Keeps the specific constraints the user gave: format, length, exclusions, and required details.",
  },
};

function metricInfo(metric) {
  return METRIC_INFO[metric] || {
    label: metric.replaceAll("_", " "),
    description: "Preference check from the selected profile.",
  };
}

export function summarize(rows) {
  const byProvider = new Map();
  for (const row of rows) {
    const provider = providerOf(row);
    const metric = metricOf(row);
    if (!byProvider.has(provider)) byProvider.set(provider, new Map());
    const metrics = byProvider.get(provider);
    if (!metrics.has(metric)) metrics.set(metric, []);
    metrics.get(metric).push({ score: scoreOf(row), pass: passOf(row) });
  }
  return byProvider;
}

function average(items, selector) {
  if (!items.length) return 0;
  return items.reduce((sum, item) => sum + selector(item), 0) / items.length;
}

export function render(summary, metadata = {}) {
  const providers = [...summary.keys()].sort();
  const metrics = [...new Set(providers.flatMap(provider => [...summary.get(provider).keys()]))].sort();
  const lines = [
    "# VibeForge Fit Scorecard",
    "",
    "This is a personal-fit chart, not a general model leaderboard. Higher scores mean the model/config matched this preference profile on these cases.",
  ];

  const provenance = provenanceLine(metadata);
  if (provenance) lines.push("", provenance);

  lines.push(
    "",
    "## Overall",
    "",
    "| Model/config | Pass rate | Mean score | Read |",
    "|---|---:|---:|---|",
  );

  for (const provider of providers) {
    const all = [...summary.get(provider).values()].flat();
    const passRate = average(all, item => item.pass ? 1 : 0);
    const mean = average(all, item => item.score);
    lines.push(`| ${provider} | ${(passRate * 100).toFixed(0)}% | ${mean.toFixed(2)} | ${bar(mean)} ${labelFor(mean)} |`);
  }

  lines.push("", "## By Preference", "");
  lines.push("| Preference | " + providers.join(" | ") + " |");
  lines.push("|---|" + providers.map(() => "---:").join("|") + "|");

  for (const metric of metrics) {
    const cells = providers.map(provider => {
      const items = summary.get(provider).get(metric) || [];
      if (!items.length) return "n/a";
      const mean = average(items, item => item.score);
      const passRate = average(items, item => item.pass ? 1 : 0);
      return `${mean.toFixed(2)} (${(passRate * 100).toFixed(0)}%)`;
    });
    lines.push(`| ${metricInfo(metric).label} | ${cells.join(" | ")} |`);
  }

  lines.push("", "## Notes", "");
  lines.push("- Review failing outputs manually before drawing conclusions.");
  lines.push("- Re-run with held-out cases before treating a config as improved.");
  lines.push("- Keep private profiles local unless the provider's data policy is acceptable for that content.");
  lines.push("");
  return lines.join("\n");
}

function htmlEscape(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function percent(score) {
  return `${Math.round(score * 100)}%`;
}

function toneClass(score) {
  if (score >= 0.85) return "strong";
  if (score >= 0.65) return "solid";
  if (score >= 0.5) return "fragile";
  return "weak";
}

function providerColor(index) {
  const colors = [
    { stroke: "#2f8f8f", fill: "rgba(47, 143, 143, 0.34)" },
    { stroke: "#bf5f8f", fill: "rgba(191, 95, 143, 0.34)" },
    { stroke: "#5c76b8", fill: "rgba(92, 118, 184, 0.28)" },
    { stroke: "#9a7a1f", fill: "rgba(154, 122, 31, 0.26)" },
  ];
  return colors[index % colors.length];
}

function polarPoint(centerX, centerY, radius, index, total) {
  const angle = -Math.PI / 2 + (Math.PI * 2 * index) / total;
  return {
    x: centerX + Math.cos(angle) * radius,
    y: centerY + Math.sin(angle) * radius,
  };
}

function radarPolygon(points) {
  return points.map(point => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
}

function radarLabel(label, x, y, anchor) {
  const words = label.split(/\s+/);
  if (label.length <= 21 || words.length < 3) {
    return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="${anchor}" class="radar-label">${htmlEscape(label)}</text>`;
  }

  let splitAt = 1;
  let smallestDifference = Infinity;
  for (let index = 1; index < words.length; index++) {
    const first = words.slice(0, index).join(" ");
    const second = words.slice(index).join(" ");
    const difference = Math.abs(first.length - second.length);
    if (difference < smallestDifference) {
      smallestDifference = difference;
      splitAt = index;
    }
  }

  const first = htmlEscape(words.slice(0, splitAt).join(" "));
  const second = htmlEscape(words.slice(splitAt).join(" "));
  return `<text x="${x.toFixed(1)}" y="${(y - 10).toFixed(1)}" text-anchor="${anchor}" class="radar-label"><tspan x="${x.toFixed(1)}">${first}</tspan><tspan x="${x.toFixed(1)}" dy="22">${second}</tspan></text>`;
}

function renderRadar({ providers, metrics, summary }) {
  if (metrics.length < 3 || providers.length === 0) return "";

  const centerX = 450;
  const centerY = 260;
  const radius = 150;
  const rings = [0.25, 0.5, 0.75, 1];
  const axes = metrics.map((metric, index) => {
    const end = polarPoint(centerX, centerY, radius, index, metrics.length);
    const labelPoint = polarPoint(centerX, centerY, radius + 58, index, metrics.length);
    const anchor = labelPoint.x < centerX - 20 ? "end" : labelPoint.x > centerX + 20 ? "start" : "middle";
    return `
          <line x1="${centerX}" y1="${centerY}" x2="${end.x.toFixed(1)}" y2="${end.y.toFixed(1)}" class="axis"></line>
          ${radarLabel(metricInfo(metric).label, labelPoint.x, labelPoint.y, anchor)}`;
  }).join("");

  const ringShapes = rings.map(level => {
    const points = metrics.map((_, index) => polarPoint(centerX, centerY, radius * level, index, metrics.length));
    return `<polygon points="${radarPolygon(points)}" class="ring"></polygon>`;
  }).join("");

  const providerShapes = providers.map((provider, providerIndex) => {
    const color = providerColor(providerIndex);
    const points = metrics.map((metric, index) => {
      const items = summary.get(provider).get(metric) || [];
      const mean = average(items, row => row.score);
      return polarPoint(centerX, centerY, radius * mean, index, metrics.length);
    });
    return `<polygon points="${radarPolygon(points)}" fill="${color.fill}" stroke="${color.stroke}" class="fit-shape"></polygon>`;
  }).join("");

  const legend = providers.map((provider, index) => {
    const color = providerColor(index);
    return `<span><i style="background:${color.stroke}"></i>${htmlEscape(provider)}</span>`;
  }).join("");

  return `
    <section>
      <h2>Fit Shape</h2>
      <p class="section-note">The shape shows where each setup is strong or thin across this user's preference areas. A wider shape means stronger fit on that preference; uneven shapes are useful because they show tradeoffs.</p>
      <div class="radar-wrap">
        <svg viewBox="0 0 900 520" role="img" aria-label="Radar chart comparing model fit across preference areas">
          ${ringShapes}
          ${axes}
          ${providerShapes}
        </svg>
      </div>
      <div class="legend">${legend}</div>
    </section>`;
}

function provenanceLine(metadata) {
  const parts = [];
  if (metadata.evaluation_mode || metadata.mode) parts.push(`Mode: ${metadata.evaluation_mode || metadata.mode}`);
  if (metadata.source) parts.push(`Source: ${metadata.source}`);
  return parts.join(" | ");
}

export function renderHtml(summary, metadata = {}) {
  const providers = [...summary.keys()].sort();
  const metrics = [...new Set(providers.flatMap(provider => [...summary.get(provider).keys()]))].sort();
  const overall = providers.map(provider => {
    const all = [...summary.get(provider).values()].flat();
    const passRate = average(all, item => item.pass ? 1 : 0);
    const mean = average(all, item => item.score);
    return { provider, passRate, mean };
  }).sort((a, b) => b.mean - a.mean);

  const providerSummaries = overall.map(item => {
    const entries = metrics.map(metric => {
      const items = summary.get(item.provider).get(metric) || [];
      return {
        metric,
        mean: average(items, row => row.score),
        passRate: average(items, row => row.pass ? 1 : 0),
      };
    }).filter(entry => Number.isFinite(entry.mean));
    const best = entries.slice().sort((a, b) => b.mean - a.mean)[0];
    const weakest = entries.slice().sort((a, b) => a.mean - b.mean)[0];
    return { ...item, best, weakest };
  });

  const overallRows = providerSummaries.map(item => `
        <tr>
          <td>${htmlEscape(item.provider)}</td>
          <td>${percent(item.passRate)}</td>
          <td>${item.mean.toFixed(2)}</td>
          <td>
            <div class="bar" aria-label="${htmlEscape(item.provider)} mean score ${item.mean.toFixed(2)}">
              <span class="${toneClass(item.mean)}" style="width:${percent(item.mean)}"></span>
            </div>
            <span class="read ${toneClass(item.mean)}">${labelFor(item.mean)}</span>
          </td>
        </tr>`).join("");

  const summaryRows = providerSummaries.map(item => `
        <tr>
          <td>${htmlEscape(item.provider)}</td>
          <td>${htmlEscape(metricInfo(item.best?.metric || "").label)}</td>
          <td>${htmlEscape(metricInfo(item.weakest?.metric || "").label)}</td>
          <td>${item.mean >= 0.65 ? "Good candidate for this profile, with targeted review." : "Use carefully; inspect failures before relying on it."}</td>
        </tr>`).join("");

  const metricRows = metrics.map(metric => {
    const cells = providers.map(provider => {
      const items = summary.get(provider).get(metric) || [];
      if (!items.length) return `<td class="empty">n/a</td>`;
      const mean = average(items, item => item.score);
      const passRate = average(items, item => item.pass ? 1 : 0);
      return `<td class="cell ${toneClass(mean)}"><b>${mean.toFixed(2)}</b><span>${percent(passRate)} pass</span></td>`;
    }).join("");
    const info = metricInfo(metric);
    return `<tr><th scope="row"><span>${htmlEscape(info.label)}</span><small>${htmlEscape(info.description)}</small></th>${cells}</tr>`;
  }).join("");

  const providerHeaders = providers.map(provider => `<th scope="col">${htmlEscape(provider)}</th>`).join("");
  const radar = renderRadar({ providers, metrics, summary });
  const provenance = provenanceLine(metadata);

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>VibeForge Fit Scorecard</title>
  <style>
    :root {
      --ink: #17202a;
      --muted: #5c6672;
      --line: #d8dde4;
      --panel: #f6f8fa;
      --soft: #fbfcfd;
      --strong: #1f7a4d;
      --solid: #2f6db5;
      --fragile: #a26000;
      --weak: #b3261e;
      --bg: #ffffff;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: var(--bg);
      color: var(--ink);
      font: 14px/1.45 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    main {
      width: min(1120px, calc(100vw - 32px));
      margin: 32px auto 48px;
    }
    header {
      border-bottom: 1px solid var(--line);
      padding-bottom: 18px;
      margin-bottom: 24px;
    }
    h1 {
      font-size: 28px;
      line-height: 1.1;
      margin: 0 0 8px;
      letter-spacing: 0;
    }
    h2 {
      font-size: 18px;
      margin: 28px 0 12px;
      letter-spacing: 0;
    }
    p { color: var(--muted); max-width: 820px; margin: 0; }
    .section-note {
      margin: -4px 0 12px;
      font-size: 13px;
    }
    .lede {
      font-size: 15px;
    }
    .provenance {
      margin-top: 8px;
      color: #39424e;
      font-size: 13px;
      font-weight: 650;
    }
    .explainer {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 12px;
      margin: 18px 0 4px;
    }
    .explainer div {
      border: 1px solid var(--line);
      background: var(--soft);
      border-radius: 6px;
      padding: 12px;
    }
    .explainer b {
      display: block;
      margin-bottom: 4px;
    }
    .explainer span {
      color: var(--muted);
      font-size: 13px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      border: 1px solid var(--line);
      table-layout: fixed;
    }
    th, td {
      border-bottom: 1px solid var(--line);
      padding: 10px 12px;
      text-align: left;
      vertical-align: middle;
      overflow-wrap: anywhere;
    }
    th { background: var(--panel); font-weight: 650; }
    tr:last-child td, tr:last-child th { border-bottom: 0; }
    .bar {
      display: inline-block;
      width: min(220px, 70%);
      height: 10px;
      background: #e8ecf1;
      border-radius: 999px;
      overflow: hidden;
      margin-right: 10px;
      vertical-align: middle;
    }
    .bar span { display: block; height: 100%; }
    .strong { background-color: #e7f4ec; color: var(--strong); }
    .solid { background-color: #e7f0fb; color: var(--solid); }
    .fragile { background-color: #fff3df; color: var(--fragile); }
    .weak { background-color: #fdebea; color: var(--weak); }
    .bar .strong { background: var(--strong); }
    .bar .solid { background: var(--solid); }
    .bar .fragile { background: var(--fragile); }
    .bar .weak { background: var(--weak); }
    .read {
      display: inline-block;
      min-width: 72px;
      border-radius: 4px;
      padding: 2px 6px;
      font-weight: 650;
      text-align: center;
    }
    .matrix th:first-child { width: 320px; }
    .matrix th span { display: block; }
    .matrix th small {
      display: block;
      color: var(--muted);
      font-weight: 400;
      margin-top: 3px;
    }
    .cell b { display: block; font-size: 16px; }
    .cell span { color: var(--muted); font-size: 12px; }
    .empty { color: var(--muted); background: #fafbfc; }
    .radar-wrap {
      border: 1px solid var(--line);
      background: var(--soft);
      border-radius: 6px;
      overflow: hidden;
    }
    svg {
      display: block;
      width: 100%;
      height: auto;
      min-height: 360px;
    }
    .axis {
      stroke: #252b33;
      stroke-width: 2.2;
      opacity: 0.82;
    }
    .ring {
      fill: none;
      stroke: #cbd2dc;
      stroke-width: 1;
    }
    .fit-shape {
      stroke-width: 3;
      vector-effect: non-scaling-stroke;
    }
    .radar-label {
      fill: var(--ink);
      font-size: 16px;
      font-weight: 700;
    }
    .legend {
      display: flex;
      gap: 16px;
      flex-wrap: wrap;
      margin-top: 10px;
      color: var(--muted);
    }
    .legend span {
      display: inline-flex;
      align-items: center;
      gap: 7px;
    }
    .legend i {
      width: 12px;
      height: 12px;
      border-radius: 50%;
      display: inline-block;
    }
    ul { color: var(--muted); padding-left: 20px; }
    @media (max-width: 720px) {
      main { width: min(100vw - 20px, 1120px); margin-top: 20px; }
      table { font-size: 12px; }
      th, td { padding: 8px; }
      .matrix th:first-child { width: 180px; }
      .bar { width: 100%; margin: 0 0 6px; }
      .explainer { grid-template-columns: 1fr; }
      .radar-label { font-size: 12px; }
    }
  </style>
</head>
<body>
  <main>
    <header>
      <h1>Which AI setup fits this workflow?</h1>
      <p class="lede">This chart compares model or agent configurations against a personal preference profile. It is not a general leaderboard; it shows where each setup is more or less likely to behave the way this user wants.</p>
      ${provenance ? `<p class="provenance">${htmlEscape(provenance)}</p>` : ""}
      <div class="explainer" aria-label="How to read this chart">
        <div><b>Checks passed</b><span>The share of test prompts where the setup met the preference threshold.</span></div>
        <div><b>Fit score</b><span>The average score from 0 to 1. Higher means closer to the expected behavior.</span></div>
        <div><b>Plain read</b><span>A quick label: strong, solid, fragile, or needs work. Always inspect failures before deciding.</span></div>
      </div>
    </header>

    <section>
      <h2>Quick Read</h2>
      <table>
        <thead>
          <tr><th>Model/config</th><th>Best at</th><th>Watch out for</th><th>How to use this</th></tr>
        </thead>
        <tbody>${summaryRows}
        </tbody>
      </table>
    </section>

    <section>
      <h2>Scores</h2>
      <table>
        <thead>
          <tr><th>Model/config</th><th>Checks passed</th><th>Fit score</th><th>Plain read</th></tr>
        </thead>
        <tbody>${overallRows}
        </tbody>
      </table>
    </section>

    ${radar}

    <section>
      <h2>Preference Areas</h2>
      <table class="matrix">
        <thead>
          <tr><th>Preference area</th>${providerHeaders}</tr>
        </thead>
        <tbody>${metricRows}
        </tbody>
      </table>
    </section>

    <section>
      <h2>Notes</h2>
      <ul>
        <li>Review failing outputs manually before drawing conclusions.</li>
        <li>Re-run with held-out cases before treating a config as improved.</li>
        <li>Keep private profiles local unless the provider's data policy is acceptable for that content.</li>
      </ul>
    </section>
  </main>
</body>
</html>
`.replace(/[ \t]+$/gm, "");
}

export function chartResultsFile({ input, out = "reports/skill-chart.md", stdout = false, quiet = false }) {
  if (quiet) process.env.VIBEFORGE_QUIET = "1";
  const inputPath = path.resolve(process.cwd(), input);
  const { rows, metadata } = readInput(inputPath);
  if (!rows.length) throw new Error(`No Promptfoo result rows found in ${input}.`);
  const outPath = path.resolve(process.cwd(), out);
  const summary = summarize(rows);
  const ranking = overallRanking(summary);
  const output = outPath.endsWith(".html") ? renderHtml(summary, metadata) : render(summary, metadata);
  const demoData = looksLikeDemoInput(input, metadata);

  if (stdout) {
    process.stdout.write(output);
    return { output, outPath: "", summary, ranking, demoData };
  }

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, output, "utf8");

  if (!isQuiet()) {
    banner("Fit scorecard", "Higher = better match to this preference profile on these cases");
    const facts = ranking.slice(0, 5).map((item, index) => [
      index === 0 ? "Leading setup" : `Setup ${index + 1}`,
      `${item.provider} · mean ${item.mean.toFixed(2)} · pass ${(item.passRate * 100).toFixed(0)}%`,
    ]);
    facts.unshift(["Source", rel(inputPath)]);
    done({
      title: "Scorecard written",
      summary: "Open the HTML/Markdown file for the full breakdown by preference area.",
      facts,
      files: [outPath],
      demoData,
      next: [
        outPath.endsWith(".html") ? `Open ${rel(outPath)} in a browser` : `Read ${rel(outPath)}`,
        "Review weak preference areas before changing anything",
        ...skillSay(
          "Use VibeForge. Create a fit review from my preference: …",
          "Use VibeForge. Run the offline case studies.",
          "Use VibeForge. Compare one setup change and re-chart held-out results.",
        ),
      ],
      trust: [
        "Deterministic rubrics are a regression signal, not proof of broad model quality.",
      ],
    });
  } else {
    console.log(`Wrote skill chart: ${outPath}`);
  }

  return { output, outPath, summary, ranking, demoData };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  chartResultsFile({ input: args.input, out: args.out, stdout: args.stdout, quiet: args.quiet });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    fail("chart", error);
    process.exit(1);
  }
}
