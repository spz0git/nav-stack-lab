/* ============================================================
   Headless runner (Web Worker). The same simulation core as the page, no DOM.
   Message in:  {cmd:'run', id, level, seed, overrides:{param:value}, secs, stopWhenDone}
   Messages out: {id, progress} … {id, done:true, summary, ms}
   ============================================================ */
function runSummary() {
  const r = S.robot,
    e = S.est,
    F = S.fsm;
  const nees = S.nees.length ? S.nees.reduce((a, b) => a + b, 0) / S.nees.length : null;
  return {
    t: +S.t.toFixed(2),
    state: F.state,
    goalsDone: WPS.filter(w => w.done && !w.skipped).length,
    goals: WPS.length,
    skipped: WPS.filter(w => w.skipped).length,
    coll: S.coll,
    ped: S.collPed,
    pedStill: S.collPedStill || 0,
    minPed: isFinite(S.minPed) ? +S.minPed.toFixed(3) : null,
    dist: +S.dist.toFixed(2),
    poseRMS: S.errN ? +Math.sqrt(S.errSq / S.errN).toFixed(4) : null,
    poseErrFinal: +hyp(r.x - e.x, r.y - e.y).toFixed(3),
    cteRMS: S.cteN ? +Math.sqrt(S.cteSq / S.cteN).toFixed(4) : null,
    nees: nees == null ? null : +nees.toFixed(2),
    replans: S.log.filter(l => /^Replan/.test(l.msg)).length,
    mpcMs: S.mpcStats ? +S.mpcStats.ms.toFixed(2) : null,
    log: S.log
      .slice(0, 12)
      .map(l => l.t.toFixed(1) + ' ' + l.msg)
      .reverse(),
    path: S.trailT.filter((_, i) => i % 2 === 0).map(p => (p ? [+p[0].toFixed(2), +p[1].toFixed(2)] : null))
  }; // the true path every 0.4 s (the trail is kept every 0.2 s; null: a kidnap)
}
// The core's numerics, reachable from the Node tests (tests/node/numerics.test.mjs); unused by the page's worker
self.__core = {
  m3inv,
  m3mul,
  cholSolve,
  boxQP,
  distanceTransform,
  RS,
  astar,
  ekfUpdate,
  icp2d,
  pgComp,
  pgRel,
  pgInit,
  pgOptimize,
  scanMatch,
  initLoc,
  advance,
  startMission,
  scanReproject,
  nnForward,
  mlpForward,
  policyFeatures,
  setGoals,
  randomFree,
  pointAt,
  project,
  LEVELS,
  loadLevel,
  setParam,
  wrap,
  clamp,
  get S() {
    return S;
  },
  get WPS() {
    return WPS;
  },
  get P() {
    return P;
  },
  RES,
  GW,
  GH,
  NC
};
self.onmessage = async e => {
  const m = e.data;
  if (m.cmd !== 'run') return;
  REC.on = false;
  try {
    if (m.seed) P.seed = m.seed;
    loadLevel(m.level);
    for (const [k, v] of Object.entries(m.overrides || {})) if (k !== 'seed') setParam(k, v, false);
    for (const [k, code] of Object.entries(m.codes || {})) {
      if (!code) continue;
      if (!slotLoad(k, code)) throw new Error(SLOTS[k].status.msg);
    }
    if ((S.fsm.state === 'IDLE' || S.fsm.state === 'DONE') && remaining().length) startMission();
    const N = Math.round((m.secs || 120) / DT),
      t0 = performance.now();
    let done = 0;
    while (done < N) {
      const n = Math.min(40, N - done);
      await advance(n);
      done += n;
      if (S.fsm.state === 'DONE' && m.stopWhenDone !== false) break;
      if (done % 400 === 0) postMessage({id: m.id, progress: done / N});
    }
    postMessage({id: m.id, done: true, summary: runSummary(), ms: +(performance.now() - t0).toFixed(0)});
  } catch (err) {
    postMessage({id: m.id, done: true, error: String((err && err.stack) || err)});
  }
};
