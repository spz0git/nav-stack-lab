/* ============================================================
   Sensors
   ============================================================ */
function lidarSense() {
  const r = S.robot,
    g = S.rngW,
    sh = allShapes();
  const ranges = new Float32Array(NBEAM);
  for (let k = 0; k < NBEAM; k++) {
    const a = r.th - Math.PI + (k * TAU) / NBEAM;
    let d = rayCast(r.x, r.y, Math.cos(a), Math.sin(a), LMAX, sh);
    if (d < LMAX) d = Math.max(0.05, d + P.lidarSig * g.n());
    ranges[k] = d;
  }
  return ranges;
}
// Beacon availability: switched off by the user (P.bOff, comma-separated IDs) or down in a random outage.
// Each beacon is a two-state Markov chain stepped at every beacon scan: an outage lasts bOutLen s on average
// and a beacon is down bOut % of the time. Outages draw from their own stream, so the sensor noise is unchanged.
function beaconsOff() {
  if (P.bOff === 'all') return new Set(S.beacons.map(b => b.id)); // a Try cfg: every beacon off
  return new Set(
    String(P.bOff || '')
      .split(',')
      .filter(s => s.trim() !== '')
      .map(Number)
  );
}
// How the active estimator depends on the beacons, in words (null: it needs them)
function beaconUse() {
  if (P.loc === 'truth') return 'ground truth localization ignores the beacons (the estimate is the true pose)';
  if (P.loc === 'dr') return 'dead reckoning never uses the beacons (odometry only)';
  if (P.loc === 'pf' && P.pfLidar && P.per === 'oracle' && P.lidar)
    return 'the particle filter also matches lidar against the prior map, so it can localize without beacons';
  if (P.loc === 'pgslam')
    return P.lidar
      ? 'pose-graph SLAM uses the lidar only: the beacons are ignored'
      : 'pose-graph SLAM uses the lidar only, and the lidar is off: it dead-reckons';
  if (P.loc === 'ekf' && P.scanMatch && P.per === 'oracle' && P.lidar)
    return 'the EKF also matches the lidar scan against the prior map, so it can localize without beacons';
  if ((P.loc === 'ekf' || P.loc === 'pf') && P.gnss)
    return `${segName(P.loc)} also fuses the GNSS fixes, so it keeps a position (metre-level) without beacons`;
  if (P.loc === 'custom') return 'your localizer gets the beacon readings that remain';
  return null;
}
function beaconDown(id) {
  return beaconsOff().has(id) || !!(S.bDown && S.bDown[id]);
}
function beaconOutages() {
  const n = S.beacons.length;
  if (!S.bDown) S.bDown = new Array(n).fill(false);
  const f = clamp((P.bOut || 0) / 100, 0, 0.95);
  if (f <= 0) {
    S.bDown.fill(false);
    return;
  }
  const dt = 4 * DT,
    pUp = Math.min(1, dt / Math.max(dt, P.bOutLen || 1)),
    pDown = Math.min(1, (pUp * f) / (1 - f)),
    g = S.rngB;
  for (let i = 0; i < n; i++) S.bDown[i] = S.bDown[i] ? g.u() >= pUp : g.u() < pDown;
}
function senseBeacons() {
  const r = S.robot,
    g = S.rngW,
    sh = allShapes(),
    out = [];
  const sr = 0.08 * P.lmK,
    sb = 0.03 * P.lmK;
  const off = beaconsOff();
  beaconOutages();
  // why each beacon did or did not answer this scan, and when it last answered (for the UI; nothing reads it back)
  if (!S.bWhy) S.bWhy = [];
  if (!S.bSeen) S.bSeen = S.beacons.map(() => []);
  for (const b of S.beacons) {
    const W = S.bSeen[b.id];
    while (W.length && W[0] < S.t - 5) W.shift();
    if (off.has(b.id) || S.bDown[b.id]) {
      S.bWhy[b.id] = off.has(b.id) ? 'off' : 'outage';
      continue;
    }
    const dx = b.x - r.x,
      dy = b.y - r.y,
      d = hyp(dx, dy);
    if (d > P.lmRange || d < 0.2) {
      S.bWhy[b.id] = 'range';
      continue;
    }
    if (rayCast(r.x, r.y, dx / d, dy / d, d, sh) < d - 0.12) {
      S.bWhy[b.id] = 'blocked';
      continue;
    }
    S.bWhy[b.id] = 'ok';
    W.push(S.t);
    out.push({id: b.id, r: d + sr * g.n(), b: wrap(Math.atan2(dy, dx) - r.th + sb * g.n())});
  }
  if (P.assoc === 'unknown' && P.clutter > 0) {
    for (let k = 0; k < 3; k++)
      if (g.u() < P.clutter / 3) out.push({id: -1, fake: true, r: 0.5 + g.u() * (P.lmRange - 0.5), b: (g.u() * 2 - 1) * Math.PI});
  }
  return out;
}

/* ============================================================
   The Sensors switchboard: one entry per sensing modality. A learner turns any of them off and the stack degrades
   instead of breaking: each consumer checks the switch, stops, and says why (the health reasons, the settings notes).
   An entry: key, label, short (the status dot), flag (the boolean in P that turns it on; on/val when the switch is a
   view on another setting, as for the beacons), kind ('proprio': motion sensors, 'extero': sensors of the world),
   loc and per (what consumes it), gives (one line: what it gives the robot, and what turning it off costs).
   A new modality is one more entry here, and its flag in params.js; the settings switch and the status dot follow.
   ============================================================ */
const SENSORS = [
  {
    key: 'odom',
    label: 'Wheel odometry',
    short: 'Odo',
    flag: 'odom',
    kind: 'proprio',
    loc: ['dead reckoning', 'EKF', 'particle filter', 'EKF-SLAM', 'pose-graph SLAM', 'your localizer'],
    per: [],
    gives:
      'Speed and turn rate from the wheel encoders, every 50 ms. Off: no encoder input; the filters predict with the commanded velocity, which knows nothing of slip, lag or a wall in the way.'
  },
  {
    key: 'gyro',
    label: 'Yaw-rate gyro',
    short: 'Gyro',
    flag: 'gyro',
    kind: 'proprio',
    loc: ['dead reckoning', 'EKF', 'particle filter', 'EKF-SLAM', 'pose-graph SLAM', 'your localizer'],
    per: [],
    gives: 'The turn rate from a gyro instead of the wheels: far less noise, but a bias of its own (Localize → Yaw-rate gyro).'
  },
  {
    key: 'lidar',
    label: 'Lidar',
    short: 'Lidar',
    flag: 'lidar',
    kind: 'extero',
    loc: ['particle filter (lidar weighting)', 'EKF (scan matching)', 'pose-graph SLAM'],
    per: ['lidar mapping', 'people detection', 'the lidar safety stop', 'DWA and MPC obstacles', 'the learned policy'],
    gives:
      '120 ranges around the robot, 10 times a second: the map, the people, the obstacles nearby, and a pose fix against the map. Off: no mapping, scan matching, people detection or safety stop.'
  },
  {
    key: 'beacons',
    label: 'Beacons',
    short: 'Bcn',
    flag: 'bOff',
    on: () => P.bOff !== 'all' && !!S && S.beacons.length > 0 && beaconsOff().size < S.beacons.length,
    val: on => (on ? '' : 'all'),
    avail: () => !!S && S.beacons.length > 0,
    kind: 'extero',
    loc: ['EKF', 'particle filter', 'EKF-SLAM', 'your localizer'],
    per: [],
    gives:
      'Range and bearing to each beacon in reach, 5 times a second: position and heading fixes. Off: the EKF coasts on odometry. Single beacons: Localize → Beacons.'
  },
  {
    key: 'gnss',
    label: 'GNSS',
    short: 'GNSS',
    flag: 'gnss',
    kind: 'extero',
    loc: ['EKF', 'particle filter', 'your localizer'],
    per: [],
    gives:
      'Position fixes 1 to 5 times a second, about a metre off with an error that wanders slowly, worse next to walls and parked cars. An outdoor sensor (L6, L7); indoors it works here only because a 2D world has no roof.'
  }
];
const sensorOn = s => (s.on ? s.on() : !!P[s.flag]);
const sensorByKey = k => SENSORS.find(s => s.key === k);
// switch one modality (setup links and Try cfgs set the flag itself; this is the settings switch)
function setSensor(key, on, live) {
  const s = sensorByKey(key);
  if (s) setParam(s.flag, s.val ? s.val(on) : !!on, live);
}
const sensorsOff = () => SENSORS.filter(s => !sensorOn(s));
// blind: every sensor of the world is off; only the motion sensors are left, and the estimate can only drift
function sensorsBlind() {
  const ex = SENSORS.filter(s => s.kind === 'extero');
  return ex.length > 0 && ex.every(s => !sensorOn(s));
}
const sensorsExteroNames = () =>
  SENSORS.filter(s => s.kind === 'extero')
    .map(s => s.label.toLowerCase().replace('gnss', 'GNSS'))
    .join(', ');
// the switches' effects: what stops when a sensor goes off, said in the event log
PARAM_EFFECTS.push(
  [
    ['lidar'],
    (k, v) => {
      if (!v) {
        S.scan = null;
        S.scanPts = [];
        S.sm = null;
        if (S.sensQ) S.sensQ = S.sensQ.filter(it => it.kind !== 'lidar');
        if (S.agents && (P.agents === 'lidar' || P.agents === 'learned')) S.agents = agInit();
      }
      logE(
        v
          ? 'Lidar → on'
          : `Lidar → off: no mapping, scan matching, people detection or lidar safety stop${P.plan === 'policy' ? '; the learned policy has no input' : ''}`,
        v ? '' : 'warn'
      );
      if (P.plan === 'policy') requestReplan('lidar switched');
      sensorsBlindLog();
    }
  ],
  [
    ['odom'],
    (k, v) =>
      logE(
        v
          ? 'Wheel odometry → on'
          : `Wheel odometry → off: the filters predict with the commanded velocity${P.gyro ? ' (the turn rate still from the gyro)' : ''}`,
        v ? '' : 'warn'
      )
  ],
  [
    ['gnss'],
    (k, v) => {
      S.gnss = null;
      S.gb = null;
      if (!v && S.sensQ) S.sensQ = S.sensQ.filter(it => it.kind !== 'gnss');
      logE(
        v
          ? `GNSS → on: ${P.gnssHz} fixes per second${['ekf', 'pf', 'custom'].includes(P.loc) ? '' : `; drawn on the map, but ${segName(P.loc)} does not fuse them (EKF, particle filter or your code do)`}`
          : 'GNSS → off'
      );
      sensorsBlindLog();
    }
  ],
  [
    ['gnssAug'],
    (k, v) => {
      S.gb = null;
      logE(v ? 'GNSS bias in the EKF state → on: two more states, a random walk each' : 'GNSS bias in the EKF state → off');
    }
  ],
  [['bOff'], () => sensorsBlindLog()]
);
const segName = loc =>
  ({
    truth: 'ground truth',
    dr: 'dead reckoning',
    ekf: 'the EKF',
    pf: 'the particle filter',
    slam: 'EKF-SLAM',
    pgslam: 'pose-graph SLAM',
    custom: 'your localizer'
  })[loc] || loc;
function sensorsBlindLog() {
  if (S && sensorsBlind())
    logE(`Blind: ${sensorsExteroNames()} all off. Only the motion sensors are left; the estimate can only drift`, 'warn');
}

/* ---------- GNSS ----------
   A receiver's position fix, as a localizer sees it: the true position plus
     white noise, σ P.gnssSig per axis, new at every fix;
     a bias that wanders slowly, a first-order Gauss–Markov process per axis, b ← φ b + σ_b √(1 − φ²) w,
       φ = e^(−Δt/τ) (stationary: always N(0, σ_b²); correlated over about τ seconds), stepped every tick;
     multipath within GNSS_MP_D of a large shape (a wall, a parked car; not a pole or a person): a jump of 2 to 4 m,
       roughly away from the shape, held for 2 to 6 s, plus extra noise. A 2D world has no sky, so the sky view a
       real receiver loses next to a wall is stood in for by distance alone;
     outages, a two-state Markov chain like the beacons' (P.gnssOut % of the time, P.gnssOutLen s on average).
   The receiver reports σ = √(σ_w² + σ_b²) per axis: honest about the spread of a single fix in the open, silent about
   the correlation, and blind to multipath (the same σ next to a wall, where the error is several times larger).
   Left out: satellite geometry (DOP), the sky view itself, carrier phase and RTK, the clock, the ionosphere. */
const GNSS_MP_D = 1.5,
  GNSS_GATE = 9.21; // χ²(2) at 99 %
const gnssRep = () => Math.hypot(P.gnssSig, P.gnssBias);
function gnssInit() {
  const g = makeRng(P.seed * 15485863 + 29); // its own random stream: switching GNSS on changes no other sensor's noise
  S.gnss = {
    g,
    bx: P.gnssBias * g.n(),
    by: P.gnssBias * g.n(),
    mp: null,
    mpUntil: 0,
    down: false,
    next: S.t,
    fixes: [],
    n: 0,
    used: 0,
    gated: 0,
    last: null,
    dist: 0
  };
}
// distance from (x, y) to the nearest large shape and the direction away from it (shapes of at least 0.5 m²)
function gnssNearLarge(x, y) {
  let best = Infinity,
    ax = 0,
    ay = 0;
  for (const s of S.shapes) {
    if (s.t !== 'r' || s.w * s.h < 0.5) continue;
    const qx = clamp(x, s.x, s.x + s.w),
      qy = clamp(y, s.y, s.y + s.h),
      d = hyp(x - qx, y - qy);
    if (d < best) {
      best = d;
      ax = x - qx;
      ay = y - qy;
    }
  }
  return {d: best, a: Math.atan2(ay, ax)};
}
// @code gnss-sense | gnssTick: the receiver, a fix with a wandering bias, multipath near large shapes, outages
function gnssTick() {
  if (!S.gnss) gnssInit();
  const G = S.gnss,
    g = G.g;
  const phi = Math.exp(-DT / Math.max(1, P.gnssTau)),
    q = P.gnssBias * Math.sqrt(1 - phi * phi);
  G.dist += Math.abs(S.odo.v || 0) * DT; // the distance driven by the odometry's account (the reset's track check)
  G.bx = phi * G.bx + q * g.n(); // the bias: first-order Gauss–Markov, stepped every tick
  G.by = phi * G.by + q * g.n();
  const f = clamp((P.gnssOut || 0) / 100, 0, 0.95);
  if (f <= 0) G.down = false;
  else {
    const pUp = Math.min(1, DT / Math.max(DT, P.gnssOutLen || 1)),
      pDown = Math.min(1, (pUp * f) / (1 - f));
    G.down = G.down ? g.u() >= pUp : g.u() < pDown;
  }
  if (S.t + 1e-9 < G.next) return;
  G.next = Math.max(G.next + 1 / clamp(P.gnssHz, 0.2, 20), S.t);
  if (G.down) return; // no fix in an outage
  const r = S.robot;
  let ex = G.bx + P.gnssSig * g.n(),
    ey = G.by + P.gnssSig * g.n();
  const N = P.gnssMp ? gnssNearLarge(r.x, r.y) : null,
    near = !!N && N.d < GNSS_MP_D;
  if (near) {
    // a reflected signal: a jump, roughly away from the shape, that holds while the geometry does
    if (!G.mp || S.t >= G.mpUntil) {
      const a = N.a + (g.u() * 2 - 1) * (Math.PI / 4),
        m = 2 + 2 * g.u();
      G.mp = {x: m * Math.cos(a), y: m * Math.sin(a)};
      G.mpUntil = S.t + 2 + 4 * g.u();
    }
    ex += G.mp.x + 0.5 * g.n();
    ey += G.mp.y + 0.5 * g.n();
  } else G.mp = null;
  G.n++;
  sensEnqueue('gnss', {x: r.x + ex, y: r.y + ey, sig: gnssRep(), t: S.t, mp: near, st: 'new', d2: null});
}
// @end
// a fix arrives (after the sensor latency): the estimator fuses it, or not; the map draws it either way
function gnssApply(fix) {
  const G = S.gnss;
  if (!G) return;
  G.last = fix;
  if (P.loc === 'ekf') ekfGnssUpdate(fix);
  else if (P.loc === 'pf') pfGnssUpdate(fix);
  else fix.st = P.loc === 'custom' ? 'slot' : 'unused';
  G.fixes.push(fix);
  if (G.fixes.length > 120) G.fixes.shift();
}
