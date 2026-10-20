/* ============================================================
   Radar and weather: a forward-facing 2D radar that measures range, azimuth and radial velocity (Doppler) per
   detection; the weather that degrades the lidar and barely touches the radar; and the radar's update in the people
   tracker, an extended Kalman filter step on the constant-velocity state of core/agents.js.
   ============================================================ */
// σ of range, azimuth and radial velocity; the range and Doppler resolution (two echoes closer than all three of range,
// Doppler and the angular resolution P.radRes become one detection); the distance from a person's centre to the
// surface that echoes; the most detections one static shape gives per scan
const RAD = {sr: 0.1, sb: (3 * Math.PI) / 180, sv: 0.1, dr: 0.4, dv: 0.25, body: 0.24, wallMax: 3};
// The radar's association gate: χ² with 2 degrees of freedom at 99 %, on range and bearing only. Gating on the radial
// velocity too would throw away exactly the echo that matters most: when a person turns around, the Doppler innovation
// is many σ (the filter's velocity is confident and wrong), and a velocity gate would reject the measurement that says so.
const RAD_GATE = 9.21;
const radarOn = () => P.radar || P.trkIn !== 'lidar';
const radReach = () => P.radRange * (P.weather === 'rain' ? 0.9 : 1);
function radRng() {
  if (!S.rngR) S.rngR = makeRng(P.seed * 15485863 + 5); // its own stream: turning the radar on leaves every other draw as it was
  return S.rngR;
}
// ---- weather: what fog and rain do to the lidar ----
// reach: beyond about this range the return is too weak; drop: a beam returns nothing; sig: extra range noise (m);
// back: a beam returns from the fog or a raindrop itself, 0.3–2 m out. The radar's wavelength (millimetres) passes
// through droplets a lidar's (a micrometre) scatters off: in rain it loses a tenth of its reach and sees a little more clutter.
const WEATHER = {
  clear: null,
  rain: {reach: 6, drop: 0.06, sig: 0.03, back: 0.002, clutter: 0.3},
  fog: {reach: 4, drop: 0.15, sig: 0.05, back: 0.005, clutter: 0}
};
function weatherLidar(ranges) {
  const Wx = WEATHER[P.weather];
  if (!Wx) return;
  if (!S.rngX) S.rngX = makeRng(P.seed * 49979687 + 9);
  const g = S.rngX;
  for (let k = 0; k < ranges.length; k++) {
    let d = ranges[k];
    if (d < LMAX && (d > Wx.reach * (0.8 + 0.4 * g.u()) || g.u() < Wx.drop)) d = LMAX;
    else if (d < LMAX) d = Math.max(0.05, d + Wx.sig * g.n());
    if (g.u() < Wx.back) d = Math.min(d, 0.3 + 1.7 * g.u());
    ranges[k] = d;
  }
}
// ---- the radar sensor ----
// A ray cast against the static shapes that also says which shape it hit and the surface normal there
function radCast(ox, oy, dx, dy, maxR) {
  let best = {t: maxR, s: -1, nx: 0, ny: 0};
  S.shapes.forEach((s, i) => {
    const t = rayCast(ox, oy, dx, dy, best.t, [s]);
    if (t >= best.t) return;
    const x = ox + t * dx,
      y = oy + t * dy;
    let nx, ny;
    if (s.t === 'r') {
      const e = [Math.abs(x - s.x), Math.abs(x - s.x - s.w), Math.abs(y - s.y), Math.abs(y - s.y - s.h)],
        m = e.indexOf(Math.min(...e));
      [nx, ny] = [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1]
      ][m];
    } else {
      nx = (x - s.x) / s.r;
      ny = (y - s.y) / s.r;
    }
    best = {t, s: i, nx, ny};
  });
  return best;
}
// Is the straight line from a to b free of static shapes and of the people other than `skip`?
function radClear(ax, ay, bx, by, skip) {
  const d = hyp(bx - ax, by - ay);
  if (d < 1e-6) return true;
  const ux = (bx - ax) / d,
    uy = (by - ay) / d;
  if (rayCast(ax, ay, ux, uy, d, S.shapes) < d - 0.05) return false;
  for (const p of S.peds) {
    if (p === skip) continue;
    for (const c of p.car ? carCircles(p) : [p])
      if (rayCast(ax, ay, ux, uy, d, [{t: 'c', x: c.x, y: c.y, r: c.r}]) < d - 0.05) return false;
  }
  return true;
}
// The ghost of person p: the radar's wave goes out to a wall, bounces to the person and back the same way, so the echo
// seems to come from the person's mirror image behind the wall (the image method), moving with the mirrored velocity.
// The wall faces tried are the sides of the rectangles that face both the robot and the person; the shortest path wins.
function radGhost(r, p, fov, reach) {
  let best = null;
  for (const s of S.shapes) {
    if (s.t !== 'r') continue;
    for (const [ax, c, lo, hi] of [
      [0, s.x, s.y, s.y + s.h],
      [0, s.x + s.w, s.y, s.y + s.h],
      [1, s.y, s.x, s.x + s.w],
      [1, s.y + s.h, s.x, s.x + s.w]
    ]) {
      const rc = ax ? r.y : r.x,
        pc = ax ? p.y : p.x;
      const out = c === (ax ? s.y : s.x) ? -1 : 1; // the side the face looks to
      if ((rc - c) * out <= 0.05 || (pc - c) * out <= 0.05) continue;
      const gx = ax ? p.x : 2 * c - p.x,
        gy = ax ? 2 * c - p.y : p.y,
        f = (c - rc) / ((ax ? gy : gx) - rc), // where the line to the image crosses the face
        wx = r.x + f * (gx - r.x),
        wy = r.y + f * (gy - r.y),
        wl = ax ? wx : wy;
      if (!(f > 0 && f < 1) || wl < lo + 0.05 || wl > hi - 0.05) continue;
      const d = hyp(gx - r.x, gy - r.y);
      if (d > reach || (best && d >= best.d)) continue;
      if (Math.abs(wrap(Math.atan2(gy - r.y, gx - r.x) - r.th)) > fov) continue;
      const ox = wx + out * (ax ? 0 : 0.02),
        oy = wy + out * (ax ? 0.02 : 0);
      if (!radClear(r.x, r.y, ox, oy, null) || !radClear(ox, oy, p.x, p.y, p)) continue;
      best = {d, x: gx, y: gy, vx: ax ? p.vx || 0 : -(p.vx || 0), vy: ax ? -(p.vy || 0) : p.vy || 0};
    }
  }
  return best;
}
// @code radar-sense | radarSense: the radar's echoes, merged by resolution, with noise, clutter and ghosts
// One scan: the people and vehicles in the field of view (one echo each, from the near side of the body), the static
// shapes (sampled across the field of view; a surface echoes strongly only when it faces the radar, so a wall gives a
// few echoes near its perpendicular and a pillar one or two), ghosts by a bounce off a wall, and clutter. Echoes closer
// than the resolution in range, in Doppler and in angle all at once become one detection, where their amplitudes
// average. Each detection is {r, b, v} relative to the robot: range (m), azimuth (rad, 0 straight ahead) and radial
// velocity (m/s, negative closing). `kind` is the simulator's label, for the measurements only: the robot never reads it.
function radarSense() {
  const r = S.robot,
    g = radRng(),
    fov = (P.radFov * Math.PI) / 360,
    reach = radReach(),
    vex = r.v * Math.cos(r.th),
    vey = r.v * Math.sin(r.th),
    echo = [];
  const add = (x, y, vx, vy, amp, kind) => {
    const dx = x - r.x,
      dy = y - r.y,
      d = hyp(dx, dy);
    if (d < 0.2 || d > reach) return;
    const b = wrap(Math.atan2(dy, dx) - r.th);
    if (Math.abs(b) > fov) return;
    echo.push({r: d, b, v: ((vx - vex) * dx + (vy - vey) * dy) / d, amp, kind});
  };
  for (const p of S.peds) {
    const dx = p.x - r.x,
      dy = p.y - r.y,
      d = hyp(dx, dy),
      body = p.car ? 0.6 : p.r;
    if (d - body > reach || d < 0.3) continue;
    if (g.u() > (p.car ? 0.98 : 0.9)) continue; // a person echoes weakly: missed one scan in ten; a vehicle hardly ever
    const sx = p.x - (dx / d) * body,
      sy = p.y - (dy / d) * body;
    if (!radClear(r.x, r.y, sx - (dx / d) * 0.05, sy - (dy / d) * 0.05, p)) continue;
    add(sx, sy, p.vx || 0, p.vy || 0, p.car ? 4 : 1, 'person');
    if (g.u() < P.radGhost / 100) {
      const q = radGhost(r, p, fov, reach);
      if (q) add(q.x, q.y, q.vx, q.vy, 0.5, 'ghost');
    }
  }
  const step = (Math.max(1, P.radRes) * Math.PI) / 360,
    per = new Map();
  for (let a = -fov; a <= fov + 1e-9; a += step) {
    const ux = Math.cos(r.th + a),
      uy = Math.sin(r.th + a),
      h = radCast(r.x, r.y, ux, uy, reach);
    if (h.s < 0) continue;
    const x = r.x + h.t * ux,
      y = r.y + h.t * uy;
    if (!radClear(r.x, r.y, x - ux * 0.05, y - uy * 0.05, null)) continue; // a person in front of the wall hides it
    const c = Math.abs(h.nx * ux + h.ny * uy); // cos of the incidence angle
    if (g.u() > 0.1 + 0.85 * c ** 4) continue;
    if (!per.has(h.s)) per.set(h.s, []);
    per.get(h.s).push({x, y, c});
  }
  for (const L of per.values()) {
    L.sort((a, b) => b.c - a.c);
    for (const q of L.slice(0, RAD.wallMax)) add(q.x, q.y, 0, 0, 2, 'static');
  }
  const Wx = WEATHER[P.weather],
    lam = P.radClutter + (Wx ? Wx.clutter : 0);
  let n = 0;
  for (let L = Math.exp(-lam), u = g.u(); u > L; u *= g.u()) n++; // Poisson: the number of false detections this scan
  for (let i = 0; i < n; i++) {
    const b = (2 * g.u() - 1) * fov,
      d = 1 + g.u() * (reach - 1);
    echo.push({r: d, b, v: -r.v * Math.cos(b) + 3 * (g.u() - 0.5), amp: 0.5, kind: 'clutter'});
  }
  // resolution: the strongest echo first; a weaker one inside its resolution cell joins it
  echo.sort((a, b) => b.amp - a.amp);
  const res = (P.radRes * Math.PI) / 180,
    out = [];
  for (const e of echo) {
    const m = out.find(o => Math.abs(o.r - e.r) < RAD.dr && Math.abs(o.v - e.v) < RAD.dv && Math.abs(wrap(o.b - e.b)) < res);
    if (!m) {
      out.push({...e, n: 1});
      continue;
    }
    const w = m.amp + e.amp;
    m.r = (m.r * m.amp + e.r * e.amp) / w;
    m.b = m.b + (wrap(e.b - m.b) * e.amp) / w;
    m.v = (m.v * m.amp + e.v * e.amp) / w;
    m.amp = w;
    m.n++;
  }
  return out.map(o => ({
    r: Math.max(0.2, o.r + RAD.sr * g.n()),
    b: wrap(o.b + RAD.sb * g.n()),
    v: o.v + RAD.sv * g.n(),
    kind: o.kind,
    n: o.n
  }));
}
// @end
// A scan delivered (latency applies, as to the lidar): placed in the world from the pose estimate, as the lidar's hits
// are, with the robot's own speed measured from it
function radarApply(D) {
  const e = S.est;
  S.radar = {t: S.t, det: D.map(d => ({...d, x: e.x + d.r * Math.cos(e.th + d.b), y: e.y + d.r * Math.sin(e.th + d.b)}))};
  S.radar.ve = radEgoSpeed(S.radar.det);
  S.radTick = S.tick;
}
// The robot's own speed from the static world's echoes. Doppler is relative: to know how fast a person moves, the
// robot must know how fast it moves itself, better than wheel odometry tells it from one tick (σ about 0.15 m/s on the
// busy floor, more than the radar's 0.1). Everything static closes at v cos b, so the echoes whose radial velocity is
// within 0.4 m/s of what the odometry predicts give v by least squares, −Σ v_d cos b / Σ cos² b; with fewer than three,
// the odometry it is.
function radEgoSpeed(det) {
  const v0 = S.odo ? S.odo.v : 0;
  let num = 0,
    den = 0,
    n = 0;
  for (const d of det) {
    const c = Math.cos(d.b);
    if (c < 0.3 || Math.abs(d.v + v0 * c) > 0.4) continue;
    num -= d.v * c;
    den += c * c;
    n++;
  }
  return n >= 3 ? num / den : v0;
}
// The static world's radial velocity at azimuth b, seen from the robot moving at v: −v cos b
// A detection is a candidate for the people tracker when it moves against the static world by more than its Doppler
// noise allows, or when the map does not explain it within what the azimuth noise smears it over. A person standing
// still within that smear of a wall or a shelf is lost to the radar (the classic weakness of Doppler processing).
function radCandidates() {
  if (!S.radar) return [];
  const e = S.est,
    v = S.radar.ve;
  return S.radar.det.filter(d => {
    if (Math.abs(d.v + v * Math.cos(d.b)) > 3 * RAD.sv + 0.05) return (d.moving = true);
    d.moving = false;
    return !radExplained(d.x, d.y, 0.25 + 2 * d.r * RAD.sb, e);
  });
}
function radExplained(x, y, tol) {
  const k = cellIdx(x, y);
  if (k < 0) return true;
  if (P.per === 'oracle') return S.cm.dist[k] < tol;
  const i0 = k % GW,
    j0 = (k / GW) | 0,
    n = Math.ceil(tol / RES);
  for (let j = Math.max(0, j0 - n); j <= Math.min(GH - 1, j0 + n); j++)
    for (let i = Math.max(0, i0 - n); i <= Math.min(GW - 1, i0 + n); i++)
      if (S.lo[j * GW + i] > 2.0 && hyp(i - i0, j - j0) * RES <= tol) return true;
  return false;
}
function radInView(t) {
  const e = S.est,
    d = hyp(t.x - e.x, t.y - e.y);
  return d < radReach() && Math.abs(wrap(Math.atan2(t.y - e.y, t.x - e.x) - e.th)) < (P.radFov * Math.PI) / 360;
}
// The radar's metrics line: what it sees and what the tracker took from it, and the nearest detection within 20° of
// straight ahead with its closing speed and the time to contact at that speed (range / closing speed), which needs no
// tracking at all: what an emergency brake reads
function radarSummary() {
  if (!radarOn() || !S.radar) return null;
  const R = S.radar,
    ahead = R.det.filter(d => Math.abs(d.b) < 0.35).sort((a, b) => a.r - b.r)[0];
  return {n: R.det.length, cand: R.cand, paired: R.paired, born: R.born, ahead, ttc: ahead && ahead.v < -0.05 ? ahead.r / -ahead.v : null};
}

/* ---------- the tracker with the radar: the constant-velocity filter with a full 4×4 covariance ---------- */
// The lidar-only tracker (agTrack) keeps one covariance for both axes, which is exact while every measurement is a
// position with the same noise in x and y. A radar detection is not: it pins the range and the radial velocity
// tightly and the bearing loosely, so the covariance turns into an ellipse along the line of sight and each track
// carries all of it: C, 4×4 row-major over [x, y, vx, vy].
const KF_Q = (dt, q) => {
  const a = (q * dt ** 4) / 4,
    b = (q * dt ** 3) / 2,
    c = q * dt * dt;
  return [a, 0, b, 0, 0, a, 0, b, b, 0, c, 0, 0, b, 0, c];
};
// a track born in the lidar-only tracker (the input switched mid-run) starts from its shared covariance
function kfInitC(t) {
  if (!t.C) t.C = [t.pxx, 0, t.pxv, 0, 0, t.pxx, 0, t.pxv, t.pxv, 0, t.pvv, 0, 0, t.pxv, 0, t.pvv];
}
function kfPredict(t, dt, q) {
  const C = t.C,
    F = (i, j) => (i === j ? 1 : j === i + 2 ? dt : 0),
    T = new Array(16).fill(0),
    Qm = KF_Q(dt, q);
  t.x += t.vx * dt;
  t.y += t.vy * dt;
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) for (let k = 0; k < 4; k++) T[i * 4 + j] += F(i, k) * C[k * 4 + j];
  for (let i = 0; i < 4; i++)
    for (let j = 0; j < 4; j++) {
      let s = Qm[i * 4 + j];
      for (let k = 0; k < 4; k++) s += T[i * 4 + k] * F(j, k);
      C[i * 4 + j] = s;
    }
}
// Innovation covariance S = H C Hᵀ + R and its inverse (m ≤ 3 rows of H), and the squared Mahalanobis distance of y
function kfInnov(t, H, y, R) {
  const m = H.length,
    C = t.C,
    HC = H.map(h => [0, 1, 2, 3].map(j => h[0] * C[j] + h[1] * C[4 + j] + h[2] * C[8 + j] + h[3] * C[12 + j])),
    Sm = H.map((_, i) => H.map((h, j) => HC[i][0] * h[0] + HC[i][1] * h[1] + HC[i][2] * h[2] + HC[i][3] * h[3] + (i === j ? R[i] : 0)));
  const Si = m === 1 ? [[1 / Sm[0][0]]] : m === 2 ? inv2(Sm) : inv3(Sm);
  if (!Si) return null;
  let d2 = 0;
  for (let i = 0; i < m; i++) for (let j = 0; j < m; j++) d2 += y[i] * Si[i][j] * y[j];
  return {HC, Si, d2};
}
// The update: K = C Hᵀ S⁻¹, x += K y, C = (I − K H) C (I − K H)ᵀ + K R Kᵀ (Joseph's form, symmetric and positive)
function kfUpdate(t, H, y, R, I) {
  const m = H.length,
    C = t.C,
    K = [0, 1, 2, 3].map(i => {
      const row = new Array(m).fill(0);
      for (let a = 0; a < m; a++) for (let b = 0; b < m; b++) row[b] += I.HC[a][i] * I.Si[a][b];
      return row;
    });
  const dx = K.map(row => row.reduce((s, k, a) => s + k * y[a], 0));
  t.x += dx[0];
  t.y += dx[1];
  t.vx += dx[2];
  t.vy += dx[3];
  const A = [];
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) A.push((i === j ? 1 : 0) - K[i].reduce((s, k, a) => s + k * H[a][j], 0));
  const AC = new Array(16).fill(0),
    N = new Array(16).fill(0);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) for (let k = 0; k < 4; k++) AC[i * 4 + j] += A[i * 4 + k] * C[k * 4 + j];
  for (let i = 0; i < 4; i++)
    for (let j = 0; j < 4; j++) {
      let s = 0;
      for (let k = 0; k < 4; k++) s += AC[i * 4 + k] * A[j * 4 + k];
      for (let a = 0; a < m; a++) s += K[i][a] * R[a] * K[j][a];
      N[i * 4 + j] = s;
    }
  t.C = N;
}
function inv2(M) {
  const d = M[0][0] * M[1][1] - M[0][1] * M[1][0];
  if (Math.abs(d) < 1e-15) return null;
  return [
    [M[1][1] / d, -M[0][1] / d],
    [-M[1][0] / d, M[0][0] / d]
  ];
}
function inv3(M) {
  const [a, b, c] = M[0],
    [d, e, f] = M[1],
    [g, h, i] = M[2],
    A = e * i - f * h,
    B = -(d * i - f * g),
    Cc = d * h - e * g,
    det = a * A + b * B + c * Cc;
  if (Math.abs(det) < 1e-18) return null;
  return [
    [A / det, -(b * i - c * h) / det, (b * f - c * e) / det],
    [B / det, (a * i - c * g) / det, -(a * f - c * d) / det],
    [Cc / det, -(a * h - b * g) / det, (a * e - b * d) / det]
  ];
}
// @code radar-update | radarH: the radar's measurement model and its Jacobian, and the update it feeds
// What the radar should read for track t, seen from the estimated pose e moving at (vex, vey): the range to the near
// side of the body, the bearing, and the radial velocity, the relative velocity w projected on the line of sight.
// H is the Jacobian of those three with respect to [x, y, vx, vy] at the track's state.
function radarH(t, e, vex, vey) {
  const dx = t.x - e.x,
    dy = t.y - e.y,
    q = Math.max(1e-6, dx * dx + dy * dy),
    rho = Math.sqrt(q),
    wx = t.vx - vex,
    wy = t.vy - vey,
    vr = (dx * wx + dy * wy) / rho;
  return {
    z: [rho - RAD.body, wrap(Math.atan2(dy, dx) - e.th), vr],
    H: [
      [dx / rho, dy / rho, 0, 0],
      [-dy / q, dx / q, 0, 0],
      [(wx - (vr * dx) / rho) / rho, (wy - (vr * dy) / rho) / rho, dx / rho, dy / rho]
    ]
  };
}
// The radar step of the tracker: every candidate detection against every track, gated by χ² (3 degrees of freedom),
// paired nearest first (greedy nearest neighbour, as the lidar's); a paired track takes the extended Kalman update. A
// clutter echo that falls inside a track's gate when the person's own echo is missing is taken as the person: nearest
// neighbour has no way to say "none of these". Unpaired candidates start tentative tracks, with the radial velocity
// already known and the tangential one not.
function radarTrack(ve) {
  const A = S.agents,
    e = S.est,
    Rm = [RAD.sr ** 2, RAD.sb ** 2, RAD.sv ** 2],
    cand = radCandidates(),
    pairs = [],
    born0 = A.nextId;
  A.tracks.forEach((t, i) => {
    const h = radarH(t, e, ve[0], ve[1]);
    cand.forEach((d, j) => {
      const y = [d.r - h.z[0], wrap(d.b - h.z[1]), d.v - h.z[2]],
        G = kfInnov(t, h.H.slice(0, 2), y.slice(0, 2), Rm.slice(0, 2)); // the gate: range and bearing only
      if (G && G.d2 < RAD_GATE) pairs.push([G.d2, i, j, h.H, y]);
    });
  });
  pairs.sort((a, b) => a[0] - b[0]);
  const ut = new Set(),
    ud = new Set();
  for (const [, i, j, H, y] of pairs) {
    if (ut.has(i) || ud.has(j)) continue;
    ut.add(i);
    ud.add(j);
    const t = A.tracks[i],
      I = kfInnov(t, H, y, Rm);
    if (!I) continue;
    kfUpdate(t, H, y, Rm, I);
    t.rh = (t.rh || 0) + 1;
    agHit(t);
  }
  cand.forEach((d, j) => {
    if (ud.has(j) || A.tracks.some(t => hyp(t.x - d.x, t.y - d.y) < 1)) return;
    const c = e.th + d.b,
      ux = Math.cos(c),
      uy = Math.sin(c),
      rr = d.r + RAD.body,
      vr = d.v + ve[0] * ux + ve[1] * uy, // the person's own speed along the line of sight
      st2 = (rr * RAD.sb) ** 2, // across the line of sight the azimuth's σ times the range; along it the range's σ
      sr2 = RAD.sr ** 2;
    const cxx = sr2 * ux * ux + st2 * uy * uy,
      cyy = sr2 * uy * uy + st2 * ux * ux,
      cxy = (sr2 - st2) * ux * uy,
      vt2 = 1, // the tangential velocity is unknown: σ 1 m/s, as a lidar track starts with in both axes
      vxx = RAD.sv ** 2 * ux * ux + vt2 * uy * uy,
      vyy = RAD.sv ** 2 * uy * uy + vt2 * ux * ux,
      vxy = (RAD.sv ** 2 - vt2) * ux * uy;
    A.tracks.push({
      id: A.nextId++,
      x: e.x + rr * ux,
      y: e.y + rr * uy,
      vx: vr * ux,
      vy: vr * uy,
      r: 0.3,
      C: [cxx, cxy, 0, 0, cxy, cyy, 0, 0, 0, 0, vxx, vxy, 0, 0, vxy, vyy],
      hits: 1,
      rh: 1,
      conf: false,
      lastUpd: S.t,
      radar: true
    });
  });
  // for the metrics line: how many detections passed the Doppler and map test, how many the gate let onto a track,
  // how many started one
  Object.assign(S.radar, {cand: cand.length, paired: ud.size, born: A.nextId - born0});
}
// @end
// A track was updated this scan: count the hit and confirm it. With both sensors, a track the radar can see needs one of
// its hits from the radar (or twice the hits from the lidar alone): a lidar return from fog, or a radar echo from
// clutter, rarely builds a track the other sensor agrees with.
function agHit(t) {
  t.hits++;
  t.lastUpd = S.t;
  if (t.conf) return;
  const vouch = P.trkIn === 'both' && radInView(t) ? (t.rh || 0) >= 1 || t.hits >= 6 : true;
  if (t.hits >= 3 && vouch) {
    t.conf = true;
    t.t0 = S.t;
  }
}
// The tracker when the radar is one of its inputs (P.trkIn 'radar' or 'both'): the same predict, gate, pair, birth and
// coast as agTrack, on the full covariance; the lidar's clusters update position, the radar's detections range,
// bearing and radial velocity.
function agTrackFused(dt) {
  const A = S.agents,
    q = P.agSigA * P.agSigA,
    R = AG_SZ * AG_SZ,
    e = S.est,
    v = S.radar ? S.radar.ve : S.odo ? S.odo.v : 0,
    ve = [v * Math.cos(e.th), v * Math.sin(e.th)];
  for (const t of A.tracks) {
    kfInitC(t);
    kfPredict(t, dt, q);
  }
  if (P.trkIn === 'both' && S.scanTick === S.tick) {
    const Hl = [
        [1, 0, 0, 0],
        [0, 1, 0, 0]
      ],
      pairs = [];
    A.tracks.forEach((t, i) =>
      A.det.forEach((d, j) => {
        const y = [d.x - t.x, d.y - t.y],
          I = kfInnov(t, Hl, y, [R, R]);
        if (I && I.d2 < 9.21) pairs.push([I.d2, i, j, y, I]);
      })
    );
    pairs.sort((a, b) => a[0] - b[0]);
    const ut = new Set(),
      ud = new Set();
    for (const [, i, j, y, I] of pairs) {
      if (ut.has(i) || ud.has(j)) continue;
      ut.add(i);
      ud.add(j);
      const t = A.tracks[i],
        d = A.det[j];
      kfUpdate(t, Hl, y, [R, R], I);
      t.r = 0.8 * t.r + 0.2 * d.r;
      // per-target scan matching, as in agTrack: the displacement of the person's hits is a velocity measurement
      if (P.agICP && t.pts && d.pts && t.pts.length >= 3 && d.pts.length >= 3) {
        const cx = t.px,
          cy = t.py,
          m = icp2d(
            t.pts.map(q => [q[0] - cx, q[1] - cy]),
            d.pts.map(q => [q[0] - cx, q[1] - cy]),
            {x: t.vx * dt, y: t.vy * dt, th: 0},
            3
          );
        if (m && m.inl >= 0.6 && m.rms < 0.08) {
          const Hv = [
              [0, 0, 1, 0],
              [0, 0, 0, 1]
            ],
            yv = [m.x / dt - t.vx, m.y / dt - t.vy],
            Iv = kfInnov(t, Hv, yv, [0.25, 0.25]);
          if (Iv) kfUpdate(t, Hv, yv, [0.25, 0.25], Iv);
        }
      }
      t.pts = d.pts;
      t.px = d.x;
      t.py = d.y;
      agHit(t);
    }
    A.det.forEach((d, j) => {
      if (ud.has(j)) return;
      A.tracks.push({
        id: A.nextId++,
        x: d.x,
        y: d.y,
        vx: 0,
        vy: 0,
        r: d.r,
        C: [R, 0, 0, 0, 0, R, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
        hits: 1,
        rh: 0,
        conf: false,
        lastUpd: S.t,
        pts: d.pts,
        px: d.x,
        py: d.y
      });
    });
  }
  if (S.radTick === S.tick) radarTrack(ve);
  for (const t of A.tracks) {
    const sp = hyp(t.vx, t.vy);
    if (sp > 2.5) {
      t.vx *= 2.5 / sp;
      t.vy *= 2.5 / sp;
    }
    // the shared scalars the rest of the page reads (σ of position in the inspector, the scalar tracker if switched back)
    t.pxx = (t.C[0] + t.C[5]) / 2;
    t.pxv = (t.C[2] + t.C[7]) / 2;
    t.pvv = (t.C[10] + t.C[15]) / 2;
  }
  A.tracks = A.tracks.filter(t => S.t - t.lastUpd < (t.conf ? 1.0 : 0.25));
}
