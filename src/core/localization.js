/* ============================================================
   Localization: truth / dead reckoning / EKF / particle filter
   ============================================================ */
function initLoc(fromStart) {
  const base = fromStart ? {x: S.robot.x, y: S.robot.y, th: S.robot.th} : {...S.est};
  S.est = {...base};
  S.nees = [];
  S.gb = null; // the GNSS bias states (gnssAug), created at the first prediction
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
      mL: 1,
      mG: 1
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
    if (P.loc === 'ekf' && P.gnss && P.gnssAug)
      gbPredict(G); // the GNSS bias states, when the EKF carries them
    else S.gb = null;
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
    f.mG += mv;
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
    if (S.gb) gbPoseUpdate([H.slice(0, 3), H.slice(3)], [Si.slice(0, 2), Si.slice(2)], nu, [K.slice(0, 2), K.slice(2, 4), K.slice(4)]); // GNSS bias states, if carried
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
  if (S.gb)
    gbPoseUpdate(
      [
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1]
      ],
      [Si.slice(0, 3), Si.slice(3, 6), Si.slice(6)],
      nu,
      [K.slice(0, 3), K.slice(3, 6), K.slice(6)]
    );
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

/* ---------- GNSS in the EKF and the particle filter ----------
   A fix z = (x, y) measures the position: h(x) = (x, y), H = [I₂ 0], R = σ_rep² I₂ with the receiver's reported σ.
   Gated at χ²(2) 99 % like a beacon reading. The plain filter takes the fixes as independent; they are not (the bias
   wanders over a minute), so it grows ever more confident about a position that is a metre off. With P.gnssAug the
   EKF carries the bias b = (b_x, b_y) as two more states, a random walk with q = 2σ_b²/τ (the Gauss–Markov process's
   variance growth over short times), and the fix becomes z = p + b: H = [I₂ 0 I₂], with R the white part alone,
   σ_rep² − σ_b² (the reported variance less the bias's, which the state now carries).
   The bias states are kept beside the 3×3 pose covariance S.Pc (which the rest of the page reads): S.gb = {b, C, B},
   C = cov(pose, b) (3×2), B = cov(b) (2×2). Every pose-only update (beacons, scan matching) moves them too, through
   the cross-covariance (gbPoseUpdate): a beacon fix calibrates the GNSS bias. */
const mz = (r, c) => Array.from({length: r}, () => new Array(c).fill(0));
function mmul(A, B) {
  const n = A.length,
    m = B[0].length,
    k = B.length,
    C = mz(n, m);
  for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) for (let a = 0; a < k; a++) C[i][j] += A[i][a] * B[a][j];
  return C;
}
const mtr = A => A[0].map((_, j) => A.map(r => r[j]));
const inv2 = S2 => {
  const det = S2[0][0] * S2[1][1] - S2[0][1] * S2[1][0];
  return Math.abs(det) < 1e-12
    ? null
    : [
        [S2[1][1] / det, -S2[0][1] / det],
        [-S2[1][0] / det, S2[0][0] / det]
      ];
};
function gbInit() {
  const v = P.gnssBias * P.gnssBias;
  S.gb = {
    b: [0, 0],
    C: mz(3, 2),
    B: [
      [v, 0],
      [0, v]
    ]
  };
}
// prediction: the pose moves with G, the bias walks: C ← G C, B ← B + q Δt I
function gbPredict(G) {
  if (!S.gb) gbInit();
  const Gm = [G.slice(0, 3), G.slice(3, 6), G.slice(6)],
    q = ((2 * P.gnssBias * P.gnssBias) / Math.max(1, P.gnssTau)) * DT;
  S.gb.C = mmul(Gm, S.gb.C);
  S.gb.B[0][0] += q;
  S.gb.B[1][1] += q;
}
// a measurement of the pose alone (H m×3, S⁻¹ m×m, innovation ν, the pose gain K 3×m): the bias gain is
// K_b = (H C)ᵀ S⁻¹, and C ← C − K H C, B ← B − K_b H C
function gbPoseUpdate(H, Si, nu, K) {
  const G = S.gb,
    HC = mmul(H, G.C),
    Kb = mmul(mtr(HC), Si),
    dC = mmul(K, HC),
    dB = mmul(Kb, HC);
  for (let j = 0; j < 2; j++) for (let c = 0; c < nu.length; c++) G.b[j] += Kb[j][c] * nu[c];
  G.C = G.C.map((r, i) => r.map((v, j) => v - dC[i][j]));
  G.B = G.B.map((r, i) => r.map((v, j) => v - 0.5 * (dB[i][j] + dB[j][i])));
}
// @code ekf-gnss | ekfGnssUpdate: a GNSS fix as a position measurement, with the bias in the state or not
function ekfGnssUpdate(fix) {
  const e = S.est,
    aug = !!S.gb,
    // R: the reported variance; with the bias in the state, only its white part (the bias's σ_b² is in B already)
    R = aug ? Math.max(fix.sig * fix.sig - P.gnssBias * P.gnssBias, 0.0025) : fix.sig * fix.sig,
    // the full state: the pose, and with the bias states (x, y, θ, b_x, b_y)
    Pp = [S.Pc.slice(0, 3), S.Pc.slice(3, 6), S.Pc.slice(6)],
    Pa = aug ? [...Pp.map((r, i) => [...r, ...S.gb.C[i]]), ...S.gb.B.map((r, j) => [...S.gb.C.map(c => c[j]), ...r])] : Pp,
    n = Pa.length,
    H = aug
      ? [
          [1, 0, 0, 1, 0],
          [0, 1, 0, 0, 1]
        ]
      : [
          [1, 0, 0],
          [0, 1, 0]
        ],
    hx = aug ? [e.x + S.gb.b[0], e.y + S.gb.b[1]] : [e.x, e.y], // the predicted fix: position, plus the bias if estimated
    nu = [fix.x - hx[0], fix.y - hx[1]],
    PHt = mmul(Pa, mtr(H)),
    S2 = mmul(H, PHt);
  S2[0][0] += R;
  S2[1][1] += R;
  const Si = inv2(S2);
  if (!Si) return;
  const d2 = nu[0] * (Si[0][0] * nu[0] + Si[0][1] * nu[1]) + nu[1] * (Si[1][0] * nu[0] + Si[1][1] * nu[1]);
  fix.d2 = d2;
  if (d2 > GNSS_GATE) {
    fix.st = 'gate'; // too far from where the filter expects it: multipath, or a filter that is lost
    S.gnss.gated++;
    S.rejected++;
    gnssLockout(fix);
    return;
  }
  S.gnss.rejSince = null;
  const K = mmul(PHt, Si), // n×2
    dx = K.map(r => r[0] * nu[0] + r[1] * nu[1]);
  S.est = {x: e.x + dx[0], y: e.y + dx[1], th: wrap(e.th + dx[2])};
  // Joseph form: P ← (I − K H) P (I − K H)ᵀ + K R Kᵀ
  const KH = mmul(K, H),
    IKH = KH.map((r, i) => r.map((v, j) => (i === j ? 1 : 0) - v)),
    Pn = mmul(mmul(IKH, Pa), mtr(IKH)),
    KRK = mmul(K, mtr(K));
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) Pn[i][j] += R * KRK[i][j];
  S.Pc = [0, 1, 2].flatMap(i => Pn[i].slice(0, 3));
  if (aug) {
    S.gb.b = [S.gb.b[0] + dx[3], S.gb.b[1] + dx[4]];
    S.gb.C = [0, 1, 2].map(i => Pn[i].slice(3));
    S.gb.B = [Pn[3].slice(3), Pn[4].slice(3)];
  }
  fix.st = 'ok';
  S.gnss.used++;
}
// @end
// the particle filter: each particle weighted by the fix's likelihood at its position (the same floor as the
// beacons'), gated against the cloud's mean and spread, and only once the robot has moved since the last fused fix
function pfGnssUpdate(fix) {
  const f = S.pf,
    R = fix.sig * fix.sig,
    e = S.est,
    nu = [fix.x - e.x, fix.y - e.y],
    Si = inv2([
      [S.Pc[0] + R, S.Pc[1]],
      [S.Pc[3], S.Pc[4] + R]
    ]);
  if (!Si) return;
  const d2 = nu[0] * (Si[0][0] * nu[0] + Si[0][1] * nu[1]) + nu[1] * (Si[1][0] * nu[0] + Si[1][1] * nu[1]);
  fix.d2 = d2;
  if (d2 > GNSS_GATE) {
    fix.st = 'gate';
    S.gnss.gated++;
    S.rejected++;
    gnssLockout(fix);
    return;
  }
  S.gnss.rejSince = null;
  if (f.mG < 0.05) {
    fix.st = 'still';
    return;
  }
  f.mG = 0;
  for (let i = 0; i < f.N; i++) {
    const dx = fix.x - f.x[i],
      dy = fix.y - f.y[i];
    f.lw[i] += Math.log(Math.exp((-0.5 * (dx * dx + dy * dy)) / R) + 1e-3);
  }
  pfResample(0, null);
  fix.st = 'ok';
  S.gnss.used++;
}
// The gate's trap: once the estimate is far enough off, every fix lands outside the gate, so nothing ever pulls it back.
// After GNSS_LOCKOUT seconds of nothing but rejected fixes the filter restarts from the fixes (what a GNSS/INS does after
// a run of rejections): the position moves by the mean innovation of the last few fixes and takes their variance, the
// heading comes from the fixes' track (the course over ground) when they moved far enough, the cross-terms are
// dropped and the bias states start over; the particles are scattered about the new position.
const GNSS_LOCKOUT = 10;
function gnssLockout(fix) {
  const G = S.gnss,
    e = S.est;
  if (G.rejSince == null) {
    G.rejSince = fix.t;
    G.rej = [];
  }
  G.rej.push({x: fix.x, y: fix.y, nx: fix.x - e.x, ny: fix.y - e.y, t: fix.t, d: G.dist});
  if (G.rej.length > 40) G.rej.shift();
  if (fix.t - G.rejSince < GNSS_LOCKOUT) return;
  const last = G.rej.slice(-6),
    nx = last.reduce((a, q) => a + q.nx, 0) / last.length,
    ny = last.reduce((a, q) => a + q.ny, 0) / last.length,
    cog = gnssTrack(G.rej.filter(q => q.t > fix.t - 6)),
    moving = cog != null,
    rev = (S.odo.v || 0) < 0;
  G.rejSince = null;
  G.resets = (G.resets || 0) + 1;
  const R = (fix.sig * fix.sig) / last.length,
    th = moving ? wrap(cog + (rev ? Math.PI : 0)) : e.th;
  if (P.loc === 'ekf') {
    S.est = {x: e.x + nx, y: e.y + ny, th};
    S.Pc = [R, 0, 0, 0, R, 0, 0, 0, moving ? ((20 * Math.PI) / 180) ** 2 : Math.max(S.Pc[8], ((30 * Math.PI) / 180) ** 2)];
    if (S.gb) gbInit();
  } else if (P.loc === 'pf') {
    const f = S.pf,
      g = S.rngA;
    for (let i = 0; i < f.N; i++) {
      f.x[i] += nx + Math.sqrt(R) * g.n();
      f.y[i] += ny + Math.sqrt(R) * g.n();
      if (moving) f.th[i] = wrap(th + 0.3 * g.n());
      f.lw[i] = 0;
    }
    pfEstimate();
  }
  fix.st = 'reset';
  logE(
    `GNSS: every fix rejected for ${GNSS_LOCKOUT} s, so ${segName(P.loc)} restarts from the fixes: moved ${hyp(nx, ny).toFixed(1)} m${moving ? `, heading from their track (${Math.round((Math.abs(wrap(th - e.th)) * 180) / Math.PI)}° turned)` : ''}`,
    'warn'
  );
}
// the course over ground from a run of fixes: the direction from the mean of the first half to the mean of the second,
// trusted only when the fixes lie along a line (no multipath jumps) and the halves are as far apart as the odometry
// says the robot drove; null otherwise
function gnssTrack(F) {
  if (F.length < 8) return null;
  const h = F.length >> 1,
    m = A => [A.reduce((a, q) => a + q.x, 0) / A.length, A.reduce((a, q) => a + q.y, 0) / A.length],
    a = m(F.slice(0, h)),
    b = m(F.slice(h)),
    L = hyp(b[0] - a[0], b[1] - a[1]),
    drove = (F[F.length - 1].d - F[0].d) / 2;
  if (L < 1.5 || Math.abs(L - drove) > 0.5 * drove) return null;
  const ux = (b[0] - a[0]) / L,
    uy = (b[1] - a[1]) / L,
    c = m(F),
    rms = Math.sqrt(F.reduce((s, q) => s + ((q.x - c[0]) * uy - (q.y - c[1]) * ux) ** 2, 0) / F.length);
  return rms < 0.8 ? Math.atan2(uy, ux) : null;
}
