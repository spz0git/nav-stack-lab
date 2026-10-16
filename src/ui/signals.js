/* ============================================================
   Signals (7.4): everything the run records, by name, for the plot panes, the Values view and the CSV export.
   Two sources at 10 Hz: the telemetry samples (S.plot, from step.js) and the replay frames (REC.frames, record.js).
   ============================================================ */
// index of the sample nearest time t in an array sorted by .t
function nearestIdx(A, t) {
  let lo = 0,
    hi = A.length - 1;
  if (hi < 0) return -1;
  while (lo < hi) {
    const m = (lo + hi) >> 1;
    if (A[m].t < t) lo = m + 1;
    else hi = m;
  }
  return lo > 0 && Math.abs(A[lo - 1].t - t) < Math.abs(A[lo].t - t) ? lo - 1 : lo;
}
const FSM_CODE = {IDLE: 0, PLAN: 1, DRIVE: 2, NO_PATH: 3, LOST: 4, DONE: 5};
const turnU = () => (isCar() ? '°' : 'rad/s');
const dynF_ = (f, k) => (f.sig && f.sig.dyn ? f.sig.dyn[k] : null);
// [id, name, unit (string or function), subsystem, source ('p' telemetry sample, 'f' replay frame), value getter]
const SIGNALS = [
  ['ep', 'Position error', 'm', 'loc', 'p', d => d.ep],
  ['ex', 'x error', 'm', 'loc', 'p', d => d.ex],
  ['ey', 'y error', 'm', 'loc', 'p', d => d.ey],
  ['eth', 'Heading error', '°', 'loc', 'p', d => deg(d.eth)],
  ['sp', 'σ position (filter)', 'm', 'loc', 'p', d => d.sp],
  ['sth', 'σ heading (filter)', '°', 'loc', 'p', d => (d.sth == null ? null : deg(d.sth))],
  ['nees', 'NEES (3 = consistent)', '', 'loc', 'f', f => f.sig && f.sig.nees],
  ['neff', 'Particles N_eff', '', 'loc', 'f', f => f.sig && f.sig.neff],
  ['explored', 'Floor seen', '%', 'per', 'f', f => (f.sig && f.sig.explored != null ? 100 * f.sig.explored : null)],
  ['zn', 'Beacon readings per scan', '', 'loc', 'f', f => (f.lastZ ? f.lastZ.length : null)],
  ['gated', 'Gated readings (total)', '', 'loc', 'f', f => f.sig && f.sig.rejected],
  ['lidar', 'Lidar hits', '', 'per', 'f', f => (f.scan ? f.scan.length / 2 : null)],
  ['trk', 'Agent tracks, confirmed', '', 'per', 'f', f => (f.agents ? f.agents.tracks.filter(t => t.conf).length : null)],
  ['trkall', 'Agent tracks, all', '', 'per', 'f', f => (f.agents ? f.agents.tracks.length : null)],
  [
    'pedgap',
    'Clearance to the nearest person',
    'm',
    'per',
    'f',
    f => {
      if (!f.peds.length) return null;
      let g = Infinity;
      for (const p of f.peds) g = Math.min(g, hyp(f.robot.x - p.x, f.robot.y - p.y) - (p.r || 0.3) - RR);
      return g;
    }
  ],
  ['state', 'Mission state (0 idle · 1 plan · 2 drive · 3 no path · 4 lost · 5 done)', '', 'plan', 'f', f => FSM_CODE[f.fsm.state]],
  ['goals', 'Goals reached', '', 'plan', 'f', f => f.done.filter(d => d[0] && !d[1]).length],
  ['dist', 'Distance driven', 'm', 'plan', 'f', f => f.sig && f.sig.dist],
  ['cte', 'Cross-track error', 'm', 'ctl', 'p', d => d.cte],
  ['vc', 'Speed command', 'm/s', 'ctl', 'p', d => d.vc],
  ['va', 'Speed', 'm/s', 'ctl', 'p', d => d.va],
  ['tc', 'Steering / turn-rate command', turnU, 'ctl', 'p', d => d.tc],
  ['ta', 'Steering / turn rate', turnU, 'ctl', 'p', d => d.ta],
  ['mpcMs', 'MPC solve time', 'ms', 'ctl', 'f', f => f.sig && f.sig.mpcMs],
  ['mpcIt', 'MPC iterations', '', 'ctl', 'f', f => f.sig && f.sig.mpcIt],
  ['mpcJ', 'MPC cost J', '', 'ctl', 'f', f => f.sig && f.sig.mpcJ],
  ['x', 'True x', 'm', '', 'f', f => f.robot.x],
  ['y', 'True y', 'm', '', 'f', f => f.robot.y],
  ['th', 'True heading', '°', '', 'f', f => deg(f.robot.th)],
  ['estx', 'Estimate x', 'm', 'loc', 'f', f => f.est.x],
  ['esty', 'Estimate y', 'm', 'loc', 'f', f => f.est.y],
  ['coll', 'Collisions (total)', '', '', 'f', f => f.coll + f.collPed],
  // the car with tyre slip (Vehicle → Car, dynamic); empty for the other vehicles
  ['beta', 'Sideslip β at the centre of mass', '°', '', 'f', f => dynF_(f, 'beta')],
  ['yawr', 'Yaw rate r', 'rad/s', '', 'f', f => dynF_(f, 'r')],
  ['yawk', 'Kinematic yaw rate v tanδ / L', 'rad/s', '', 'f', f => dynF_(f, 'rk')],
  ['ay', 'Lateral acceleration a_y', 'm/s²', '', 'f', f => dynF_(f, 'ay')],
  ['mug', 'Grip limit μg', 'm/s²', '', 'f', f => dynF_(f, 'mug')],
  ['af', 'Front slip angle α_f', '°', '', 'f', f => dynF_(f, 'af')],
  ['ar', 'Rear slip angle α_r', '°', '', 'f', f => dynF_(f, 'ar')]
];
const SIG = Object.fromEntries(SIGNALS.map(([id, name, unit, sys, src, get]) => [id, {id, name, unit, sys, src, get}]));
const SIG_GROUPS = [
  ['loc', 'Localization'],
  ['per', 'Perception'],
  ['plan', 'Mission'],
  ['ctl', 'Control'],
  ['', 'Vehicle and world']
];
const sigUnit = g => (typeof g.unit === 'function' ? g.unit() : g.unit);
const sigData = g => (g.src === 'p' ? (S ? S.plot : []) : REC.frames);
// the value of a signal at time t (nearest sample), or null
function sigAt(id, t) {
  const g = SIG[id],
    A = sigData(g);
  if (!A.length) return null;
  const i = nearestIdx(A, t);
  if (i < 0 || Math.abs(A[i].t - t) > 0.3) return null;
  const v = g.get(A[i]);
  return v == null || !isFinite(v) ? null : v;
}
const sigFmt = v =>
  v == null
    ? '—'
    : Number.isInteger(v)
      ? String(v)
      : Math.abs(v) >= 100
        ? v.toFixed(0)
        : Math.abs(v) >= 10
          ? v.toFixed(1)
          : Math.abs(v) >= 1
            ? v.toFixed(2)
            : v.toFixed(3);
// the time the views read: a hover, else the replayed moment, else live
const valuesT = () => (CURSOR.hover != null ? CURSOR.hover : shownT());

/* ---------- Values: every signal at the shown time (Foxglove's raw message view) ---------- */
let metView = 'metrics';
function renderValues() {
  const el = $('#values');
  if (!el || metView !== 'values' || !S) return;
  const t = valuesT();
  const live = CURSOR.hover == null && !REPLAY.active;
  el.innerHTML =
    `<p class="val-t">${live ? 'live' : CURSOR.hover != null ? 'hovered' : 'replay'} · ${t.toFixed(1)} s</p>` +
    SIG_GROUPS.map(([sys, title]) => {
      const rows = SIGNALS.filter(s => s[3] === sys)
        .map(([id]) => {
          const g = SIG[id],
            v = sigAt(id, t),
            u = sigUnit(g);
          return `<div><dt title="${esc(g.name)}">${esc(g.name)}</dt><dd>${sigFmt(v)}${v != null && u ? ' ' + u : ''}</dd></div>`;
        })
        .join('');
      return `<section class="val-g"${sys ? ` data-sys="${sys}"` : ''}><h4>${title}</h4><dl class="metrics">${rows}</dl></section>`;
    }).join('');
}
function setMetView(v) {
  metView = v;
  $('#metsel')
    .querySelectorAll('button')
    .forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === v)));
  $('#metrics').hidden = v !== 'metrics';
  $('#values').hidden = v !== 'values';
  renderValues();
}
{
  const h = $('.tele-met h3');
  const w = document.createElement('div');
  w.className = 'met-head';
  h.parentNode.insertBefore(w, h);
  w.appendChild(h);
  h.textContent = '';
  h.className = 'sr-only';
  h.textContent = 'Metrics and values';
  const sg = document.createElement('div');
  sg.className = 'seg sm';
  sg.id = 'metsel';
  sg.setAttribute('aria-label', 'Metrics or values');
  sg.innerHTML =
    '<button type="button" data-v="metrics" aria-pressed="true" title="Run summary">Metrics</button><button type="button" data-v="values" aria-pressed="false" title="Every recorded signal at the shown time (hover a plot or the timeline to read another time)">Values</button>';
  w.appendChild(sg);
  sg.querySelectorAll('button').forEach(b => (b.onclick = () => setMetView(b.dataset.v)));
  const v = document.createElement('div');
  v.id = 'values';
  v.className = 'values';
  v.hidden = true;
  $('#metrics').after(v);
}
