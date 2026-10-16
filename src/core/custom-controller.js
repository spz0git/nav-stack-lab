/* ---------- custom controller: user code in a Web Worker, run in lockstep ---------- */
async function customCmd() {
  if (S.fsm.state === 'LOST') {
    S.ctlViz = null;
    return {v: 0, w: Math.min(0.6, P.wmax)};
  }
  if (S.fsm.state !== 'DRIVE' || !S.track) {
    S.ctlViz = null;
    return {v: 0, w: 0};
  }
  const customWorker = SLOTS.ctl.worker;
  if (!customWorker) {
    slotNotLoaded('ctl');
    return {v: 0, w: 0};
  }
  const e = S.est,
    wp = WPS[S.fsm.queue[0]];
  const obs = {
    t: S.t,
    dt: DT,
    pose: {x: e.x, y: e.y, th: e.th},
    odom: {...S.odo},
    path: S.track.dense,
    goal: {x: wp.x, y: wp.y},
    scan: S.scanPts,
    agents: agList().map(t => ({id: t.id, x: t.x, y: t.y, vx: t.vx, vy: t.vy, r: t.r})),
    limits: {vmax: P.vmax, wmax: P.wmax, accel: P.accel, amax: P.amax, alpha: P.alpha},
    pathId: S.pathId,
    dir: S.track.dir || 1,
    vehicle: {model: P.model, wheelbase: P.wheelbase, steerMax: steerMax(), steer: S.robot.d}
  };
  const r = await customWorker.call(obs);
  if (!r.ok) {
    slotErr('ctl', r.error);
    S.ctlViz = null;
    return {v: 0, w: 0};
  }
  SLOTS.ctl.lastErr = '';
  S.ctlViz = r.mark ? {carrot: r.mark} : null;
  return {v: isFinite(r.v) ? r.v : 0, w: isFinite(r.w) ? r.w : 0, steer: r.steer};
}
