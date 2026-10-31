/* ============================================================
   Health rules (7.6, 2.6): every check of every subsystem, the rules the page's health lights show (ui/health.js
   draws them). In the core, so that a run without a page records them too: the safety measures note when each light
   first turned amber or red (core/safety.js). No DOM here.
   ============================================================ */
const H_SYS = [
  ['loc', 'Localize'],
  ['per', 'Perceive'],
  ['plan', 'Plan'],
  ['ctl', 'Control']
];
const H_RANK = {idle: 0, ok: 1, warn: 2, bad: 3};
// Every check of every subsystem, from the live state or a recorded frame f: H.all[k] = [{name, on, lvl, msg}],
// H[k] = [level, reason] of the worst check that holds (ties: the first listed)
function healthNow(f) {
  const V = f || S,
    r = V.robot,
    F = V.fsm,
    st = F.state,
    drive = st === 'DRIVE',
    sig = f ? f.sig || {} : null,
    all = {};
  const C = (k, name, on, lvl, msg) => {
    (all[k] || (all[k] = [])).push({name, on: !!on, lvl, msg});
  };
  healthLoc(C, V, f, sig, st, drive);
  healthPer(C, V, f, r, drive);
  healthPlan(C, F, f, st);
  healthCtl(C, V, f, sig, r, st, drive);
  return healthWorst(all);
}
// localization: the estimator's checks (lost, consistency, particles, beacon readings) and its status line, then the
// sensors switched off. C(k, name, on, lvl, msg) records a check; V is the live state S or the frame f.
function healthLoc(C, V, f, sig, st, drive) {
  const sp = V.Pc ? Math.sqrt(Math.max(0, V.Pc[0] + V.Pc[4])) : null,
    nees = sig ? sig.nees : S.nees.length ? S.nees.slice(-25).reduce((a, b) => a + b, 0) / Math.min(25, S.nees.length) : null,
    neff = neffAvg(V.t),
    N = S.pf ? S.pf.N : P.npart,
    usesB = ['ekf', 'pf', 'slam'].includes(P.loc),
    silent = usesB && !f ? S.t - (S.zLastT || 0) : 0; // the last tick with beacon readings (core/safety.js)
  healthSensorChecks(C, 'loc');
  if (P.loc === 'truth') C('loc', 'Estimator', true, 'idle', 'ground truth: the pose is known');
  else {
    C('loc', 'Lost', st === 'LOST' || (sp != null && sp > 1), 'bad', `lost: position σ ${sp != null ? sp.toFixed(1) : '?'} m`);
    C(
      'loc',
      'Consistency',
      nees != null && nees > 9,
      'warn',
      `overconfident: NEES ${nees != null ? nees.toFixed(1) : '—'} (3 is consistent)`
    );
    if (P.loc === 'pf')
      C(
        'loc',
        'Particles',
        neff != null && neff < 0.15 * N,
        'warn',
        `particles degenerate: N_eff ${neff != null ? neff.toFixed(0) : '—'} of ${N} (2 s mean)`
      );
    if (usesB && sensorOn(sensorByKey('beacons')))
      C(
        'loc',
        'Beacon readings',
        silent > 3 && drive,
        beaconUse() ? 'ok' : 'warn',
        beaconUse()
          ? `no beacon readings for ${silent.toFixed(0)} s; lidar against the map holds it (σ ${sp != null ? sp.toFixed(2) : '—'} m)`
          : `no beacon readings for ${silent.toFixed(1)} s`
      );
    C(
      'loc',
      'Estimator',
      true,
      'ok',
      P.loc === 'dr'
        ? `dead reckoning${sp != null ? `: σ ${sp.toFixed(2)} m and growing` : ''}`
        : `σ ${sp != null ? sp.toFixed(2) : '—'} m${nees != null ? ` · NEES ${nees.toFixed(1)}` : ''}${neff != null && P.loc === 'pf' ? ` · N_eff ${neff.toFixed(0)}` : ''}`
    );
  }
  // the sensors switched off, listed last so that it never stands in for the estimator's own line
  C(
    'loc',
    'Sensors',
    sensorsOff().length > 0,
    'idle',
    `off: ${sensorsOff()
      .map(s => s.label)
      .join(', ')}`
  );
}
// perception: person contact, the sensors, learned blocks, lidar returns, phantom tracks, a person nearby, and the
// status line
function healthPer(C, V, f, r, drive) {
  const hits = f ? (f.scan ? f.scan.length / 2 : 0) : S.scanPts.length,
    tr = V.agents ? V.agents.tracks : [],
    cf = tr.filter(t => t.conf).length,
    people = V.peds.filter(p => !p.car).length;
  let gap = Infinity;
  for (const p of V.peds) gap = Math.min(gap, hyp(r.x - p.x, r.y - p.y) - (p.r || 0.3) - RR);
  C('per', 'Person contact', r.pedContact, 'bad', 'contact with a person');
  healthSensorChecks(C, 'per');
  learnHealth(C, 'per', f); // a learned block reading inputs unlike its training data (core/learnmon.js)
  if (P.lidar) C('per', 'Lidar returns', V.t > 0.5 && hits === 0, 'warn', 'no lidar returns');
  if (agOn())
    C(
      'per',
      'Phantom tracks',
      cf > people + 1,
      'warn',
      `${cf} confirmed tracks for ${people} ${people === 1 ? 'person' : 'people'}: phantom tracks`
    );
  if (people) C('per', 'Person nearby', gap < 0.3 && drive, 'warn', `a person ${Math.max(0, gap).toFixed(2)} m away`);
  if (!P.lidar)
    C(
      'per',
      'Sensing',
      true,
      'idle',
      `lidar off${agOn() ? ` · ${cf} track${cf === 1 ? '' : 's'}` : ''}${P.per === 'mapping' ? ' · the map no longer grows' : ''}`
    );
  else if (people && !agOn()) C('per', 'Tracking', true, 'idle', `${hits} lidar hits · people not tracked (agent tracking off)`);
  else
    C(
      'per',
      'Sensing',
      true,
      'ok',
      `${hits} lidar hits${agOn() ? ` · ${cf} track${cf === 1 ? '' : 's'}` : ''}${P.per === 'mapping' ? ' · mapping' : ''}`
    );
}
// mission and plan: no path, the sensors, learned blocks, the operating domain, goals, skipped goals, plan time, and
// the mission line
function healthPlan(C, F, f, st) {
  const ps = S.planStats,
    skipped = f ? f.done.filter(d => d[1]).length : WPS.filter(w => w.skipped).length,
    n = f ? f.done.length : WPS.length;
  C('plan', 'Path', st === 'NO_PATH', 'bad', `no path to the next goal${F.fails ? ` (attempt ${F.fails} of 3)` : ''}`);
  healthSensorChecks(C, 'plan');
  learnHealth(C, 'plan', f);
  if (P.oddMon) C('plan', 'Operating domain', !f && S.odd && S.odd.out, 'warn', `outside the operating domain: ${S.odd ? S.odd.why : ''}`);
  C('plan', 'Goals', st === 'IDLE' && !n, 'idle', 'no goals: tap the map to add some');
  C('plan', 'Goals skipped', skipped > 0, 'warn', `${skipped} goal${skipped === 1 ? '' : 's'} skipped`);
  C('plan', 'Plan time', ps && ps.ms > 250 && !f, 'warn', ps ? `last plan took ${ps.ms.toFixed(0)} ms (${ps.name})` : '');
  C(
    'plan',
    'Mission',
    true,
    st === 'DONE' ? 'ok' : st === 'IDLE' ? 'idle' : 'ok',
    st === 'DONE'
      ? 'all goals reached'
      : st === 'IDLE'
        ? 'ready: press Run'
        : ps
          ? `${ps.name} · ${ps.len.toFixed(1)} m · ${ps.ms.toFixed(0)} ms`
          : st.toLowerCase()
  );
}
// control: obstacle contact, the sensors, the radar brake, grip, actuator limit, the MPC's budget and constraints,
// cross-track error, and the driving line
function healthCtl(C, V, f, sig, r, st, drive) {
  const D = S.plot,
    tE = V.t,
    win = D.filter(d => d.t > tE - 2 && d.t <= tE + 1e-6),
    lim = isCar() ? 0.97 * P.steerMaxDeg : 0.97 * P.wmax,
    sat = win.length ? win.filter(d => d.ta != null && Math.abs(d.ta) >= lim).length / win.length : 0,
    last = win.length ? win[win.length - 1] : null,
    cte = last && last.cte != null ? Math.abs(last.cte) : null,
    mms = sig ? sig.mpcMs : S.mpcStats && P.ctl === 'mpc' ? S.mpcStats.ms : null;
  const dq = !isDyn() ? null : f ? sig.dyn : dynSig(r),
    ayF = dq && dq.mug > 0 ? Math.abs(dq.ay) / dq.mug : 0;
  C('ctl', 'Obstacle contact', r.contact, 'bad', 'contact with an obstacle');
  healthSensorChecks(C, 'ctl');
  C('ctl', 'Emergency brake', P.radBrake && !radarOn(), 'warn', 'the radar emergency brake is on, but the radar is off (Sensors)');
  if (isDyn())
    C(
      'ctl',
      'Grip',
      drive && ayF > 0.8,
      'warn',
      dq ? `near the grip limit: a_y ${Math.abs(dq.ay).toFixed(2)} m/s², ${(100 * ayF).toFixed(0)} % of μg (${dq.mug.toFixed(2)} m/s²)` : ''
    );
  C(
    'ctl',
    'Actuator limit',
    drive && sat > 0.5,
    'warn',
    `${isCar() ? 'steering' : 'turn rate'} at its limit ${(sat * 100).toFixed(0)} % of the last 2 s`
  );
  if (P.ctl === 'mpc') {
    C(
      'ctl',
      'MPC budget',
      mms != null && P.mpcBudget > 0 && mms >= 0.85 * P.mpcBudget,
      'warn',
      `MPC at its ${P.mpcBudget} ms budget (${mms != null ? mms.toFixed(1) : '—'} ms)`
    );
    C(
      'ctl',
      'MPC constraints',
      !f && S.mpcStats && S.mpcStats.viol > 0.05,
      'warn',
      S.mpcStats ? `MPC constraints violated by ${S.mpcStats.viol.toFixed(2)}` : ''
    );
  }
  C('ctl', 'On the path', drive && cte != null && cte > 0.5, 'warn', `${cte != null ? cte.toFixed(2) : '—'} m off the path`);
  C(
    'ctl',
    'Driving',
    true,
    drive ? 'ok' : 'idle',
    !drive
      ? st === 'DONE'
        ? 'stopped: mission complete'
        : 'not driving'
      : `cross-track ${cte != null ? cte.toFixed(2) : '—'} m${mms != null ? ` · MPC ${mms.toFixed(1)} ms` : ''}`
  );
}
// H.all = all; H[k] = [level, reason] of the worst check of subsystem k that holds (ties: the first listed), or of its
// last check (the status line) when none does
function healthWorst(all) {
  const H = {all};
  for (const k of Object.keys(all)) {
    const on = all[k].filter(c => c.on).sort((a, b) => H_RANK[b.lvl] - H_RANK[a.lvl]);
    const w = on[0] || all[k][all[k].length - 1];
    H[k] = [w.lvl, w.msg];
  }
  return H;
}

// N_eff averaged over the last 2 s of recorded frames (a single reading dips at every resampling)
function neffAvg(t) {
  const F = REC.frames;
  if (!F.length || P.loc !== 'pf') return null;
  let n = 0,
    a = 0;
  for (let i = F.length - 1; i >= 0 && F[i].t > t - 2; i--) {
    if (F[i].t > t + 1e-6) continue;
    const v = F[i].sig && F[i].sig.neff;
    if (v != null) {
      a += v;
      n++;
    }
  }
  return n ? a / n : S.pf ? S.pf.neff : null;
}

// The checks for the sensors switched off, as they bear on subsystem k (loc, per, plan or ctl): blind, odometry,
// beacons, lidar and GNSS for the estimator, the lidar for perception, planning and control. C as in healthNow.
function healthSensorChecks(C, k) {
  const off = sensorsOff().map(s => s.key),
    est = segName(P.loc),
    noLid = off.includes('lidar'),
    noB = off.includes('beacons'),
    blind = sensorsBlind();
  if (k === 'loc') {
    if (P.loc === 'truth') return;
    C('loc', 'Blind', blind, 'warn', `blind: ${sensorsExteroNames()} all off, so ${est} only integrates motion and drifts`);
    C(
      'loc',
      'Odometry',
      off.includes('odom'),
      'warn',
      `wheel odometry off: ${est} predicts with the commanded velocity${P.gyro ? ' and the gyro' : ''}`
    );
    const usesB = ['ekf', 'pf', 'slam', 'custom'].includes(P.loc);
    if (noB && usesB && !blind) {
      const u = beaconUse();
      C('loc', 'Beacons', true, u ? 'ok' : 'warn', u ? `beacons off; ${u}` : `beacons off: ${est} coasts on odometry`);
    }
    const lidLoc = P.loc === 'pgslam' || (P.loc === 'ekf' && P.scanMatch) || (P.loc === 'pf' && P.pfLidar && P.per === 'oracle');
    if (noLid && lidLoc && !blind)
      C(
        'loc',
        'Lidar',
        true,
        P.loc === 'pgslam' ? 'warn' : 'idle',
        P.loc === 'pgslam'
          ? 'lidar off: pose-graph SLAM adds no matches or loop closures; it dead-reckons'
          : P.loc === 'ekf'
            ? 'lidar off: no scan matching'
            : 'lidar off: the particles are weighted by the beacons alone'
      );
    if (P.gnss && !['ekf', 'pf', 'custom'].includes(P.loc))
      C('loc', 'GNSS', true, 'idle', `GNSS on, but ${est} does not fuse it (the EKF, the particle filter and your code do)`);
  }
  if (k === 'per') {
    C('per', 'Blind', blind, 'bad', `blind: ${sensorsExteroNames()} all off; only the motion sensors are left`);
    if (noLid)
      C(
        'per',
        'Lidar',
        true,
        'warn',
        `lidar off: no ${[P.per === 'mapping' ? 'mapping' : '', agOn() && P.agents !== 'truth' && !radarTracks() ? 'people detection' : '', 'obstacles from the scan'].filter(Boolean).join(', no ')}${radarTracks() ? '; people tracked from the radar alone, ahead only' : agOn() && P.agents !== 'truth' && radarOn() ? ' (Perceive → Tracker inputs: Radar tracks people from the radar)' : ''}`
      );
  }
  if (k === 'plan' && noLid) {
    if (P.per === 'mapping')
      C(
        'plan',
        'Lidar',
        true,
        'warn',
        `lidar off: planning on the map seen so far, which no longer grows${P.unknownAs === 'lethal' ? ' (unseen space is lethal: goals beyond it have no path)' : ' (unseen space is taken as free)'}`
      );
    if (P.plan === 'policy') C('plan', 'Lidar', true, 'bad', 'lidar off: the learned policy has no input');
  }
  if (k === 'ctl' && noLid) {
    if (P.guard && GUARD_CTL.includes(P.ctl)) C('ctl', 'Lidar', true, 'warn', 'lidar off: no lidar safety stop');
    else if (P.ctl === 'dwa' || (P.ctl === 'mpc' && P.mpcObs))
      C('ctl', 'Lidar', true, 'warn', `lidar off: ${P.ctl === 'dwa' ? 'DWA' : 'MPC'} sees no obstacles nearby`);
  }
}
