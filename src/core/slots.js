/* ============================================================
   Code slots: user JavaScript for the controller, the global planner, the localizer and the agent predictor.
   Each slot runs in its own Web Worker, called in lockstep with the simulation, with a timeout.
   ============================================================ */
const SLOT_EXAMPLES = {
  plan: `// Your global planner. Called whenever the mission needs a path (initial plan, replans).
// Return { path: [[x, y], ...] } from the start to the goal, or { error: 'reason' } when there is none.
// A car may return { segs: [{ pts: [[x, y, th], ...], dir: +1 | -1 }, ...] } with reverse legs.
//
// obs.start  {x, y, th}      estimated pose
// obs.goal   {x, y, th|null} the goal, heading only for posed goals
// obs.grid   {w, h, res}     the costmap grid: w × h cells of res metres
// obs.lethal Uint8Array      1 where the robot centre may not go (w*h, row-major, cell (i, j) = j*w + i)
// obs.dist   Float32Array    distance to the nearest obstacle per cell [m]
// obs.vehicle {model, wheelbase, steerMax, minTurnR, revOK}
// Budget: 3 s per call. mem persists between calls.

function plan(obs, mem) {
  const { w, h, res } = obs.grid, L = obs.lethal;
  const cell = (x, y) => [Math.floor(x / res), Math.floor(y / res)];
  const [si, sj] = cell(obs.start.x, obs.start.y), [gi, gj] = cell(obs.goal.x, obs.goal.y);
  // 8-connected A* with the octile heuristic
  const g = new Float32Array(w * h).fill(Infinity), par = new Int32Array(w * h).fill(-1), closed = new Uint8Array(w * h);
  const heur = (i, j) => { const dx = Math.abs(i - gi), dy = Math.abs(j - gj); return Math.max(dx, dy) + 0.414 * Math.min(dx, dy); };
  const open = [[heur(si, sj), sj * w + si]]; g[sj * w + si] = 0;
  const NB = [[1,0,1],[-1,0,1],[0,1,1],[0,-1,1],[1,1,1.414],[1,-1,1.414],[-1,1,1.414],[-1,-1,1.414]];
  let found = false, expansions = 0;
  while (open.length) {
    let b = 0; for (let k = 1; k < open.length; k++) if (open[k][0] < open[b][0]) b = k;   // a heap would be faster
    const [, u] = open.splice(b, 1)[0]; if (closed[u]) continue; closed[u] = 1; expansions++;
    if (u === gj * w + gi) { found = true; break; }
    const ui = u % w, uj = (u / w) | 0;
    for (const [di, dj, c] of NB) { const vi = ui + di, vj = uj + dj; if (vi < 0 || vj < 0 || vi >= w || vj >= h) continue;
      const v = vj * w + vi; if (L[v] || closed[v]) continue;
      if (di && dj && (L[uj * w + vi] || L[vj * w + ui])) continue;           // no corner cutting
      const ng = g[u] + c * (1 + 3 * Math.max(0, 0.6 - obs.dist[v]));         // stay away from walls when it is cheap to
      if (ng < g[v]) { g[v] = ng; par[v] = u; open.push([ng + heur(vi, vj), v]); } }
  }
  if (!found) return { error: 'no path on the grid' };
  const path = []; for (let u = gj * w + gi; u >= 0; u = par[u]) path.push([(u % w + 0.5) * res, (((u / w) | 0) + 0.5) * res]);
  path.reverse(); path[0] = [obs.start.x, obs.start.y]; path[path.length - 1] = [obs.goal.x, obs.goal.y];
  return { path, expansions };
}
`,
  loc: `// Your localizer. Called every 50 ms tick, before the planner and controller use the estimate.
// Return { x, y, th } and optionally cov: a 3×3 covariance as 9 numbers, row-major (drawn as an ellipse).
//
// obs.init    {x, y, th} on the first call only (the start pose), else null
// obs.dt      0.05 s
// obs.odom    {v, w}   measured speed and yaw rate (noisy, slightly biased)
// obs.beacons [{id, r, b}] or null: range and bearing (body frame) to beacons seen this tick; id is -1 when unlabeled
// obs.map     [{id, x, y}] beacon positions
// obs.scan    Float32Array(120) of lidar ranges or null; beam k points at -π + k·2π/120 in the body frame, 8 m max
// mem persists between calls. Budget: 200 ms per call.

function localize(obs, mem) {
  if (obs.init) { mem.x = obs.init.x; mem.y = obs.init.y; mem.th = obs.init.th; }
  // dead reckoning with the exact arc
  const v = obs.odom.v, w = obs.odom.w, dt = obs.dt;
  if (Math.abs(w) < 1e-6) { mem.x += v * dt * Math.cos(mem.th); mem.y += v * dt * Math.sin(mem.th); }
  else { const r = v / w, t2 = mem.th + w * dt; mem.x += r * (Math.sin(t2) - Math.sin(mem.th)); mem.y -= r * (Math.cos(t2) - Math.cos(mem.th)); mem.th = t2; }
  // pull toward each labeled beacon reading: a fixed-gain correction, not a Kalman filter
  if (obs.beacons) for (const z of obs.beacons) {
    const b = obs.map.find(m => m.id === z.id); if (!b) continue;
    const dx = b.x - mem.x, dy = b.y - mem.y, rHat = Math.hypot(dx, dy), bHat = Math.atan2(dy, dx) - mem.th;
    const er = z.r - rHat, eb = Math.atan2(Math.sin(z.b - bHat), Math.cos(z.b - bHat));
    const ux = dx / rHat, uy = dy / rHat;
    mem.x -= 0.2 * er * ux; mem.y -= 0.2 * er * uy; mem.th -= 0.2 * eb;   // a larger measured bearing means the heading estimate is too large
  }
  mem.th = Math.atan2(Math.sin(mem.th), Math.cos(mem.th));
  return { x: mem.x, y: mem.y, th: mem.th };
}
`,
  pred: `// Your agent predictor. Called at 10 Hz with the current tracks.
// Return { trajectories: { [id]: [[x, y, r], ...] } }: one sample per step of obs.dt from t = 0 to obs.horizon, per track.
// The speed planner, DWA and MPC read these samples instead of the built-in constant-velocity model.
//
// obs.tracks  [{id, x, y, vx, vy, r, age}]  position, velocity estimate, radius, seconds since confirmed
// obs.horizon seconds to predict (the Prediction horizon slider)
// obs.dt      sample step (0.1 s)
// obs.lethal, obs.grid  the static map, as for the planner (people do not walk through walls)
// mem persists between calls. Budget: 200 ms per call.

function predict(obs, mem) {
  const out = {}, n = Math.round(obs.horizon / obs.dt);
  for (const t of obs.tracks) {
    const samples = [];
    let vx = t.vx, vy = t.vy;
    for (let k = 0; k <= n; k++) {
      const tt = k * obs.dt;
      // constant velocity, with the velocity decaying toward a walking pace after 2 s: people rarely keep running
      const sp = Math.hypot(vx, vy), cap = tt > 2 ? 1.2 : Infinity;
      if (sp > cap) { vx *= cap / sp; vy *= cap / sp; }
      samples.push([t.x + vx * tt, t.y + vy * tt, t.r + 0.1 * tt]);
    }
    out[t.id] = samples;
  }
  return { trajectories: out };
}
`
};
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
  SLOTS[k] = {code: k === 'ctl' ? DEFAULT_CODE : SLOT_EXAMPLES[k], worker: null, status: {msg: 'Not loaded.', cls: ''}, lastErr: ''};
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
  if (S) setParam(SLOT_DEFS[k].param, 'custom', false);
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
      lethal: LV.truthOcc
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
