/* ============================================================
   EKF-SLAM: the beacon positions are unknown and estimated together with the pose.
   State x = [x, y, θ, m1x, m1y, m2x, m2y, …], full covariance. Known IDs give data association;
   unlabeled readings are matched to the mapped beacons by Mahalanobis distance inside the gate.
   ============================================================ */
function slamInit() {
  const e = S.est;
  S.slam = {n: 0, ids: [], x: [e.x, e.y, e.th], P: [0.01, 0, 0, 0, 0.01, 0, 0, 0, 0.0025]};
  S.Pc = [0.01, 0, 0, 0, 0.01, 0, 0, 0, 0.0025];
}
const slamDim = () => 3 + 2 * S.slam.n;
function slamPredict(v, w) {
  const M = S.slam,
    n = slamDim(),
    th = M.x[2],
    nx = integ(M.x[0], M.x[1], th, v, w, DT);
  const k = assumedK(),
    sv = sigV(v, w, k),
    sw = sigW(v, w, k),
    c = Math.cos(th),
    s = Math.sin(th),
    a = DT * DT * sv * sv,
    b = DT * DT * sw * sw;
  const Gx = [1, 0, -v * DT * s, 0, 1, v * DT * c, 0, 0, 1],
    Q = [a * c * c, a * c * s, 0, a * c * s, a * s * s, 0, 0, 0, b];
  // P ← G P Gᵀ + Q on the pose block; cross terms: G P_xm ; map block unchanged
  const P = M.P,
    Pn = P.slice();
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < n; j++) {
      let sum = 0;
      for (let k2 = 0; k2 < 3; k2++) sum += Gx[i * 3 + k2] * P[k2 * n + j];
      Pn[i * n + j] = sum;
    }
  for (let i = 0; i < n; i++)
    for (let j = 0; j < 3; j++) {
      let sum = 0;
      for (let k2 = 0; k2 < 3; k2++) sum += Pn[i * n + k2] * Gx[j * 3 + k2];
      P[i * n + j] = sum;
    }
  for (let i = 0; i < n; i++) for (let j = 3; j < n; j++) P[i * n + j] = Pn[i * n + j];
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) P[i * n + j] += Q[i * 3 + j];
  M.x[0] = nx.x;
  M.x[1] = nx.y;
  M.x[2] = nx.th;
  slamExport();
}
function slamExport() {
  const M = S.slam,
    n = slamDim();
  S.est = {x: M.x[0], y: M.x[1], th: M.x[2]};
  S.Pc = [M.P[0], M.P[1], M.P[2], M.P[n], M.P[n + 1], M.P[n + 2], M.P[2 * n], M.P[2 * n + 1], M.P[2 * n + 2]];
}
function slamAdd(id, r, b) {
  const M = S.slam,
    n0 = slamDim(),
    n = n0 + 2,
    th = M.x[2],
    a = th + b;
  const mx = M.x[0] + r * Math.cos(a),
    my = M.x[1] + r * Math.sin(a);
  // Jacobians of the inverse observation
  const Jx = [1, 0, -r * Math.sin(a), 0, 1, r * Math.cos(a)],
    Jz = [Math.cos(a), -r * Math.sin(a), Math.sin(a), r * Math.cos(a)];
  const sr = sigR(),
    sb = sigB(),
    R = [sr * sr, 0, 0, sb * sb];
  const Pn = new Array(n * n).fill(0);
  for (let i = 0; i < n0; i++) for (let j = 0; j < n0; j++) Pn[i * n + j] = M.P[i * n0 + j];
  // P_mx = Jx P_xx ; P_mm = Jx P_xx Jxᵀ + Jz R Jzᵀ ; P_m,others = Jx P_x,others
  for (let i = 0; i < 2; i++)
    for (let j = 0; j < n0; j++) {
      let s = 0;
      for (let k = 0; k < 3; k++) s += Jx[i * 3 + k] * M.P[k * n0 + j];
      Pn[(n0 + i) * n + j] = s;
      Pn[j * n + n0 + i] = s;
    }
  for (let i = 0; i < 2; i++)
    for (let j = 0; j < 2; j++) {
      let s = 0;
      for (let k = 0; k < 3; k++) s += Pn[(n0 + i) * n + k] * Jx[j * 3 + k];
      for (let k = 0; k < 2; k++) s += Jz[i * 2 + k] * R[k * 2 + k] * Jz[j * 2 + k];
      Pn[(n0 + i) * n + n0 + j] = s;
    }
  M.P = Pn;
  M.x.push(mx, my);
  M.ids.push(id);
  M.n++;
}
// EKF-SLAM measurement update: known or unlabeled IDs, Mahalanobis gating, new landmarks appended to the state and covariance.
function slamUpdate(z) {
  const M = S.slam,
    sr = sigR(),
    sb = sigB();
  for (const m of z) {
    const n = slamDim(),
      x = M.x,
      Pm = M.P;
    // candidates: the beacon with this id, or every mapped beacon when unlabeled
    let cands = [];
    if (P.assoc === 'known' && !m.fake) {
      const j = M.ids.indexOf(m.id);
      cands = j >= 0 ? [j] : [];
    } else if (P.assoc === 'unknown') cands = M.ids.map((_, j) => j);
    let best = null;
    for (const j of cands) {
      const k = 3 + 2 * j,
        dx = x[k] - x[0],
        dy = x[k + 1] - x[1],
        q = dx * dx + dy * dy,
        r = Math.sqrt(q);
      if (r < 1e-6) continue;
      const H = new Float64Array(2 * n); // rows: range, bearing; columns: pose (3) and this landmark (2)
      H[0] = -dx / r;
      H[1] = -dy / r;
      H[2] = 0;
      H[k] = dx / r;
      H[k + 1] = dy / r;
      H[n + 0] = dy / q;
      H[n + 1] = -dx / q;
      H[n + 2] = -1;
      H[n + k] = -dy / q;
      H[n + k + 1] = dx / q;
      // S = H P Hᵀ + R using the sparse columns
      const cols = [0, 1, 2, k, k + 1],
        PH = new Float64Array(n * 2);
      for (let i = 0; i < n; i++)
        for (let c = 0; c < 2; c++) {
          let s = 0;
          for (const cc of cols) s += Pm[i * n + cc] * H[c * n + cc];
          PH[i * 2 + c] = s;
        }
      const S00 = (() => {
          let s = 0;
          for (const cc of cols) s += H[cc] * PH[cc * 2];
          return s + sr * sr;
        })(),
        S01 = (() => {
          let s = 0;
          for (const cc of cols) s += H[cc] * PH[cc * 2 + 1];
          return s;
        })(),
        S11 = (() => {
          let s = 0;
          for (const cc of cols) s += H[n + cc] * PH[cc * 2 + 1];
          return s + sb * sb;
        })();
      const det = S00 * S11 - S01 * S01;
      if (Math.abs(det) < 1e-14) continue;
      const Si = [S11 / det, -S01 / det, -S01 / det, S00 / det];
      const nu = [m.r - r, wrap(m.b - (Math.atan2(dy, dx) - x[2]))];
      const d2 = nu[0] * (Si[0] * nu[0] + Si[1] * nu[1]) + nu[1] * (Si[2] * nu[0] + Si[3] * nu[1]);
      if (!best || d2 < best.d2) best = {d2, j, PH, Si, nu, H};
    }
    const gate = P.assoc === 'unknown' ? 9.21 : 1e9;
    if (!best || best.d2 > gate) {
      if (m.fake) {
        S.rejected++;
        continue;
      }
      // unknown beacon: add it to the map (unlabeled: only when it is far from every mapped one)
      if (P.assoc === 'known') slamAdd(m.id, m.r, m.b);
      else if (!best || best.d2 > 40) {
        slamAdd(-1 - M.n, m.r, m.b);
      } else S.rejected++;
      continue;
    }
    const {PH, Si, nu} = best;
    const K = new Float64Array(n * 2);
    for (let i = 0; i < n; i++) {
      K[i * 2] = PH[i * 2] * Si[0] + PH[i * 2 + 1] * Si[2];
      K[i * 2 + 1] = PH[i * 2] * Si[1] + PH[i * 2 + 1] * Si[3];
    }
    for (let i = 0; i < n; i++) x[i] += K[i * 2] * nu[0] + K[i * 2 + 1] * nu[1];
    x[2] = wrap(x[2]);
    // P ← P − K S Kᵀ  (Joseph form is costlier; symmetrize instead)
    const KS = new Float64Array(n * 2);
    for (let i = 0; i < n; i++) {
      KS[i * 2] = K[i * 2] * S00of(best) + K[i * 2 + 1] * S01of(best);
      KS[i * 2 + 1] = K[i * 2] * S01of(best) + K[i * 2 + 1] * S11of(best);
    }
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) Pm[i * n + j] -= KS[i * 2] * K[j * 2] + KS[i * 2 + 1] * K[j * 2 + 1];
    for (let i = 0; i < n; i++)
      for (let j = i + 1; j < n; j++) {
        const s = 0.5 * (Pm[i * n + j] + Pm[j * n + i]);
        Pm[i * n + j] = s;
        Pm[j * n + i] = s;
      }
  }
  slamExport();
}
// S (innovation covariance) recovered from its inverse
function S00of(b) {
  const d = b.Si[0] * b.Si[3] - b.Si[1] * b.Si[2];
  return b.Si[3] / d;
}
function S01of(b) {
  const d = b.Si[0] * b.Si[3] - b.Si[1] * b.Si[2];
  return -b.Si[1] / d;
}
function S11of(b) {
  const d = b.Si[0] * b.Si[3] - b.Si[1] * b.Si[2];
  return b.Si[0] / d;
}
function slamLandmarks() {
  const M = S.slam;
  if (!M) return [];
  const n = slamDim(),
    out = [];
  for (let j = 0; j < M.n; j++) {
    const k = 3 + 2 * j;
    out.push({
      id: M.ids[j],
      x: M.x[k],
      y: M.x[k + 1],
      P: [M.P[k * n + k], M.P[k * n + k + 1], 0, M.P[(k + 1) * n + k], M.P[(k + 1) * n + k + 1], 0, 0, 0, 0]
    });
  }
  return out;
}
