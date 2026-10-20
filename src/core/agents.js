/* ============================================================
   Step
   ============================================================ */
/* ============================================================
   Moving agents: lidar detection, tracking (constant-velocity Kalman filter),
   prediction, and an ST-graph speed planner that uses the predictions.
   The global path stays static; agents are handled at the trajectory level
   (path–velocity decomposition), with escalation to a replan when speed alone
   cannot resolve the conflict.
   ============================================================ */
const AG_PATH_CTL = ['pp', 'rwf', 'stanley', 'pid'];
function agInit() {
  return {
    tracks: [],
    nextId: 1,
    det: [],
    dynPts: [],
    staticPts: null,
    lastT: null,
    st: null,
    vlim: Infinity,
    vlimStop: Infinity,
    blockT: 0,
    lastAgentPlan: -99,
    yieldLog: {},
    egoPath: null
  };
}
const agOn = () => P.agents !== 'off';
const AG_ST_CTL = [...AG_PATH_CTL, 'mpc']; // controllers that follow the speed plan: path trackers as a speed cap, MPC as its reference
const stActive = () => AG_ST_CTL.includes(P.ctl) && P.spd === 'st' && agOn();
// A lidar hit is "explained" when the static map accounts for it
function agExplained(x, y) {
  const k = cellIdx(x, y);
  if (k < 0) return true;
  if (P.per === 'oracle') return S.cm.dist[k] < 0.25;
  const i = k % GW,
    j = (k / GW) | 0; // built map: only cells that have been occupied for a while count as static
  for (let dj = -1; dj <= 1; dj++)
    for (let di = -1; di <= 1; di++) {
      const ii = i + di,
        jj = j + dj;
      if (ii < 0 || jj < 0 || ii >= GW || jj >= GH) continue;
      if (S.lo[jj * GW + ii] > 2.0) return true;
    }
  return false;
}
// Detection: cluster unexplained hits over consecutive beams, reject clusters too large to be a person
function agDetect() {
  const A = S.agents,
    e = S.est,
    R = S.scan;
  A.det = [];
  A.dynPts = [];
  if (!R) return;
  const pts = new Array(NBEAM).fill(null);
  for (let k = 0; k < NBEAM; k++) {
    if (R[k] >= LMAX - 1e-3) continue;
    const a = e.th - Math.PI + (k * TAU) / NBEAM,
      x = e.x + R[k] * Math.cos(a),
      y = e.y + R[k] * Math.sin(a);
    if (!agExplained(x, y)) pts[k] = [x, y, k];
  }
  agCluster(pts, false);
}
// The previous scan as it would look from the current pose if everything stood still: its points moved by the
// odometry increment into the current body frame and binned by beam (LMAX where no point lands). The difference to
// the current scan is then a motion cue with the robot's own motion taken out: near zero on walls, large on a person.
function scanReproject(prev, v, w, dt) {
  const out = new Float32Array(NBEAM).fill(LMAX);
  if (!prev) return out;
  const dth = w * dt,
    dx = v * dt * Math.cos(dth / 2),
    dy = v * dt * Math.sin(dth / 2),
    c = Math.cos(-dth),
    s = Math.sin(-dth);
  for (let k = 0; k < NBEAM; k++) {
    if (prev[k] >= LMAX - 1e-3) continue;
    const a = -Math.PI + (k * TAU) / NBEAM,
      px = prev[k] * Math.cos(a) - dx, // the point in the previous body frame, then into the current one
      py = prev[k] * Math.sin(a) - dy,
      x = c * px - s * py,
      y = s * px + c * py,
      r = hyp(x, y),
      kk = Math.round(((Math.atan2(y, x) + Math.PI) / TAU) * NBEAM) % NBEAM;
    if (r < out[kk]) out[kk] = r;
  }
  return out;
}
// @code ag-learned | agDetectLearned: the learned per-beam detector, its clusters and the hit points it hands on
// The seven numbers per beam the detector sees (the collector tools/collect-detector.mjs and the Train tab's data come
// from this same function): range/8, the previous scan reprojected into this frame /8, their difference clipped to
// ±1, the hit flag, the odometry's v/1.5 and ω/2 broadcast over the beams, and how well the robot's map explains the
// hit (detStatic). prev null: no previous scan yet; st null: the six numbers of a model trained without the map.
function detFeatures(R, prev, v, w, st) {
  const CH = st ? 7 : 6,
    f = new Float32Array(NBEAM * CH);
  for (let k = 0; k < NBEAM; k++) {
    const rk = Math.min(R[k], LMAX),
      rp = prev ? prev[k] : rk;
    f[k * CH] = rk / LMAX;
    f[k * CH + 1] = rp / LMAX;
    f[k * CH + 2] = clamp(rk - rp, -1, 1);
    f[k * CH + 3] = R[k] < LMAX - 1e-3 ? 1 : 0;
    f[k * CH + 4] = v / 1.5;
    f[k * CH + 5] = w / 2;
    if (st) f[k * CH + 6] = st[k];
  }
  return f;
}
// How well the map the robot has explains each beam's hit, 0 to 1, placed from the estimated pose: the evidence the
// rule (agExplained) thresholds, kept as a number. Prior map: 1 on an obstacle, falling with the distance to the
// nearest one, 0.5 at the rule's 0.25 m and 0 from 0.5 m; built map: the highest log-odds around the cell / 4, 0.5 at
// the rule's 2. Outside the map: 1. The network learns how far to trust it.
function detStatic(R, e) {
  const st = new Float32Array(NBEAM);
  for (let k = 0; k < NBEAM; k++) {
    if (R[k] >= LMAX - 1e-3) continue;
    const a = e.th - Math.PI + (k * TAU) / NBEAM,
      c = cellIdx(e.x + R[k] * Math.cos(a), e.y + R[k] * Math.sin(a));
    if (c < 0) {
      st[k] = 1;
      continue;
    }
    if (P.per === 'oracle') {
      st[k] = clamp(1 - S.cm.dist[c] / 0.5, 0, 1);
      continue;
    }
    const i = c % GW,
      j = (c / GW) | 0;
    let lo = -Infinity;
    for (let dj = -1; dj <= 1; dj++)
      for (let di = -1; di <= 1; di++) {
        const ii = i + di,
          jj = j + dj;
        if (ii >= 0 && jj >= 0 && ii < GW && jj < GH) lo = Math.max(lo, S.lo[jj * GW + ii]);
      }
    st[k] = clamp(lo / 4, 0, 1);
  }
  return st;
}
// The learned detector: a 1D convolution over the beams (the built-in MODELS.detector, trained in training/detector,
// or one trained in the Train tab) gives each beam the probability that its hit lies on a person, from the shape and
// motion of the hits and the map's evidence; beams above the model's threshold are clustered as agDetect clusters
// unexplained hits. Where the map is missing or wrong (not built yet, the pose estimate off) the evidence is weak or
// misleading, and the shape and motion carry the decision.
function agDetectLearned() {
  const A = S.agents,
    e = S.est,
    R = S.scan,
    M = nnModel('detector');
  A.det = [];
  A.dynPts = [];
  A.beamP = null;
  if (!R || !M) return;
  const v = S.odo ? S.odo.v : 0,
    w = S.odo ? S.odo.w : 0,
    prev = A.prevScan ? scanReproject(A.prevScan, v, w, S.t - (A.prevT || S.t)) : null,
    f = detFeatures(R, prev, v, w, M.layers[0].cin > 6 ? detStatic(R, e) : null),
    thr = M.threshold || (M.layers[0].cin > 6 ? DET_THR : 0.6);
  A.prevScan = Float32Array.from(R);
  A.prevT = S.t;
  const p = nnForward(M, f, NBEAM);
  A.beamP = p;
  A.beamThr = thr;
  const pts = new Array(NBEAM).fill(null);
  for (let k = 0; k < NBEAM; k++) {
    if (R[k] >= LMAX - 1e-3 || p[k] < thr) continue;
    const a = e.th - Math.PI + (k * TAU) / NBEAM;
    pts[k] = [e.x + R[k] * Math.cos(a), e.y + R[k] * Math.sin(a), k];
  }
  agCluster(pts, M.minBeams || (M.layers[0].cin > 6 ? DET_MIN : 2));
}
// @end
// Consecutive hit points (one gap allowed) become clusters; a cluster of a person's size becomes a detection,
// its centre pushed to the far side of the hits (which lie on the near side of the person)
function agCluster(pts, learned) {
  // learned: false for the rule, or the fewest beams a learned detection has
  const A = S.agents,
    e = S.est,
    cl = [];
  let cur = null,
    miss = 0;
  for (let k = 0; k < NBEAM; k++) {
    const p = pts[k];
    if (!p) {
      if (cur && ++miss > 1) cur = null;
      continue;
    }
    const l = cur && cur[cur.length - 1];
    if (l && hyp(p[0] - l[0], p[1] - l[1]) < 0.45) {
      cur.push(p);
      miss = 0;
    } else {
      cur = [p];
      cl.push(cur);
      miss = 0;
    }
  }
  if (cl.length > 1) {
    const f = cl[0],
      l = cl[cl.length - 1],
      a = f[0],
      b = l[l.length - 1];
    if (a[2] <= 1 && b[2] >= NBEAM - 2 && hyp(a[0] - b[0], a[1] - b[1]) < 0.45) {
      l.push(...f);
      cl.shift();
    }
  }
  for (const c of cl) {
    let mx = 0,
      my = 0;
    for (const p of c) {
      mx += p[0];
      my += p[1];
    }
    mx /= c.length;
    my /= c.length;
    let ext = 0;
    for (const p of c) ext = Math.max(ext, hyp(p[0] - mx, p[1] - my));
    ext *= 2;
    if (ext > (S.peds.some(p => p.car) ? 2.2 : 1.2)) continue;
    if (learned && c.length < learned) continue;
    const dx = mx - e.x,
      dy = my - e.y,
      d = hyp(dx, dy) || 1,
      r = clamp(0.5 * ext + 0.1, 0.3, S.peds.some(p => p.car) ? 0.9 : 0.55),
      sh = 0.6 * r; // hits lie on the near side
    A.det.push({x: mx + (dx / d) * sh, y: my + (dy / d) * sh, r, n: c.length, pts: c.map(p => [p[0], p[1]]), learned: !!learned});
  }
  for (const p of pts) if (p) A.dynPts.push(p);
}
// Tracking: one constant-velocity Kalman filter per agent, gated greedy nearest-neighbour association
const AG_SZ = 0.1; // measurement noise σ [m]
// @code ag-track | agTrack: clusters to tracks, with the constant-velocity Kalman filter
function agTrack() {
  const A = S.agents;
  if (P.agents === 'truth') {
    A.tracks = S.peds.map((p, i) => ({
      id: i + 1,
      x: p.x,
      y: p.y,
      vx: p.vx || 0,
      vy: p.vy || 0,
      r: p.r,
      pxx: 0,
      pxv: 0,
      pvv: 0,
      hits: 99,
      conf: true,
      lastUpd: S.t
    }));
    return;
  }
  const dt = A.lastT == null ? 0.1 : Math.max(1e-3, S.t - A.lastT);
  A.lastT = S.t;
  const q = P.agSigA * P.agSigA,
    R = AG_SZ * AG_SZ;
  for (const t of A.tracks) {
    t.x += t.vx * dt;
    t.y += t.vy * dt; // predict: x' = F x,  P' = F P Fᵀ + Q  (per axis; both axes share P)
    const a = t.pxx + 2 * dt * t.pxv + dt * dt * t.pvv + (q * dt ** 4) / 4,
      b = t.pxv + dt * t.pvv + (q * dt ** 3) / 2,
      c = t.pvv + q * dt * dt;
    t.pxx = a;
    t.pxv = b;
    t.pvv = c;
  }
  const pairs = [];
  A.tracks.forEach((t, i) =>
    A.det.forEach((d, j) => {
      const m = ((d.x - t.x) ** 2 + (d.y - t.y) ** 2) / (t.pxx + R);
      if (m < 9.21) pairs.push([m, i, j]);
    })
  );
  pairs.sort((a, b) => a[0] - b[0]);
  const ut = new Set(),
    ud = new Set();
  for (const [, i, j] of pairs) {
    if (ut.has(i) || ud.has(j)) continue;
    ut.add(i);
    ud.add(j);
    const t = A.tracks[i],
      d = A.det[j],
      S2 = t.pxx + R,
      k0 = t.pxx / S2,
      k1 = t.pxv / S2,
      nx = d.x - t.x,
      ny = d.y - t.y;
    t.x += k0 * nx;
    t.y += k0 * ny;
    t.vx += k1 * nx;
    t.vy += k1 * ny;
    const pxx = (1 - k0) * t.pxx,
      pxv = (1 - k0) * t.pxv,
      pvv = t.pvv - k1 * t.pxv;
    t.pxx = pxx;
    t.pxv = pxv;
    t.pvv = pvv;
    const sp = hyp(t.vx, t.vy);
    if (sp > 2.5) {
      t.vx *= 2.5 / sp;
      t.vy *= 2.5 / sp;
    }
    t.r = 0.8 * t.r + 0.2 * d.r;
    // per-target scan matching: the person's hits of this scan aligned to the hits of the last one give the
    // displacement, a direct velocity measurement that the Kalman filter's velocity state takes with its own gain
    if (P.agICP && t.pts && d.pts && t.pts.length >= 3 && d.pts.length >= 3) {
      const cx = t.px,
        cy = t.py,
        src = t.pts.map(q => [q[0] - cx, q[1] - cy]),
        dst = d.pts.map(q => [q[0] - cx, q[1] - cy]),
        m = icp2d(src, dst, {x: t.vx * dt, y: t.vy * dt, th: 0}, 3); // a person is a handful of hits
      if (m && m.inl >= 0.6 && m.rms < 0.08) {
        const vmx = m.x / dt,
          vmy = m.y / dt,
          Rv = 0.5 * 0.5,
          kv = t.pvv / (t.pvv + Rv);
        t.vx += kv * (vmx - t.vx);
        t.vy += kv * (vmy - t.vy);
        t.pvv *= 1 - kv;
        t.icp = (t.icp || 0) + 1;
      }
    }
    t.pts = d.pts;
    t.px = d.x;
    t.py = d.y;
    t.hits++;
    t.lastUpd = S.t;
    if (!t.conf && t.hits >= 3) {
      t.conf = true;
      t.t0 = S.t;
    }
  }
  A.det.forEach((d, j) => {
    if (!ud.has(j))
      A.tracks.push({
        id: A.nextId++,
        x: d.x,
        y: d.y,
        vx: 0,
        vy: 0,
        r: d.r,
        pxx: R,
        pxv: 0,
        pvv: 1,
        hits: 1,
        conf: false,
        lastUpd: S.t,
        pts: d.pts,
        px: d.x,
        py: d.y
      });
  });
  A.tracks = A.tracks.filter(t => S.t - t.lastUpd < (t.conf ? 1.0 : 0.25)); // confirmed tracks coast through 1 s of occlusion
}
// @end
// Prediction: constant velocity (or frozen), radius inflated with time; or the learned futures (core/predict.js)
function agPred(t, tt) {
  if (P.agPred === 'custom') {
    const q = trajPred(t, tt);
    if (q) return q;
  }
  if (P.agPred === 'learned' && t.lp) return predLearnedDisc(t, tt);
  const cv = P.agPred !== 'static';
  return [t.x + (cv ? t.vx * tt : 0), t.y + (cv ? t.vy * tt : 0), t.r + (cv ? P.agGrow * tt : 0)];
}
function agList(rng) {
  const A = S.agents;
  if (!A || !agOn()) return [];
  const e = S.est;
  return A.tracks.filter(t => t.conf && hyp(t.x - e.x, t.y - e.y) < (rng || 10));
}

// ---- ST-graph speed planning along the current leg ----
// Occupancy: cell (t, s) is blocked when the footprint at path distance s ahead overlaps a predicted agent at time t.
// Dynamic programming over (t, s, v) with a small set of accelerations finds the cheapest collision-free speed profile.
const ST_DT = 0.2,
  ST_DS = 0.1,
  ST_DV = 0.05;
// The ST speed planner: dynamic programming over (time, distance along the path, speed) against the predicted agents,
// with a terminal test past the horizon; its speed at 0.2 s caps the tracker.
function stPlan() {
  const A = S.agents,
    T = S.track,
    e = S.est;
  A.st = null;
  A.vlim = Infinity;
  if (!T || S.fsm.state !== 'DRIVE' || !agOn()) return;
  const ags = agListModes(14),
    dir = T.dir || 1,
    pr = project(e.x, e.y, true),
    Hh = P.agT,
    nt = Math.round(Hh / ST_DT);
  const vtop = Math.min(P.vcruise, isCar() ? vCap(dir) : P.vmax),
    sRem = Math.max(0, T.total - pr.s);
  const v0 = clamp(Math.abs(S.odo.v), 0, vtop + 0.3),
    sMax = Math.min(sRem, (vtop + 0.3) * Hh) + 0.3,
    ns = Math.ceil(sMax / ST_DS) + 1;
  const vref = new Float32Array(ns);
  for (let j = 0; j < ns; j++) {
    const s = pr.s + j * ST_DS;
    let v = vtop,
      kp = 0;
    for (let d = 0; d <= 0.6; d += 0.2) kp = Math.max(kp, Math.abs(kapAt(s + d)));
    if (kp > 1e-6) v = Math.min(v, Math.sqrt(P.alat / kp));
    vref[j] = Math.min(v, decelCap(T.total - s));
  }
  // occ: inside the clearance (1) or touching (2); cc: collision cost of the cell; prox: soft cost just outside the clearance
  const occ = new Uint8Array((nt + 1) * ns),
    cc = new Float32Array((nt + 1) * ns),
    prox = new Float32Array((nt + 1) * ns),
    who = new Int16Array((nt + 1) * ns),
    marg = P.stMarg;
  let inter = false;
  // terminal cost: the profile must end somewhere the robot could stay. Parking in an agent's lane just beyond the horizon is not free.
  const term = new Float32Array(ns);
  // cost of a cell: inside the predicted body (no uncertainty growth) is a collision; inside the growth band or the clearance is soft
  const cellCost = (b0, bg) => (b0 < 0 ? 400 + 2000 * -b0 : 40 * (marg - Math.min(bg, b0)));
  if (ags.length)
    for (let j = 0; j < ns; j++) {
      const s = Math.min(T.total, pr.s + j * ST_DS),
        p = pointAt(s),
        hd = T.hd[segAt(s)],
        C = fpCircles(p[0], p[1], dir > 0 ? hd : hd + Math.PI);
      for (let k = 1; k <= nt; k++) {
        const tt = k * ST_DT;
        let best = Infinity,
          bid = 0;
        let b0 = Infinity;
        for (const a of ags) {
          const q = agPred(a, tt);
          for (const c of C) {
            const dc = hyp(c[0] - q[0], c[1] - q[1]) - c[2],
              d = dc - q[2];
            if (d < best) {
              best = d;
              bid = a.id;
            }
            if (dc - a.r < b0) b0 = dc - a.r;
          }
        }
        const i = k * ns + j;
        if (best < marg) {
          occ[i] = b0 < 0 ? 2 : 1;
          cc[i] = cellCost(b0, best);
          who[i] = bid;
          inter = true;
        } else if (best < marg + 0.6) {
          prox[i] = 1 - (best - marg) / 0.6;
          who[i] = bid;
          inter = true;
        }
      }
      for (let tt = Hh + 0.5; tt <= Hh + 3 + 1e-6; tt += 0.5) {
        let best = Infinity,
          b0 = Infinity;
        for (const a of ags) {
          const q = agPred(a, tt),
            gH = q[2] - agPred(a, Hh)[2];
          for (const c of C) {
            const dc = hyp(c[0] - q[0], c[1] - q[1]) - c[2],
              d = dc - q[2] + gH;
            if (d < best) best = d;
            if (dc - a.r < b0) b0 = dc - a.r;
          }
        }
        if (best < marg) term[j] = Math.max(term[j], 0.5 * cellCost(b0, best));
      }
    } // growth frozen at the horizon
  const Aacc = P.accel ? P.amax : 0.8,
    Bdec = P.accel ? P.amax : 1.5,
    acts = [-Bdec, -0.5 * Bdec, -0.2 * Bdec, 0, 0.5 * Aacc, Aacc];
  const nv = Math.round((vtop + 0.3) / ST_DV) + 1,
    NSV = ns * nv,
    N = (nt + 1) * NSV;
  const C = new Float32Array(N).fill(Infinity),
    Sv = new Float32Array(N),
    Vv = new Float32Array(N),
    Par = new Int32Array(N).fill(-1);
  const vrefAt = s => vref[clamp(Math.round(s / ST_DS), 0, ns - 1)];
  const put = (k, s, v, c, par) => {
    const i = k * NSV + clamp(Math.round(s / ST_DS), 0, ns - 1) * nv + clamp(Math.round(v / ST_DV), 0, nv - 1);
    if (c < C[i]) {
      C[i] = c;
      Sv[i] = s;
      Vv[i] = v;
      Par[i] = par;
    }
  };
  const trans = (k, s, v, par, c0) => {
    for (const a of acts) {
      let v2 = v + a * ST_DT,
        s2;
      if (v2 < 0) {
        s2 = s + (a < 0 ? (v * v) / (-2 * a) : 0);
        v2 = 0;
      } else s2 = s + ((v + v2) / 2) * ST_DT;
      s2 = Math.min(s2, sMax);
      const vr = vrefAt(s2);
      if (v2 > vr + 0.02 && a !== acts[0]) continue;
      const j2 = clamp(Math.round(s2 / ST_DS), 0, ns - 1),
        row = (k + 1) * ns;
      let pen = 0;
      for (let j = Math.min(j2, Math.max(0, Math.ceil(s / ST_DS - 1e-6))); j <= j2; j++) if (cc[row + j] > pen) pen = cc[row + j]; // always includes the cell it ends in   // soft: the least-bad profile still exists
      put(k + 1, s2, v2, c0 + ST_DT * ((vr - v2) ** 2 + 0.3 * a * a + 3 * prox[row + j2] + pen), par);
    }
  };
  trans(0, 0, v0, -2, 0);
  for (let k = 1; k < nt; k++) {
    const b = k * NSV;
    for (let i = 0; i < NSV; i++) {
      const g = b + i;
      if (C[g] !== Infinity) trans(k, Sv[g], Vv[g], g, C[g]);
    }
  }
  let bi = -1,
    bc = Infinity;
  for (let i = nt * NSV; i < N; i++) {
    if (C[i] === Infinity) continue;
    const c = C[i] + term[((i - nt * NSV) / nv) | 0];
    if (c < bc) {
      bc = c;
      bi = i;
    }
  }
  // unconstrained reference: accelerate toward v_ref, ignoring agents
  const free = [[0, 0]];
  {
    let s = 0,
      v = v0;
    for (let k = 1; k <= nt; k++) {
      const vr = vrefAt(s),
        v2 = v < vr ? Math.min(vr, v + Aacc * ST_DT) : Math.max(vr, v - Bdec * ST_DT);
      s = Math.min(sMax, s + ((v + v2) / 2) * ST_DT);
      v = v2;
      free.push([k * ST_DT, s]);
    }
  }
  const st = {
    nt,
    ns,
    dt: ST_DT,
    ds: ST_DS,
    sMax,
    occ,
    prox,
    who,
    free,
    prof: null,
    conflict: false,
    inter,
    s0: pr.s,
    dir,
    pathId: S.pathId,
    seg: S.segIdx,
    t: S.t
  };
  if (bi >= 0) {
    const prof = [];
    let i = bi;
    for (let k = nt; k >= 1; k--) {
      prof.push([k * ST_DT, Sv[i], Vv[i]]);
      i = Par[i];
    }
    prof.push([0, 0, v0]);
    prof.reverse();
    st.prof = prof;
    // conflict: even the cheapest profile is predicted to touch an agent
    for (let k = 1; k <= nt && !st.conflict; k++) {
      const j2 = clamp(Math.round(prof[k][1] / ST_DS), 0, ns - 1),
        j1 = Math.min(j2, Math.max(0, Math.ceil(prof[k - 1][1] / ST_DS - 1e-6)));
      for (let j = j1; j <= j2; j++)
        if (occ[k * ns + j] === 2) {
          st.conflict = k * ST_DT;
          break;
        }
    }
  }
  A.st = st;
  if (!stActive()) return;
  if (!st.prof) A.vlim = Math.max(0, v0 - Bdec * 2 * DT);
  else if (inter) A.vlim = st.prof[1][2];
  // yielding message and escalation to the global planner
  if (st.prof && inter) {
    const sEnd = st.prof[nt][1],
      fEnd = free[nt][1];
    if (sEnd < fEnd - 0.5) {
      let id = 0;
      for (let k = 1; k <= nt && !id; k++) {
        const j0 = clamp(Math.round(st.prof[k][1] / ST_DS), 0, ns - 1);
        for (let j = j0; j < Math.min(ns, j0 + 12); j++) {
          const w = who[k * ns + j];
          if (w && (occ[k * ns + j] || prox[k * ns + j] > 0.3)) {
            id = w;
            break;
          }
        }
      }
      if (id && (A.yieldLog[id] == null || S.t - A.yieldLog[id] > 6)) {
        A.yieldLog[id] = S.t;
        logE(`Speed planner: yielding to agent #${id}`, 'warn');
      }
    }
  }
  const waiting = st.prof && inter && st.prof[nt][1] < 0.2 && v0 < 0.1;
  A.blockT = st.conflict ? A.blockT + 2 * DT * 10 : waiting ? A.blockT + 2 * DT : 0; // escalate after ≈0.3 s of unavoidable conflict, or ≈4 s of waiting
  if (A.blockT >= 3.9 && P.agPlan && S.t - A.lastAgentPlan > 4) {
    A.blockT = 0;
    A.lastAgentPlan = S.t;
    S.fsm.state = 'PLAN';
    S.fsm.pendingReason = 'agent blocking';
    logE('Speed planner: an agent blocks the path; asking for a new path', 'warn');
  }
}
// Reactive baseline: brake for unexplained lidar hits inside the footprint corridor ahead (no tracking, no prediction)
function stReactive() {
  const A = S.agents,
    T = S.track,
    e = S.est;
  if (!T || S.fsm.state !== 'DRIVE' || !A.dynPts.length) return Infinity;
  const dir = T.dir || 1,
    pr = project(e.x, e.y, true),
    B = P.accel ? P.amax : 1.5,
    look = Math.min(T.total - pr.s, 3);
  const near = A.dynPts.filter(p => hyp(p[0] - e.x, p[1] - e.y) < look + 1.5);
  if (!near.length) return Infinity;
  for (let s = 0.1; s <= look + 1e-6; s += 0.1) {
    const q = pointAt(pr.s + s),
      hd = T.hd[segAt(pr.s + s)];
    for (const c of fpCircles(q[0], q[1], dir > 0 ? hd : hd + Math.PI))
      for (const p of near) if (hyp(p[0] - c[0], p[1] - c[1]) < c[2] + 0.1) return Math.sqrt(2 * B * Math.max(0, s - 0.3));
  }
  return Infinity;
}
function agentsTick() {
  const A = S.agents;
  if (!A) return;
  if (!agOn() && P.spd !== 'stop') {
    if (A.tracks.length || A.st || A.det.length) S.agents = agInit();
    return;
  }
  const lid = S.scanTick === S.tick;
  if (lid) {
    if (P.agents === 'learned') agDetectLearned();
    else agDetect();
  }
  if (agOn() && (lid || P.agents === 'truth')) agTrack();
  if (agOn() && lid) predTick();
  if (!agOn()) A.tracks = [];
}
function agentsPlan() {
  const A = S.agents;
  if (!A || (!agOn() && P.spd !== 'stop')) return;
  const lid = S.scanTick === S.tick;
  if (lid) {
    const conf = A.tracks.filter(t => t.conf);
    A.staticPts = conf.length ? S.scanPts.filter(p => !conf.some(t => hyp(p[0] - t.x, p[1] - t.y) < t.r + 0.25)) : S.scanPts;
    if (agOn()) stPlan();
    else {
      A.st = null;
      A.vlim = Infinity;
    }
    A.vlimStop = P.spd === 'stop' ? stReactive() : Infinity;
  }
}
// Cap the path tracker's speed (keeps the commanded curvature)
function agSpeedCap(c) {
  const A = S.agents;
  if (!A || !AG_PATH_CTL.includes(P.ctl) || S.fsm.state !== 'DRIVE' || !S.track) return c;
  const lim = P.spd === 'st' && agOn() ? A.vlim : P.spd === 'stop' ? A.vlimStop : Infinity;
  const v = Math.abs(c.v || 0);
  if (!(lim < v)) return c;
  const f = v > 1e-9 ? lim / v : 0,
    o = {...c, v: c.v * f};
  if (!isCar() && o.w != null) o.w = c.w * f;
  return o;
}
// @code vo | agVO: velocity obstacles, the tracker's command checked against every person's cone and moved out of it
// Velocity obstacles (Fiorini & Shiller 1998): for each tracked person, the set of robot velocities that collide with
// the person within τ, assuming the person keeps their velocity, is a cone in velocity space. The tracker's command is
// a velocity; if it lies in any cone, the nearest velocity outside all of them is taken from a sampled set of speeds
// and headings, and realized as a speed and a turn toward that heading. The people's own reaction is not modelled
// (that is reciprocal VO), so two reacting parties can dance.
function voHits(ux, uy, ax, ay, vx, vy, R, tau) {
  // the first time t in (0, τ] at which the robot moving at (ux, uy) from the origin meets the disc of radius R
  // centred at (ax, ay) moving at (vx, vy): the smaller root of |d − t w|² = R², w the relative velocity
  const wx = ux - vx,
    wy = uy - vy,
    dd = ax * ax + ay * ay;
  if (dd <= R * R) return wx * ax + wy * ay > 0 ? 0 : Infinity; // already overlapping: blocked unless moving apart
  const ww = wx * wx + wy * wy,
    dw = ax * wx + ay * wy;
  if (ww < 1e-9 || dw <= 0) return Infinity; // not moving relative to it, or moving away
  const disc = dw * dw - ww * (dd - R * R);
  if (disc < 0) return Infinity; // the ray misses the disc
  const t = (dw - Math.sqrt(disc)) / ww;
  return t <= tau ? t : Infinity;
}
function agVO(c) {
  S.vo = null;
  if (P.spd !== 'vo' || !agOn() || !AG_PATH_CTL.includes(P.ctl) || S.fsm.state !== 'DRIVE' || !S.track) return c;
  const ags = agList(8);
  if (!ags.length) return c;
  const e = S.est,
    tau = P.voT,
    th = e.th,
    v0 = c.v || 0,
    sp = Math.abs(v0),
    dir = v0 < 0 ? -1 : 1,
    cones = ags.map(t => ({ax: t.x - e.x, ay: t.y - e.y, vx: t.vx, vy: t.vy, R: RR + t.r + P.voMargin, id: t.id}));
  const free = (ux, uy) => {
    let tmin = Infinity;
    for (const k of cones) tmin = Math.min(tmin, voHits(ux, uy, k.ax, k.ay, k.vx, k.vy, k.R, tau));
    return tmin;
  };
  const hx = Math.cos(th) * dir,
    hy = Math.sin(th) * dir,
    ux0 = sp * hx,
    uy0 = sp * hy,
    t0 = free(ux0, uy0);
  S.vo = {cones, tau, pref: [ux0, uy0], pick: null, tHit: t0, dir};
  if (!isFinite(t0) || sp < 1e-3) return c; // the command is outside every cone: nothing to do
  // the sampled candidates: speeds down from the command, headings up to 90° either side; the nearest free one wins,
  // with a small preference for the heading chosen last tick (no dithering between two equal detours)
  let best = null,
    bc = Infinity;
  const last = S.voLast || 0;
  // the last candidate speed is a slow reverse: in an aisle, against someone walking at you, the only free velocity
  for (const f of [1, 0.75, 0.5, 0.25, -0.4]) {
    const s2 = sp * f;
    for (let k = -9; k <= 9; k++) {
      if (f < 0 && k !== 0) continue; // reverse: straight back only
      const dth = k * (Math.PI / 18),
        a = th + dir * dth,
        ux = s2 * Math.cos(a) * dir,
        uy = s2 * Math.sin(a) * dir;
      if (!isFinite(free(ux, uy))) {
        // free: no cone is entered within τ
        const cost = (ux - ux0) ** 2 + (uy - uy0) ** 2 + 0.03 * Math.abs(dth) + 0.02 * Math.abs(dth - last);
        if (cost < bc) {
          bc = cost;
          best = {s: s2, dth, ux, uy};
        }
      }
    }
  }
  S.voN = (S.voN || 0) + 1;
  if (!best) {
    // every sampled velocity collides within τ: stop, keep steering (the person is expected to pass)
    S.voLast = 0;
    S.vo.pick = [0, 0];
    S.voStops = (S.voStops || 0) + 1;
    return isCar() ? {...c, v: 0} : {...c, v: 0, w: 0};
  }
  S.voLast = best.dth;
  S.vo.pick = [best.ux, best.uy];
  // the heading change becomes a turn over about half a second, added to the tracker's own turn
  const wAdd = clamp(best.dth / 0.5, -P.wmax, P.wmax),
    v = dir * best.s;
  if (isCar()) {
    const sm = steerMax(),
      st = clamp((c.steer || 0) + Math.atan((P.wheelbase * wAdd) / Math.max(0.2, best.s)), -sm, sm);
    return {...c, v, steer: st};
  }
  return {...c, v, w: clamp((c.w || 0) + wAdd, -P.wmax, P.wmax)};
}
// @end
// The controller's own prediction of the ego, for the map and the ST graph
function agPost() {
  const A = S.agents;
  if (!A) return;
  A.egoPath = null;
  if (!agOn() || !S.track) return;
  const V = S.ctlViz;
  if (P.ctl === 'mpc' && V && V.pred) A.egoPath = {pts: V.pred, dt: P.mpcDt, src: 'MPC prediction'};
  else if (P.ctl === 'dwa' && V && V.trajs && V.best >= 0) {
    const q = V.trajs[V.best].pts,
      pts = [];
    for (let i = 0; i < q.length; i += 2) pts.push([q[i], q[i + 1]]);
    A.egoPath = {pts, dt: 0.2, src: 'DWA rollout'};
  }
}
// Ego positions at whole seconds: from the speed plan (path trackers) or the local planner's own prediction (DWA, MPC)
function agEgoMarks() {
  const A = S.agents,
    out = [];
  if (!A || !S.track) return out;
  if (A.egoPath) {
    const {pts, dt} = A.egoPath;
    for (let t = 1; t * 1 <= (pts.length - 1) * dt + 1e-6; t++) {
      const i = Math.round(t / dt);
      if (i < pts.length) out.push([pts[i][0], pts[i][1], t]);
    }
    return out;
  }
  if (stActive() && A.st && A.st.prof && A.st.pathId === S.pathId) {
    const st = A.st;
    for (let t = 1; t <= st.nt * st.dt + 1e-6; t++) {
      const k = Math.round(t / st.dt);
      if (k > st.nt) break;
      const p = pointAt(st.s0 + st.prof[k][1]);
      out.push([p[0], p[1], t]);
    }
  }
  return out;
}
// Agent layer for the global planner: mark predicted positions over the next 2 s as occupied
function agCostLayer() {
  const ags = agListModes(30);
  if (!ags.length) return false;
  const cm = S.cm,
    occ = cm.occ;
  for (const a of ags)
    for (let tt = 0; tt <= 2.0001; tt += 0.5) {
      const q = agPred(a, tt),
        r = q[2];
      for (let j = cellI(q[1] - r); j <= cellI(q[1] + r); j++)
        for (let i = cellI(q[0] - r); i <= cellI(q[0] + r); i++) {
          if (i < 0 || j < 0 || i >= GW || j >= GH) continue;
          if (hyp((i + 0.5) * RES - q[0], (j + 0.5) * RES - q[1]) <= r) occ[j * GW + i] = 1;
        }
    }
  cm.dist = distanceTransform(occ);
  const d = cm.dist,
    inf = Math.max(P.infl, 0.01);
  for (let i = 0; i < NC; i++) {
    cm.lethal[i] = d[i] < LETHAL ? 1 : 0;
    const qq = (LETHAL + inf - d[i]) / inf;
    cm.pen[i] = d[i] < LETHAL ? 1 : qq > 0 ? qq * qq : 0;
  }
  return true;
}
// Exact clearance between the true body and a person (for the metric)
function bodyGap(r, p) {
  if (p.car) return Math.min(...carCircles(p).map(c => bodyGap(r, c)));
  if (!isCar()) return hyp(p.x - r.x, p.y - r.y) - RR - p.r;
  const c = Math.cos(r.th),
    s = Math.sin(r.th),
    hl = carLen() / 2,
    hw = CAR.width / 2,
    off = carLen() / 2 - CAR.rear,
    cx = r.x + off * c,
    cy = r.y + off * s;
  const dx = p.x - cx,
    dy = p.y - cy,
    lx = dx * c + dy * s,
    ly = -dx * s + dy * c;
  return hyp(lx - clamp(lx, -hl, hl), ly - clamp(ly, -hw, hw)) - p.r;
}
