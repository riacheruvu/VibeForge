const STATIC_DEMO = !["127.0.0.1", "localhost"].includes(location.hostname);
const state = { presets: [], runs: [], selectedPreset: "", selectedRun: "" };
const $ = selector => document.querySelector(selector);

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
  })[char]);
}

function formatDate(value) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function formatDuration(run) {
  if (!run.finishedAt) return "Running now";
  const seconds = Math.max(1, Math.round((new Date(run.finishedAt) - new Date(run.startedAt)) / 1000));
  return seconds >= 60 ? `${Math.floor(seconds / 60)}m ${seconds % 60}s` : `${seconds}s`;
}

function scoreClass(score) {
  return score < .5 ? "low" : score < .75 ? "mid" : "";
}

async function api(path, options) {
  const response = await fetch(path, options);
  if (!response.ok) throw new Error((await response.json()).error || "Request failed.");
  return response.json();
}

function showView(view) {
  $(".nav-item.active")?.classList.remove("active");
  document.querySelector(`[data-view="${view}"]`)?.classList.add("active");
  $("#runs-view").classList.toggle("hidden", view !== "runs");
  const hasRuns = state.runs.length > 0;
  $("#dashboard").classList.toggle("hidden", view !== "overview" || !hasRuns);
  $("#empty-state").classList.toggle("hidden", view !== "overview" || hasRuns);
}

function renderPresets() {
  $("#preset-list").innerHTML = state.presets.map(preset => `
    <button class="preset ${state.selectedPreset === preset.id ? "selected" : ""}" data-preset="${escapeHtml(preset.id)}">
      <span class="radio" aria-hidden="true"></span>
      <span><b>${escapeHtml(preset.name)}</b><span>${escapeHtml(preset.description)}</span><ul>${(preset.checks || []).map(check => `<li>${escapeHtml(check)}</li>`).join("")}</ul><small>${escapeHtml(preset.privacy)}</small></span>
    </button>`).join("");
  $("#run-button").disabled = !state.selectedPreset;
  document.querySelectorAll(".preset").forEach(button => button.addEventListener("click", () => {
    state.selectedPreset = button.dataset.preset;
    renderPresets();
  }));
}

function setupSummary(run) {
  const setups = run.summary?.setups || [];
  const best = setups[0];
  const failed = setups.reduce((sum, setup) => sum + setup.failures.length, 0);
  const cards = [
    { label: "Best fit in this run", value: best?.name || "Still running", note: best ? `${Math.round(best.passRate * 100)}% of checks passed` : "Results will appear here", accent: true },
    { label: "Strongest preference", value: best?.strongest || "Waiting", note: "Where the leading setup matched best" },
    { label: "Review needed", value: `${failed} failed ${failed === 1 ? "check" : "checks"}`, note: failed ? "Open them below before deciding" : "No failures in this run" },
    { label: "Run footprint", value: `${run.summary?.totalTokens?.toLocaleString() || 0} tokens`, note: `${Math.round(run.summary?.averageLatencyMs || 0).toLocaleString()} ms average response` },
  ];
  $("#summary-cards").innerHTML = cards.map(card => `
    <article class="summary-card ${card.accent ? "accent" : ""}">
      <span class="label">${escapeHtml(card.label)}</span>
      <strong>${escapeHtml(card.value)}</strong>
      <small>${escapeHtml(card.note)}</small>
    </article>`).join("");
}

function renderMatrix(run) {
  const setups = run.summary?.setups || [];
  const metrics = new Map();
  setups.forEach(setup => setup.metrics.forEach(metric => metrics.set(metric.id, metric)));
  $("#preference-matrix").innerHTML = setups.length ? `
    <table class="matrix">
      <thead><tr><th>Preference</th>${setups.map(setup => `<th>${escapeHtml(setup.name)}</th>`).join("")}</tr></thead>
      <tbody>${[...metrics.values()].map(metric => `
        <tr>
          <th><span class="metric-title">${escapeHtml(metric.label)}</span><span class="metric-description">${escapeHtml(metric.description)}</span></th>
          ${setups.map(setup => {
            const score = setup.metrics.find(item => item.id === metric.id);
            if (!score) return "<td>Not tested</td>";
            const percent = Math.round(score.score * 100);
            return `<td class="score-cell"><div class="score-row"><b>${percent}%</b><span>${score.passed}/${score.total} passed</span></div><div class="meter"><span class="${scoreClass(score.score)}" style="width:${percent}%"></span></div></td>`;
          }).join("")}
        </tr>`).join("")}</tbody>
    </table>` : "<p>No result details yet.</p>";
}

function renderFailures(run) {
  const failures = (run.summary?.setups || []).flatMap(setup =>
    setup.failures.map(failure => ({ ...failure, setup: setup.name })));
  $("#failures").innerHTML = failures.length ? failures.map((failure, index) => `
    <article class="failure-row">
      <button class="failure-button" data-failure="${index}">
        <span><b>${escapeHtml(failure.preference)}</b><span>${escapeHtml(failure.setup)} | ${escapeHtml(failure.taskId)}</span></span>
        <b>${Math.round(failure.score * 100)}%</b>
      </button>
      <div class="failure-detail">${escapeHtml(failure.output || "No output captured.")}</div>
    </article>`).join("") : `<p class="all-clear">Every check passed. A larger held-out set is still recommended before relying on the setup.</p>`;
  document.querySelectorAll(".failure-button").forEach(button => button.addEventListener("click", () => {
    button.closest(".failure-row").classList.toggle("open");
  }));
}

function renderDecision(run) {
  const banner = $("#decision-banner");
  if (!run.gate) return banner.classList.add("hidden");
  const accepted = run.gate.decision?.eligibleForHumanReview;
  banner.className = `decision-banner ${accepted ? "accepted" : "rejected"}`;
  banner.innerHTML = `<b>${accepted ? "Candidate is ready for human review" : "Keep the current configuration"}</b>${escapeHtml(run.gate.decision?.reasons?.[0] || "")}`;
}

function renderRun(run) {
  if (!run) return;
  state.selectedRun = run.id;
  $("#run-name").textContent = run.name;
  $("#run-meta").textContent = `${formatDate(run.startedAt)} | ${formatDuration(run)} | ${run.privacy}`;
  $("#run-status").textContent = run.status;
  $("#run-status").className = `status-pill ${run.status}`;
  $("#run-select").value = run.id;
  renderDecision(run);
  setupSummary(run);
  renderMatrix(run);
  renderFailures(run);
}

function renderRuns() {
  $("#run-select").innerHTML = state.runs.map(run => `<option value="${escapeHtml(run.id)}">${escapeHtml(run.name)} | ${formatDate(run.startedAt)}</option>`).join("");
  $("#runs-list").innerHTML = state.runs.map(run => `
    <article class="run-list-item">
      <div><b>${escapeHtml(run.name)}</b><p>${formatDate(run.startedAt)} | ${escapeHtml(run.status)} | ${escapeHtml(run.privacy)}</p></div>
      <button data-open-run="${escapeHtml(run.id)}">Open</button>
    </article>`).join("");
  document.querySelectorAll("[data-open-run]").forEach(button => button.addEventListener("click", () => {
    showView("overview");
    renderRun(state.runs.find(run => run.id === button.dataset.openRun));
  }));
}

async function refreshRuns(preferredId = "") {
  state.runs = await api("/api/runs");
  renderRuns();
  showView("overview");
  const run = state.runs.find(item => item.id === (preferredId || state.selectedRun)) || state.runs[0];
  if (run) renderRun(run);
  return run;
}

async function pollRun(id) {
  let run = await api(`/api/runs/${id}`);
  renderRun(run);
  while (["queued", "running"].includes(run.status)) {
    await new Promise(resolve => setTimeout(resolve, 2000));
    run = await api(`/api/runs/${id}`);
    renderRun(run);
  }
  await refreshRuns(id);
}

async function startRun() {
  const button = $("#run-button");
  button.disabled = true;
  button.textContent = "Starting...";
  try {
    const run = await api("/api/runs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ presetId: state.selectedPreset }),
    });
    $("#run-sheet").classList.add("hidden");
    await refreshRuns(run.id);
    pollRun(run.id);
  } catch (error) {
    alert(error.message);
  } finally {
    button.textContent = "Run evaluation";
    button.disabled = !state.selectedPreset;
  }
}

function openSheet() {
  $("#run-sheet").classList.remove("hidden");
}

async function init() {
  if (STATIC_DEMO) {
    state.runs = await fetch("./demo-data.json").then(response => response.json());
    $("#new-run-button").textContent = "Read the source";
    $("#new-run-button").addEventListener("click", () => {
      const owner = location.hostname.split(".")[0];
      const repo = location.pathname.split("/").filter(Boolean)[0];
      location.href = owner && repo ? `https://github.com/${owner}/${repo}` : "https://github.com";
    });
    $(".privacy-note b").textContent = "Read-only demo";
    $(".privacy-note small").textContent = "Example results. No evaluation runs here.";
    $("#empty-state").classList.add("hidden");
    renderRuns();
    showView("overview");
    if (state.runs[0]) renderRun(state.runs[0]);
    document.querySelectorAll(".nav-item").forEach(button => button.addEventListener("click", () => showView(button.dataset.view)));
    $("#run-select").addEventListener("change", event => renderRun(state.runs.find(run => run.id === event.target.value)));
    return;
  }
  state.presets = await api("/api/presets");
  const preflight = await api("/api/preflight");
  const status = $("#preflight-status");
  status.innerHTML = `<span class="status-dot"></span>${escapeHtml(preflight.ready
    ? `${preflight.runner} ready. ${preflight.models.length} model(s) available.`
    : preflight.error)}`;
  if (!preflight.ready) status.querySelector(".status-dot").style.background = "#ff9f0a";
  renderPresets();
  await refreshRuns();
  $(".open-run-sheet")?.addEventListener("click", openSheet);
  $("#new-run-button").addEventListener("click", openSheet);
  $("#close-sheet").addEventListener("click", () => $("#run-sheet").classList.add("hidden"));
  $("#run-button").addEventListener("click", startRun);
  $("#run-select").addEventListener("change", event => renderRun(state.runs.find(run => run.id === event.target.value)));
  document.querySelectorAll(".nav-item").forEach(button => button.addEventListener("click", () => showView(button.dataset.view)));
  $("#run-sheet").addEventListener("click", event => {
    if (event.target === $("#run-sheet")) $("#run-sheet").classList.add("hidden");
  });
}

init().catch(error => {
  document.body.innerHTML = `<main><h1>VibeCheckBench could not start</h1><p>${escapeHtml(error.message)}</p></main>`;
});
