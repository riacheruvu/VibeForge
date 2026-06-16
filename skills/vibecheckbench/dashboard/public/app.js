const STATIC_DEMO = !["127.0.0.1", "localhost"].includes(location.hostname);
const state = { presets: [], runs: [], selectedPreset: "", selectedRun: "", evidence: null };
const $ = selector => document.querySelector(selector);
const PREFERENCES = {
  calibrated_factuality_and_sourceability: "Doesn't overclaim",
  concise_length_control: "Keeps it high-signal",
  context_sensitive_non_refusal: "Helps without overstepping",
  social_sycophancy_resistance: "Pushes back kindly",
  user_agency_and_decision_fit: "Helps me choose",
  verifiable_instruction_following: "Respects my asks",
  custom: "Other / custom",
};

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
  $("#evidence-view").classList.toggle("hidden", view !== "evidence");
  $("#setups-view").classList.toggle("hidden", view !== "setups");
  const hasRuns = state.runs.length > 0;
  $("#dashboard").classList.toggle("hidden", view !== "overview" || !hasRuns);
  $("#empty-state").classList.toggle("hidden", view !== "overview" || hasRuns);
}

function decisionFor(candidateId) {
  return state.evidence?.decisions?.decisions?.find(item => item.candidateId === candidateId) || {};
}

function renderEvidenceSummary() {
  const review = state.evidence?.review;
  const decisions = state.evidence?.decisions?.decisions || [];
  const project = state.evidence?.project;
  const accepted = decisions.filter(item => item.status === "accepted").length;
  const heldOut = decisions.filter(item => item.status === "accepted" && item.split === "held_out").length;
  const cards = [
    { label: "Suggestions to review", value: review?.candidates?.length || 0, note: "Found locally or added by you" },
    { label: "Ready to use", value: accepted, note: "Reviewed tests without private details" },
    { label: "Saved for final check", value: heldOut, note: "Kept unseen while you improve the setup" },
    { label: "Tests created", value: project?.summary?.acceptedCases || 0, note: project ? "Ready for the next evaluation" : "Create the set when your review is done" },
  ];
  $("#evidence-summary").innerHTML = cards.map(card => `
    <article class="summary-card">
      <span class="label">${escapeHtml(card.label)}</span>
      <strong>${escapeHtml(card.value)}</strong>
      <small>${escapeHtml(card.note)}</small>
    </article>`).join("");
}

function preferenceOptions(selected = "") {
  return Object.entries(PREFERENCES).map(([id, label]) =>
    `<option value="${escapeHtml(id)}" ${id === selected ? "selected" : ""}>${escapeHtml(label)}</option>`).join("");
}

function preferenceLabel(candidate) {
  return candidate.preferenceLabel || PREFERENCES[candidate.preferenceId] || candidate.preferenceId;
}

function renderCandidates() {
  const candidates = state.evidence?.review?.candidates || [];
  $("#candidate-list").innerHTML = candidates.length ? candidates.map(candidate => {
    const decision = decisionFor(candidate.id);
    const status = decision.status || "deferred";
    return `
      <article class="candidate-card" data-candidate="${escapeHtml(candidate.id)}">
        <div class="candidate-topline">
          <div><span class="preference-chip">${escapeHtml(preferenceLabel(candidate))}</span><h3>${escapeHtml(decision.title || candidate.suggestedTitle || `Test ${preferenceLabel(candidate)}`)}</h3></div>
          <span class="confidence">Automatic suggestion</span>
        </div>
        <p class="evidence-excerpt"><b>What prompted this suggestion</b><span>${escapeHtml(candidate.userExcerpt || "Added directly by the user.")}</span></p>
        <div class="candidate-fields">
          <label>Test name<input data-field="title" value="${escapeHtml(decision.title || candidate.suggestedTitle || `Test ${preferenceLabel(candidate)}`)}"></label>
          <label>Preference in plain language<textarea data-field="userProfile" rows="2">${escapeHtml(decision.userProfile || candidate.userProfile || "")}</textarea></label>
          <label>Test prompt without private details<textarea data-field="publicSafePrompt" rows="3" placeholder="Rewrite the situation without names, private projects, or sensitive details.">${escapeHtml(decision.publicSafePrompt || candidate.suggestedPublicSafePrompt || "")}</textarea></label>
          <label>A good answer should<textarea data-field="expectedBehavior" rows="2">${escapeHtml(decision.expectedBehavior || candidate.suggestedExpectedBehavior || "")}</textarea></label>
          <label>When to use it<select data-field="split"><option value="development" ${decision.split !== "held_out" ? "selected" : ""}>While improving the setup</option><option value="held_out" ${decision.split === "held_out" ? "selected" : ""}>For a final, unseen check</option></select></label>
        </div>
        <div class="candidate-actions">
          <button class="secondary-button candidate-decision ${status === "rejected" ? "selected-danger" : ""}" data-status="rejected">Reject</button>
          <button class="secondary-button candidate-decision ${status === "deferred" ? "selected-neutral" : ""}" data-status="deferred">Keep for later</button>
          <button class="primary-button candidate-decision" data-status="accepted">${status === "accepted" ? "Save changes" : "Use this test"}</button>
        </div>
      </article>`;
  }).join("") : `<div class="gentle-empty"><b>No suggestions yet</b><span>Import conversations, review the public example, or add a test directly.</span></div>`;

  document.querySelectorAll(".candidate-decision").forEach(button => button.addEventListener("click", async () => {
    const card = button.closest(".candidate-card");
    const candidate = candidates.find(item => item.id === card.dataset.candidate);
    const field = name => card.querySelector(`[data-field="${name}"]`)?.value || "";
    button.disabled = true;
    try {
      const result = await api("/api/evidence/decision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidateId: candidate.id,
          status: button.dataset.status,
          title: field("title"),
          userProfile: field("userProfile"),
          publicSafePrompt: field("publicSafePrompt"),
          expectedBehavior: field("expectedBehavior"),
          split: field("split"),
        }),
      });
      state.evidence = result.evidence;
      renderEvidence();
    } catch (error) {
      alert(error.message);
    } finally {
      button.disabled = false;
    }
  }));
}

function renderSampleLibrary() {
  const samples = state.evidence?.samples || [];
  $("#sample-library").innerHTML = samples.map(sample => `
    <article class="sample-card">
      <span class="preference-chip">${escapeHtml(PREFERENCES[sample.preferenceId] || sample.preferenceId)}</span>
      <h3>${escapeHtml(sample.title)}</h3>
      <p>${escapeHtml(sample.prompt)}</p>
      <small><b>A good answer should:</b> ${escapeHtml(sample.expectedBehavior)}</small>
    </article>`).join("");
}

function renderSetupSurfaces() {
  const surfaces = state.evidence?.setupSurfaces || [];
  const supportLabels = {
    executable: "Ready to compare",
    partial: "System prompts supported",
    manifest: "Can be tracked",
    trace_required: "Needs run history",
    adapter_required: "Needs a connector",
    experiment: "Compare as an experiment",
  };
  $("#setup-surfaces").innerHTML = surfaces.map(surface => `
    <article class="surface-card">
      <div class="surface-heading"><h3>${escapeHtml(surface.label)}</h3><span class="support ${escapeHtml(surface.support)}">${escapeHtml(supportLabels[surface.support] || surface.support)}</span></div>
      <p>${escapeHtml(surface.question)}</p>
      <div><b>You can change</b><span>${surface.changes.map(escapeHtml).join(" / ")}</span></div>
      <div><b>Check whether it improves</b><span>${surface.measures.map(escapeHtml).join(" / ")}</span></div>
    </article>`).join("");
}

function renderCaseStudies() {
  const studies = state.evidence?.caseStudies || [];
  $("#case-study-list").innerHTML = studies.length ? studies.map(study => `
    <article class="case-study-card">
      <div>
        <span class="preference-chip">Case study</span>
        <h3>${escapeHtml(study.title)}</h3>
        <p>${escapeHtml(study.summary)}</p>
      </div>
      <div class="case-study-meta">
        <b>What it shows</b>
        <ol>${(study.workflow || []).slice(0, 4).map(item => `<li>${escapeHtml(item)}</li>`).join("")}</ol>
        <details>
          <summary>How to run this</summary>
          <code>${escapeHtml(study.runCommand || "")}</code>
        </details>
        <small>${escapeHtml(study.expectedTakeaway || study.privacy || "")}</small>
      </div>
    </article>`).join("") : `<div class="gentle-empty"><b>No case studies found</b><span>Add a case-study.json under examples/case-studies.</span></div>`;
}

function renderEvidence() {
  renderEvidenceSummary();
  renderCandidates();
  renderSampleLibrary();
  renderSetupSurfaces();
  renderCaseStudies();
  const preferenceSelect = $("#manual-case-form select[name='preferenceId']");
  if (preferenceSelect && !preferenceSelect.options.length) preferenceSelect.innerHTML = preferenceOptions();
}

function fillManualCase(draft) {
  const form = $("#manual-case-form");
  const set = (name, value) => {
    const field = form.querySelector(`[name='${name}']`);
    if (field) field.value = value || "";
  };
  set("preferenceId", draft.preferenceId);
  set("preferenceName", draft.preferenceName);
  set("title", draft.title);
  set("userProfile", draft.userProfile);
  set("publicSafePrompt", draft.publicSafePrompt);
  set("expectedBehavior", draft.expectedBehavior);
  set("split", draft.split || "development");
  $("#draft-preview").classList.remove("hidden");
  document.querySelector(".direct-case-editor")?.setAttribute("open", "");
}

async function refreshEvidence() {
  state.evidence = STATIC_DEMO
    ? await fetch("./demo-evidence.json").then(response => response.json())
    : await api("/api/evidence");
  renderEvidence();
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
    { label: "Best match in this run", value: best?.name || "Still running", note: best ? `${Math.round(best.passRate * 100)}% of your checks passed` : "Results will appear here", accent: true },
    { label: "Matched best on", value: best?.strongest || "Waiting", note: "The preference this setup handled most reliably" },
    { label: "Answers to review", value: `${failed} ${failed === 1 ? "answer" : "answers"}`, note: failed ? "Open them below to see what went wrong" : "No misses in this run" },
    { label: "Time and tokens", value: `${run.summary?.totalTokens?.toLocaleString() || 0} tokens`, note: `${Math.round(run.summary?.averageLatencyMs || 0).toLocaleString()} ms per answer on average` },
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
      <thead><tr><th>Preference you care about</th>${setups.map(setup => `<th>${escapeHtml(setup.name)}</th>`).join("")}</tr></thead>
      <tbody>${[...metrics.values()].map(metric => `
        <tr>
          <th><span class="metric-title">${escapeHtml(metric.label)}</span><span class="metric-description">${escapeHtml(metric.description)}</span></th>
          ${setups.map(setup => {
            const score = setup.metrics.find(item => item.id === metric.id);
            if (!score) return "<td>Not tested</td>";
            const percent = Math.round(score.score * 100);
            return `<td class="score-cell"><div class="score-row"><b>${percent}% fit</b><span>${score.passed} of ${score.total} checks passed</span></div><div class="meter"><span class="${scoreClass(score.score)}" style="width:${percent}%"></span></div></td>`;
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
  banner.innerHTML = `<b>${accepted ? "This change is worth a closer look" : "The current setup is still the safer choice"}</b>${escapeHtml(run.gate.decision?.reasons?.[0] || "")}`;
}

function renderRecommendation(run) {
  const block = $("#recommendation-block");
  const decision = run.recommendation?.decision;
  if (!decision) return block.classList.add("hidden");
  const actionLabels = {
    collect_more_evidence: "Build a stronger test set",
    test_config_change: "Compare one setup change",
    test_workflow_routing: "Test task-based routing",
    validate_setup_choice: "Confirm the leading setup",
    test_targeted_config_change: "Target the weak behavior",
    keep_and_monitor: "Keep it and keep learning",
  };
  block.classList.remove("hidden");
  $("#recommendation").innerHTML = `
    <div>
      <span class="recommendation-action">${escapeHtml(actionLabels[decision.action] || "Next experiment")}</span>
      <h3>${escapeHtml(decision.headline)}</h3>
      <p>${escapeHtml(decision.rationale)}</p>
    </div>
    <div class="next-experiment"><b>Change next: ${escapeHtml(decision.targetSurface || "one part of the setup")}</b><span>${escapeHtml(decision.nextExperiment)}</span><small>VibeCheckBench will not apply the change automatically. Compare the new results before keeping it.</small></div>`;
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
  renderRecommendation(run);
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
    await refreshEvidence();
    $("#new-run-button").textContent = "Read the source";
    $("#new-run-button").addEventListener("click", () => {
      const owner = location.hostname.split(".")[0];
      const repo = location.pathname.split("/").filter(Boolean)[0];
      location.href = owner && repo ? `https://github.com/${owner}/${repo}` : "https://github.com";
    });
    $(".privacy-note b").textContent = "Read-only demo";
    $(".privacy-note small").textContent = "Example results. No evaluation runs here.";
    $("#import-conversations").disabled = true;
    $("#mine-example").disabled = true;
    $("#promote-evidence").disabled = true;
    $("#draft-test").disabled = true;
    $("#draft-preview").classList.remove("hidden");
    $("#draft-preview").innerHTML = "<b>Read-only demo</b><span>Run the dashboard locally or ask Codex to use VibeCheckBench to draft tests from your own preferences.</span>";
    $("#manual-case-form").querySelectorAll("input, textarea, select, button").forEach(control => { control.disabled = true; });
    $("#candidate-list").querySelectorAll("textarea, select, button").forEach(control => { control.disabled = true; });
    $("#empty-state").classList.add("hidden");
    renderRuns();
    showView("overview");
    if (state.runs[0]) renderRun(state.runs[0]);
    document.querySelectorAll(".nav-item").forEach(button => button.addEventListener("click", () => showView(button.dataset.view)));
    $("#run-select").addEventListener("change", event => renderRun(state.runs.find(run => run.id === event.target.value)));
    return;
  }
  state.presets = await api("/api/presets");
  await refreshEvidence();
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
  document.querySelectorAll("[data-jump-view]").forEach(button => button.addEventListener("click", () => showView(button.dataset.jumpView)));
  $("#run-sheet").addEventListener("click", event => {
    if (event.target === $("#run-sheet")) $("#run-sheet").classList.add("hidden");
  });
  $("#import-conversations").addEventListener("click", () => $("#conversation-file").click());
  $("#conversation-file").addEventListener("change", async event => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const result = await api("/api/evidence/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, content: await file.text() }),
      });
      state.evidence = result.evidence;
      renderEvidence();
    } catch (error) {
      alert(error.message);
    } finally {
      event.target.value = "";
    }
  });
  $("#mine-example").addEventListener("click", async () => {
    const result = await api("/api/evidence/mine-example", { method: "POST" });
    state.evidence = result.evidence;
    renderEvidence();
  });
  $("#promote-evidence").addEventListener("click", async () => {
    try {
      const result = await api("/api/evidence/promote", { method: "POST" });
      state.evidence = result.evidence;
      renderEvidence();
      alert(`Built ${result.promoted} approved case(s).`);
    } catch (error) {
      alert(error.message);
    }
  });
  $("#manual-case-form").addEventListener("submit", async event => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      const result = await api("/api/evidence/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(form.entries())),
      });
      state.evidence = result.evidence;
      event.currentTarget.reset();
      renderEvidence();
    } catch (error) {
      alert(error.message);
    }
  });
  $("#draft-test").addEventListener("click", async event => {
    const button = event.currentTarget;
    button.disabled = true;
    try {
      const preference = $("#plain-preference").value;
      const result = await api("/api/evidence/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preference }),
      });
      fillManualCase(result.draft);
    } catch (error) {
      alert(error.message);
    } finally {
      button.disabled = false;
    }
  });
}

init().catch(error => {
  document.body.innerHTML = `<main><h1>VibeCheckBench could not start</h1><p>${escapeHtml(error.message)}</p></main>`;
});
