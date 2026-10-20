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
  if (P.loc === 'pf' && P.pfLidar && P.per === 'oracle')
    return 'the particle filter also matches lidar against the prior map, so it can localize without beacons';
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
