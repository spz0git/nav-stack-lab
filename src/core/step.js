// One tick, in three parts so that user code in workers can be awaited between them:
// sense → (custom localizer) → mission and tracking → (custom predictor) → speed planning
function preSense() {
  schedTick(); // the fault schedule's events due before this tick (core/config.js)
  S.tick++;
  S.t += DT;
  updatePeds(DT);
  actuate();
  odometry();
  if (P.loc !== 'custom') locPredict();
  if (P.lidar && S.tick % 2 === 1) sensEnqueue('lidar', lidarSense()); // the Sensors switches: an off sensor makes no readings
  if (S.tick % 2 === 1 && radarOn()) sensEnqueue('radar', radarSense()); // with the lidar, at 10 Hz
  if (S.tick % 4 === 1) sensEnqueue('beacons', senseBeacons());
  if (P.sonar) sensEnqueue('sonar', sonarSense()); // the ultrasonic ring fires its own schedule (core/sensors.js)
  if (P.gnss) gnssTick();
  sensDeliver();
  if (P.loc === 'truth') S.est = {x: S.robot.x, y: S.robot.y, th: S.robot.th};
}
function postSense() {
  if (P.per === 'mapping' && S.tick % 10 === 0) {
    buildCostmap();
    dirty.occ = true;
  }
  metrics();
  missionTick();
  agentsTick();
  oddTick(); // the ODD monitor, when on (core/oddmon.js)
}
function metrics() {
  const r = S.robot,
    e = S.est;
  const ex = r.x - e.x,
    ey = r.y - e.y,
    eth = wrap(r.th - e.th),
    ep = hyp(ex, ey);
  S.errSq += ep * ep;
  S.errN++;
  safeTick();
  let cte = null;
  if (S.track && S.fsm.state === 'DRIVE') {
    cte = project(r.x, r.y, false).d;
    S.cteSq += cte * cte;
    S.cteN++;
  }
  if (S.Pc && S.tick % 4 === 1) {
    const Pi = m3inv(S.Pc);
    if (Pi) {
      const v = [ex, ey, eth];
      let q = 0;
      for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) q += v[a] * Pi[a * 3 + b] * v[b];
      S.nees.push(q);
      if (S.nees.length > 100) S.nees.shift();
    }
  }
  if (S.tick % 2 === 0) {
    S.plot.push({
      t: S.t,
      ex,
      ey,
      ep,
      eth,
      sp: S.Pc ? Math.sqrt(Math.max(0, S.Pc[0] + S.Pc[4])) : null,
      sx: S.Pc ? Math.sqrt(Math.max(0, S.Pc[0])) : null,
      sth: S.Pc ? Math.sqrt(Math.max(0, S.Pc[8])) : null,
      cte,
      vc: S.cmd.v,
      va: r.v,
      tc: isCar() ? deg(S.cmd.steer || 0) : S.cmd.w,
      ta: isCar() ? deg(r.d) : r.w
    });
    if (S.plot.length > 3000) S.plot.shift();
  } // 5 min at 10 Hz, as long as the replay frames (record.js)
  if (S.tick % 4 === 0) {
    S.trailT.push([r.x, r.y]);
    S.trailE.push([e.x, e.y]);
    if (S.trailT.length > 1500) {
      S.trailT.shift();
      S.trailE.shift();
    }
  }
}
let busy = false;
// Controllers return {v, w} or {v, steer}; convert to what the active vehicle model takes
function normCmd(c) {
  const v = isFinite(c.v) ? c.v : 0;
  if (!isCar()) return {v, w: isFinite(c.w) ? c.w : 0, steer: 0};
  let st = c.steer;
  if (st == null || !isFinite(st)) {
    const w = isFinite(c.w) ? c.w : 0;
    st = Math.abs(v) < 0.05 ? Math.sign(w) * steerMax() : Math.atan((P.wheelbase * w) / v);
  }
  st = clamp(st, -steerMax(), steerMax());
  return {v, steer: st, w: (v * Math.tan(st)) / P.wheelbase};
}
// Control latency: commands wait latency/DT ticks before reaching the actuators
function applyCmd(c) {
  if (P.actNoise > 0 && S.fsm.state === 'DRIVE') {
    // noise on what is executed, not on what the controller meant: the behaviour-cloning collector records the expert's
    // intended path while the robot wanders off it, so the data covers the states the learned policy will drift into
    const g = S.rngA;
    c = {
      ...c,
      v: c.v * (1 + 0.25 * P.actNoise * g.n()),
      w: c.w != null ? c.w + P.actNoise * g.n() : c.w,
      steer: c.steer != null ? c.steer + 0.3 * P.actNoise * g.n() : c.steer
    };
  }
  c = oddCmd(radarBrake(c)); // the radar emergency brake and the ODD monitor's manoeuvre, after every controller
  // the zero-velocity update needs the robot still: with it on, the first 2 s of a run are a calibration hold
  if (P.gyro && P.zupt && S.t < 2) c = {v: 0, w: 0, steer: 0};
  S.cmdIssued = c;
  const n = Math.max(0, Math.round(P.latency / DT)); // never negative: a queue that cannot shrink below n hangs the loop
  if (!n) {
    S.cmd = c;
    S.cmdQ = [];
    return;
  }
  if (!S.cmdQ) S.cmdQ = [];
  S.cmdQ.push(c);
  while (S.cmdQ.length > n) S.cmd = S.cmdQ.shift();
}
async function advance(n) {
  if (busy) return;
  busy = true;
  try {
    for (let i = 0; i < n; i++) {
      if (S.fsm.planPending && S.fsm.planPromise) await S.fsm.planPromise; // a custom planner answers in lockstep
      preSense();
      if (P.loc === 'custom') await customLocalize();
      postSense();
      if (P.agPred === 'custom' && S.scanTick === S.tick && agOn()) await customPredict();
      agentsPlan();
      const cmd = P.ctl === 'custom' && !S.fsm.align ? await customCmd() : builtinCmd();
      applyCmd(normCmd(cmd));
      agPost();
      recFrame();
      if (S.halt) {
        S.halt = false;
        if (pauseOnContact && running) {
          running = false;
          logE('Paused on contact (uncheck Pause on contact to keep going)', 'warn');
          break;
        }
      }
    }
  } finally {
    busy = false;
  }
}
