/* ============================================================
   Experiments: batch runs in Web Workers, results table, CSV. Shareable configuration.
   ============================================================ */
const EXP = {
  vary: [
    {k: '', vals: ''},
    {k: '', vals: ''}
  ],
  seed0: 1,
  seed1: 5,
  secs: 200,
  stopDone: true,
  jobs: [],
  results: [],
  running: false,
  done: 0,
  metric: 'ped',
  pool: [],
  cancel: false,
  base: null,
  level: null,
  hover: null,
  pts: []
};
// level: the level the results belong to; hover: the result under the pointer in the chart (its path is bold on the map); pts: the chart's points for hit-testing
const EXP_METRICS = [
  ['goalsDone', 'Goals reached', ''],
  ['t', 'Mission time', 's'],
  ['coll', 'Static collisions', ''],
  ['ped', 'People contacts', ''],
  ['minPed', 'Closest approach', 'm'],
  ['impact', 'Impact speed', 'm/s'], // the safety measures (core/safety.js): the worst moving contact with a person
  ['minObs', 'Wall clearance', 'm'],
  ['nearS', 'Under 0.3 m of a person', 's'],
  ['ttc1S', 'Time to contact under 1 s', 's'],
  ['cteRMS', 'Cross-track RMS', 'm'],
  ['poseRMS', 'Pose RMS', 'm'],
  ['nees', 'NEES', ''],
  ['replans', 'Replans', ''],
  ['dist', 'Distance', 'm']
];
function paramList() {
  const out = [];
  for (const t of ['loc', 'per', 'mis', 'plan', 'ctl', 'veh'])
    for (const f of SCHEMA[t]) {
      if (!f.k || f.k === 'seed') continue;
      out.push(f);
    }
  return out;
}
function baseOverrides() {
  const o = {};
  for (const k of Object.keys(P)) {
    if (k === 'seed') continue;
    const d = k in (LV.cfg || {}) ? LV.cfg[k] : DEFAULTS[k];
    if (d !== undefined && P[k] !== d) o[k] = P[k];
  }
  return o;
}
function fmtOv(o) {
  const e = Object.entries(o);
  return e.length ? e.map(([k, v]) => `${k} ${typeof v === 'boolean' ? (v ? 'on' : 'off') : v}`).join(', ') : 'level defaults';
}
function parseVals(f, txt) {
  if (!f) return [];
  if (f.type === 'seg') {
    const opts = (typeof f.opts === 'function' ? f.opts() : f.opts).map(o => o[0]);
    const want = txt.split(/[,\s]+/).filter(Boolean);
    return want.length ? want.filter(v => opts.includes(v)) : opts;
  }
  if (f.type === 'bool') return [false, true];
  return txt
    .split(/[,\s]+/)
    .filter(Boolean)
    .map(Number)
    .filter(v => isFinite(v));
}
function expPane() {
  const pl = paramList(),
    opt = sel =>
      `<option value="">— none —</option>` +
      pl.map(f => `<option value="${f.k}" ${sel === f.k ? 'selected' : ''}>${f.label.replace(/<[^>]+>/g, '')}</option>`).join('');
  const hint = i => {
    const f = pl.find(x => x.k === EXP.vary[i].k);
    if (!f) return '';
    if (f.type === 'seg') return 'options: ' + (typeof f.opts === 'function' ? f.opts() : f.opts).map(o => o[0]).join(', ');
    if (f.type === 'bool') return 'off and on';
    return `numbers, e.g. ${f.min}, ${((f.min + f.max) / 2).toFixed(2)}, ${f.max}`;
  };
  const n = jobCount();
  return `<p class="note">Runs this level headless in background workers, over seeds and over the values you vary, and tabulates the outcome. The base is the current setup: <b>${LV.id} ${LV.name}</b> with ${esc(fmtOv(baseOverrides()))}.</p>
  <div class="field"><div class="row"><label>Vary</label></div><div class="vary"><select class="sel" data-vary="0">${opt(EXP.vary[0].k)}</select><input type="text" data-vals="0" value="${esc(EXP.vary[0].vals)}" placeholder="${hint(0)}" ${EXP.vary[0].k ? '' : 'disabled'}></div></div>
  <div class="field"><div class="row"><label>Vary also</label></div><div class="vary"><select class="sel" data-vary="1">${opt(EXP.vary[1].k)}</select><input type="text" data-vals="1" value="${esc(EXP.vary[1].vals)}" placeholder="${hint(1)}" ${EXP.vary[1].k ? '' : 'disabled'}></div></div>
  <div class="exprow"><label>Seeds <input type="number" id="exp-s0" min="1" max="99" value="${EXP.seed0}"> to <input type="number" id="exp-s1" min="1" max="99" value="${EXP.seed1}"></label>
    <label>Duration <input type="number" id="exp-secs" min="10" max="900" step="10" value="${EXP.secs}"> s</label>
    <label class="check sm"><input type="checkbox" id="exp-stop" ${EXP.stopDone ? 'checked' : ''}><span>stop when the mission completes</span></label></div>
  <div class="controls"><button class="btn primary" id="exp-run" ${EXP.running ? 'disabled' : ''}>Run ${n} job${n === 1 ? '' : 's'}</button><button class="btn" id="exp-cancel" ${EXP.running ? '' : 'hidden'}>Cancel</button><span class="lbl" id="exp-prog">${EXP.running ? `${EXP.done}/${EXP.jobs.length}` : EXP.results.length ? `${EXP.results.length} runs done` : ''}</span></div>
  <div class="expbar" ${EXP.running ? '' : 'hidden'}><i id="exp-bar" style="width:${EXP.jobs.length ? (100 * EXP.done) / EXP.jobs.length : 0}%"></i></div>
  <div id="exp-out">${expResultsHTML()}</div>
  <details class="how"><summary>Share this setup</summary><div class="how-body">
    <p>The link encodes the level, every parameter that differs from the level's defaults, and the goals. Paste JSON to restore a setup.</p>
    <div class="controls"><button class="btn" id="cfg-link">Copy link</button><button class="btn" id="cfg-export">Save JSON</button><button class="btn" id="cfg-import">Import JSON below</button></div>
    <textarea id="cfg-json" rows="4" spellcheck="false" aria-label="Configuration JSON">${esc(JSON.stringify(currentConfig()))}</textarea><p class="codestat" id="cfg-msg"></p></div></details>`;
}
function jobCount() {
  const pl = paramList();
  let n = Math.max(0, EXP.seed1 - EXP.seed0 + 1);
  for (const v of EXP.vary) {
    if (!v.k) continue;
    const f = pl.find(x => x.k === v.k);
    n *= Math.max(1, parseVals(f, v.vals).length);
  }
  return n;
}
function expResultsHTML() {
  const R = EXP.results;
  if (!R.length) return '';
  const groups = new Map();
  for (const r of R) {
    const key = JSON.stringify(r.cfg);
    if (!groups.has(key)) groups.set(key, {cfg: r.cfg, runs: []});
    groups.get(key).runs.push(r);
  }
  const stat = (runs, k) => {
    const v = runs.map(r => r.s && r.s[k]).filter(x => x != null && isFinite(x));
    if (!v.length) return ['—', null, null];
    const m = v.reduce((a, b) => a + b, 0) / v.length,
      sd = v.length > 1 ? Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / (v.length - 1)) : 0;
    return [m, sd, v];
  };
  const fm = (m, sd, k) => {
    if (m === '—') return '—';
    const d = ['t', 'dist'].includes(k)
      ? 0
      : ['goalsDone', 'coll', 'ped', 'replans', 'nees', 'nearS', 'ttc1S'].includes(k)
        ? 1
        : k === 'impact'
          ? 2
          : 3;
    return sd > 0 ? `${m.toFixed(d)} ± ${sd.toFixed(d)}` : m.toFixed(d);
  };
  const cols = EXP_METRICS;
  let h = `<div class="exptab"><table><thead><tr><th>Configuration</th><th>n</th>${cols.map(c => `<th title="${c[1]}">${c[1]}${c[2] ? ` [${c[2]}]` : ''}</th>`).join('')}</tr></thead><tbody>`;
  for (const g of groups.values()) {
    const err = g.runs.filter(r => r.error).length;
    h += `<tr><td>${esc(fmtOv(g.cfg))}${err ? ` <span class="bad">(${err} failed)</span>` : ''}</td><td>${g.runs.length}</td>${cols
      .map(c => {
        const [m, sd] = stat(g.runs, c[0]);
        return `<td>${fm(m, sd, c[0])}</td>`;
      })
      .join('')}</tr>`;
  }
  h += `</tbody></table></div>
  <div class="controls"><span class="lbl">Chart</span><select class="sel sm" id="exp-metric">${cols.map(c => `<option value="${c[0]}" ${EXP.metric === c[0] ? 'selected' : ''}>${c[1]}</option>`).join('')}</select><button class="btn" id="exp-csv">Save CSV</button><button class="btn" id="exp-copycsv">Copy CSV</button><button class="btn" id="exp-copy">Copy table</button><button class="btn" id="exp-clear">Clear results</button></div>
  <canvas id="cv-exp" class="expchart" aria-label="Metric per configuration"></canvas>`;
  return h;
}
// the colour of a configuration: its rank among the configurations along a ramp from the accent to the rose
function expGroups() {
  const keys = [];
  for (const r of EXP.results) {
    const k = JSON.stringify(r.cfg);
    if (!keys.includes(k)) keys.push(k);
  }
  return keys;
}
function expColor(r, keys) {
  const n = keys.length,
    i = keys.indexOf(JSON.stringify(r.cfg)),
    u = n > 1 ? i / (n - 1) : 0;
  return mixHex(TOK.accent, TOK.rose, u);
}
function mixHex(a, b, u) {
  const p = x => [1, 3, 5].map(i => parseInt(x.slice(i, i + 2), 16)),
    A = p(a),
    B = p(b);
  return (
    '#' +
    A.map((v, i) =>
      Math.round(v + (B[i] - v) * u)
        .toString(16)
        .padStart(2, '0')
    ).join('')
  );
}
// the paths of the experiment's runs on the map; the hovered one bold
function drawSweep(px) {
  if (!EXP.results.length || EXP.level !== LV.id) return;
  const keys = expGroups();
  EXP.results.forEach((r, i) => {
    if (!r.s || !r.s.path || i === EXP.hover) return;
    ctx.lineWidth = px(1.2);
    ctx.strokeStyle = rgba(expColor(r, keys), 0.45);
    polyline(r.s.path);
    ctx.stroke();
  });
  const hv = EXP.hover != null && EXP.results[EXP.hover];
  if (hv && hv.s && hv.s.path) {
    ctx.lineWidth = px(3);
    ctx.strokeStyle = TOK.ink;
    polyline(hv.s.path);
    ctx.stroke();
  }
}
function expHover(i) {
  if (EXP.hover === i) return;
  EXP.hover = i;
  drawExpChart();
  if (AN.mode === 'sim') draw();
}
// the one varied parameter when it is numeric: the chart becomes metric against its value
function expXParam() {
  const ks = [...new Set(EXP.results.flatMap(r => Object.keys(r.cfg)))];
  if (ks.length !== 1) return null;
  const k = ks[0];
  return EXP.results.every(r => typeof r.cfg[k] === 'number') ? k : null;
}
function drawExpChart() {
  const c = $('#cv-exp');
  if (!c || !EXP.results.length) return;
  readTokens();
  const dpr = sizeCanvas(c),
    g = c.getContext('2d'),
    w = c.width,
    h = c.height;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.fillStyle = TOK['map-bg'];
  g.fillRect(0, 0, w, h);
  EXP.pts = [];
  const xk = expXParam();
  if (xk) return drawExpScatter(g, w, h, dpr, xk);
  const groups = new Map();
  for (const r of EXP.results) {
    const key = JSON.stringify(r.cfg);
    if (!groups.has(key)) groups.set(key, {cfg: r.cfg, v: []});
    const x = r.s && r.s[EXP.metric];
    if (x != null && isFinite(x)) groups.get(key).v.push(x);
  }
  const G = [...groups.values()],
    k = EXP.metric,
    M = EXP_METRICS.find(m => m[0] === k);
  let lo = 0,
    hi = -Infinity;
  for (const q of G)
    for (const v of q.v) {
      lo = Math.min(lo, v);
      hi = Math.max(hi, v);
    }
  if (!isFinite(hi)) hi = 1;
  if (hi <= lo) hi = lo + 1;
  hi *= 1.12;
  const padL = 44 * dpr,
    padR = 10 * dpr,
    padT = 22 * dpr,
    padB = 44 * dpr,
    n = G.length,
    bw = (w - padL - padR) / n;
  const Y = v => padT + ((hi - v) / (hi - lo)) * (h - padT - padB);
  g.font = `${Math.round(10 * dpr)}px ${getComputedStyle(document.body).getPropertyValue('--f-mono') || 'monospace'}`;
  g.strokeStyle = TOK.line;
  g.beginPath();
  g.moveTo(padL, Y(0));
  g.lineTo(w - padR, Y(0));
  g.stroke();
  g.fillStyle = TOK.muted;
  g.textAlign = 'right';
  g.textBaseline = 'middle';
  g.fillText(hi.toFixed(hi < 2 ? 2 : 0), padL - 5 * dpr, Y(hi));
  g.fillText('0', padL - 5 * dpr, Y(0));
  G.forEach((q, i) => {
    if (!q.v.length) return;
    const m = q.v.reduce((a, b) => a + b, 0) / q.v.length,
      mn = Math.min(...q.v),
      mx = Math.max(...q.v),
      x0 = padL + bw * (i + 0.2),
      x1 = padL + bw * (i + 0.8),
      xc = (x0 + x1) / 2;
    g.fillStyle = rgba(TOK.accent, 0.55);
    g.fillRect(x0, Y(Math.max(0, m)), x1 - x0, Math.abs(Y(0) - Y(m)));
    if (q.v.length > 1) {
      g.strokeStyle = TOK.ink;
      g.lineWidth = 1.5 * dpr;
      g.beginPath();
      g.moveTo(xc, Y(mn));
      g.lineTo(xc, Y(mx));
      g.moveTo(xc - 4 * dpr, Y(mn));
      g.lineTo(xc + 4 * dpr, Y(mn));
      g.moveTo(xc - 4 * dpr, Y(mx));
      g.lineTo(xc + 4 * dpr, Y(mx));
      g.stroke();
    }
    g.fillStyle = TOK.ink;
    g.textAlign = 'center';
    g.textBaseline = 'bottom';
    g.fillText(m.toFixed(m < 10 ? 2 : 0), xc, Y(Math.max(m, mx)) - 3 * dpr);
    g.fillStyle = TOK.muted;
    g.textBaseline = 'top';
    const lab = fmtOv(q.cfg).split(', ');
    g.fillText(lab[0].slice(0, Math.floor((x1 - x0) / (6 * dpr))), xc, h - padB + 4 * dpr);
    if (lab[1]) g.fillText(lab[1].slice(0, Math.floor((x1 - x0) / (6 * dpr))), xc, h - padB + 16 * dpr);
  });
  g.fillStyle = TOK.muted;
  g.textAlign = 'left';
  g.textBaseline = 'top';
  g.fillText(`${M[1]}${M[2] ? ' [' + M[2] + ']' : ''} · mean per configuration, whiskers min–max over seeds`, padL, 4 * dpr);
  // the bars are hit targets too: hover highlights that configuration's runs on the map
  G.forEach((q, i) => {
    const x0 = padL + bw * (i + 0.2),
      x1 = padL + bw * (i + 0.8);
    EXP.results.forEach((r, ri) => {
      if (JSON.stringify(r.cfg) === JSON.stringify(q.cfg))
        EXP.pts.push({x: (x0 + x1) / 2, y: Y(q.v.length ? q.v.reduce((a, b) => a + b, 0) / q.v.length : 0), i: ri, w: (x1 - x0) / 2});
    });
  });
}
// metric against the parameter: one dot per run, the mean per value as a line; the hovered run is ringed and named
function drawExpScatter(g, w, h, dpr, xk) {
  const k = EXP.metric,
    M = EXP_METRICS.find(m => m[0] === k),
    keys = expGroups(),
    R = EXP.results.filter(r => r.s && r.s[k] != null && isFinite(r.s[k]));
  const xs = [...new Set(R.map(r => r.cfg[xk]))].sort((a, b) => a - b);
  if (!xs.length) return;
  const padL = 44 * dpr,
    padR = 12 * dpr,
    padT = 22 * dpr,
    padB = 34 * dpr;
  let lo = 0,
    hi = -Infinity;
  for (const r of R) {
    lo = Math.min(lo, r.s[k]);
    hi = Math.max(hi, r.s[k]);
  }
  if (!isFinite(hi)) hi = 1;
  if (hi <= lo) hi = lo + 1;
  hi *= 1.12;
  const x0 = xs[0],
    x1 = xs[xs.length - 1],
    X = v => padL + (xs.length > 1 ? (v - x0) / (x1 - x0) : 0.5) * (w - padL - padR),
    Y = v => padT + ((hi - v) / (hi - lo)) * (h - padT - padB);
  g.font = `${Math.round(10 * dpr)}px ${getComputedStyle(document.body).getPropertyValue('--f-mono') || 'monospace'}`;
  g.strokeStyle = TOK.line;
  g.beginPath();
  g.moveTo(padL, Y(0));
  g.lineTo(w - padR, Y(0));
  g.moveTo(padL, padT);
  g.lineTo(padL, Y(0));
  g.stroke();
  g.fillStyle = TOK.muted;
  g.textAlign = 'right';
  g.textBaseline = 'middle';
  g.fillText(hi.toFixed(hi < 2 ? 2 : 0), padL - 5 * dpr, Y(hi));
  g.fillText('0', padL - 5 * dpr, Y(0));
  g.textAlign = 'center';
  g.textBaseline = 'top';
  for (const v of xs) g.fillText(String(+v.toFixed(3)), X(v), h - padB + 4 * dpr);
  const f = paramList().find(x => x.k === xk),
    xl = f ? plain(f.label) : xk;
  g.fillText(`${xl}${f && f.unit ? ' [' + f.unit + ']' : ''}`, (padL + w - padR) / 2, h - padB + 16 * dpr);
  // the mean per value
  g.strokeStyle = TOK.ink;
  g.lineWidth = 1.5 * dpr;
  g.beginPath();
  xs.forEach((v, i) => {
    const ys = R.filter(r => r.cfg[xk] === v).map(r => r.s[k]),
      m = ys.reduce((a, b) => a + b, 0) / ys.length;
    if (i) g.lineTo(X(v), Y(m));
    else g.moveTo(X(v), Y(m));
  });
  g.stroke();
  // one dot per run
  R.forEach(r => {
    const i = EXP.results.indexOf(r),
      x = X(r.cfg[xk]),
      y = Y(r.s[k]);
    EXP.pts.push({x, y, i, w: 6 * dpr});
    g.fillStyle = rgba(expColor(r, keys), i === EXP.hover ? 1 : 0.7);
    g.beginPath();
    g.arc(x, y, (i === EXP.hover ? 4.5 : 3) * dpr, 0, TAU);
    g.fill();
    if (i === EXP.hover) {
      g.strokeStyle = TOK.ink;
      g.lineWidth = 1.5 * dpr;
      g.beginPath();
      g.arc(x, y, 7 * dpr, 0, TAU);
      g.stroke();
    }
  });
  g.fillStyle = TOK.muted;
  g.textAlign = 'left';
  g.textBaseline = 'top';
  const hv = EXP.hover != null && EXP.results[EXP.hover];
  g.fillText(
    hv && hv.s
      ? `${fmtOv(hv.cfg)} · seed ${hv.seed} · ${M[1]} ${hv.s[k]} · click to run this setup`
      : `${M[1]}${M[2] ? ' [' + M[2] + ']' : ''} against ${xl}: a dot per run, the line is the mean · hover a dot to see its path on the map`,
    padL,
    4 * dpr
  );
}
function expCSV() {
  const cols = [
    'level',
    'seed',
    ...Object.keys(EXP.results[0].cfg)
      .concat(Object.keys(EXP.results.reduce((a, r) => Object.assign(a, r.cfg), {})))
      .filter((k, i, a) => a.indexOf(k) === i),
    ...EXP_METRICS.map(m => m[0]),
    'error'
  ];
  const rows = [cols.join(',')];
  for (const r of EXP.results)
    rows.push(
      cols
        .map(k => {
          let v =
            k === 'level' ? r.level : k === 'seed' ? r.seed : k === 'error' ? r.error || '' : k in r.cfg ? r.cfg[k] : r.s ? r.s[k] : '';
          if (v == null) v = '';
          v = String(v);
          return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
        })
        .join(',')
    );
  return rows.join('\n');
}
// Saving a file: the claude.ai viewer mediates downloads; outside it (a local copy of the page) use a plain link
let DL = null,
  DLready = false;
(async () => {
  try {
    if (window.claude && window.claude.use) DL = await window.claude.use('downloads');
  } catch (_) {
    DL = null;
  }
  DLready = true;
})();
async function download(name, text, type) {
  if (DL) {
    try {
      await DL.save({filename: name, data: text});
      return true;
    } catch (e) {
      if (e && e.code !== 'declined') logE('Could not save ' + name + ': ' + (e.message || e.code), 'warn');
      return false;
    }
  }
  if (window.claude && window.claude.use) {
    const el = $('#cfg-msg') || $('#exp-prog');
    if (el) el.textContent = 'Saving files is not available in this view; use Copy instead.';
    return false;
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], {type: type || 'text/plain'}));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  return true;
}
// the page's copy of the worker source has no built-in weights (build.mjs); they come from this page's MODELS
function makeCoreWorker() {
  const src = document.getElementById('core-worker-src').textContent;
  return new Worker(URL.createObjectURL(new Blob([`self.__MODELS=${JSON.stringify(MODELS)};\n`, src], {type: 'text/javascript'})));
}
async function expRun() {
  const pl = paramList(),
    base = baseOverrides(),
    lvl = levelRef(LV);
  let cfgs = [{}];
  for (const v of EXP.vary) {
    if (!v.k) continue;
    const f = pl.find(x => x.k === v.k),
      vals = parseVals(f, v.vals);
    if (!vals.length) continue;
    const nx = [];
    for (const c of cfgs) for (const x of vals) nx.push({...c, [v.k]: x});
    cfgs = nx;
  }
  const jobs = [];
  let id = 0;
  for (const c of cfgs)
    for (let s = EXP.seed0; s <= EXP.seed1; s++)
      jobs.push({
        id: id++,
        level: lvl,
        seed: s,
        overrides: {...base, ...c},
        cfg: c,
        secs: EXP.secs,
        stopWhenDone: EXP.stopDone,
        models: USER_MODELS, // the models trained in the page (Train tab), for a detModel / polModel that names one
        codes: {
          ctl: P.ctl === 'custom' ? SLOTS.ctl.code : null,
          plan: P.plan === 'custom' ? SLOTS.plan.code : null,
          loc: P.loc === 'custom' ? SLOTS.loc.code : null,
          pred: P.agPred === 'custom' ? SLOTS.pred.code : null
        }
      });
  if (!jobs.length) return;
  EXP.jobs = jobs;
  EXP.results = [];
  EXP.done = 0;
  EXP.running = true;
  EXP.cancel = false;
  EXP.base = base;
  EXP.level = LV.id;
  EXP.hover = null;
  if (EXP.metric === 'ped' && !(LV.peds && LV.peds.length)) EXP.metric = 'cteRMS'; // no people on this level: chart the tracking error instead
  renderAllPanes();
  const nW = Math.max(1, Math.min(4, (navigator.hardwareConcurrency || 2) - 1, jobs.length));
  const queue = jobs.slice();
  const worker = async () => {
    const w = makeCoreWorker();
    try {
      while (queue.length && !EXP.cancel) {
        const j = queue.shift();
        const r = await new Promise(res => {
          w.onmessage = e => {
            const d = e.data;
            if (d.progress != null) {
              const el = $('#exp-prog');
              if (el) el.textContent = `${EXP.done}/${jobs.length} · running`;
              return;
            }
            if (d.done) res(d);
          };
          w.onerror = e => res({error: e.message});
          w.postMessage({cmd: 'run', ...j});
        });
        EXP.results.push({level: LV.id, seed: j.seed, cfg: j.cfg, s: r.summary || null, error: r.error || null, ms: r.ms});
        EXP.done++;
        const el = $('#exp-prog'),
          bar = $('#exp-bar');
        if (el) el.textContent = `${EXP.done}/${jobs.length}`;
        if (bar) bar.style.width = (100 * EXP.done) / jobs.length + '%';
        const out = $('#exp-out');
        if (out && (EXP.done % Math.max(1, nW) === 0 || EXP.done === jobs.length)) {
          out.innerHTML = expResultsHTML();
          wireExpOut();
          drawExpChart();
        }
        if (AN.mode === 'sim') draw();
      }
    } finally {
      w.terminate();
    }
  };
  await Promise.all(Array.from({length: nW}, worker));
  EXP.running = false;
  if (activeTab === 'exp') renderAllPanes();
  logE(`Experiment: ${EXP.results.length} run${EXP.results.length === 1 ? '' : 's'} finished${EXP.cancel ? ' (cancelled)' : ''}`, 'ok');
}
function wireExpOut() {
  const m = $('#exp-metric');
  if (m)
    m.onchange = e => {
      EXP.metric = e.target.value;
      drawExpChart();
    };
  const cv = $('#cv-exp');
  if (cv) {
    const near = e => {
      const b = cv.getBoundingClientRect(),
        dpr = cv.width / b.width,
        x = (e.clientX - b.left) * dpr,
        y = (e.clientY - b.top) * dpr;
      let best = null,
        bd = Infinity;
      for (const p of EXP.pts) {
        const d = Math.hypot(p.x - x, p.y - y);
        if (d < bd && d < Math.max(p.w, 10 * dpr) * 2) {
          bd = d;
          best = p.i;
        }
      }
      return best;
    };
    cv.onpointermove = e => expHover(near(e));
    cv.onpointerleave = () => expHover(null);
    cv.onclick = e => {
      const i = near(e);
      if (i == null) return;
      const r = EXP.results[i];
      tryGo({set: {...(EXP.base || {}), ...r.cfg}, seed: r.seed});
      logE(`Running the experiment's setup: ${fmtOv(r.cfg)} · seed ${r.seed}`, 'ok');
    };
    cv.style.cursor = 'crosshair';
  }
  const c = $('#exp-csv');
  if (c) c.onclick = () => download(`nav-lab-${LV.id}-${Date.now()}.csv`, expCSV(), 'text/csv');
  const cc = $('#exp-copycsv');
  if (cc)
    cc.onclick = () => {
      if (navigator.clipboard)
        navigator.clipboard.writeText(expCSV()).then(() => {
          const el = $('#exp-prog');
          if (el) el.textContent = 'CSV copied.';
        });
    };
  const cp = $('#exp-copy');
  if (cp)
    cp.onclick = () => {
      const t = $('.exptab table');
      if (t && navigator.clipboard)
        navigator.clipboard.writeText([...t.rows].map(r => [...r.cells].map(c => c.textContent.trim()).join('\t')).join('\n'));
    };
  const cl = $('#exp-clear');
  if (cl)
    cl.onclick = () => {
      EXP.results = [];
      renderAllPanes();
    };
}
function wireExp(pane) {
  pane.querySelectorAll('[data-vary]').forEach(
    sl =>
      (sl.onchange = () => {
        EXP.vary[+sl.dataset.vary] = {k: sl.value, vals: ''};
        renderAllPanes();
      })
  );
  pane.querySelectorAll('[data-vals]').forEach(
    inp =>
      (inp.oninput = () => {
        EXP.vary[+inp.dataset.vals].vals = inp.value;
        const b = $('#exp-run');
        if (b) b.textContent = `Run ${jobCount()} job${jobCount() === 1 ? '' : 's'}`;
      })
  );
  const num = (id, k, lo, hi) => {
    const el = $(id);
    if (el)
      el.onchange = () => {
        EXP[k] = clamp(Math.round(+el.value) || lo, lo, hi);
        el.value = EXP[k];
        const b = $('#exp-run');
        if (b) b.textContent = `Run ${jobCount()} job${jobCount() === 1 ? '' : 's'}`;
      };
  };
  num('#exp-s0', 'seed0', 1, 99);
  num('#exp-s1', 'seed1', 1, 99);
  num('#exp-secs', 'secs', 10, 900);
  const st = $('#exp-stop');
  if (st)
    st.onchange = () => {
      EXP.stopDone = st.checked;
    };
  const run = $('#exp-run');
  if (run)
    run.onclick = () => {
      if (!EXP.running) expRun();
    };
  const cn = $('#exp-cancel');
  if (cn)
    cn.onclick = () => {
      EXP.cancel = true;
    };
  wireExpOut();
  drawExpChart();
  const lk = $('#cfg-link');
  if (lk)
    lk.onclick = () => {
      const u = configURL();
      if (navigator.clipboard)
        navigator.clipboard.writeText(u).then(
          () => {
            $('#cfg-msg').textContent = 'Link copied.';
          },
          () => {
            $('#cfg-msg').textContent = u;
          }
        );
      else $('#cfg-msg').textContent = u;
      history.replaceState(null, '', '#' + u.split('#')[1]);
    };
  const ex = $('#cfg-export');
  if (ex)
    ex.onclick = () => {
      const j = JSON.stringify(currentConfig(), null, 1);
      $('#cfg-json').value = j;
      if (navigator.clipboard) navigator.clipboard.writeText(j);
      download(`nav-lab-${LV.id}.json`, j, 'application/json').then(ok => {
        $('#cfg-msg').textContent = ok ? 'Saved and copied.' : 'JSON is in the box and on the clipboard.';
      });
    };
  const im = $('#cfg-import');
  if (im)
    im.onclick = () => {
      try {
        applyConfig(JSON.parse($('#cfg-json').value));
        $('#cfg-msg').textContent = 'Applied.';
        renderAllPanes();
      } catch (e) {
        $('#cfg-msg').textContent = 'Could not read that JSON: ' + e.message;
      }
    };
}
// ---- configuration as data ----
// A custom level travels with the setup: a generated one as its spec (gen), any other as the level itself (levelData,
// core/levels.js); the map's edits stay in params, as for a built-in level
function currentConfig() {
  const c = {level: LV.id, seed: P.seed, params: baseOverrides()};
  if (!LEVELS.includes(LV)) {
    if (LV.genSpec) c.gen = {...LV.genSpec};
    else c.levelData = levelJSON(LV);
  }
  const dg = LV.wps.map(w => [w[0], w[1], w.length > 2 ? w[2] : null]),
    cg = WPS.some(w => w.explore) ? dg : WPS.map(w => [w.x, w.y, w.th == null ? null : w.th]); // a frontier goal is the mission's, not the setup's
  if (JSON.stringify(dg) !== JSON.stringify(cg)) c.goals = cg.map(g => g.map(v => (v == null ? null : +v.toFixed(2))));
  return c;
}
function applyConfig(c) {
  let i = LEVELS.findIndex(L => L.id === c.level);
  if (c.gen) i = genSpec(c.gen);
  else if (c.levelData) i = c.levelData;
  else if (c.lz) throw new Error('the level in the link is not read yet');
  else if (i < 0) throw new Error('unknown level ' + c.level);
  if (c.seed) P.seed = clamp(Math.round(c.seed), 1, 99);
  loadLevel(i);
  for (const [k, v] of Object.entries(c.params || {})) {
    if (k in DEFAULTS) setParam(k, v, false);
  }
  if (c.goals) {
    WPS = c.goals.map(g => ({x: g[0], y: g[1], th: g[2] == null ? null : g[2], done: false}));
    S.fsm.state = 'IDLE';
    startMission();
    doPlan('initial');
  }
  running = false;
  renderAllPanes();
  draw();
  refreshAll(); // the tabs show the link's settings at once
}
function configURL() {
  const c = currentConfig(),
    q = [`l=${c.level}`, `seed=${c.seed}`];
  // the level: a spec as key:value pairs; a level as deflated JSON (lz), or plain until that is ready (lj)
  if (c.gen) q.push('gen=' + genLinkEnc(c.gen));
  else if (c.levelData) q.push(LV.lz ? 'lz=' + LV.lz : 'lj=' + b64uText(JSON.stringify(c.levelData)));
  for (const [k, v] of Object.entries(c.params)) q.push(`${k}=${encodeURIComponent(typeof v === 'boolean' ? (v ? 1 : 0) : v)}`);
  if (c.goals) q.push('goals=' + c.goals.map(g => g.map(v => (v == null ? '' : v)).join(',')).join(';'));
  return location.href.split('#')[0] + '#' + q.join('&');
}
function configFromHash() {
  const h = location.hash.slice(1);
  if (!h || !/^l=(L\d|C|G)\b/.test(h)) return null;
  const c = {params: {}};
  for (const part of h.split('&')) {
    const [k, v] = part.split('=');
    const val = decodeURIComponent(v || '');
    if (k === 'l') c.level = val;
    else if (k === 'seed') c.seed = +val;
    else if (k === 'gen') c.gen = genLinkDec(val);
    else if (k === 'lz') c.lz = val;
    else if (k === 'lj') c.levelData = JSON.parse(b64uDecText(val));
    else if (k === 'goals') c.goals = val.split(';').map(g => g.split(',').map(x => (x === '' ? null : +x)));
    else if (k === 'mode') c.mode = val;
    else if (k === 't') c.t = +val;
    else if (k in DEFAULTS) {
      const d = DEFAULTS[k];
      c.params[k] = typeof d === 'boolean' ? val === '1' || val === 'true' : typeof d === 'number' ? +val : val;
    }
  }
  return c;
}
