/* ============================================================
   Sensors
   ============================================================ */
// A beam that returns nothing reads LMAX, whatever the reach (every consumer takes LMAX as "no return")
const lidarReach = () => clamp(P.lidarRange || LMAX, 1, LMAX);
function lidarSense() {
  const r = S.robot,
    g = S.rngW,
    sh = allShapes(),
    R = lidarReach();
  const ranges = new Float32Array(NBEAM);
  for (let k = 0; k < NBEAM; k++) {
    const a = r.th - Math.PI + (k * TAU) / NBEAM;
    let d = rayCast(r.x, r.y, Math.cos(a), Math.sin(a), R, sh);
    if (d < R) d = Math.max(0.05, d + P.lidarSig * g.n());
    else d = LMAX;
    ranges[k] = d;
  }
  // dropouts draw from their own stream, so switching them on leaves the range noise as it was
  if (P.lidarDrop > 0) {
    if (!S.rngLd) S.rngLd = makeRng(P.seed * 2654435761 + 17);
    const q = Math.min(P.lidarDrop, 100) / 100;
    for (let k = 0; k < NBEAM; k++) if (S.rngLd.u() < q) ranges[k] = LMAX;
  }
  if (P.weather !== 'clear') weatherLidar(ranges);
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
  if (P.loc === 'pf' && P.pfSonar && P.sonar && P.per === 'oracle')
    return 'the particle filter also matches the sonar ring against the prior map, so it can localize without beacons';
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

/* ---------- ultrasonic ring (P.sonar; off by default) ----------
   P.sonN transducers spaced evenly round the hull, each a cone P.sonBeam wide that reports one number: the range of
   the nearest echo anywhere in the cone, from a fan of rays SON_FAN° apart. Each ray stops at the first thing it hits;
   its echo comes back only if the surface faces the sensor (incidence under P.sonSpec, a specular reflector otherwise
   sends it away), only if it is beyond the ring-down dead zone P.sonMin, and only inside the reach P.sonMax. No echo
   at all reads as the maximum range. With probability P.sonXt a sonar hears a neighbour's echo instead of its own.
   The sonars fire in turn, one ping every P.sonPing seconds, so the ring's cycle is N · ping (0.4 s for 8 at 50 ms,
   against the lidar's 0.1 s): each reading is as old as the time since that sonar last fired. The lab models no
   materials: glass and dark surfaces, which a lidar can miss and a sonar sees, are walls like any other here.
   Sensors registry: when SENSORS exists, its entry is {key: 'sonar', label: 'Ultrasonic ring', flag: 'sonar', feeds:
   'mapping (P.mapSrc), the safety stop (P.guardSrc), the particle filter (P.pfSonar), the Code tab's localizer and predictor'}. */
const SON_FAN = 2; // degrees between the rays of a cone's fan
// a sonar's mount on the hull and its axis, in the body frame: the circle of radius RR (unicycle), the body's rectangle (car)
function sonMountB(i, N) {
  const phi = (i * TAU) / N;
  if (!isCar()) return {x: RR * Math.cos(phi), y: RR * Math.sin(phi), a: phi};
  const hl = carLen() / 2,
    hw = CAR.width / 2,
    c = Math.cos(phi),
    s = Math.sin(phi),
    t = Math.min(Math.abs(c) > 1e-9 ? hl / Math.abs(c) : Infinity, Math.abs(s) > 1e-9 ? hw / Math.abs(s) : Infinity),
    off = carLen() / 2 - CAR.rear;
  return {x: off + t * c, y: t * s, a: phi};
}
// rayCast with the cosine of the incidence angle at the hit (1: the surface faces the ray, 0: grazing)
function sonRay(ox, oy, dx, dy, maxR, shapes) {
  let best = maxR,
    cs = 0;
  for (const s of shapes) {
    if (s.t === 'r') {
      let tmin = -Infinity,
        tmax = Infinity,
        ax = 0;
      if (Math.abs(dx) < 1e-12) {
        if (ox < s.x || ox > s.x + s.w) continue;
      } else {
        const t1 = (s.x - ox) / dx,
          t2 = (s.x + s.w - ox) / dx;
        tmin = Math.min(t1, t2);
        tmax = Math.max(t1, t2);
      }
      if (Math.abs(dy) < 1e-12) {
        if (oy < s.y || oy > s.y + s.h) continue;
      } else {
        const t1 = (s.y - oy) / dy,
          t2 = (s.y + s.h - oy) / dy;
        if (Math.min(t1, t2) > tmin) {
          tmin = Math.min(t1, t2);
          ax = 1;
        }
        tmax = Math.min(tmax, Math.max(t1, t2));
      }
      if (tmin <= tmax && tmin >= 0 && tmin < best) {
        best = tmin;
        cs = Math.abs(ax ? dy : dx);
      }
    } else {
      const fx = ox - s.x,
        fy = oy - s.y,
        b = fx * dx + fy * dy,
        c = fx * fx + fy * fy - s.r * s.r,
        disc = b * b - c;
      if (disc < 0) continue;
      const t = -b - Math.sqrt(disc);
      if (t >= 0 && t < best) {
        best = t;
        cs = Math.abs(((fx + t * dx) * dx + (fy + t * dy) * dy) / s.r);
      }
    }
  }
  return {d: best, c: cs};
}
// One cone's echo from the true pose: {d, why}, d = Infinity when nothing answers; why: ok, spec (every hit too oblique),
// dead (the only hits inside the dead zone), none (nothing within reach)
function sonEcho(i, N, sh) {
  const r = S.robot,
    m = sonMountB(i, N),
    c = Math.cos(r.th),
    s = Math.sin(r.th),
    ox = r.x + m.x * c - m.y * s,
    oy = r.y + m.x * s + m.y * c,
    w = (P.sonBeam * Math.PI) / 180,
    nr = Math.max(3, Math.round(P.sonBeam / SON_FAN) + 1),
    cmin = Math.cos((P.sonSpec * Math.PI) / 180);
  let d = Infinity,
    spec = false,
    dead = false;
  for (let k = 0; k < nr; k++) {
    const a = r.th + m.a - w / 2 + (k * w) / (nr - 1),
      h = sonRay(ox, oy, Math.cos(a), Math.sin(a), P.sonMax, sh);
    if (h.d >= P.sonMax) continue;
    if (h.d < P.sonMin) dead = true;
    else if (h.c < cmin - 1e-9) spec = true;
    else if (h.d < d) d = h.d;
  }
  return {d, why: d < Infinity ? 'ok' : spec ? 'spec' : dead ? 'dead' : 'none'};
}
// @code sonar-sense | sonarSense: a ring of cones fired in turn, each reporting its nearest echo
function sonarSense() {
  const N = clamp(Math.round(P.sonN), 4, 16);
  if (!S.son || S.son.N !== N) S.son = {N, next: 0, acc: 0, g: makeRng(P.seed * 6151 + 5)}; // its own noise stream
  const R = S.son,
    g = R.g,
    sh = allShapes(),
    out = [],
    ping = Math.max(10, Math.round(1000 * P.sonPing));
  R.acc += Math.round(1000 * DT);
  while (R.acc >= ping) {
    R.acc -= ping;
    const i = R.next;
    R.next = (i + 1) % N;
    let e = sonEcho(i, N, sh);
    if (P.sonXt > 0 && g.u() < P.sonXt / 100) {
      const j = (i + (g.u() < 0.5 ? N - 1 : 1)) % N; // a neighbour's ping, heard by this sonar
      e = {...sonEcho(j, N, sh), why: 'xt'};
    }
    const m = sonMountB(i, N),
      d = e.d < Infinity ? clamp(e.d + P.sonSig * g.n(), P.sonMin, P.sonMax) : P.sonMax;
    out.push({i, r: d, max: e.d === Infinity, why: e.why, mx: m.x, my: m.y, a: m.a, w: (P.sonBeam * Math.PI) / 180, t: S.t});
  }
  return out;
}
// @end
// The ring's cycle: how old the oldest reading is [s]
const sonCycle = () => clamp(Math.round(P.sonN), 4, 16) * Math.max(0.01, P.sonPing);
// Readings delivered (after the sensor latency, like the lidar): placed with the estimate now, as the lidar's hits are,
// kept per sonar in S.sonArcs (what the map draws and the safety stop reads), and passed to whatever uses them
function sonarApply(list) {
  const e = S.est,
    c = Math.cos(e.th),
    s = Math.sin(e.th),
    N = clamp(Math.round(P.sonN), 4, 16);
  if (!S.sonArcs || S.sonArcs.length !== N) S.sonArcs = new Array(N).fill(null);
  S.sonArcs = S.sonArcs.slice(); // a new array per delivery: a replay frame keeps the one it saw
  for (const z of list) {
    const A = {...z, x: e.x + z.mx * c - z.my * s, y: e.y + z.mx * s + z.my * c, th: e.th + z.a};
    S.sonArcs[z.i] = A;
    if (P.per === 'mapping' && P.mapSrc !== 'lidar') integrateSonar(A);
  }
  if (P.loc === 'pf' && P.pfSonar && P.per === 'oracle') pfSonarUpdate(list);
  S.sonTick = S.tick;
}
// The returned arcs as points for the safety stop: an echo says something is at that range somewhere in the cone, so
// every point of the arc counts (one per 3°); readings older than two ring cycles are dropped
function sonarPts() {
  const out = [],
    old = S.t - 2 * sonCycle() - 1e-6;
  for (const A of S.sonArcs || []) {
    if (!A || A.max || A.t < old) continue;
    const n = Math.max(2, Math.round((A.w * 180) / Math.PI / 3));
    for (let k = 0; k <= n; k++) {
      const a = A.th - A.w / 2 + (k * A.w) / n;
      out.push([A.x + A.r * Math.cos(a), A.y + A.r * Math.sin(a)]);
    }
  }
  return out;
}
// What the Code tab's localizer and predictor receive: the readings delivered this tick, in the body frame
const sonarObs = list =>
  list ? list.map(z => ({i: z.i, r: +z.r.toFixed(4), max: z.max, bearing: z.a, width: z.w, mount: [z.mx, z.my]})) : null;

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
    gives: 'The turn rate from a gyro instead of the wheels: far less noise, but a bias of its own (Sensors → Yaw-rate gyro).'
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
      'Range and bearing to each beacon in reach, 5 times a second: position and heading fixes. Off: the EKF coasts on odometry. Single beacons: Sensors → Beacons.'
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
  },
  {
    key: 'sonar',
    label: 'Sonar ring',
    short: 'Sonar',
    flag: 'sonar',
    kind: 'extero',
    loc: ['particle filter (sonar weighting)', 'your localizer'],
    per: ['sonar mapping', 'the sonar safety stop'],
    gives:
      'The ultrasonic ring: one range per sonar for a whole cone, a few metres at most, the sonars firing in turn: a blurred map, a bumper that stops late at grazing angles, and a rough pose fix against the map. Its settings: Sensors → Ultrasonic ring; the map, the safety stop and the particle filter each choose whether to read it.'
  },
  {
    key: 'radar',
    label: 'Radar',
    short: 'Radar',
    flag: 'radar',
    kind: 'extero',
    loc: [],
    per: ['the people tracker (Perceive → Tracker inputs)', 'your predictor'],
    gives:
      'A few detections per scan ahead of the robot, each with range, a coarse bearing and the radial speed from the Doppler shift, with clutter and ghosts; it keeps working in fog and rain. Its settings: Sensors → Radar; the people tracker reads it when Perceive → Tracker inputs says so.'
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
