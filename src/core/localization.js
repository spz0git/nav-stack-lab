/* ============================================================
   Localization: truth / dead reckoning / EKF / particle filter
   ============================================================ */
function initLoc(fromStart) {
  const base = fromStart ? {x: S.robot.x, y: S.robot.y, th: S.robot.th} : {...S.est};
  S.est = {...base};
  S.nees = [];
  if (P.loc === 'dr' || P.loc === 'ekf') S.Pc = [0.01, 0, 0, 0, 0.01, 0, 0, 0, 0.0025];
  else S.Pc = null;
  if (P.loc === 'slam') slamInit();
  else S.slam = null;
  if (P.loc === 'pgslam') pgInit();
  else S.pg = null;
  if (P.loc === 'pf') {
    const N = P.npart,
      g = S.rngA;
    S.pf = {
      N,
      x: new Float64Array(N),
      y: new Float64Array(N),
      th: new Float64Array(N),
      lw: new Float64Array(N),
      wslow: 0,
      wfast: 0,
      neff: N,
      inj: 0,
      mB: 1,
      mL: 1
    };
    for (let i = 0; i < N; i++) {
      S.pf.x[i] = base.x + 0.1 * g.n();
      S.pf.y[i] = base.y + 0.1 * g.n();
      S.pf.th[i] = wrap(base.th + 0.05 * g.n());
    }
    pfEstimate();
  } else S.pf = null;
}
function m3mul(A, B) {
  const C = new Array(9);
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++) {
      C[i * 3 + j] = A[i * 3] * B[j] + A[i * 3 + 1] * B[3 + j] + A[i * 3 + 2] * B[6 + j];
    }
  return C;
}
const m3T = A => [A[0], A[3], A[6], A[1], A[4], A[7], A[2], A[5], A[8]];
function m3inv(A) {
  const [a, b, c, d, e, f, g, h, i] = A;
  const C0 = e * i - f * h,
    C1 = -(d * i - f * g),
    C2 = d * h - e * g;
  const det = a * C0 + b * C1 + c * C2;
  if (Math.abs(det) < 1e-18) return null;
  return [
    C0 / det,
    -(b * i - c * h) / det,
    (b * f - c * e) / det,
    C1 / det,
    (a * i - c * g) / det,
    -(a * f - c * d) / det,
    C2 / det,
    -(a * h - b * g) / det,
    (a * e - b * d) / det
  ];
}
// @code ekf-predict | locPredict: the prediction step of dead reckoning, the EKF and the particle filter
function locPredict() {
  const {v, w} = S.odo;
  if (P.loc === 'truth') return;
  if (P.loc === 'slam') {
    slamPredict(v, w);
    return;
  }
  if (P.loc === 'pgslam') {
    pgPredict(v, w);
    return;
  }
  if (P.loc === 'dr' || P.loc === 'ekf') {
    const e = S.est,
      th = e.th;
    const n = integ(e.x, e.y, th, v, w, DT);
    const G = [1, 0, -v * DT * Math.sin(th), 0, 1, v * DT * Math.cos(th), 0, 0, 1];
    const k = assumedK(),
      sv = sigV(v, w, k),
      sw = filtSigW(v, w);
    const c = Math.cos(th),
      s = Math.sin(th),
      a = DT * DT * sv * sv,
      b = DT * DT * sw * sw;
    const VMV = [a * c * c, a * c * s, 0, a * c * s, a * s * s, 0, 0, 0, b];
    const Pn = m3mul(m3mul(G, S.Pc), m3T(G));
    for (let i = 0; i < 9; i++) Pn[i] += VMV[i];
    S.Pc = Pn;
    S.est = n;
    return;
  }
  if (P.loc === 'pf') {
    const f = S.pf,
      g = S.rngA,
      k = assumedK();
    const sv = Math.max(sigV(v, w, k), 0.02),
      sw = Math.max(filtSigW(v, w), 0.02);
    for (let i = 0; i < f.N; i++) {
      const n = integ(f.x[i], f.y[i], f.th[i], v + sv * g.n(), w + sw * g.n(), DT);
      f.x[i] = n.x;
      f.y[i] = n.y;
      f.th[i] = n.th;
    }
    const mv = Math.abs(v) * DT + 0.5 * Math.abs(w) * DT;
    f.mB += mv;
    f.mL += mv;
    f.mS = (f.mS || 0) + mv; // since the last sonar weighting (pfSonarUpdate)
    pfEstimate();
  }
}
// @end
// @code ekf-update | ekfUpdate: the Kalman update per beacon reading, with the gate
function ekfUpdate(z) {
  const sr = sigR(),
    sb = sigB();
  for (const m of z) {
    const e = S.est,
      Pc = S.Pc;
    const cand = P.assoc === 'known' && !m.fake ? [S.beacons[m.id]] : P.assoc === 'known' ? [] : S.beacons;
    let best = null;
    for (const lm of cand) {
      const dx = lm.x - e.x,
        dy = lm.y - e.y,
        q = dx * dx + dy * dy,
        r = Math.sqrt(q);
      if (r < 1e-6) continue;
      const H = [-dx / r, -dy / r, 0, dy / q, -dx / q, -1];
      const PH = [
        Pc[0] * H[0] + Pc[1] * H[1] + Pc[2] * H[2],
        Pc[0] * H[3] + Pc[1] * H[4] + Pc[2] * H[5],
        Pc[3] * H[0] + Pc[4] * H[1] + Pc[5] * H[2],
        Pc[3] * H[3] + Pc[4] * H[4] + Pc[5] * H[5],
        Pc[6] * H[0] + Pc[7] * H[1] + Pc[8] * H[2],
        Pc[6] * H[3] + Pc[7] * H[4] + Pc[8] * H[5]
      ]; // 3x2
      const S00 = H[0] * PH[0] + H[1] * PH[2] + H[2] * PH[4] + sr * sr,
        S01 = H[0] * PH[1] + H[1] * PH[3] + H[2] * PH[5],
        S10 = H[3] * PH[0] + H[4] * PH[2] + H[5] * PH[4],
        S11 = H[3] * PH[1] + H[4] * PH[3] + H[5] * PH[5] + sb * sb;
      const det = S00 * S11 - S01 * S10;
      if (Math.abs(det) < 1e-12) continue;
      const Si = [S11 / det, -S01 / det, -S10 / det, S00 / det];
      const nu = [m.r - r, wrap(m.b - (Math.atan2(dy, dx) - e.th))];
      const d2 = nu[0] * (Si[0] * nu[0] + Si[1] * nu[1]) + nu[1] * (Si[2] * nu[0] + Si[3] * nu[1]);
      if (!best || d2 < best.d2) best = {d2, H, PH, Si, nu};
    }
    const gate = P.assoc === 'unknown' ? 9.21 : 1e9;
    if (!best || best.d2 > gate) {
      if (m.fake || P.assoc === 'unknown') S.rejected++;
      continue;
    }
    const {H, PH, Si, nu} = best;
    const K = [
      PH[0] * Si[0] + PH[1] * Si[2],
      PH[0] * Si[1] + PH[1] * Si[3],
      PH[2] * Si[0] + PH[3] * Si[2],
      PH[2] * Si[1] + PH[3] * Si[3],
      PH[4] * Si[0] + PH[5] * Si[2],
      PH[4] * Si[1] + PH[5] * Si[3]
    ];
    S.est = {x: e.x + K[0] * nu[0] + K[1] * nu[1], y: e.y + K[2] * nu[0] + K[3] * nu[1], th: wrap(e.th + K[4] * nu[0] + K[5] * nu[1])};
    // Joseph form: P = (I-KH)P(I-KH)^T + K R K^T
    const IKH = [
      1 - (K[0] * H[0] + K[1] * H[3]),
      -(K[0] * H[1] + K[1] * H[4]),
      -(K[0] * H[2] + K[1] * H[5]),
      -(K[2] * H[0] + K[3] * H[3]),
      1 - (K[2] * H[1] + K[3] * H[4]),
      -(K[2] * H[2] + K[3] * H[5]),
      -(K[4] * H[0] + K[5] * H[3]),
      -(K[4] * H[1] + K[5] * H[4]),
      1 - (K[4] * H[2] + K[5] * H[5])
    ];
    const Pn = m3mul(m3mul(IKH, Pc), m3T(IKH));
    const r2 = sr * sr,
      b2 = sb * sb;
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) Pn[i * 3 + j] += K[i * 2] * K[j * 2] * r2 + K[i * 2 + 1] * K[j * 2 + 1] * b2;
    S.Pc = Pn;
  }
}
// @end
// @code pf-update | pfUpdate: weighting the particles by the beacon readings, with the augmented-MCL averages
function pfUpdate(z) {
  const f = S.pf,
    N = f.N;
  if (!z.length || f.mB < 0.05) return;
  f.mB = 0;
  const sr = sigR(),
    sb = sigB(),
    FLOOR = 1e-3;
  let avg = 0;
  for (let i = 0; i < N; i++) {
    let ll = 0;
    for (const m of z) {
      let best = 0;
      const cands = P.assoc === 'known' ? (m.fake ? [] : [S.beacons[m.id]]) : S.beacons;
      for (const lm of cands) {
        const dx = lm.x - f.x[i],
          dy = lm.y - f.y[i];
        const er = (m.r - hyp(dx, dy)) / sr,
          eb = wrap(m.b - (Math.atan2(dy, dx) - f.th[i])) / sb;
        const L = Math.exp(-0.5 * (er * er + eb * eb));
        if (L > best) best = L;
      }
      ll += Math.log(best + FLOOR);
    }
    f.lw[i] += ll;
    avg += Math.exp(ll / z.length);
  }
  avg /= N;
  // augmented MCL: short/long-term likelihood averages
  if (f.wslow === 0) {
    f.wslow = avg;
    f.wfast = avg;
  }
  f.wslow += 0.001 * (avg - f.wslow);
  f.wfast += 0.1 * (avg - f.wfast);
  const pinj = P.inject ? Math.min(0.25, Math.max(0, 1 - f.wfast / f.wslow)) : 0;
  f.inj = pinj;
  pfResample(pinj, z);
}
// @end
// Lidar likelihood-field model against the prior map (as in AMCL). 24 of 120 beams, tempered.
function pfLidarUpdate(ranges) {
  const f = S.pf,
    N = f.N,
    D = LV.truthDist,
    SIG = 0.2,
    TEMPER = 0.4;
  if (f.mL < 0.05) return;
  f.mL = 0;
  for (let i = 0; i < N; i++) {
    let ll = 0;
    const x = f.x[i],
      y = f.y[i],
      th = f.th[i];
    for (let k = 0; k < NBEAM; k += 5) {
      const r = ranges[k];
      if (r >= LMAX - 1e-3) continue;
      const a = th - Math.PI + (k * TAU) / NBEAM;
      const idx = cellIdx(x + r * Math.cos(a), y + r * Math.sin(a));
      const d = idx < 0 ? 2 : Math.max(0, D[idx] - 0.05);
      ll += Math.log(0.9 * Math.exp(-0.5 * (d / SIG) ** 2) + 0.05);
    }
    f.lw[i] += TEMPER * ll;
  }
  pfResample(0, null);
}
// @code pf-sonar | pfSonarUpdate: weighting the particles by the sonars against the prior map (the cone likelihood)
// For each reading, the range the particle expects is the nearest obstacle of the prior map inside that sonar's cone,
// beyond the dead zone and within reach, from SON_LRAYS rays marched on the map's distance field. A returned reading is
// scored by a Gaussian on its difference from the expectation, with a floor for what the map cannot explain (people,
// crosstalk); a reading at maximum range by how often a cone reads nothing: nearly always when the map has nothing in
// reach, SON_PDROP of the time when it has (a specular miss). Chapter 3 §11 derives it. Standing still, nothing is
// weighted: the same readings again are not new evidence.
const SON_LRAYS = 7,
  SON_PDROP = 0.3;
function sonExpect(D, ox, oy, th, z) {
  let best = P.sonMax;
  for (let k = 0; k < SON_LRAYS; k++) {
    const a = th + z.a - z.w / 2 + (k * z.w) / (SON_LRAYS - 1),
      c = Math.cos(a),
      s = Math.sin(a);
    for (let t = P.sonMin; t < best;) {
      const idx = cellIdx(ox + t * c, oy + t * s);
      if (idx < 0) {
        best = t; // the edge of the world is a wall
        break;
      }
      const d = D[idx];
      if (d < RES / 2) {
        best = t;
        break;
      }
      t += Math.max(d - RES / 2, RES / 2);
    }
  }
  return best;
}
function pfSonarUpdate(list) {
  const f = S.pf,
    N = f.N,
    D = LV.truthDist,
    SIG = 0.15,
    TEMPER = 0.5;
  if (!list.length || (f.mS || 0) < 0.02) return;
  f.mS = 0;
  for (let i = 0; i < N; i++) {
    const x = f.x[i],
      y = f.y[i],
      th = f.th[i],
      c = Math.cos(th),
      s = Math.sin(th);
    let ll = 0;
    for (const z of list) {
      const ex = sonExpect(D, x + z.mx * c - z.my * s, y + z.mx * s + z.my * c, th, z);
      const p = z.max ? (ex >= P.sonMax - 1e-6 ? 0.9 : SON_PDROP) : 0.85 * Math.exp(-0.5 * ((z.r - ex) / SIG) ** 2) + 0.05;
      ll += Math.log(p);
    }
    f.lw[i] += TEMPER * ll;
  }
  pfResample(0, null);
}
// @end
// @code pf-resample | pfResample: N_eff, low-variance resampling and the injected samples
function pfResample(pinj, z) {
  const f = S.pf,
    N = f.N;
  let mx = -Infinity;
  for (let i = 0; i < N; i++) if (f.lw[i] > mx) mx = f.lw[i];
  let sum = 0;
  const w = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    w[i] = Math.exp(f.lw[i] - mx);
    sum += w[i];
  }
  let s2 = 0;
  for (let i = 0; i < N; i++) {
    w[i] /= sum;
    s2 += w[i] * w[i];
  }
  f.neff = 1 / s2;
  if (f.neff < N / 2 || pinj > 0.01) {
    const g = S.rngA,
      nx = new Float64Array(N),
      ny = new Float64Array(N),
      nt = new Float64Array(N);
    const step = 1 / N;
    let u = g.u() * step,
      c = w[0],
      i = 0;
    for (let m = 0; m < N; m++) {
      const U = u + m * step;
      while (U > c && i < N - 1) {
        i++;
        c += w[i];
      }
      if (pinj > 0 && g.u() < pinj) {
        const q = srlSample(z, g);
        nx[m] = q.x;
        ny[m] = q.y;
        nt[m] = q.th;
      } else {
        nx[m] = f.x[i];
        ny[m] = f.y[i];
        nt[m] = f.th[i];
      }
    }
    f.x = nx;
    f.y = ny;
    f.th = nt;
    f.lw = new Float64Array(N);
  }
  pfEstimate();
}
// @end
// Sensor-resetting sample: a pose consistent with one current beacon reading (Lenser & Veloso)
function srlSample(z, g) {
  const real = z.filter(m => P.assoc === 'unknown' || !m.fake);
  for (let t = 0; t < 30 && real.length; t++) {
    const m = real[Math.floor(g.u() * real.length)];
    const lm = P.assoc === 'known' ? S.beacons[m.id] : S.beacons[Math.floor(g.u() * S.beacons.length)];
    const r = m.r + sigR() * g.n(),
      phi = g.u() * TAU,
      x = lm.x - r * Math.cos(phi),
      y = lm.y - r * Math.sin(phi);
    const k = cellIdx(x, y);
    if (k < 0 || LV.truthDist[k] < RR) continue;
    return {x, y, th: wrap(phi - (m.b + sigB() * g.n()))};
  }
  return randomFree(g);
}
function randomFree(g) {
  for (let t = 0; t < 200; t++) {
    const x = 0.3 + g.u() * (W - 0.6),
      y = 0.3 + g.u() * (H - 0.6);
    const k = cellIdx(x, y);
    if (k >= 0 && LV.truthDist[k] > RR + 0.05) return {x, y, th: (g.u() * 2 - 1) * Math.PI};
  }
  return {x: W / 2, y: H / 2, th: 0};
}
function pfEstimate() {
  const f = S.pf,
    N = f.N;
  let mx = -Infinity;
  for (let i = 0; i < N; i++) if (f.lw[i] > mx) mx = f.lw[i];
  let sw = 0,
    sx = 0,
    sy = 0,
    sc = 0,
    ss = 0;
  const w = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    w[i] = Math.exp(f.lw[i] - mx);
    sw += w[i];
  }
  for (let i = 0; i < N; i++) {
    const wi = w[i] / sw;
    w[i] = wi;
    sx += wi * f.x[i];
    sy += wi * f.y[i];
    sc += wi * Math.cos(f.th[i]);
    ss += wi * Math.sin(f.th[i]);
  }
  const th = Math.atan2(ss, sc);
  const C = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  for (let i = 0; i < N; i++) {
    const d = [f.x[i] - sx, f.y[i] - sy, wrap(f.th[i] - th)];
    for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) C[a * 3 + b] += w[i] * d[a] * d[b];
  }
  for (let a = 0; a < 3; a++) C[a * 4] += 1e-6;
  S.est = {x: sx, y: sy, th};
  S.Pc = C;
}
function scatterParticles() {
  if (P.loc !== 'pf') {
    logE('Scatter needs the particle filter', 'warn');
    return;
  }
  const f = S.pf,
    g = S.rngA;
  for (let i = 0; i < f.N; i++) {
    const q = randomFree(g);
    f.x[i] = q.x;
    f.y[i] = q.y;
    f.th[i] = q.th;
    f.lw[i] = 0;
  }
  f.mB = f.mL = 1;
  pfEstimate();
  logE(`Scattered ${f.N} particles uniformly (global localization)`, 'warn');
  UI.draw();
}
// Scan matching against the prior map (Hector-style): the scan's hits are aligned to the map's distance field by
// Gauss–Newton on ξ = (x, y, θ), starting from the estimate. A hit p_i placed at T_ξ p_i in the world costs d(T_ξ p_i)²,
// d the bilinearly interpolated distance to the nearest wall; its Jacobian is ∇d times the derivative of the transform.
// Hits farther than 0.5 m from any wall (people, outliers) are left out. Returns the pose, a covariance s² H⁻¹ (s² the
// residual variance, inflated for the beams' correlation), the residual RMS, the count and the iterations, or null.
// D is the prior map's distance field unless pose-graph SLAM passes the one of the map it has built.
// @code scan-match | scanMatch: Gauss–Newton alignment of a scan to the map's distance field
function scanMatch(ranges, pose, D = LV.truthDist) {
  // D: a distance field; the prior map's, or the built map's for pose-graph SLAM
  const HIT = 0.5,
    pts = [];
  for (let k = 0; k < NBEAM; k += 2) {
    const r = ranges[k];
    if (r >= LMAX - 1e-3) continue;
    const a = -Math.PI + (k * TAU) / NBEAM;
    pts.push([r * Math.cos(a), r * Math.sin(a)]);
  }
  if (pts.length < 12) return null;
  // d and ∇d at a world point, bilinear between the cell centres (null off the map)
  const field = (x, y) => {
    const fx = x / RES - 0.5,
      fy = y / RES - 0.5,
      i = Math.floor(fx),
      j = Math.floor(fy);
    if (i < 0 || j < 0 || i >= GW - 1 || j >= GH - 1) return null;
    const tx = fx - i,
      ty = fy - j,
      k = j * GW + i,
      d00 = D[k],
      d10 = D[k + 1],
      d01 = D[k + GW],
      d11 = D[k + GW + 1];
    return {
      d: (1 - ty) * ((1 - tx) * d00 + tx * d10) + ty * ((1 - tx) * d01 + tx * d11),
      gx: ((1 - ty) * (d10 - d00) + ty * (d11 - d01)) / RES,
      gy: ((1 - tx) * (d01 - d00) + tx * (d11 - d10)) / RES
    };
  };
  let x = pose.x,
    y = pose.y,
    th = pose.th,
    H = null,
    n = 0,
    ss = 0,
    it = 0;
  for (; it < 10; it++) {
    const c = Math.cos(th),
      s = Math.sin(th),
      b = [0, 0, 0];
    H = [0, 0, 0, 0, 0, 0, 0, 0, 0];
    n = 0;
    ss = 0;
    for (const [px, py] of pts) {
      const f = field(x + c * px - s * py, y + s * px + c * py);
      if (!f || f.d > HIT) continue;
      const J = [f.gx, f.gy, f.gx * (-s * px - c * py) + f.gy * (c * px - s * py)]; // ∂d/∂x, ∂d/∂y, ∂d/∂θ
      for (let a = 0; a < 3; a++) {
        b[a] += J[a] * f.d;
        for (let q = 0; q < 3; q++) H[a * 3 + q] += J[a] * J[q];
      }
      n++;
      ss += f.d * f.d;
    }
    if (n < 12) return null;
    for (let a = 0; a < 3; a++) H[a * 4] += 1e-6;
    const Hi = m3inv(H);
    if (!Hi) return null;
    const dx = -(Hi[0] * b[0] + Hi[1] * b[1] + Hi[2] * b[2]), // the Gauss–Newton step H δ = −b
      dy = -(Hi[3] * b[0] + Hi[4] * b[1] + Hi[5] * b[2]),
      dth = -(Hi[6] * b[0] + Hi[7] * b[1] + Hi[8] * b[2]);
    x += dx;
    y += dy;
    th = wrap(th + dth);
    if (Math.abs(dx) < 1e-3 && Math.abs(dy) < 1e-3 && Math.abs(dth) < 1e-3) break;
  }
  const s2 = Math.max(ss / Math.max(1, n - 3), 1e-4), // residual variance, floored at (1 cm)²
    Hi = m3inv(H);
  if (!Hi) return null;
  const cov = Hi.map(v => v * s2 * SM_INFL);
  cov[0] += SM_FLOOR * SM_FLOOR; // the map's cells are 10 cm: no fit is better than a few centimetres
  cov[4] += SM_FLOOR * SM_FLOOR;
  cov[8] += 0.0003; // (1°)²
  return {x, y, th, cov, rms: Math.sqrt(ss / n), n, hits: pts.length, it};
}
// @end
const SM_INFL = 4, // the hits are not independent (neighbouring beams see the same wall): the fit's covariance, inflated
  SM_RMS_MAX = 0.12, // a fit worse than this is not a fit: not fused
  SM_FLOOR = 0.05; // and floored at half the map's resolution (NEES ≈ 3 on L3 with this; 0.03 gives 9)
// The matched pose as a direct measurement of the EKF state (H = I), gated at χ²(3) 99 %: a match that converged to the
// wrong minimum, as after a kidnap, is rejected rather than fused. The match starts from the estimate, so the fix is not
// independent of it (the double counting every scan matcher lives with); the inflated covariance stands in for that.
// @code ekf-scan | ekfScanUpdate: the scan match fused as a pose fix
function ekfScanUpdate(ranges) {
  const e = S.est,
    m = scanMatch(ranges, e);
  S.sm = m
    ? {
        rms: m.rms,
        n: m.n,
        hits: m.hits,
        it: m.it,
        cov: m.cov,
        ok: false,
        dx: hyp(m.x - e.x, m.y - e.y),
        d2: null,
        still: false,
        poor: false
      }
    : null;
  if (!m) return;
  // a poor fit (large residual, or most hits far from any wall) is a match onto the wrong walls, as after a kidnap
  if (m.rms > SM_RMS_MAX || m.n < 0.6 * m.hits) {
    S.sm.poor = true;
    S.rejected++;
    return;
  }
  // the same scan from the same place is not new evidence: fuse only once the robot has moved since the last fused match
  const L = S.smLast;
  if (L && hyp(e.x - L.x, e.y - L.y) < 0.05 && Math.abs(wrap(e.th - L.th)) < 0.1) {
    S.sm.still = true;
    return;
  }
  const nu = [m.x - e.x, m.y - e.y, wrap(m.th - e.th)],
    Si = m3inv(S.Pc.map((v, i) => v + m.cov[i]));
  if (!Si) return;
  let d2 = 0;
  for (let a = 0; a < 3; a++) for (let q = 0; q < 3; q++) d2 += nu[a] * Si[a * 3 + q] * nu[q];
  S.sm.d2 = d2;
  if (d2 > 11.34) {
    S.rejected++;
    return;
  }
  const K = m3mul(S.Pc, Si); // P (P + R)⁻¹
  S.est = {
    x: e.x + K[0] * nu[0] + K[1] * nu[1] + K[2] * nu[2],
    y: e.y + K[3] * nu[0] + K[4] * nu[1] + K[5] * nu[2],
    th: wrap(e.th + K[6] * nu[0] + K[7] * nu[1] + K[8] * nu[2])
  };
  const IK = [1 - K[0], -K[1], -K[2], -K[3], 1 - K[4], -K[5], -K[6], -K[7], 1 - K[8]]; // Joseph form
  const Pn = m3mul(m3mul(IK, S.Pc), m3T(IK)),
    KRK = m3mul(m3mul(K, m.cov), m3T(K));
  S.Pc = Pn.map((v, i) => v + KRK[i]);
  S.sm.ok = true;
  S.smLast = {...S.est};
}
// @end
