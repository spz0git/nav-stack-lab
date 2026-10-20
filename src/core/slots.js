/* ============================================================
   Code slots: user JavaScript for the controller, the global planner, the localizer and the agent predictor.
   Each slot runs in its own Web Worker, called in lockstep with the simulation, with a timeout.
   ============================================================ */
// The slot examples come from src/examples/<slot>/*.js (tools/code.mjs inlines them as SLOT_LIBRARY); the editor starts
// on the first one of each slot.
const slotExample = (k, id) => (SLOT_LIBRARY[k] || []).find(e => !id || e.id === id) || {id: '', name: '', code: ''};
const SLOT_DEFS = {
  ctl: {
    name: 'Controller',
    fn: 'control',
    timeout: 200,
    param: 'ctl',
    wrap: r => ({
      ok: true,
      v: +r.v || 0,
      w: +r.w || 0,
      steer: r.steer == null ? null : +r.steer,
      mark: Array.isArray(r.mark) ? r.mark : null
    })
  },
  plan: {
    name: 'Planner',
    fn: 'plan',
    timeout: 3000,
    param: 'plan',
    wrap: r => ({ok: true, path: r.path, segs: r.segs, error: r.error, expansions: r.expansions, nodes: r.nodes})
  },
  loc: {
    name: 'Localizer',
    fn: 'localize',
    timeout: 200,
    param: 'loc',
    wrap: r => ({ok: true, x: +r.x, y: +r.y, th: +r.th, cov: Array.isArray(r.cov) && r.cov.length === 9 ? r.cov.map(Number) : null})
  },
  pred: {name: 'Predictor', fn: 'predict', timeout: 200, param: 'agPred', wrap: r => ({ok: true, trajectories: r.trajectories || {}})}
};
const SLOTS = {};
for (const k of Object.keys(SLOT_DEFS))
  SLOTS[k] = {code: slotExample(k).code, worker: null, status: {msg: 'Not loaded.', cls: ''}, lastErr: ''};
function slotWorker(k, code) {
  const D = SLOT_DEFS[k];
  const src = `"use strict";\n${code}\n;const __mem={};const __wrap=${D.wrap.toString()};self.onmessage=(e)=>{if(e.data&&e.data.reset){for(const k in __mem)delete __mem[k];return;}try{if(typeof ${D.fn}!=='function')throw new Error('Define a function named ${D.fn}(obs, mem)');const r=${D.fn}(e.data,__mem)||{};self.postMessage(__wrap(r));}catch(err){self.postMessage({ok:false,error:String(err&&err.message||err)});}};`;
  const url = URL.createObjectURL(new Blob([src], {type: 'text/javascript'}));
  let wk;
  try {
    wk = new Worker(url);
  } catch (err) {
    return {error: 'Workers are unavailable here: ' + err.message};
  }
  const W_ = {wk, pending: null, dead: false, error: null, slot: k};
  wk.onmessage = e => {
    const p = W_.pending;
    W_.pending = null;
    if (p) {
      clearTimeout(p.to);
      p.res(e.data);
    }
  };
  wk.onerror = e => {
    e.preventDefault();
    W_.error = `Line ${Math.max(1, (e.lineno || 2) - 1)}: ${e.message}`;
    W_.dead = true;
    const p = W_.pending;
    W_.pending = null;
    if (p) {
      clearTimeout(p.to);
      p.res({ok: false, error: W_.error});
    }
    slotStatus(k, W_.error, 'err');
  };
  W_.call = obs =>
    new Promise(res => {
      if (W_.dead) return res({ok: false, error: W_.error || 'worker stopped'});
      const to = setTimeout(() => {
        W_.pending = null;
        W_.dead = true;
        W_.error = `Timed out after ${D.timeout} ms (infinite loop?)`;
        wk.terminate();
        slotStatus(k, W_.error, 'err');
        res({ok: false, error: W_.error});
      }, D.timeout);
      W_.pending = {res, to};
      wk.postMessage(obs);
    });
  W_.reset = () => {
    if (!W_.dead) wk.postMessage({reset: true});
  };
  W_.kill = () => {
    // a call still pending resolves as failed now, or its timer would fire later as a spurious timeout
    W_.dead = true;
    const p = W_.pending;
    W_.pending = null;
    if (p) {
      clearTimeout(p.to);
      p.res({ok: false, error: 'replaced by a new load'});
    }
    try {
      wk.terminate();
    } catch (_) {}
  };
  return W_;
}
function slotStatus(k, msg, cls) {
  SLOTS[k].status = {msg, cls};
  UI.slotStatus(k, msg, cls);
}
// Load a slot's code and switch the matching parameter to 'custom'
function slotLoad(k, code) {
  const sl = SLOTS[k];
  if (code != null) sl.code = code;
  if (sl.worker) sl.worker.kill();
  const w = slotWorker(k, sl.code);
  if (w.error) {
    sl.worker = null;
    slotStatus(k, w.error, 'err');
    return false;
  }
  sl.worker = w;
  sl.lastErr = '';
  slotStatus(k, `Loaded. ${SLOT_DEFS[k].name} set to Your code.`, 'ok');
  if (S) {
    const already = P[SLOT_DEFS[k].param] === 'custom';
    setParam(SLOT_DEFS[k].param, 'custom', false);
    if (already && k === 'plan' && S.fsm.state !== 'IDLE' && S.fsm.state !== 'DONE') requestReplan('planner loaded'); // the old worker's plan died with it
  }
  return true;
}
function slotErr(k, err) {
  const sl = SLOTS[k];
  if (sl.lastErr !== err) {
    logE(`Your ${SLOT_DEFS[k].name.toLowerCase()}: ${err}`, 'bad');
    slotStatus(k, err, 'err');
    sl.lastErr = err;
  }
}
function slotNotLoaded(k) {
  const sl = SLOTS[k];
  if (sl.lastErr !== 'none') {
    logE(`Your ${SLOT_DEFS[k].name.toLowerCase()} is not loaded yet. Open the Code tab and press Load.`, 'warn');
    sl.lastErr = 'none';
  }
}
const customWorkerOf = k => SLOTS[k].worker;
// ---- planner slot ----
function customPlanStart(wp, reason) {
  const F = S.fsm,
    w = SLOTS.plan.worker;
  if (!w) {
    slotNotLoaded('plan');
    F.state = 'NO_PATH';
    F.fails++;
    return;
  }
  const e = S.est,
    t0 = performance.now();
  const obs = {
    start: {x: e.x, y: e.y, th: e.th},
    goal: {x: wp.x, y: wp.y, th: wp.th == null ? null : wp.th},
    grid: {w: GW, h: GH, res: RES},
    lethal: S.cm.lethal.slice(),
    dist: S.cm.dist.slice(),
    vehicle: {model: P.model, wheelbase: P.wheelbase, steerMax: steerMax(), minTurnR: isCar() ? minTurnR() : 0, revOK: P.revOK},
    reason
  };
  F.planPending = true;
  F.planPromise = w.call(obs).then(r => {
    F.planPending = false;
    F.planPromise = null;
    let res;
    if (!r.ok) {
      slotErr('plan', r.error);
      res = {ok: false, reason: r.error};
    } else if (r.error) res = {ok: false, reason: String(r.error)};
    else {
      const valid = p =>
        Array.isArray(p) &&
        p.length >= 2 &&
        p.every(q => Array.isArray(q) && isFinite(q[0]) && isFinite(q[1]) && q[0] >= 0 && q[0] <= W && q[1] >= 0 && q[1] <= H);
      if (r.segs && Array.isArray(r.segs) && r.segs.length && r.segs.every(s => valid(s.pts)))
        res = {ok: true, segs: r.segs.map(s => ({pts: s.pts.map(q => q.slice(0, 3)), dir: s.dir < 0 ? -1 : 1})), exp: r.expansions || 0};
      else if (valid(r.path)) res = {ok: true, pts: r.path.map(q => [+q[0], +q[1]]), exp: r.expansions || 0};
      else {
        slotErr('plan', 'return { path: [[x, y], ...] } with at least two points inside the world');
        res = {ok: false, reason: 'invalid path'};
      }
      if (r.nodes && Array.isArray(r.nodes)) S.search = {type: 'hybrid', pts: r.nodes.flat()};
      else S.search = null;
    }
    SLOTS.plan.lastErr = res.ok ? '' : SLOTS.plan.lastErr;
    applyPlanResult(res, 'Your code', reason, t0, false);
  });
}
// ---- localizer slot ----
async function customLocalize() {
  const w = SLOTS.loc.worker;
  if (!w) {
    slotNotLoaded('loc');
    return;
  }
  const first = !S.locInit;
  S.locInit = true;
  const z = S.deliv && S.deliv.z ? S.deliv.z.map(m => ({id: P.assoc === 'known' ? m.id : -1, r: m.r, b: m.b})) : null;
  const obs = {
    init: first ? {x: S.robot.x, y: S.robot.y, th: S.robot.th} : null,
    dt: DT,
    odom: {...S.odo},
    beacons: z,
    map: S.beacons.map(b => ({id: b.id, x: b.x, y: b.y})),
    scan: S.deliv && S.deliv.scan ? Array.from(S.deliv.scan) : null,
    sonar: P.sonar && S.deliv ? sonarObs(S.deliv.sonar) : null, // the ultrasonic readings delivered this tick
    gnss: S.deliv && S.deliv.gnss ? {x: S.deliv.gnss.x, y: S.deliv.gnss.y, sigma: S.deliv.gnss.sig, t: S.deliv.gnss.t} : null, // a fix, when one arrived
    field: first && P.per === 'oracle' ? {w: GW, h: GH, res: RES, dist: Array.from(LV.truthDist)} : null, // the prior map, once
    t: S.t
  };
  const r = await w.call(obs);
  if (!r.ok) {
    slotErr('loc', r.error);
    return;
  }
  if (!isFinite(r.x) || !isFinite(r.y) || !isFinite(r.th)) {
    slotErr('loc', 'return { x, y, th } as finite numbers');
    return;
  }
  SLOTS.loc.lastErr = '';
  S.est = {x: r.x, y: r.y, th: wrap(r.th)};
  S.Pc = r.cov ? r.cov.slice() : null;
}
// ---- predictor slot ----
async function customPredict() {
  const w = SLOTS.pred.worker,
    A = S.agents;
  if (!w) {
    slotNotLoaded('pred');
    return;
  }
  const tracks = A.tracks.filter(t => t.conf);
  if (!tracks.length) return;
  const dt = 0.1,
    obs = {
      tracks: tracks.map(t => ({id: t.id, x: t.x, y: t.y, vx: t.vx, vy: t.vy, r: t.r, age: +(S.t - (t.t0 || S.t)).toFixed(2)})),
      horizon: P.agT,
      dt,
      grid: {w: GW, h: GH, res: RES},
      lethal: LV.truthOcc,
      // the ultrasonic ring's latest arc per sonar, placed with the estimate (world frame), and how old it is
      sonar:
        P.sonar && S.sonArcs
          ? S.sonArcs
              .filter(Boolean)
              .map(A => ({i: A.i, r: A.r, max: A.max, x: A.x, y: A.y, th: A.th, width: A.w, age: +(S.t - A.t).toFixed(2)}))
          : null
    };
  const r = await w.call(obs);
  if (!r.ok) {
    slotErr('pred', r.error);
    return;
  }
  SLOTS.pred.lastErr = '';
  for (const t of tracks) {
    const tr = r.trajectories[t.id];
    t.traj = Array.isArray(tr) && tr.length ? {dt, s: tr.map(q => [+q[0], +q[1], q[2] == null ? t.r : +q[2]])} : null;
  }
}
function trajPred(t, tt) {
  const T = t.traj;
  if (!T) return null;
  const k = tt / T.dt,
    i = Math.min(T.s.length - 1, Math.floor(k)),
    j = Math.min(T.s.length - 1, i + 1),
    f = k - i;
  const a = T.s[i],
    b = T.s[j];
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
}
