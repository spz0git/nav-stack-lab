/* ============================================================
   Configuration: level loading, parameter changes, kidnapping
   ============================================================ */
function kidnapTo(p) {
  // p = [x, y] or null for a free spot far from the robot
  const r = S.robot;
  let best = null;
  if (!p) {
    for (let i = 0; i < 400; i++) {
      const x = 1 + S.rngA.u() * (W - 2),
        y = 1 + S.rngA.u() * (H - 2),
        k = cellIdx(x, y);
      if (k < 0 || LV.truthDist[k] < 0.8) continue;
      const d = hyp(x - r.x, y - r.y);
      if (d > 6 && (!best || d > best[2])) best = [x, y, d];
      if (best && best[2] > 12) break;
    }
    if (!best) return;
    p = best;
  }
  r.x = p[0];
  r.y = p[1];
  r.v = 0;
  r.w = 0;
  r.d = 0;
  r.vy = 0;
  r.r = 0;
  r.contact = false;
  S.trailT.push(null);
  logE(`Robot kidnapped to (${p[0].toFixed(1)}, ${p[1].toFixed(1)}). The estimate was not told.`, 'bad');
  UI.draw();
  UI.refresh();
}
/* ---------- the fault schedule (P.sched): settings changed, or the robot kidnapped, at set times ----------
   An event {t, set: {key: value, …}} or {t, act: 'kidnap' | 'scatter', to: [x, y]} applies just before the first tick
   that starts at or after t seconds: a sensor switched off at 30 s, fog rolling in, the kidnap of the localization
   lessons (a Try's act, 8 s). It is a setting, so a Try's set, a worker run's overrides and a level's settings carry it,
   and a reset replays it. Events apply in list order; each once per run. */
const SCHED_ACTS = ['kidnap', 'scatter'];
function schedError(v) {
  if (!Array.isArray(v)) return 'a list of events';
  if (v.length > 32) return 'at most 32 events';
  for (const e of v) {
    if (!e || typeof e !== 'object' || typeof e.t !== 'number' || !(e.t >= 0)) return 'a time t ≥ 0 s in each event';
    if (e.act != null && !SCHED_ACTS.includes(e.act)) return `act to be ${SCHED_ACTS.join(' or ')}`;
    if (e.act == null && (!e.set || typeof e.set !== 'object')) return 'set: {setting: value} or an act in each event';
    if (e.set)
      for (const k of Object.keys(e.set))
        if (!Object.hasOwn(DEFAULTS, k) || k === 'sched' || k === 'seed') return `settings it knows, not ${k}`;
  }
  return null;
}
function schedTick() {
  const E = P.sched;
  if (!E || !E.length) return;
  if (S.schedRef !== E) {
    S.schedRef = E;
    S.schedDone = new Set();
  }
  for (let i = 0; i < E.length; i++) {
    const e = E[i];
    if (S.schedDone.has(i) || S.t + 1e-9 < e.t) continue;
    S.schedDone.add(i);
    if (e.act === 'kidnap') kidnapTo(e.to || null);
    else if (e.act === 'scatter') scatterParticles();
    else {
      logE(
        `Fault schedule at ${e.t} s: ${Object.entries(e.set)
          .map(([k, v]) => `${k} → ${v}`)
          .join(', ')}`,
        'warn'
      );
      for (const [k, v] of Object.entries(e.set)) setParam(k, v, false); // as a released slider: with every effect
    }
  }
}
// i: a built-in level's index, a level (the runtime object, the JSON format) or a generator spec (levelOf, levels.js)
function loadLevel(i) {
  LV = levelOf(i);
  setWorld(...levelSize(LV));
  // every setting goes back to the level's, except the seed and the trained models picked in Perceive and Plan, so that
  // a model trained in the page can be tried on every level (Agent tracking / Planner still follow the level)
  // the level's settings pass the same check as a setup link's (paramError): one that fails is left out and logged
  const cfg = {},
    warn = [...(LV.warn || [])];
  for (const [k, v] of Object.entries(LV.cfg)) {
    const why = paramError(k, v);
    if (why) warn.push(why);
    else cfg[k] = v;
  }
  Object.assign(P, DEFAULTS, {seed: P.seed, detModel: P.detModel, polModel: P.polModel, predModel: P.predModel}, cfg);
  applyMap();
  LAYERS.cost = !!(LV.layers && LV.layers.cost);
  WPS = LV.wps.map(w => ({x: w[0], y: w[1], th: w.length > 2 ? w[2] : null, done: false}));
  running = false;
  reset();
  for (const w of warn) logE(`Ignored the level's setting: ${w}`, 'warn');
  UI.levelChanged();
  UI.invalidate();
}
// Picking another level yourself (the level menu, search) keeps every setting you changed from the current level's own
// setup; the new level supplies the rest. Not carried: what belongs to the old level's geometry (the painted and erased
// map, the beacons switched off), and a planner or tracker the new level's vehicle cannot use. Try buttons, lessons,
// setup links and the tests call loadLevel, which starts from the level's own setup (the seed and the trained models
// aside), so that the numbers quoted with them hold. Returns {kept, dropped}: the settings carried, and the ones not.
const LEVEL_OWN = ['seed', 'map', 'mapAdd', 'mapDel', 'bOff'];
function levelChanges() {
  const out = {};
  for (const k of Object.keys(DEFAULTS)) {
    if (LEVEL_OWN.includes(k)) continue;
    const d = k in LV.cfg ? LV.cfg[k] : DEFAULTS[k];
    if (P[k] !== d) out[k] = P[k];
  }
  return out;
}
function switchLevel(i) {
  const ch = levelChanges(),
    kept = {},
    dropped = {};
  loadLevel(i);
  // the vehicle first: whether a planner or tracker fits depends on it (the model's effect re-picks the planner)
  const keys = ['model', 'carPhys'].filter(k => k in ch).concat(Object.keys(ch).filter(k => k !== 'model' && k !== 'carPhys'));
  for (const k of keys) {
    const v = ch[k],
      unfit = isCar()
        ? k === 'plan' && v === 'stastar'
        : (k === 'plan' && (v === 'rs' || v === 'hybrid')) || (k === 'ctl' && v === 'stanley');
    if (unfit) dropped[k] = v;
    else {
      setParam(k, v, false);
      kept[k] = v;
    }
  }
  const n = Object.keys(kept).length,
    nd = Object.keys(dropped).length;
  if (n) logE(`Kept ${n} setting${n > 1 ? 's' : ''} you changed: ${Object.keys(kept).join(', ')}`);
  if (nd)
    logE(
      `Not kept (this level's vehicle cannot use it): ${Object.entries(dropped)
        .map(([k, v]) => `${k} ${v}`)
        .join(', ')}`,
      'warn'
    );
  return {kept, dropped};
}
// The map as edited: the level's obstacles (all of them, none but the outer walls with map = 'empty', less the ones
// erased in mapDel) plus the painted cells of mapAdd, a 0.4 m grid merged into one rectangle per run along a row. The
// level keeps its designed list in shapes0; the occupancy and distance grids are rebuilt only when the edit changed.
const PAINT = 0.4;
let PGW = Math.round(W / PAINT),
  PGH = Math.round(H / PAINT);
const idList = s =>
  String(s || '')
    .split(',')
    .filter(x => x !== '')
    .map(Number)
    .filter(n => Number.isInteger(n) && n >= 0);
const paintCell = (x, y) => {
  const i = Math.floor(x / PAINT),
    j = Math.floor(y / PAINT);
  return i < 0 || j < 0 || i >= PGW || j >= PGH ? -1 : j * PGW + i;
};
function applyMap() {
  const L = LV;
  if (!L.shapes0) L.shapes0 = L.shapes;
  const key = `${P.map}|${P.mapAdd}|${P.mapDel}`;
  if (L.mapKey === key) return false;
  const del = new Set(idList(P.mapDel)),
    out = L.shapes0.filter((s, i) => s.border || (P.map !== 'empty' && !del.has(i)));
  const cells = [...new Set(idList(P.mapAdd))].filter(c => c < PGW * PGH).sort((a, b) => a - b);
  for (let k = 0; k < cells.length;) {
    const j = Math.floor(cells[k] / PGW),
      i0 = cells[k] % PGW;
    let n = 1;
    while (k + n < cells.length && cells[k + n] === cells[k] + n && (cells[k] % PGW) + n < PGW) n++;
    out.push({t: 'r', x: i0 * PAINT, y: j * PAINT, w: n * PAINT, h: PAINT, painted: true});
    k += n;
  }
  L.shapes = out;
  L.mapKey = key;
  L.truthOcc = null; // prepLevel rebuilds the grids from the new list
  return true;
}
// A painted cell or an erased obstacle while the run goes on: the grids, the costmap and the plan follow at once
function mapChanged() {
  if (!applyMap() || !S) return;
  prepLevel(LV);
  S.shapes = LV.shapes;
  S.dstar = null;
  buildCostmap();
  dirty.occ = dirty.cost = true;
  requestReplan('map edited');
}
// What changing a parameter implies, as an ordered table: [the keys, the effect(k, v, old, live)]. Several keys may
// share one effect; a key may appear in more than one entry (each runs, in this order). `live` is true while a slider
// is still being dragged, so the costly effects (a costmap rebuild, a replan) wait for the release.
const PARAM_EFFECTS = [
  [
    ['loc', 'npart', 'pgKf', 'pgLoop', 'pgMatch'],
    () => {
      S.locInit = false;
      if (SLOTS.loc.worker) SLOTS.loc.worker.reset();
      initLoc(false);
      logE(
        `Localization → ${{truth: 'ground truth', dr: 'dead reckoning', ekf: 'EKF', pf: 'particle filter', slam: 'EKF-SLAM', pgslam: 'pose-graph SLAM', custom: 'your code'}[P.loc]}`
      );
    }
  ],
  [
    ['assoc', 'inject', 'filtK', 'scanMatch'],
    () => {
      S.nees = [];
      S.sm = null;
    }
  ],
  [
    ['agents'],
    (k, v) => {
      S.agents = agInit();
      logE(`Agent tracking → ${{off: 'off', truth: 'ground truth', lidar: 'lidar', learned: 'learned detector'}[v]}`);
    }
  ],
  [
    ['trkIn'],
    (k, v) => {
      S.agents = agInit();
      logE(`Tracker inputs → ${{lidar: 'lidar', radar: 'radar', both: 'lidar and radar'}[v]}`);
    }
  ],
  [
    ['radar', 'weather'],
    (k, v) =>
      logE(
        k === 'radar'
          ? `Radar → ${v ? 'on' : 'off'}`
          : `Weather → ${v}${v === 'clear' ? '' : ': the lidar reaches less far, drops beams and sees the air'}`
      )
  ],
  [
    ['detModel', 'polModel', 'predModel'],
    (k, v) => {
      const M = USER_MODELS[v],
        what = {detModel: 'Detector', polModel: 'Policy', predModel: 'Predictor'}[k];
      if (v !== 'builtin' && !M) logE(`${what} model "${v}" is not in this browser (yet): the built-in one runs until it is`, 'warn');
      else logE(`${what} model → ${M ? M.label || v : 'built-in'}`);
      if (k === 'detModel') S.agents = agInit();
      else if (k === 'predModel') for (const t of S.agents ? S.agents.tracks : []) t.lp = null;
      else if (P.plan === 'policy') requestReplan('policy model changed');
    }
  ],
  [
    ['spd'],
    (k, v) => logE(`Response to agents → ${{none: 'ignore', stop: 'reactive stop', st: 'speed planning', vo: 'velocity obstacles'}[v]}`)
  ],
  [
    ['gyro', 'zupt'],
    (k, v) => {
      S.gyroBiasEst = 0;
      logE(
        k === 'gyro'
          ? `Yaw-rate gyro → ${v ? 'on: the turn rate comes from the gyro' : 'off: the turn rate comes from the wheels'}`
          : `Zero-velocity bias update → ${v ? 'on' : 'off'}`
      );
    }
  ],
  [
    ['per'],
    (k, v) => {
      if (v === 'mapping') S.lo.fill(0);
      buildCostmap();
      dirty.occ = true;
      logE(`Map source → ${v === 'oracle' ? 'prior map' : 'lidar mapping (empty grid)'}`);
      requestReplan('map source changed');
    }
  ],
  [
    ['unknownAs', 'infl'],
    (k, v, old, live) => {
      if (live) return;
      buildCostmap();
      requestReplan('costmap changed');
    }
  ],
  [
    ['mis'],
    (k, v) => {
      if (S.fsm.state !== 'IDLE' && S.fsm.state !== 'DONE') {
        startMission();
        doPlan('initial');
      } else logE(`Goal order → ${v}`);
    }
  ],
  [
    ['plan', 'smooth', 'policyGoal'],
    () => {
      S.dstar = null; // D* Lite's search is tied to its planner and ε
      requestReplan('planner changed');
    }
  ],
  [
    ['eps', 'rrtIt'],
    (k, v, old, live) => {
      if (!live) {
        S.dstar = null;
        requestReplan('planner changed');
      }
    }
  ],
  [
    ['ctl'],
    (k, v) => {
      S.ctlState = {I: 0, prev: null};
      S.ctlViz = null;
      SLOTS.ctl.lastErr = '';
      if (SLOTS.ctl.worker) SLOTS.ctl.worker.reset();
      logE(
        `Controller → ${{pp: 'pure pursuit', rwf: 'rear-wheel feedback', pid: 'PID', dwa: 'DWA', stanley: 'Stanley', mpc: 'MPC', custom: 'your code'}[v]}`
      );
    }
  ],
  [
    ['agPred'],
    () => {
      if (SLOTS.pred.worker) SLOTS.pred.worker.reset();
    }
  ],
  [
    ['vehicles', 'people'],
    (k, v) => {
      if (k === 'vehicles') {
        S.peds = S.peds.filter(p => !p.car);
        if (v) carsInit();
      }
      logE(k === 'people' ? `People → ${v}` : `Other vehicles → ${v ? 'on' : 'off'}`);
    }
  ],
  [
    ['map', 'mapAdd', 'mapDel'],
    (k, v) => {
      mapChanged();
      if (k === 'map')
        logE(v === 'empty' ? 'Map → empty floor: only the outer walls; beacons, people and goals stay' : "Map → the level's obstacles");
    }
  ],
  [
    ['misLoop'],
    (k, v) => {
      logE(v ? 'Repeat the goals: after the last goal the mission starts again' : 'Repeat the goals off');
      if (v && S.fsm.state === 'DONE' && WPS.length) missionRepeat();
    }
  ],
  [
    ['bOff'],
    () => {
      const n = beaconsOff().size,
        u = beaconUse();
      logE(
        n
          ? `Beacons switched off: ${[...beaconsOff()].join(', ')} (${S.beacons.length - n} of ${S.beacons.length} on)${u ? `; note: ${u}` : ''}`
          : 'All beacons on',
        n && u && P.loc !== 'custom' ? 'warn' : ''
      );
    }
  ],
  [
    ['bOut'],
    (k, v, old, live) => {
      if (!live) logE(v > 0 ? `Random beacon outages: each beacon down ${v} % of the time` : 'Random beacon outages off');
    }
  ],
  [
    ['seed'],
    (k, v, old, live) => {
      if (!live) logE(`Seed ${v} takes effect on Reset`);
    }
  ],
  [
    ['carPhys'],
    (k, v) => {
      S.robot.vy = 0;
      S.robot.r = 0;
      logE(v === 'dyn' ? 'Car → dynamic (tyre slip)' : 'Car → kinematic (no slip)');
    }
  ],
  [
    ['model'],
    (k, v) => {
      S.robot.d = 0;
      S.robot.w = 0;
      S.robot.vy = 0;
      S.robot.r = 0;
      S.cmd = {v: 0, w: 0, steer: 0};
      if (v === 'diff') {
        if (P.plan === 'rs' || P.plan === 'hybrid') P.plan = 'astar';
        if (P.ctl === 'stanley') P.ctl = 'pp';
      } else if (P.plan !== 'rs') P.plan = 'hybrid';
      logE(v === 'car' ? 'Vehicle → car-like (bicycle) · planner → Hybrid A*' : 'Vehicle → unicycle (diff-drive)');
      requestReplan('vehicle model changed');
    }
  ],
  [
    ['wheelbase', 'steerMaxDeg', 'revOK', 'revPen', 'gearPen', 'hybH', 'planPct'],
    (k, v, old, live) => {
      if (!live && (P.plan === 'hybrid' || P.plan === 'rs')) requestReplan('vehicle or planner changed');
    }
  ]
];
// the keys whose effect runs even when the value did not change (a slider released on its old value still rebuilds)
const PARAM_ALWAYS = ['infl', 'eps', 'rrtIt', 'wheelbase', 'steerMaxDeg', 'revPen', 'gearPen', 'planPct'];
// What is wrong with the value v for the parameter k, or null: a choice parameter must be one of its values, a numeric
// one a finite number within its range (PARAM_RANGE), the fault schedule well formed. setParam and a level's settings
// (levels.js) both check with it.
function paramError(k, v) {
  // own keys only: a key such as __proto__ or constructor would otherwise find Object.prototype's members
  if (Object.hasOwn(PARAM_OPTS, k) && !PARAM_OPTS[k].includes(v)) return `${k} has no value "${v}" (one of ${PARAM_OPTS[k].join(', ')})`;
  if (typeof DEFAULTS[k] === 'number' && !(typeof v === 'number' && isFinite(v))) return `${k} needs a number, not "${v}"`;
  const R = Object.hasOwn(PARAM_RANGE, k) ? PARAM_RANGE[k] : null;
  if (R && (v < R[0] || v > R[1])) return `${k} must be from ${R[0]} to ${R[1]}, not ${v}`;
  if (k === 'sched' && schedError(v)) return `the fault schedule needs ${schedError(v)}`;
  return null;
}
// Set one parameter: `veh` fans out to model and carPhys; a value paramError rejects (a mistyped setup link or Try cfg,
// a number out of range) is ignored with a log line and the old value kept; then the effects table runs.
function setParam(k, v, live) {
  if (k === 'veh') {
    const m = v === 'diff' ? 'diff' : 'car';
    if (m !== P.model) setParam('model', m, live);
    if (m === 'car') setParam('carPhys', v === 'dyn' ? 'dyn' : 'kin', live);
    return;
  }
  const why = paramError(k, v);
  if (why) {
    logE(`Ignored: ${why}`, 'warn');
    return;
  }
  const old = P[k];
  P[k] = v;
  if (k.startsWith('mpc') && S) S.mpc = null;
  if (old === v && !PARAM_ALWAYS.includes(k)) return;
  for (const [keys, fx] of PARAM_EFFECTS) if (keys.includes(k)) fx(k, v, old, live);
  UI.invalidate();
  if (UI.mode() === 'sim') {
    UI.draw();
    UI.refresh();
  }
}
function toggleBeacon(id) {
  const s = beaconsOff();
  if (s.has(id)) s.delete(id);
  else s.add(id);
  setParam('bOff', [...s].sort((a, b) => a - b).join(','), false);
}
function requestReplan(reason) {
  const F = S.fsm;
  if (F.state === 'DRIVE' || F.state === 'NO_PATH' || F.state === 'PLAN') {
    F.state = 'PLAN';
    F.pendingReason = reason;
    if (!running) advanceMission();
  }
}
function advanceMission() {
  missionTick();
  UI.draw();
  UI.refresh();
}
