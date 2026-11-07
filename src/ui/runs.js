/* ============================================================
   Runs (7.7). Every run longer than a second is kept when it ends (Reset, a new level, a Try): the last six in
   Recent, and any you Keep, with a name, until the page closes. Compare overlays one run on the current one: its
   path on the map (amber, dashed), its series in every plot, and a table of the metrics side by side. A run exports
   to a JSON file and imports back, so runs can be kept between sessions or passed on.
   ============================================================ */
const RUNS = {recent: [], kept: [], cmp: null, meta: null, n: 0};
// what the run was, noted while it is live: the level and settings change before the core says it ended
function runMetaNote() {
  if (!S) return;
  if (!RUNS.meta || RUNS.meta.S !== S) RUNS.meta = {S, start: Date.now()};
  RUNS.meta.level = LV.id;
  RUNS.meta.cfg = currentConfig();
  RUNS.meta.label = runLabel();
}
const RUN_METRICS = [
  ['goals', 'Goals reached', '', 1],
  ['tDone', 'Mission time', 's', 1],
  ['coll', 'Collisions', '', 0],
  ['ped', 'People contacts', '', 0],
  ['minPed', 'Closest to a person', 'm', 2],
  ['impact', 'Impact speed', 'm/s', 2],
  ['minObs', 'Wall clearance', 'm', 2],
  ['poseRMS', 'Pose RMS', 'm', 3],
  ['nees', 'NEES (mean)', '', 1],
  ['cteRMS', 'Cross-track RMS', 'm', 3],
  ['replans', 'Replans', '', 0],
  ['dist', 'Distance', 'm', 1]
];
function runSnapshot() {
  const F = REC.frames,
    m = RUNS.meta && RUNS.meta.S === S ? RUNS.meta : {level: LV.id, cfg: currentConfig(), label: runLabel()};
  if (!S || S.t <= 1 || F.length < 5) return null;
  const last = F[F.length - 1],
    done = last.done.filter(d => d[0] && !d[1]).length,
    comp = S.log.find(l => /^Mission complete/.test(l.msg));
  const fsig = SIGNALS.filter(s => s[4] === 'f').map(s => s[0]);
  return {
    id: 'r' + ++RUNS.n,
    name: '',
    level: m.level,
    cfg: m.cfg,
    label: m.label,
    t: S.t,
    at: Date.now(),
    metrics: {
      goals: `${done}/${last.done.length}`,
      tDone: comp ? comp.t : null,
      coll: S.coll,
      ped: S.collPed,
      minPed: isFinite(S.minPed) ? Math.max(0, S.minPed) : null,
      impact: safeSummary().impact,
      minObs: isFinite(S.safe.minObs) ? Math.max(0, S.safe.minObs) : null,
      poseRMS: S.errN ? Math.sqrt(S.errSq / S.errN) : null,
      nees: S.nees.length ? S.nees.reduce((a, b) => a + b, 0) / S.nees.length : null,
      cteRMS: S.cteN ? Math.sqrt(S.cteSq / S.cteN) : null,
      replans: S.log.filter(l => /^Replan/.test(l.msg)).length,
      dist: S.dist
    },
    trailT: S.trailT.filter(Boolean).map(p => [+p[0].toFixed(3), +p[1].toFixed(3)]),
    plot: S.plot.map(d => ({...d})),
    F: F.map(f => {
      const o = {t: f.t};
      for (const id of fsig) {
        const v = SIG[id].get(f);
        o[id] = v == null || !isFinite(v) ? null : +(+v).toFixed(4);
      }
      return o;
    })
  };
}
UI.runMeta = () => (RUNS.meta && RUNS.meta.S === S ? RUNS.meta : null);
UI.runEnded = () => {
  const r = runSnapshot();
  if (!r) return;
  const k = RUNS.kept.find(x => x._S === S);
  if (k) {
    const {id, name} = k;
    Object.assign(k, r, {id, name});
    delete k._S;
    renderRuns(true);
    return k;
  } // a run kept while live gets its full length
  RUNS.recent.unshift(r);
  RUNS.recent = RUNS.recent.slice(0, 6);
  renderRuns(true);
  return r;
};
const runName = r => r.name || `${r.level} · ${r.label}`;
const runFind = id => RUNS.kept.find(r => r.id === id) || RUNS.recent.find(r => r.id === id) || null;
function runKeep(r, name) {
  if (!r) return;
  r.name = name || r.name || `${r.level} · ${r.label}`;
  RUNS.recent = RUNS.recent.filter(x => x !== r);
  if (!RUNS.kept.includes(r)) RUNS.kept.unshift(r);
  RUNS.kept = RUNS.kept.slice(0, 12);
  renderRuns(true);
}
function runCompare(r) {
  RUNS.cmp = r && RUNS.cmp !== r ? r : null;
  if (RUNS.cmp && RUNS.cmp.level !== LV.id)
    toast(`That run is on ${RUNS.cmp.level}: its path and plots show when ${RUNS.cmp.level} is loaded (Load its setup)`, 5200);
  renderRuns(true);
  draw();
  drawPlot();
}
// the compared run's data for a signal: [samples, value getter]
function cmpData(G) {
  const r = RUNS.cmp;
  if (!r) return [[], () => null];
  return G.src === 'p' ? [r.plot, G.get] : [r.F, d => d[G.id]];
}
const cmpOn = () => !!(RUNS.cmp && RUNS.cmp.level === LV.id);
// the compared run's path on the map (world coordinates; called by draw())
function drawCompare(px) {
  if (!cmpOn()) return;
  ctx.save();
  ctx.lineWidth = px(2.2);
  ctx.setLineDash([px(6), px(4)]);
  ctx.strokeStyle = rgba(TOK.amber, 0.85);
  polyline(RUNS.cmp.trailT);
  ctx.stroke();
  ctx.restore();
}
// the live run's metrics, in the same form as a snapshot
function liveMetrics() {
  const r = runSnapshot();
  return r ? r.metrics : null;
}

/* ---------- export / import ---------- */
function runExport(r) {
  const {_S, id, ...run} = r,
    o = {format: 'nav-stack-lab-run', version: 1, run};
  download(
    `nav-lab-run-${r.level}-${(r.name || r.label).replace(/[^\w.-]+/g, '-').slice(0, 40)}.json`,
    JSON.stringify(o),
    'application/json'
  );
}
function runImport(text) {
  const o = JSON.parse(text);
  if (
    !o ||
    o.format !== 'nav-stack-lab-run' ||
    !o.run ||
    !Array.isArray(o.run.trailT) ||
    !Array.isArray(o.run.plot) ||
    !Array.isArray(o.run.F)
  )
    throw new Error('not a Nav Stack Lab run file');
  const r = {...o.run, id: 'r' + ++RUNS.n};
  r.name = r.name || `${r.level} · ${r.label} (imported)`;
  RUNS.kept.unshift(r);
  renderRuns(true);
  return r;
}

/* ---------- the Runs panel ---------- */
function runRow(r, kept) {
  const on = RUNS.cmp === r,
    m = r.metrics;
  return `<li class="run${on ? ' cmp' : ''}"><div class="run-main"><b>${esc(runName(r))}</b><span class="lbl">${esc(r.level)} · ${r.t.toFixed(0)} s · goals ${esc(m.goals)}${m.coll + m.ped ? ` · <span class="bad">${m.coll + m.ped} contact${m.coll + m.ped === 1 ? '' : 's'}</span>` : ''}${m.poseRMS != null ? ` · pose RMS ${m.poseRMS.toFixed(2)} m` : ''}</span></div>
    <div class="run-acts"><button type="button" class="ibtn" data-cmp="${r.id}" aria-pressed="${on}" title="Overlay this run on the current one: map path, plots and metrics">Compare</button>${kept ? '' : `<button type="button" class="ibtn" data-keep="${r.id}" title="Keep it in the list, with a name">Keep</button>`}<button type="button" class="ibtn" data-load="${r.id}" title="Load its level, settings and goals">Load setup</button><button type="button" class="ibtn" data-exp="${r.id}" title="Save as a JSON file">Export</button><button type="button" class="ibtn" data-del="${r.id}" aria-label="Remove ${esc(runName(r))}" title="Remove">×</button></div></li>`;
}
function cmpTableHTML() {
  const c = RUNS.cmp;
  if (!c) return '';
  const L = liveMetrics();
  const f = (v, d) => (v == null ? '—' : typeof v === 'string' ? v : v.toFixed(d));
  const delta = (a, b, d) => (a == null || b == null || typeof a === 'string' ? '' : `${a - b > 0 ? '+' : ''}${(a - b).toFixed(d)}`);
  return `<h4 class="chg-h">Compared with <span class="cmp-sw"></span> ${esc(runName(c))}</h4>
   <table class="cmptab"><thead><tr><th>Metric</th><th>This run</th><th>Compared</th><th>Δ</th></tr></thead><tbody>${RUN_METRICS.map(
     ([k, name, u, d]) => {
       const a = L ? L[k] : null,
         b = c.metrics[k];
       return `<tr><td>${name}${u ? ` [${u}]` : ''}</td><td>${f(a, d)}</td><td>${f(b, d)}</td><td>${delta(a, b, d)}</td></tr>`;
     }
   ).join('')}</tbody></table>
   ${c.level !== LV.id ? `<p class="note">That run is on ${esc(c.level)}; its path and plot series show when ${esc(c.level)} is loaded.</p>` : `<p class="note">On the map: its path, amber dashed. In the plots: its series, dashed. This run: ${S.t.toFixed(0)} s so far${L ? '' : ' (run it longer than a second to compare)'}.</p>`}`;
}
function renderRuns(full = true) {
  const p = $('#runpanel');
  if (!p || p.hidden) return;
  if (!full) {
    const c = $('#run-cmp');
    if (c) c.innerHTML = cmpTableHTML();
    return;
  }
  p.innerHTML = `<div class="chg-head"><b>Runs</b><span class="lbl">kept until the page closes; Export keeps one for good</span><button type="button" class="ibtn" id="run-x" aria-label="Close">×</button></div>
   <form class="chg-save" id="run-keepnow"><input type="text" id="run-name" maxlength="60" placeholder="Name this run (${LV.id}, ${S ? S.t.toFixed(0) : 0} s so far)" aria-label="Run name"><button type="submit" class="btn small" ${S && S.t > 1 ? '' : 'disabled'}>Keep this run</button></form>
   <div id="run-cmp">${cmpTableHTML()}</div>
   <h4 class="chg-h">Kept</h4>${RUNS.kept.length ? `<ul class="runs">${RUNS.kept.map(r => runRow(r, true)).join('')}</ul>` : `<p class="note">None yet. Keep the current run above, or a recent one below.</p>`}
   <h4 class="chg-h">Recent <span class="lbl">the last six that ended</span></h4>${RUNS.recent.length ? `<ul class="runs">${RUNS.recent.map(r => runRow(r, false)).join('')}</ul>` : `<p class="note">A run lands here when it ends: Reset, another level, or a Try button.</p>`}
   <div class="controls"><label class="btn small run-imp">Import a run…<input type="file" id="run-file" accept=".json,application/json" hidden></label></div>`;
  $('#run-x').onclick = () => toggleRuns(false);
  $('#run-keepnow').onsubmit = e => {
    e.preventDefault();
    const r = runSnapshot();
    if (!r) {
      toast('Run it longer than a second first');
      return;
    }
    r._S = S;
    runKeep(r, $('#run-name').value.trim());
    toast(`Kept “${runName(r)}”; it keeps growing until the run ends`);
  };
  p.querySelectorAll('[data-cmp]').forEach(b => (b.onclick = () => runCompare(runFind(b.dataset.cmp))));
  p.querySelectorAll('[data-keep]').forEach(b => (b.onclick = () => runKeep(runFind(b.dataset.keep))));
  p.querySelectorAll('[data-load]').forEach(
    b =>
      (b.onclick = () => {
        const r = runFind(b.dataset.load);
        try {
          applyConfig(r.cfg);
          renderAllPanes();
          toast(`Loaded the setup of “${runName(r)}”`);
        } catch (err) {
          toast('Could not load it: ' + err.message);
        }
      })
  );
  p.querySelectorAll('[data-exp]').forEach(b => (b.onclick = () => runExport(runFind(b.dataset.exp))));
  p.querySelectorAll('[data-del]').forEach(
    b =>
      (b.onclick = () => {
        const r = runFind(b.dataset.del);
        if (RUNS.cmp === r) RUNS.cmp = null;
        RUNS.kept = RUNS.kept.filter(x => x !== r);
        RUNS.recent = RUNS.recent.filter(x => x !== r);
        renderRuns(true);
        draw();
        drawPlot();
      })
  );
  $('#run-file').onchange = e => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    f.text()
      .then(t => {
        const r = runImport(t);
        toast(`Imported “${runName(r)}”`);
      })
      .catch(err => toast('Could not import: ' + err.message));
  };
}
function toggleRuns(on) {
  const p = $('#runpanel'),
    b = $('#tg-runs');
  on = on == null ? p.hidden : on;
  if (on) setLevel('advanced', 'the Runs panel');
  p.hidden = !on;
  b.setAttribute('aria-expanded', String(on));
  if (on) {
    p.classList.toggle('sheet', narrowUI());
    renderRuns(true);
    const f = p.querySelector('input,button');
    if (f) f.focus();
  }
}
{
  const b = document.createElement('button');
  b.type = 'button';
  b.id = 'tg-runs';
  b.className = 'ibtn';
  b.setAttribute('aria-expanded', 'false');
  b.setAttribute('aria-controls', 'runpanel');
  b.title = 'Runs: keep, compare and export';
  b.innerHTML = 'Runs <span class="badge" id="runs-n" data-n="0">0</span>';
  $('#bartools').insertBefore(b, $('#tg-dock'));
  b.onclick = () => toggleRuns();
  const p = document.createElement('div');
  p.id = 'runpanel';
  p.className = 'chgpanel runpanel';
  p.hidden = true;
  p.setAttribute('role', 'dialog');
  p.setAttribute('aria-label', 'Runs');
  document.body.appendChild(p);
  document.addEventListener(
    'pointerdown',
    e => {
      if (!p.hidden && !p.contains(e.target) && !b.contains(e.target)) toggleRuns(false);
    },
    true
  );
  p.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      toggleRuns(false);
      b.focus();
    }
  });
}
let runsKey = '';
function renderRunsBadge() {
  runMetaNote();
  const n = RUNS.kept.length + RUNS.recent.length,
    el = $('#runs-n');
  setText(el, String(n));
  setProp(el.dataset, 'n', String(n));
  const key = n + '|' + (RUNS.cmp && RUNS.cmp.id);
  if (key !== runsKey) {
    runsKey = key;
    renderRuns(true);
  } else if (RUNS.cmp && S && Math.floor(S.t) !== renderRunsBadge.t) {
    renderRunsBadge.t = Math.floor(S.t);
    renderRuns(false);
  }
}
