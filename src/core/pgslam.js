/* ============================================================
   Pose-graph SLAM (lidar only): keyframes joined by odometry edges and by loop-closure edges from scan-to-scan ICP,
   optimized by Gauss–Newton with the first pose fixed. The current estimate is the last keyframe's optimized pose
   composed with the odometry since; its covariance the keyframe's marginal plus the odometry's growth. After an
   optimization the occupancy grid is rebuilt from the keyframes' scans, so the map snaps into place with the poses.
   ============================================================ */
// pose algebra: a ⊕ b composes b (in a's frame) onto a; b ⊖ a is b expressed in a's frame
const pgComp = (a, b) => {
  const c = Math.cos(a.th),
    s = Math.sin(a.th);
  return {x: a.x + c * b.x - s * b.y, y: a.y + s * b.x + c * b.y, th: wrap(a.th + b.th)};
};
const pgRel = (a, b) => {
  const c = Math.cos(a.th),
    s = Math.sin(a.th),
    dx = b.x - a.x,
    dy = b.y - a.y;
  return {x: c * dx + s * dy, y: -s * dx + c * dy, th: wrap(b.th - a.th)};
};
function pgInit() {
  const e = {x: S.est.x, y: S.est.y, th: S.est.th};
  S.pg = {
    nodes: [{x: e.x, y: e.y, th: e.th, scan: null, t: S.t}],
    edges: [], // {i, j, z: {x, y, th}, O: 3×3 information (9), loop: bool}
    rel: {x: 0, y: 0, th: 0}, // odometry since the last keyframe, in its frame
    relP: [1e-6, 0, 0, 0, 1e-6, 0, 0, 0, 1e-6], // and its covariance
    marg: [0.01, 0, 0, 0, 0.01, 0, 0, 0, 0.0025], // the last keyframe's marginal covariance
    loops: 0,
    matched: 0, // keyframes whose pose the scan-to-map match refined
    hits: new Uint16Array(NC), // the keyframes' hit map (hit cells counted, never carved), the reference the matcher uses
    frames: [], // every integrated scan, as points with the keyframe it hangs off and its pose relative to it
    last: null, // the last loop closure, for the Localize line
    opt: null, // the last optimization: {ms, it, chi2}
    rebuilt: 0
  };
}
// dead reckoning since the last keyframe: the arc on the relative pose, its covariance grown as the EKF grows its own
function pgPredict(v, w) {
  const G = S.pg,
    r = G.rel,
    n = integ(r.x, r.y, r.th, v, w, DT),
    Gj = [1, 0, -v * DT * Math.sin(r.th), 0, 1, v * DT * Math.cos(r.th), 0, 0, 1],
    k = assumedK(),
    sv = sigV(v, w, k),
    sw = filtSigW(v, w),
    c = Math.cos(r.th),
    s = Math.sin(r.th),
    a = DT * DT * sv * sv,
    b = DT * DT * sw * sw,
    VMV = [a * c * c, a * c * s, 0, a * c * s, a * s * s, 0, 0, 0, b],
    Pn = m3mul(m3mul(Gj, G.relP), m3T(Gj));
  for (let i = 0; i < 9; i++) Pn[i] += VMV[i];
  G.relP = Pn;
  G.rel = n;
  pgPublish();
}
// the covariance of K ⊕ r from K's and r's: J_K Σ_K J_Kᵀ + R Σ_r Rᵀ, J_K the composition's Jacobian in K (the
// keyframe's heading uncertainty swings the odometry leg sideways, which is what makes dead reckoning grow)
function pgCompCov(K, PK, r, Pr) {
  const c = Math.cos(K.th),
    s = Math.sin(K.th),
    JK = [1, 0, -(s * r.x + c * r.y), 0, 1, c * r.x - s * r.y, 0, 0, 1],
    R = [c, -s, 0, s, c, 0, 0, 0, 1],
    A = m3mul(m3mul(JK, PK), m3T(JK)),
    B = m3mul(m3mul(R, Pr), m3T(R));
  return A.map((v, i) => v + B[i]);
}
// the estimate the stack uses: last keyframe ⊕ odometry since, with the covariance composed the same way
function pgPublish() {
  const G = S.pg,
    K = G.nodes[G.nodes.length - 1];
  S.est = pgComp(K, G.rel);
  S.Pc = pgCompCov(K, G.marg, G.rel, G.relP);
}
// a scan as hit points in the body frame, every beam
function pgPoints(ranges) {
  const pts = [];
  for (let k = 0; k < NBEAM; k++) {
    const r = ranges[k];
    if (r >= LMAX - 1e-3) continue;
    const a = -Math.PI + (k * TAU) / NBEAM;
    pts.push([r * Math.cos(a), r * Math.sin(a)]);
  }
  return pts;
}
// @code icp | icp2d: point-to-point ICP between two scans, the closed-form 2D alignment per step
// Point-to-point ICP: src (body frame of pose A) onto dst (body frame of pose B), from an initial guess T of A in B's
// frame. Each step pairs every source point with its nearest destination point, then solves the pairing's best rigid
// transform in closed form (centroids, the 2×2 cross-covariance M, θ = atan2(M₁₀ − M₀₁, M₀₀ + M₁₁)). Returns the pose,
// the residual RMS over the final pairs and the share of source points paired within 0.3 m.
function icp2d(src, dst, T0, minPairs = 12) {
  let T = {...T0};
  const PAIR = 0.5;
  let pairs = [],
    rms = 0;
  for (let it = 0; it < 15; it++) {
    const c = Math.cos(T.th),
      s = Math.sin(T.th);
    pairs = [];
    for (const p of src) {
      const wx = T.x + c * p[0] - s * p[1],
        wy = T.y + s * p[0] + c * p[1];
      let bd = PAIR * PAIR,
        bq = null;
      for (const q of dst) {
        const d = (q[0] - wx) ** 2 + (q[1] - wy) ** 2;
        if (d < bd) {
          bd = d;
          bq = q;
        }
      }
      if (bq) pairs.push([p, bq, bd]);
    }
    if (pairs.length < minPairs) return null;
    let sx = 0,
      sy = 0,
      dx = 0,
      dy = 0;
    for (const [p, q] of pairs) {
      sx += p[0];
      sy += p[1];
      dx += q[0];
      dy += q[1];
    }
    const n = pairs.length;
    sx /= n;
    sy /= n;
    dx /= n;
    dy /= n;
    let M00 = 0,
      M01 = 0,
      M10 = 0,
      M11 = 0;
    for (const [p, q] of pairs) {
      const ax = p[0] - sx,
        ay = p[1] - sy,
        bx = q[0] - dx,
        by = q[1] - dy;
      M00 += bx * ax;
      M01 += bx * ay;
      M10 += by * ax;
      M11 += by * ay;
    }
    const th = Math.atan2(M10 - M01, M00 + M11),
      c2 = Math.cos(th),
      s2 = Math.sin(th);
    const Tn = {x: dx - (c2 * sx - s2 * sy), y: dy - (s2 * sx + c2 * sy), th};
    const moved = hyp(Tn.x - T.x, Tn.y - T.y) + Math.abs(wrap(Tn.th - T.th));
    T = Tn;
    if (moved < 1e-4) break;
  }
  let n = 0,
    ss = 0;
  for (const [, , d] of pairs)
    if (d < 0.09) {
      n++;
      ss += d;
    }
  rms = n ? Math.sqrt(ss / n) : Infinity;
  return {x: T.x, y: T.y, th: T.th, rms, inl: n / src.length, n};
}
// @end
// A new scan: a keyframe when the robot has moved enough; then loop closures against earlier keyframes nearby, and
// an optimization when one is found.
function pgLidar(ranges) {
  const G = S.pg,
    r = G.rel;
  if (!G.nodes[0].scan) {
    G.nodes[0].scan = pgPoints(ranges);
    pgHits(G.nodes[0], G.nodes[0].scan);
    G.frames.push({k: 0, rel: {x: 0, y: 0, th: 0}, pts: G.nodes[0].scan});
    return;
  }
  if (hyp(r.x, r.y) < P.pgKf && Math.abs(r.th) < 0.35) {
    // between keyframes the scan still goes into the planning grid (fidelity.js); it is kept, hung off the last
    // keyframe, so that the grid can be rebuilt when the graph moves
    if (P.per === 'mapping') G.frames.push({k: G.nodes.length - 1, rel: {...r}, pts: pgPoints(ranges)});
    return;
  }
  const K = G.nodes[G.nodes.length - 1],
    k = G.nodes.length,
    pts = pgPoints(ranges);
  let pose = pgComp(K, r),
    z = {...r},
    Po = G.relP.map((v, i) => v + (i % 4 === 0 ? 1e-6 : 0)),
    matched = false;
  // the local half of lidar SLAM: the scan matched against the map built so far refines the keyframe's pose, and the
  // edge to the previous keyframe carries the matched relative pose with the fit's information instead of the odometry's
  // The reference is the keyframes' own map, not the live grid: the live grid holds scans placed at the drifting
  // odometry poses between keyframes, and matching against those would lock the drift in instead of removing it.
  if (P.pgMatch && G.nodes.length > 1) {
    const occ = new Uint8Array(NC);
    for (let i = 0; i < NC; i++) occ[i] = G.hits[i] ? 1 : 0;
    const m = scanMatch(ranges, pose, distanceTransform(occ));
    if (m && m.rms < 0.1 && m.n >= 0.5 * m.hits && hyp(m.x - pose.x, m.y - pose.y) < 0.5 && Math.abs(wrap(m.th - pose.th)) < 0.15) {
      // fused with the odometry, not swapped for it: along a corridor the fit's covariance is long and the odometry
      // keeps its say; across it the fit wins. A Kalman update of the predicted pose by the matched one.
      const c = Math.cos(K.th),
        s = Math.sin(K.th),
        R = [c, -s, 0, s, c, 0, 0, 0, 1],
        Pw = m3mul(m3mul(R, G.relP), m3T(R)),
        Si = m3inv(Pw.map((v, i) => v + m.cov[i]));
      if (Si) {
        const Kg = m3mul(Pw, Si),
          nu = [m.x - pose.x, m.y - pose.y, wrap(m.th - pose.th)];
        pose = {
          x: pose.x + Kg[0] * nu[0] + Kg[1] * nu[1] + Kg[2] * nu[2],
          y: pose.y + Kg[3] * nu[0] + Kg[4] * nu[1] + Kg[5] * nu[2],
          th: wrap(pose.th + Kg[6] * nu[0] + Kg[7] * nu[1] + Kg[8] * nu[2])
        };
        const IK = [1 - Kg[0], -Kg[1], -Kg[2], -Kg[3], 1 - Kg[4], -Kg[5], -Kg[6], -Kg[7], 1 - Kg[8]],
          Pf = m3mul(IK, Pw),
          Rt = m3T(R);
        z = pgRel(K, pose);
        Po = m3mul(m3mul(Rt, Pf), R).map((v, i) => v + (i % 4 === 0 ? 1e-6 : 0)); // into K's frame
        matched = true;
        G.matched++;
      }
    }
  }
  G.nodes.push({x: pose.x, y: pose.y, th: pose.th, scan: pts, t: S.t, matched});
  pgHits(pose, pts);
  G.frames.push({k, rel: {x: 0, y: 0, th: 0}, pts});
  const Oi = m3inv(Po);
  G.edges.push({i: k - 1, j: k, z, O: Oi || [100, 0, 0, 0, 100, 0, 0, 0, 100], loop: false});
  G.rel = {x: 0, y: 0, th: 0};
  G.relP = [1e-6, 0, 0, 0, 1e-6, 0, 0, 0, 1e-6];
  let closed = false;
  if (P.pgLoop) {
    // candidates: keyframes at least ten back, within a radius that grows with the pose uncertainty (the drift since
    // the last closure is what a closure is for), the two nearest; the plain ICP from the graph's guess first, and
    // when that fails a grid of starts around it, accepted only on a stricter fit
    const sig = Math.sqrt(Math.max(0, S.Pc[0] + S.Pc[4])),
      rad = Math.min(6, 1.5 + 2 * sig),
      cand = [];
    for (let i = 0; i <= k - 10; i++) {
      const d = hyp(G.nodes[i].x - pose.x, G.nodes[i].y - pose.y);
      if (d < rad) cand.push([d, i]);
    }
    cand.sort((a, b) => a[0] - b[0]);
    // the two nearest, and the nearest old one (forty keyframes back or more): the recent ones along the same
    // corridor close small loops, the old one is the revisit that carries the drift of the whole excursion
    const pick = cand.slice(0, 2),
      old = cand.find(([, i]) => i <= k - 40);
    if (old && !pick.includes(old)) pick.push(old);
    for (const [, i] of pick) {
      const Ni = G.nodes[i],
        init = pgRel(Ni, pose);
      let m = icp2d(pts, Ni.scan, init),
        wide = false;
      if (!m || m.inl < 0.6 || m.rms > 0.08) {
        m = null;
        if (sig > 0.3) {
          wide = true;
          for (let ox = -2; ox <= 2 && !(m && m.inl > 0.85); ox += 1)
            for (let oy = -2; oy <= 2; oy += 1)
              for (const oth of [-0.5, 0, 0.5]) {
                const t = icp2d(pts, Ni.scan, {x: init.x + ox, y: init.y + oy, th: wrap(init.th + oth)});
                if (t && t.inl >= 0.7 && t.rms <= 0.06 && (!m || t.inl > m.inl)) m = t;
              }
        }
        if (!m) continue;
      }
      const corr = hyp(m.x - init.x, m.y - init.y),
        dth = Math.abs(wrap(m.th - init.th));
      if (corr > (wide ? 3 * sig + 0.5 : 1.0) || dth > 0.6) continue; // farther than the uncertainty allows: a wrong match
      const sg = Math.max(m.rms, 0.05), // point-to-point ICP slides along walls by about the point spacing
        O = [1 / (sg * sg), 0, 0, 0, 1 / (sg * sg), 0, 0, 0, 1 / 0.0025]; // heading to 3°: ICP trades sliding against rotation
      G.edges.push({i, j: k, z: {x: m.x, y: m.y, th: m.th}, O, loop: true});
      G.loops++;
      if (corr > 0.3) G.bigCorr = true;
      G.last = {t: S.t, i, j: k, corr, inl: m.inl, rms: m.rms};
      logE(
        `Loop closure: keyframe ${k} ↔ ${i}, correction ${(100 * corr).toFixed(0)} cm, ${(100 * m.inl).toFixed(0)} % of the hits paired${wide ? ' (found by the wide search)' : ''}`,
        'ok'
      );
      closed = true;
    }
  }
  // closures are batched: one optimization per second, at once when a closure moved the pose by more than 0.3 m
  if (closed) G.pending = true;
  if (G.pending && (S.t - (G.lastOpt || -9) >= 1 || G.bigCorr)) {
    G.pending = false;
    G.bigCorr = false;
    G.lastOpt = S.t;
    pgOptimize();
    pgRebuildMap();
    if (P.per === 'mapping') requestReplan('map corrected');
  } else pgMarginal();
  pgPublish();
}
// @code pg-optimize | pgOptimize: Gauss–Newton over all keyframe poses, the first one fixed
// Every edge (i, j, z, Ω) says "j, seen from i, is at z"; its error is the mismatch between what the poses say and
// z, its Jacobians A (to pose i) and B (to pose j) are those of the relative-pose function. The normal equations
// H δ = −b sum AᵀΩA, AᵀΩB, BᵀΩB and AᵀΩe, BᵀΩe into the blocks of the poses the edge joins; a large prior on the
// first pose fixes the gauge (a map can slide and turn as a whole). Dense Cholesky, the graph being small.
function pgOptimize() {
  const G = S.pg,
    N = G.nodes.length,
    n = 3 * N,
    t0 = performance.now();
  let it = 0,
    chi2 = 0;
  for (; it < 6; it++) {
    const H = new Float64Array(n * n),
      b = new Float64Array(n);
    chi2 = 0;
    for (const E of G.edges) {
      const Xi = G.nodes[E.i],
        Xj = G.nodes[E.j],
        ci = Math.cos(Xi.th),
        si = Math.sin(Xi.th),
        cz = Math.cos(E.z.th),
        sz = Math.sin(E.z.th),
        dx = Xj.x - Xi.x,
        dy = Xj.y - Xi.y;
      // Δ = X_i⁻¹ X_j in i's frame; e = Z⁻¹ Δ
      const Dx = ci * dx + si * dy,
        Dy = -si * dx + ci * dy,
        ex = cz * (Dx - E.z.x) + sz * (Dy - E.z.y),
        ey = -sz * (Dx - E.z.x) + cz * (Dy - E.z.y),
        eth = wrap(Xj.th - Xi.th - E.z.th),
        e = [ex, ey, eth];
      // ∂e/∂x_j = [R_zᵀ R_iᵀ 0; 0 1], ∂e/∂x_i = [−R_zᵀ R_iᵀ, R_zᵀ (∂R_iᵀ/∂θ)(t_j − t_i); 0 −1]
      const RzRi = [cz * ci + sz * -si, cz * si + sz * ci, -sz * ci + cz * -si, -sz * si + cz * ci]; // R_zᵀ R_iᵀ, 2×2 row-major
      const dRx = -si * dx + ci * dy, // (∂R_iᵀ/∂θ)(t_j − t_i)
        dRy = -ci * dx - si * dy;
      const A = [-RzRi[0], -RzRi[1], cz * dRx + sz * dRy, -RzRi[2], -RzRi[3], -sz * dRx + cz * dRy, 0, 0, -1],
        B = [RzRi[0], RzRi[1], 0, RzRi[2], RzRi[3], 0, 0, 0, 1];
      const O = E.O;
      const OA = m3mul(O, A),
        OB = m3mul(O, B),
        Oe = [O[0] * ex + O[1] * ey + O[2] * eth, O[3] * ex + O[4] * ey + O[5] * eth, O[6] * ex + O[7] * ey + O[8] * eth];
      chi2 += ex * Oe[0] + ey * Oe[1] + eth * Oe[2];
      const AtOA = m3mul(m3T(A), OA),
        AtOB = m3mul(m3T(A), OB),
        BtOB = m3mul(m3T(B), OB),
        At = m3T(A),
        Bt = m3T(B);
      const bi = 3 * E.i,
        bj = 3 * E.j;
      for (let r = 0; r < 3; r++) {
        b[bi + r] += At[r * 3] * Oe[0] + At[r * 3 + 1] * Oe[1] + At[r * 3 + 2] * Oe[2];
        b[bj + r] += Bt[r * 3] * Oe[0] + Bt[r * 3 + 1] * Oe[1] + Bt[r * 3 + 2] * Oe[2];
        for (let c = 0; c < 3; c++) {
          H[(bi + r) * n + bi + c] += AtOA[r * 3 + c];
          H[(bi + r) * n + bj + c] += AtOB[r * 3 + c];
          H[(bj + r) * n + bi + c] += AtOB[c * 3 + r];
          H[(bj + r) * n + bj + c] += BtOB[r * 3 + c];
        }
      }
    }
    for (let r = 0; r < 3; r++) H[r * n + r] += 1e6; // the first pose is the anchor
    for (let r = 0; r < n; r++) H[r * n + r] += 1e-6;
    const L = pgChol(H, n),
      d = pgSolve(L, b, n);
    let mx = 0;
    for (let i = 0; i < N; i++) {
      G.nodes[i].x -= d[3 * i];
      G.nodes[i].y -= d[3 * i + 1];
      G.nodes[i].th = wrap(G.nodes[i].th - d[3 * i + 2]);
      mx = Math.max(mx, Math.abs(d[3 * i]), Math.abs(d[3 * i + 1]));
    }
    G.H = H;
    G.L = L;
    if (mx < 1e-4) break;
  }
  G.opt = {ms: performance.now() - t0, it: it + 1, chi2};
  G.optMax = Math.max(G.optMax || 0, G.opt.ms);
  pgMarginal();
}
// @end
// the last keyframe's marginal covariance: three solves against the factored H (the block of H⁻¹), or, with no
// optimization yet, the previous marginal grown by the last odometry edge
function pgMarginal() {
  const G = S.pg,
    N = G.nodes.length,
    n = 3 * N;
  if (!G.L || G.L.length !== n * n) {
    const E = G.edges[G.edges.length - 1];
    if (E && !E.loop) {
      const Oi = m3inv(E.O);
      if (Oi) G.marg = pgCompCov(G.nodes[E.i], G.marg, E.z, Oi);
    }
    return;
  }
  const M = [];
  for (let c = 0; c < 3; c++) {
    const e = new Float64Array(n);
    e[n - 3 + c] = 1;
    const col = pgSolve(G.L, e, n);
    for (let r = 0; r < 3; r++) M[r * 3 + c] = col[n - 3 + r];
  }
  G.marg = M;
}
function pgChol(A, n) {
  const L = new Float64Array(n * n);
  for (let i = 0; i < n; i++)
    for (let j = 0; j <= i; j++) {
      let s = A[i * n + j];
      for (let k = 0; k < j; k++) s -= L[i * n + k] * L[j * n + k];
      if (i === j) L[i * n + i] = Math.sqrt(Math.max(s, 1e-12));
      else L[i * n + j] = s / L[j * n + j];
    }
  return L;
}
function pgSolve(L, b, n) {
  const y = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let s = b[i];
    for (let k = 0; k < i; k++) s -= L[i * n + k] * y[k];
    y[i] = s / L[i * n + i];
  }
  const x = new Float64Array(n);
  for (let i = n - 1; i >= 0; i--) {
    let s = y[i];
    for (let k = i + 1; k < n; k++) s -= L[k * n + i] * x[k];
    x[i] = s / L[i * n + i];
  }
  return x;
}
// a keyframe's hits into the hit map at a pose: the cells the beams ended in, counted, never carved
function pgHits(pose, pts) {
  const H = S.pg.hits,
    c = Math.cos(pose.th),
    s = Math.sin(pose.th);
  for (const [px, py] of pts) {
    const k = cellIdx(pose.x + c * px - s * py, pose.y + s * px + c * py);
    if (k >= 0) H[k]++;
  }
}
// a keyframe's scan into the planning grid at a pose (integrateScan works on S.lo at S.est: swap the pose in and out)
function pgIntegrate(pose, pts) {
  const keep = S.est;
  S.est = {x: pose.x, y: pose.y, th: pose.th};
  integrateScanPts(pts);
  S.est = keep;
}
// the maps from the keyframes' scans at their optimized poses, after an optimization: the hit map the matcher uses,
// and, with lidar mapping on, the planning grid, so the map the robot drives by moves with the graph
function pgRebuildMap() {
  const G = S.pg;
  G.hits.fill(0);
  for (const K of G.nodes) if (K.scan) pgHits(K, K.scan);
  G.rebuilt++;
  if (P.per === 'mapping') {
    S.lo.fill(0);
    for (const F of G.frames) pgIntegrate(pgComp(G.nodes[F.k], F.rel), F.pts);
    buildCostmap();
    dirty.occ = true;
  }
}
