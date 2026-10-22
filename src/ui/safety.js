/* ============================================================
   Tools → Safety (docs/safety-lab.md, phase 2). The operating domain as a sheet of ranges, checked against the level
   on screen; the scenario search of core/search.js run in background workers, its margin per run charted and the
   worst runs listed, each a button that opens it in the simulator; and scenario sets, the worst runs kept and rerun
   after a change, exported and imported as JSON. Everything is kept for the session.
   A Try sets it up with cfg.saf = {sheet: 'ODD-1' | {…}, budget, rounds, seed, run: true}.
   ============================================================ */
const SAF = {
  sheet: oddCopy(ODD_SHEETS['ODD-1']),
  budget: 40,
  rounds: 2,
  seed: 1,
  secs: 300,
  results: [],
  running: false,
  cancel: false,
  done: 0,
  total: 0,
  sets: [],
  msg: '',
  pts: []
};
const SAF_LABEL = {
  aisle: ['Aisles', 'm'],
  cross: ['Cross aisles', ''],
  gaps: ['Gaps in the racks', ''],
  people: ['People', ''],
  stepout: ['People who wait for the robot', '']
};
// The settings the runs take beyond the scenario's own: what you changed on this level (a mitigation to try), less what
// the sheet itself varies
function safExtra() {
  const ch = levelChanges();
  delete ch.weather;
  delete ch.people;
  return ch;
}
const safWorld = sc =>
  `world ${sc.level.seed} · aisles ${sc.level.aisle} m · ${sc.level.people} people${sc.level.stepout ? ` + ${sc.level.stepout} waiting` : ''} · ${sc.set.weather}${sc.set.people === 'reactive' ? ' · people react' : ''} · seed ${sc.seed}`;
const safWhat = s =>
  !s
    ? 'failed'
    : s.events.length
      ? s.events
          .slice(0, 3)
          .map(e => `${e.sev} ${e.v.toFixed(2)} m/s (${e.kind === 'static' ? 'rack' : 'person'}, ${e.t.toFixed(0)} s)`)
          .join(' · ') + (s.events.length > 3 ? ` · ${s.events.length - 3} more` : '')
      : `no contact · closest ${s.minPed == null ? '—' : s.minPed.toFixed(2)} m · racks ${s.minObs == null ? '—' : s.minObs.toFixed(2)} m`;
function safPane() {
  const sh = SAF.sheet,
    lim = {...GEN_COMMON, ...GEN_FAMILIES[sh.family].params},
    err = oddSheetError(sh),
    ex = safExtra(),
    rng = Object.entries(sh.ranges)
      .map(
        ([k, [lo, hi]]) =>
          `<label>${SAF_LABEL[k][0]} <input type="number" data-odd="${k}" data-end="0" min="${lim[k][1]}" max="${lim[k][2]}" step="${lim[k][3]}" value="${lo}"> to <input type="number" data-odd="${k}" data-end="1" min="${lim[k][1]}" max="${lim[k][2]}" step="${lim[k][3]}" value="${hi}">${SAF_LABEL[k][1] ? ' ' + SAF_LABEL[k][1] : ''}</label>`
      )
      .join(''),
    box = (k, v, l) =>
      `<label class="check sm"><input type="checkbox" data-oddset="${k}" value="${v}" ${sh[k].includes(v) ? 'checked' : ''}><span>${l}</span></label>`;
  const chk = oddCheck(sh)
    .map(
      ([a, v, al, ok]) =>
        `<tr><td>${a}</td><td>${v == null ? '—' : esc(String(v))}</td><td>${esc(al)}</td><td class="${ok === false ? 'bad' : ''}">${ok == null ? 'not derivable' : ok ? 'inside' : 'outside'}</td></tr>`
    )
    .join('');
  return `<p class="note">Where the stack is meant to work, and a search for the runs inside it where it fails anyway. Every run is a generated ${sh.family} with the settings of ${sh.like}${Object.keys(ex).length ? `, plus what you changed: <b>${esc(fmtOv(ex))}</b>` : ''}, run headless to Mission complete or ${SAF.secs} s.</p>
  <h4 class="saf-h">Operating domain: ${esc(sh.name)}</h4>
  <div class="exprow saf-sheet">${rng}</div>
  <div class="exprow"><span class="lbl">Weather</span>${box('weather', 'clear', 'clear')}${box('weather', 'rain', 'rain')}${box('weather', 'fog', 'fog')}<span class="lbl">People</span>${box('people', 'scripted', 'scripted')}${box('people', 'reactive', 'react')}<button class="linkbtn" id="saf-reset">Back to ODD-1</button></div>
  ${err ? `<p class="note bad">The sheet needs ${esc(err)}.</p>` : ''}
  <details class="how"><summary>Is the level on screen inside it?</summary><div class="exptab"><table><thead><tr><th>Attribute</th><th>This level</th><th>The sheet</th><th></th></tr></thead><tbody>${chk}</tbody></table></div></details>
  <h4 class="saf-h">Search</h4>
  <div class="exprow"><label>Runs <input type="number" id="saf-budget" min="4" max="400" step="2" value="${SAF.budget}"></label><label>Refine rounds <input type="number" id="saf-rounds" min="0" max="4" value="${SAF.rounds}"></label><label>Search seed <input type="number" id="saf-seed" min="1" max="999" value="${SAF.seed}"></label></div>
  <div class="controls"><button class="btn primary" id="saf-run" ${SAF.running || err ? 'disabled' : ''}>Search</button><button class="btn" id="saf-cancel" ${SAF.running ? '' : 'hidden'}>Cancel</button><span class="lbl" id="saf-prog">${safProg()}</span></div>
  <div class="expbar" ${SAF.running ? '' : 'hidden'}><i id="saf-bar" style="width:${SAF.total ? (100 * SAF.done) / SAF.total : 0}%"></i></div>
  <div id="saf-out">${safResultsHTML()}</div>
  <h4 class="saf-h">Scenario sets</h4>
  <div id="saf-sets">${safSetsHTML()}</div>`;
}
function safProg() {
  if (SAF.running) return `${SAF.done}/${SAF.total}${SAF.msg ? ' · ' + SAF.msg : ''}`;
  return SAF.msg;
}
function safResultsHTML() {
  const R = SAF.results.filter(r => r.margin != null);
  if (!R.length) return '';
  const st = k => {
    const m = R.filter(r => r.kind === k).map(r => r.margin);
    return m.length
      ? `${m.length} ${k} runs: ${m.filter(x => x < 0).length} with a contact, the worst margin ${Math.min(...m).toFixed(2)}`
      : '';
  };
  const worst = R.slice()
    .sort((a, b) => a.margin - b.margin || a.i - b.i)
    .slice(0, 8);
  return `<canvas id="cv-saf" class="expchart" aria-label="Margin per run"></canvas>
  <p class="note">${[st('random'), st('refine')].filter(Boolean).join('; ')}. The margin is minus the fastest contact's speed when there was one, else the smallest gap to a person or a rack.</p>
  <div class="exptab"><table><thead><tr><th>Run</th><th>Margin</th><th>What happened</th><th>Scenario</th><th></th></tr></thead><tbody>${worst
    .map(
      r =>
        `<tr><td>${r.i + 1} ${r.kind}</td><td class="${r.margin < 0 ? 'bad' : ''}">${r.margin.toFixed(2)}</td><td>${esc(safWhat(r.s))}</td><td>${esc(safWorld(r.sc))}</td><td><button class="btn small" data-safopen="${r.i}">Open</button></td></tr>`
    )
    .join('')}</tbody></table></div>
  <div class="controls"><button class="btn" id="saf-keep" ${SAF.running ? 'disabled' : ''}>Keep the worst 5 as a set</button></div>`;
}
function safSetsHTML() {
  const sets = SAF.sets
    .map((S0, i) => {
      const L = S0.last;
      return `<div class="saf-set"><b>${esc(S0.name)}</b> · ${S0.scenarios.length} scenarios${L ? ` · last rerun: <span class="${L.pass < L.n ? 'bad' : ''}">${L.pass} of ${L.n} without a contact</span>${L.extra ? ` (with ${esc(L.extra)})` : ''}` : ''}
      <div class="controls"><button class="btn small" data-safrerun="${i}" ${SAF.running ? 'disabled' : ''}>Rerun</button><button class="btn small" data-safexport="${i}">Save JSON</button><button class="btn small" data-safdrop="${i}">Remove</button></div>${L ? `<ol class="saf-list">${L.rows.map(r => `<li class="${r.pass ? '' : 'bad'}">${esc(safWhat(r.s))} · ${esc(safWorld(r.sc))}</li>`).join('')}</ol>` : ''}</div>`;
    })
    .join('');
  return `${sets || '<p class="note">No sets yet: search, then keep the worst runs. A set reruns after a change (the safety stop on, a slower cruise) to check that the change helps on every one of them, not only the one that motivated it.</p>'}
  <details class="how"><summary>Import a set</summary><div class="how-body"><textarea id="saf-json" rows="3" spellcheck="false" aria-label="Scenario set JSON"></textarea><div class="controls"><button class="btn" id="saf-import">Import</button></div></div></details>`;
}
// Runs scenarios in background workers, in order of their index; calls back with each result as it lands
async function safRunJobs(list, extra, done) {
  const out = new Array(list.length),
    queue = list.map((sc, i) => ({sc, i})),
    nW = Math.max(1, Math.min(4, (navigator.hardwareConcurrency || 2) - 1, list.length));
  const worker = async () => {
    const w = makeCoreWorker();
    try {
      while (queue.length && !SAF.cancel) {
        const {sc, i} = queue.shift();
        const r = await new Promise(res => {
          w.onmessage = e => e.data.done && res(e.data);
          w.onerror = e => res({error: e.message});
          w.postMessage({
            cmd: 'run',
            id: i,
            level: sc.level,
            seed: sc.seed,
            overrides: {...sc.set, ...extra},
            secs: SAF.secs,
            stopWhenDone: true,
            models: USER_MODELS
          });
        });
        out[i] = r.summary || null;
        done(i, out[i]);
      }
    } finally {
      w.terminate();
    }
  };
  await Promise.all(Array.from({length: nW}, worker));
  return out;
}
const safRefresh = () => {
  if (activeTab === 'saf') renderAllPanes();
};
function safProgress() {
  const el = $('#saf-prog'),
    bar = $('#saf-bar');
  if (el) el.textContent = safProg();
  if (bar) bar.style.width = (100 * SAF.done) / Math.max(1, SAF.total) + '%';
}
async function safSearch() {
  if (SAF.running || oddSheetError(SAF.sheet)) return;
  const sh = oddCopy(SAF.sheet),
    extra = safExtra(),
    plan = searchPlan(SAF.budget, SAF.rounds),
    u = makeRng(SAF.seed * 7919 + 17).u;
  Object.assign(SAF, {running: true, cancel: false, results: [], done: 0, total: plan.reduce((a, s) => a + s.n, 0), msg: ''});
  safRefresh();
  for (const step of plan) {
    if (SAF.cancel) break;
    SAF.msg = step.kind === 'random' ? 'sampling the domain' : 'refining around the worst';
    const batch = searchBatch(step, SAF.results, sh, u),
      base = SAF.results.length;
    const sums = await safRunJobs(batch, extra, () => {
      SAF.done++;
      safProgress();
    });
    batch.forEach((sc, k) => SAF.results.push({i: base + k, kind: step.kind, sc, s: sums[k], margin: searchMargin(sums[k])}));
    const o = $('#saf-out');
    if (o && activeTab === 'saf') {
      o.innerHTML = safResultsHTML();
      wireSafOut();
      drawSafChart();
    }
  }
  SAF.running = false;
  SAF.msg = `${SAF.results.length} runs${SAF.cancel ? ' (cancelled)' : ''}`;
  logE(
    `Safety search: ${SAF.results.length} runs, ${SAF.results.filter(r => r.margin != null && r.margin < 0).length} with a contact`,
    'ok'
  );
  safRefresh();
}
async function safRerun(i) {
  const set = SAF.sets[i];
  if (!set || SAF.running) return;
  const extra = safExtra();
  Object.assign(SAF, {running: true, cancel: false, done: 0, total: set.scenarios.length, msg: 'rerunning ' + set.name});
  safRefresh();
  const sums = await safRunJobs(set.scenarios, extra, () => {
    SAF.done++;
    safProgress();
  });
  const rows = set.scenarios.map((sc, k) => ({sc, s: sums[k], pass: !!sums[k] && !sums[k].events.length}));
  set.last = {rows, n: rows.length, pass: rows.filter(r => r.pass).length, extra: Object.keys(extra).length ? fmtOv(extra) : ''};
  SAF.running = false;
  SAF.msg = `${set.name}: ${set.last.pass} of ${set.last.n} without a contact`;
  logE(`Scenario set rerun: ${SAF.msg}`, set.last.pass === set.last.n ? 'ok' : 'warn');
  safRefresh();
}
function safOpen(sc) {
  tryGo({sim: true, level: sc.level, set: sc.set, seed: sc.seed, tab: 'saf', hold: true});
}
// A Try's cfg.saf: the sheet, the budget, and whether to start
function safFromTry(c) {
  if (c.sheet) SAF.sheet = oddCopy(typeof c.sheet === 'string' ? ODD_SHEETS[c.sheet] : c.sheet);
  for (const k of ['budget', 'rounds', 'seed']) if (c[k] != null) SAF[k] = c[k];
  if (SAF.running) SAF.cancel = true; // a search already running stops after the runs in its workers
  if (c.run)
    (async () => {
      while (SAF.running) await new Promise(r => setTimeout(r, 100));
      safSearch();
    })();
}
function drawSafChart() {
  const c = $('#cv-saf'),
    R = SAF.results.filter(r => r.margin != null);
  if (!c || !R.length) return;
  readTokens();
  const dpr = sizeCanvas(c),
    g = c.getContext('2d'),
    w = c.width,
    h = c.height,
    lo = Math.max(-2, Math.min(-0.5, ...R.map(r => r.margin))),
    hi = Math.min(1.5, Math.max(0.5, ...R.map(r => r.margin))),
    padL = 40 * dpr,
    padR = 10 * dpr,
    padT = 18 * dpr,
    padB = 22 * dpr,
    n = Math.max(SAF.total, R.length),
    X = i => padL + ((i + 0.5) / n) * (w - padL - padR),
    Y = v => padT + ((hi - clamp(v, lo, hi)) / (hi - lo)) * (h - padT - padB);
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.fillStyle = TOK['map-bg'];
  g.fillRect(0, 0, w, h);
  g.font = `${Math.round(10 * dpr)}px ${getComputedStyle(document.body).getPropertyValue('--f-mono') || 'monospace'}`;
  g.fillStyle = rgba(TOK.bad, 0.08);
  g.fillRect(padL, Y(0), w - padL - padR, Y(lo) - Y(0));
  g.strokeStyle = TOK.line;
  g.beginPath();
  g.moveTo(padL, Y(0));
  g.lineTo(w - padR, Y(0));
  g.stroke();
  g.fillStyle = TOK.muted;
  g.textAlign = 'right';
  g.textBaseline = 'middle';
  for (const v of [hi, 0, lo]) g.fillText(v.toFixed(1), padL - 5 * dpr, Y(v));
  g.textAlign = 'left';
  g.fillText('contact below 0 · random (blue) · refined (rose)', padL + 4 * dpr, padT - 9 * dpr);
  for (const r of R) {
    g.fillStyle = r.kind === 'random' ? TOK.accent : TOK.rose;
    g.beginPath();
    g.arc(X(r.i), Y(r.margin), 3.2 * dpr, 0, 2 * Math.PI);
    g.fill();
  }
}
function wireSafOut() {
  const pane = $('#pane');
  if (!pane) return;
  pane.querySelectorAll('[data-safopen]').forEach(b => (b.onclick = () => safOpen(SAF.results[+b.dataset.safopen].sc)));
  const k = $('#saf-keep');
  if (k)
    k.onclick = () => {
      const worst = SAF.results
        .filter(r => r.margin != null)
        .sort((a, b) => a.margin - b.margin || a.i - b.i)
        .slice(0, 5);
      SAF.sets.push({
        name: `Set ${SAF.sets.length + 1}: the worst ${worst.length} runs of the ${SAF.sheet.name.split(',')[0]} search`,
        scenarios: worst.map(r => r.sc),
        last: null
      });
      safRefresh();
    };
}
function wireSaf(pane) {
  pane.querySelectorAll('input[data-odd]').forEach(
    el =>
      (el.onchange = () => {
        const r = SAF.sheet.ranges[el.dataset.odd];
        r[+el.dataset.end] = +el.value;
        safRefresh();
      })
  );
  pane.querySelectorAll('input[data-oddset]').forEach(
    el =>
      (el.onchange = () => {
        const k = el.dataset.oddset,
          L = SAF.sheet[k].filter(v => v !== el.value);
        SAF.sheet[k] = el.checked ? L.concat(el.value) : L;
        safRefresh();
      })
  );
  const num = (id, k) => {
    const el = $(id);
    if (el) el.onchange = () => (SAF[k] = Math.max(+el.min, Math.min(+el.max, Math.round(+el.value) || SAF[k])));
  };
  num('#saf-budget', 'budget');
  num('#saf-rounds', 'rounds');
  num('#saf-seed', 'seed');
  $('#saf-reset').onclick = () => {
    SAF.sheet = oddCopy(ODD_SHEETS['ODD-1']);
    safRefresh();
  };
  $('#saf-run').onclick = () => safSearch();
  $('#saf-cancel').onclick = () => (SAF.cancel = true);
  pane.querySelectorAll('[data-safrerun]').forEach(b => (b.onclick = () => safRerun(+b.dataset.safrerun)));
  pane.querySelectorAll('[data-safdrop]').forEach(
    b =>
      (b.onclick = () => {
        SAF.sets.splice(+b.dataset.safdrop, 1);
        safRefresh();
      })
  );
  pane.querySelectorAll('[data-safexport]').forEach(
    b =>
      (b.onclick = () => {
        const S0 = SAF.sets[+b.dataset.safexport];
        download(
          `nav-lab-scenarios-${S0.name.split(':')[0].replace(/\W+/g, '-').toLowerCase()}.json`,
          JSON.stringify({format: 'nav-stack-lab-scenarios', version: 1, name: S0.name, scenarios: S0.scenarios}, null, 1),
          'application/json'
        );
      })
  );
  $('#saf-import').onclick = () => {
    try {
      const j = JSON.parse($('#saf-json').value);
      if (j.format !== 'nav-stack-lab-scenarios' || !Array.isArray(j.scenarios) || !j.scenarios.length)
        throw new Error('not a scenario set');
      const ok = (k, v) => (PARAM_OPTS[k].includes(v) ? v : DEFAULTS[k]), // a set carries the two settings a sheet varies, nothing else
        scenarios = j.scenarios.slice(0, 50).map(sc => ({
          level: genSpec(sc.level),
          set: {weather: ok('weather', sc.set && sc.set.weather), people: ok('people', sc.set && sc.set.people)},
          seed: clamp(Math.round(+sc.seed || 7), 1, 99)
        }));
      SAF.sets.push({name: plainText(j.name, 80) || `Set ${SAF.sets.length + 1}: imported`, scenarios, last: null});
      SAF.msg = `Imported ${scenarios.length} scenarios`;
    } catch (e) {
      SAF.msg = 'Could not import: ' + e.message;
    }
    safRefresh();
  };
  wireSafOut();
  drawSafChart();
}
