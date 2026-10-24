/* ============================================================
   Recording: frames for replay, and the ghost of the previous run
   ============================================================ */
const REC = {frames: [], max: 3000, every: 2, on: true}; // 10 Hz frames, up to 5 minutes
let GHOST = null; // {level, label, trailT, plot, run} kept from the previous run on this level (run: the page's copy in its runs library)
function recFrame() {
  if (!REC.on || S.tick % REC.every) return;
  const sp = S.scanPts,
    sc = new Float32Array(sp.length * 2);
  for (let i = 0; i < sp.length; i++) {
    sc[2 * i] = sp[i][0];
    sc[2 * i + 1] = sp[i][1];
  }
  const A = S.agents;
  REC.frames.push({
    t: S.t,
    tick: S.tick,
    robot: {...S.robot},
    est: {...S.est},
    Pc: S.Pc ? S.Pc.slice() : null,
    cmd: {...S.cmd},
    peds: S.peds.map(p => ({x: p.x, y: p.y, vx: p.vx || 0, vy: p.vy || 0, r: p.r, wait: p.wait || 0})),
    scan: sc,
    lastZ: S.lastZ,
    sonArcs: S.sonArcs || null, // replaced, not changed, at each delivery (sonarApply)
    radar: S.radar || null,
    bDown: S.bDown ? S.bDown.slice() : null,
    nT: S.trailT.length,
    nE: S.trailE.length,
    plan: S.plan,
    segIdx: S.segIdx,
    track: S.track,
    ctlViz: S.ctlViz,
    search: S.search,
    fsm: {state: S.fsm.state, queue: S.fsm.queue.slice()},
    done: WPS.map(w => [w.done, w.skipped]),
    agents: A ? {tracks: A.tracks.map(t => ({...t})), egoPath: A.egoPath, st: A.st, det: [], dynPts: [], staticPts: null} : null,
    coll: S.coll,
    collPed: S.collPed,
    // scalar diagnostics for the plot dock's signals (UI only; nothing in the simulation reads them)
    sig: {
      explored: P.per === 'mapping' ? exploredFrac() : null,
      mpcMs: S.mpcStats ? S.mpcStats.ms : null,
      mpcIt: S.mpcStats ? S.mpcStats.it : null,
      mpcJ: S.mpcStats ? S.mpcStats.J : null,
      nees: S.nees.length ? S.nees[S.nees.length - 1] : null,
      sm: S.sm ? S.sm.rms : null,
      loops: S.pg ? S.pg.loops : null,
      mapAcc: P.per === 'mapping' ? mapAgree() : null,
      neff: S.pf ? S.pf.neff : null,
      minPed: isFinite(S.minPed) ? S.minPed : null,
      rejected: S.rejected,
      dist: S.dist,
      fsm: S.fsm.state,
      dyn: isDyn() ? dynSig(S.robot) : null,
      ood: learnSig(), // the learned blocks' out-of-distribution scores now (core/learnmon.js)
      brake: P.radBrake ? (S.radBrake && S.t < S.radBrake.until ? 1 : 0) : null
    }
  });
  if (REC.frames.length > REC.max) REC.frames.splice(0, REC.frames.length - REC.max);
}
// A frame as a view over the live state: fields the renderer reads come from the frame, everything else falls through
function frameView(f) {
  const v = Object.create(S);
  Object.assign(v, {
    t: f.t,
    tick: f.tick,
    robot: f.robot,
    est: f.est,
    Pc: f.Pc,
    cmd: f.cmd,
    peds: f.peds,
    lastZ: f.lastZ,
    radar: f.radar,
    bDown: f.bDown,
    plan: f.plan,
    segIdx: f.segIdx,
    track: f.track,
    ctlViz: f.ctlViz,
    search: f.search,
    agents: f.agents,
    coll: f.coll,
    collPed: f.collPed,
    pf: null,
    fsm: Object.assign(Object.create(S.fsm), f.fsm),
    trailT: S.trailT.slice(0, f.nT),
    trailE: S.trailE.slice(0, f.nE)
  });
  const pts = [];
  for (let i = 0; i < f.scan.length; i += 2) pts.push([f.scan[i], f.scan[i + 1]]);
  v.scanPts = pts;
  return v;
}
function runLabel() {
  const names = {
    pp: 'pure pursuit',
    rwf: 'rear-wheel feedback',
    stanley: 'Stanley',
    pid: 'PID',
    dwa: 'DWA',
    mpc: P.mpcMode === 'ltv' ? 'LTV-MPC' : 'MPC',
    custom: 'your code'
  };
  const d = [];
  for (const k of Object.keys(P)) {
    if (k === 'ctl' || k === 'seed') continue;
    const def = k in (LV.cfg || {}) ? LV.cfg[k] : DEFAULTS[k];
    if (def !== undefined && P[k] !== def) d.push(`${k} ${typeof P[k] === 'boolean' ? (P[k] ? 'on' : 'off') : P[k]}`);
  }
  return `${names[P.ctl] || P.ctl} · seed ${P.seed}${d.length ? ' · ' + d.slice(0, 3).join(', ') + (d.length > 3 ? ' …' : '') : ''}`;
}
function keepGhost() {
  const run = S ? UI.runEnded() || null : null; // the page keeps a copy (runs library); S and the frames are still the finished run's here
  // the level and settings noted while the run was live: a new level or a Try has already replaced LV and P here
  const m = S && UI.runMeta();
  if (S && S.t > 1 && S.trailT.length > 5)
    GHOST = {level: m ? m.level : LV.id, label: m ? m.label : runLabel(), trailT: S.trailT.slice(), plot: S.plot.slice(), t: S.t, run}; // nulls in trailT: kidnap breaks
  REC.frames = [];
}
