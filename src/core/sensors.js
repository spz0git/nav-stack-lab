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
  if (P.loc === 'pf' && P.pfLidar && P.per === 'oracle')
    return 'the particle filter also matches lidar against the prior map, so it can localize without beacons';
  if (P.loc === 'pf' && P.pfSonar && P.sonar && P.per === 'oracle')
    return 'the particle filter also matches the sonar ring against the prior map, so it can localize without beacons';
  if (P.loc === 'pgslam') return 'pose-graph SLAM uses the lidar only: the beacons are ignored';
  if (P.loc === 'ekf' && P.scanMatch && P.per === 'oracle')
    return 'the EKF also matches the lidar scan against the prior map, so it can localize without beacons';
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
