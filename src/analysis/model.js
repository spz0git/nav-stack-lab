/* ============================================================
   Linear analysis of the lateral tracking loop
   Operating point: straight path, speed v₀ = cruise speed, small errors.
   Controller gains are read off the real controller code by finite differences.
   ============================================================ */
const AN = {
  mode: 'sim',
  loop: 'lat',
  adv: false,
  wi: null,
  curveR: 0,
  useEst: false,
  stepKind: 'offset',
  showCL: true,
  nyqScale: 'log',
  stepAmp: 0.2,
  injAmp: 'small',
  spdAmp: 0.2,
  meas: {step: null, freq: null, spd: null},
  play: null,
  why: false,
  busy: false,
  res: null,
  resSpd: null,
  dirty: true,
  msg: ''
};
const anCtl = () => (P.ctl === 'stanley' && !isCar() ? 'pp' : P.ctl);
const anSupported = () => ['pp', 'rwf', 'stanley', 'pid', 'mpc'].includes(anCtl());
const latN = () => Math.round(P.latency / DT);
const anV0 = () => Math.min(P.vcruise, P.vmax);
const CTL_NAMES = {
  pp: 'Pure pursuit',
  rwf: 'Rear-wheel feedback',
  stanley: 'Stanley',
  pid: 'PID',
  mpc: 'MPC',
  dwa: 'DWA',
  custom: 'Your code'
};

// ---- bench: straight path along +x at y = 0, no obstacles, ground-truth state, ideal odometry ----
const anR = () => AN.curveR || 0; // operating point: 0 = straight path, else a circle of this radius (left turn)
const anEst = () => AN.useEst && P.loc !== 'truth' && P.loc !== 'custom';
function benchTrack() {
  if (!anR())
    return [
      [-20, 0],
      [800, 0]
    ];
  const R = anR(),
    pts = [];
  for (let a = -0.6; a <= 12 * Math.PI; a += 0.02) pts.push([R * Math.sin(a), R - R * Math.cos(a)]);
  return pts;
}
function benchBeacons() {
  const out = [];
  if (!anEst()) return out;
  let id = 0;
  if (!anR()) {
    for (let x = -24; x <= 824; x += 4) for (const y of [-4, 4]) out.push({id: id++, x, y});
  } else {
    const R = anR();
    for (let x = -R - 8; x <= R + 8; x += 4)
      for (let y = -8; y <= 2 * R + 8; y += 4) {
        if (Math.abs(Math.hypot(x, y - R) - R) < 1) continue;
        out.push({id: id++, x, y});
      }
  }
  return out;
}
function benchErr(B) {
  if (!anR()) return B.robot.y;
  const R = anR();
  return R - Math.hypot(B.robot.x, B.robot.y - R);
} // lateral error, left of the path positive
function benchPose(B, e, th) {
  const r = B.robot;
  if (!anR()) {
    r.y = e;
    r.th = th;
  } else {
    const R = anR(),
      a = Math.atan2(r.x, R - r.y),
      rr = R - (B.ess || 0) - e;
    r.x = rr * Math.sin(a);
    r.y = R - rr * Math.cos(a);
    r.th = wrap(a + th);
  }
  B.est = {x: r.x, y: r.y, th: r.th};
}
function benchSettle(B) {
  // run to the operating point: on a curve, or with an estimator, the loop needs time to settle
  B.ess = 0;
  if (!anR() && !anEst()) return;
  inBench(B, () => {
    for (let i = 0; i < Math.round((anR() ? 12 : 8) / DT); i++) benchTick(B, null);
  });
  B.ess = benchErr(B);
  B.t = 0;
  B.tick = 0;
  B.coll = 0;
}
function makeBench(v0, y0, th0) {
  const B = {
    t: 0,
    tick: 0,
    rngW: makeRng(1),
    rngA: makeRng(2),
    shapes: [],
    peds: [],
    beacons: benchBeacons(),
    robot: {x: 0, y: y0, th: th0, v: v0, w: 0, wa: 0, d: 0, vy: 0, r: 0, contact: false, pedContact: false},
    cmd: {v: v0, w: 0, steer: 0},
    cmdQ: [],
    odo: {v: v0, w: 0},
    est: {x: 0, y: y0, th: th0},
    Pc: null,
    pf: null,
    scanPts: [],
    lastZ: [],
    fsm: {state: 'DRIVE', queue: [0], lastPlanT: 0, lastBlockT: 0, prog: {t: 0, x: 0, y: 0}, fails: 0},
    track: null,
    plan: null,
    segIdx: 0,
    pathId: 100000,
    search: null,
    ctlViz: null,
    ctlState: {I: 0, prev: null},
    log: [],
    coll: 0,
    collPed: 0,
    dist: 0,
    errSq: 0,
    errN: 0,
    cteSq: 0,
    cteN: 0,
    nees: [],
    plot: [],
    trailT: [],
    trailE: [],
    mpc: null,
    mpcStats: null,
    rejected: 0,
    ess: 0
  };
  if (anEst())
    inBench(B, () => {
      initLoc(true);
    });
  return B;
}
function inBench(B, fn) {
  const saved = S;
  S = B;
  try {
    if (!B.track) setTrack(benchTrack());
    return fn();
  } finally {
    S = saved;
  }
}
// @code bench-tick | benchTick: one tick of the nonlinear bench the linear model is checked against
function benchTick(B, inj) {
  B.tick++;
  B.t += DT;
  actuate();
  if (anEst()) {
    odometry();
    locPredict();
    if (B.tick % 4 === 1) {
      const z = senseBeacons();
      B.lastZ = z;
      if (P.loc === 'ekf') ekfUpdate(z);
      else if (P.loc === 'pf') pfUpdate(z);
      else if (P.loc === 'slam') slamUpdate(z);
    }
  } else {
    B.odo = {v: B.robot.v, w: B.robot.w};
    B.est = {x: B.robot.x, y: B.robot.y, th: B.robot.th};
  }
  let c = normCmd(builtinCmd()),
    uc = null;
  if (inj) {
    const d = inj(B.t),
      mpc = anCtl() === 'mpc';
    if (mpc) {
      uc = B.mpc ? B.mpc.uPrev[1] : 0;
      if (isCar()) c.steer += d * DT;
      else c.w += d * DT;
      if (B.mpcCmd) {
        if (isCar()) B.mpcCmd.steer = c.steer;
        else B.mpcCmd.w = c.w;
      }
    } // the injected rate enters the command integrator
    else {
      uc = isCar() ? c.steer : c.w;
      if (isCar()) c.steer += d;
      else c.w += d;
    }
    if (isCar()) c.w = (c.v * Math.tan(c.steer)) / P.wheelbase;
  }
  applyCmd(c);
  return uc;
}
// @end
function benchPrime(B) {
  for (let i = 0; i < latN(); i++) B.cmdQ.push({v: B.robot.v, w: 0, steer: 0});
}

// ---- controller gains at the operating point ----
// @code an-gains | anGains: the controller gains at the operating speed
function anGains(v0) {
  const ctl = anCtl(),
    car = isCar(),
    h = 1e-3,
    B = makeBench(v0, 0, 0);
  const est = AN.useEst;
  AN.useEst = false; // gains are read with ground truth; the estimator enters through the experiments
  try {
    benchSettle(B);
    return inBench(B, () => {
      const x0 = B.robot.x,
        y0 = B.robot.y,
        th0 = B.robot.th,
        d0 = B.robot.d,
        w0 = B.robot.w,
        vy0 = B.robot.vy || 0,
        r0 = B.robot.r || 0;
      const out = (e, th, s, sc, up, dv, dr) => {
        B.robot.x = x0;
        B.robot.y = y0;
        B.robot.th = th0;
        benchPose(B, e, th);
        B.robot.v = v0;
        B.robot.d = car ? d0 + s : 0;
        B.robot.vy = vy0 + (dv || 0);
        B.robot.r = r0 + (dr || 0);
        const w = car ? (v0 * Math.tan(B.robot.d)) / P.wheelbase : w0 + s;
        B.robot.w = w;
        B.odo = {v: v0, w};
        B.ctlState = {I: 0, prev: null};
        const scc = (car ? d0 : w0) + sc;
        B.cmd = {v: v0, w: scc, steer: scc};
        if (ctl === 'mpc') {
          const it = P.mpcIt;
          P.mpcIt = 25;
          const last = () => {
            B.mpcCmd = {v: v0, steer: car ? scc : 0, w: car ? 0 : scc, tick: B.tick - 1};
          }; // as if the MPC ran last tick
          try {
            B.mpc = null;
            last();
            ctlMPC();
            if (up) {
              B.mpc.uPrev = [0, up];
              last();
              ctlMPC();
            }
          } finally {
            P.mpcIt = it;
          }
          return B.mpc.uPrev[1];
        }
        const c = normCmd(builtinRaw());
        return car ? c.steer : c.w;
      };
      const d = f => (f(h) - f(-h)) / (2 * h);
      const K = {e: -d(x => out(x, 0, 0, 0, 0)), th: -d(x => out(0, x, 0, 0, 0))};
      if (ctl === 'mpc') {
        K.s = -d(x => out(0, 0, x, 0, 0));
        K.c = -d(x => out(0, 0, 0, x, 0));
        K.u = d(x => out(0, 0, 0, 0, x));
        if (mpcTyres()) {
          K.vy = -d(x => out(0, 0, 0, 0, 0, x, 0));
          K.r = -d(x => out(0, 0, 0, 0, 0, 0, x));
        }
      } // the MPC with the tyre model also feeds back v_y and r
      K.ess = B.ess;
      return K;
    });
  } finally {
    AN.useEst = est;
  }
}
// @end

// ---- the car with tyre slip: δ → [v_y, r] by the linear bicycle model at v₀ (dynLin, core/vehicle.js), θ̇ₑ = r and
// ė = v₀ θₑ + v_y − l_r r (the rear axle's sideways velocity). The exact discretization of [v_y, r, θₑ, e] over one
// tick with δ held (ZOH) drives the 20 Hz loop (stepLin) and L(e^{sT}) (Lparts); the continuous polynomials
// (yaw rate G_r = nr/det, lateral velocity G_vy = nvy/det) give the transfer function's text and open-loop poles ----
function dynPlant(v0) {
  const {A, B} = dynLin(v0),
    lr = dynInfo().lr,
    [[a, b], [c, d]] = A,
    [b1, b2] = B;
  const E = expm(
    [
      [a, b, 0, 0, b1],
      [c, d, 0, 0, b2],
      [0, 1, 0, 0, 0],
      [1, -lr, v0, 0, 0],
      [0, 0, 0, 0, 0]
    ].map(r => r.map(x => x * DT))
  );
  const nr = [c * b1 - a * b2, b2],
    nvy = [b * b2 - d * b1, b1],
    det = [a * d - b * c, -(a + d), 1];
  // u → e and u → θₑ as numerators over s²·det: PE = v₀ nr + s (nvy − l_r nr), PT = s nr
  return {
    A,
    B,
    lr,
    nr,
    nvy,
    det,
    P: pRoots(det).filter(z => z[0] > 1e-9).length,
    PE: pAdd(pScale(nr, v0), pMul([0, 1], pAdd(nvy, pScale(nr, -lr)))),
    PT: pMul([0, 1], nr),
    Phi: E.slice(0, 4).map(r => r.slice(0, 4)),
    Gam: E.slice(0, 4).map(r => r[4])
  };
}

// ---- model: L(s) = N(s)/D(s) · e^{−sT_d} · M(s);  M = 1/(1 − K_u e^{−sT}) for the MPC ----
function anBuild() {
  const ctl = anCtl(),
    car = isCar(),
    T = DT,
    v0 = anV0(),
    g = car ? v0 / P.wheelbase : 1,
    tau = P.lag,
    nL = latN();
  const M = {
    ctl,
    car,
    T,
    v0,
    g,
    tau,
    aL: tau > 0 ? 1 - Math.exp(-T / tau) : 1,
    nL,
    Td: T / 2 + nL * T,
    kind: 'none',
    dyn: car && isDyn() ? dynPlant(v0) : null
  };
  if (!anSupported()) return M;
  const actD = tau > 0 ? [1, tau] : [1];
  if (ctl === 'pid') {
    M.kind = 'pid';
    M.Ld = Math.max(0.1, P.ppL0 + P.ppK * v0);
    const Cn = [P.ki, P.kp, P.kd];
    M.N = pScale(pMul(Cn, [v0 / M.Ld, 1]), g);
    M.D = pMul([0, 0, 0, 1], actD);
    M.Ne = pScale(Cn, (g * v0) / M.Ld);
  } else if (ctl === 'mpc') {
    const K = anGains(v0);
    M.kind = 'mpc';
    M.K = K;
    M.ess = K.ess;
    M.lagModel = P.mpcLag && tau > 0;
    if (!M.lagModel) K.c = 0;
    // u̇ = −(K_e e + K_θ θₑ + K_s s + K_c s_cmd) + K_u u̇_prev ;  s_cmd = ∫u̇ ;  s = s_cmd/(τs+1)
    M.N = pAdd(pMul([0, 0, K.c], actD), [g * K.e * v0, g * K.th, K.s]);
    M.D = pMul([0, 0, 0, 1], actD);
    M.Ne = [g * K.e * v0];
  } else {
    const K = anGains(v0);
    M.kind = 'static';
    M.Ke = K.e;
    M.Kth = K.th;
    M.ess = K.ess;
    M.N = [g * K.e * v0, g * K.th];
    M.D = pMul([0, 0, 1], actD);
    M.Ne = [g * K.e * v0];
  }
  if (M.dyn) {
    const {PE, PT, det} = M.dyn,
      K = M.K; // the same loops with the tyres' yaw dynamics in the plant
    if (M.kind === 'static') {
      M.N = pAdd(pScale(PE, M.Ke), pScale(PT, M.Kth));
      M.D = pMul(pMul([0, 0, 1], det), actD);
      M.Ne = pScale(PE, M.Ke);
    } else if (M.kind === 'pid') {
      const Cn = [P.ki, P.kp, P.kd];
      M.N = pMul(Cn, pAdd(pScale(PE, 1 / M.Ld), PT));
      M.D = pMul(pMul([0, 0, 0, 1], det), actD);
      M.Ne = pMul(Cn, pScale(PE, 1 / M.Ld));
    } else {
      M.N = pAdd(pAdd(pMul(pMul([0, 0, K.c], actD), det), pMul([0, 0, K.s], det)), pAdd(pScale(PE, K.e), pScale(PT, K.th)));
      M.D = pMul(pMul([0, 0, 0, 1], det), actD);
      M.Ne = pScale(PE, K.e);
      if (K.vy != null) M.N = pAdd(M.N, pMul([0, 0, 1], pAdd(pScale(M.dyn.nvy, K.vy), pScale(M.dyn.nr, K.r))));
    }
  }
  return M;
}
// Loop transfer at complex s. The vehicle is continuous (two integrators) behind a zero-order hold
// (delay T/2 + latency). Controller and actuator elements that run in the 20 Hz loop are evaluated
// exactly at z = e^{sT}: the discrete lag a/(1−(1−a)z⁻¹), the PID's rectangular integral and
// backward difference, and the MPC's rate integrator T/(1−z⁻¹) and memory 1/(1−K_u z⁻¹).
// @code loop-parts | Lparts: the open-loop transfer function, factor by factor
function Lparts(M, s) {
  const g = M.g,
    v = M.v0,
    zi = Cx.exp(Cx.scale(s, -M.T)),
    one = [1, 0],
    s2 = Cx.mul(s, s);
  const zh = Cx.exp(Cx.scale(s, -M.T / 2)),
    lat = Cx.exp(Cx.scale(s, -M.nL * M.T)); // hold delay T/2 on vehicle paths; latency on everything through the actuator
  const lag = M.tau > 0 ? Cx.div([M.aL, 0], Cx.sub(one, Cx.scale(zi, 1 - M.aL))) : one;
  let plantE = Cx.mul(zh, Cx.div([g * v, 0], s2)),
    plantTh = Cx.mul(zh, Cx.div([g, 0], s)),
    plantVy = null,
    plantR = null; // u → e and u → θₑ (and u → v_y, r with tyres)
  if (M.dyn) {
    // car with tyre slip: the exact sampled plant C (zI − Φ)⁻¹ Γ, z = e^{sT} (it holds δ over the tick itself, so no T/2;
    // the hold-as-delay approximation above is good for two integrators but not for tyre poles near the Nyquist frequency)
    const D = M.dyn,
      z = Cx.exp(Cx.scale(s, M.T)),
      X = cxSolve(
        D.Phi.map((r, i) => r.map((x, j) => (i === j ? [z[0] - x, z[1]] : [-x, 0]))),
        D.Gam.map(x => [x, 0])
      );
    plantTh = X[2];
    plantE = X[3];
    plantVy = X[0];
    plantR = X[1];
  }
  let L, Le;
  if (M.kind === 'static') {
    const A = Cx.mul(lag, lat);
    L = Cx.mul(A, Cx.add(Cx.scale(plantE, M.Ke), Cx.scale(plantTh, M.Kth)));
    Le = Cx.mul(A, Cx.scale(plantE, M.Ke));
  } else if (M.kind === 'pid') {
    const T = M.T,
      omz = Cx.sub(one, zi),
      C = Cx.add(Cx.add([P.kp, 0], Cx.div([P.ki * T, 0], omz)), Cx.scale(omz, P.kd / T));
    const A = Cx.mul(Cx.mul(lag, lat), C);
    L = Cx.mul(A, Cx.add(Cx.scale(plantE, 1 / M.Ld), plantTh));
    Le = Cx.mul(A, Cx.scale(plantE, 1 / M.Ld));
  } else {
    const K = M.K,
      integ = Cx.div([M.T, 0], Cx.sub(one, zi)),
      mem = Cx.div(one, Cx.sub(one, Cx.scale(zi, K.u))),
      pre = Cx.mul(integ, mem),
      A = Cx.mul(lag, lat);
    // the controller reads its own last command (K_c) and the actuator position (K_s) one tick later: z⁻¹
    let inner = Cx.add(Cx.scale(zi, K.s), Cx.add(Cx.scale(plantE, K.e), Cx.scale(plantTh, K.th)));
    if (K.vy != null && plantVy) inner = Cx.add(inner, Cx.add(Cx.scale(plantVy, K.vy), Cx.scale(plantR, K.r)));
    L = Cx.mul(pre, Cx.add(Cx.scale(zi, K.c), Cx.mul(A, inner)));
    Le = Cx.mul(pre, Cx.mul(A, Cx.scale(plantE, K.e)));
  }
  return {L, Le};
}
// @end
function Ls(M, s) {
  return Lparts(M, s).L;
}
function Ljw(M, w) {
  return Ls(M, [0, w]);
}

// ---- exact discrete loop at the simulation rate (ZOH, sample delay, latency queue) ----
function linLayout(M) {
  let i = 3;
  const L = {y: 0, psi: 1, sa: 2};
  if (M.dyn) {
    L.vy = i++;
    L.r = i++;
  }
  if (M.kind === 'mpc') L.sc = i++;
  if (M.kind === 'pid') {
    if (P.ki !== 0) L.I = i++;
    L.pv = i++;
  }
  if (M.kind === 'mpc') L.up = i++;
  L.q0 = i;
  L.n = i + M.nL + 1;
  return L;
}
function stepLin(M, L, X, k, d, r) {
  const T = M.T,
    v0 = M.v0,
    g = M.g,
    x = X.slice();
  const sa = x[L.sa] + (x[L.q0] - x[L.sa]) * M.aL;
  x[L.sa] = sa;
  const se = sa + d,
    psi = x[L.psi];
  if (M.dyn) {
    const D = M.dyn,
      z = [x[L.vy], x[L.r], psi, x[L.y]],
      o = [L.vy, L.r, L.psi, L.y];
    for (let i = 0; i < 4; i++) {
      let s = D.Gam[i] * se;
      for (let j = 0; j < 4; j++) s += D.Phi[i][j] * z[j];
      x[o[i]] = s;
    }
  } else {
    x[L.psi] = psi + g * se * T;
    x[L.y] = x[L.y] + v0 * (psi * T + 0.5 * g * se * T * T);
  }
  for (let j = 0; j < M.nL; j++) x[L.q0 + j] = x[L.q0 + j + 1];
  const e = x[L.y] - r,
    th = x[L.psi];
  let c;
  if (M.kind === 'static') c = -k * (M.Ke * e + M.Kth * th);
  else if (M.kind === 'pid') {
    const al = -(e / M.Ld + th);
    let I = 0;
    if (L.I != null) {
      x[L.I] += al * T;
      I = x[L.I];
    }
    const D = (al - x[L.pv]) / T;
    x[L.pv] = al;
    c = k * (P.kp * al + P.ki * I + P.kd * D);
  } else {
    const K = M.K,
      sm = M.car ? sa : sa + d,
      ty = K.vy != null && M.dyn ? K.vy * x[L.vy] + K.r * x[L.r] : 0;
    const sd = k * (-(K.e * e + K.th * th + K.s * sm + K.c * x[L.sc] + ty) + K.u * x[L.up]);
    x[L.up] = sd;
    c = x[L.sc] + sd * T;
    x[L.sc] = c;
  }
  x[L.q0 + M.nL] = c;
  return x;
}
function clMatrix(M, L, k) {
  const A = [];
  for (let i = 0; i < L.n; i++) A.push(new Array(L.n).fill(0));
  for (let j = 0; j < L.n; j++) {
    const X = new Array(L.n).fill(0);
    X[j] = 1;
    const Y = stepLin(M, L, X, k, 0, 0);
    for (let i = 0; i < L.n; i++) A[i][j] = Y[i];
  }
  return A;
}
const zToS = (z, T) => {
  const r = Cx.abs(z);
  return r < 1e-9 ? null : [Math.log(r) / T, Cx.arg(z) / T];
};
function linResponse(M, L, kind, tEnd) {
  // e(t) per unit offset (kind 'offset') or per unit actuator bias ('bias')
  let X = new Array(L.n).fill(0);
  const out = [[0, kind === 'offset' ? 1 : 0]];
  if (kind === 'offset') {
    X[L.y] = 1;
    if (M.kind === 'pid') X[L.pv] = -1 / M.Ld;
  }
  const d = kind === 'bias' ? 1 : 0,
    N = Math.round(tEnd / M.T);
  for (let k = 1; k <= N; k++) {
    X = stepLin(M, L, X, 1, d, 0);
    out.push([k * M.T, X[L.y]]);
  }
  return out;
}
// @code step-metrics | stepMetrics: overshoot, rise and settling time from a response
function stepMetrics(resp, kind) {
  const n = resp.length,
    fin = resp.slice(Math.floor(n * 0.85)).reduce((a, p) => a + p[1], 0) / Math.ceil(n * 0.15);
  if (kind === 'offset') {
    let mn = 0,
      t90 = null,
      t10 = null,
      ts = 0;
    for (const [t, e] of resp) {
      if (e < mn) mn = e;
      if (t90 == null && e <= 0.9) t90 = t;
      if (t10 == null && e <= 0.1) t10 = t;
      if (Math.abs(e) > 0.02) ts = t;
    }
    return {overshoot: Math.max(0, -mn) * 100, rise: t10 != null && t90 != null ? t10 - t90 : null, settle: ts, final: fin};
  }
  let pk = 0,
    ts = 0;
  for (const [t, e] of resp) if (Math.abs(e) > Math.abs(pk)) pk = e;
  for (const [t, e] of resp) if (Math.abs(e - fin) > 0.02 * Math.max(Math.abs(pk), 1e-9)) ts = t;
  return {peak: pk, settle: ts, final: fin};
}
// @end

// ---- margins, sensitivity peak, Nyquist encirclements ----
// @code an-freq | anFreq: the Bode and Nyquist points, crossover and the margins
function anFreq(M) {
  const wN = Math.PI / M.T,
    ws = [];
  for (let i = 0; i <= 700; i++) ws.push(Math.pow(10, -2 + (i * (Math.log10(wN) + 2)) / 700));
  const pts = ws.map(w => {
    const L = Ljw(M, w);
    return {w, L, mag: Cx.abs(L), ph: Cx.arg(L)};
  });
  let off = 0;
  for (let i = 0; i < pts.length; i++) {
    if (i) {
      let dph = pts[i].ph - pts[i - 1].ph;
      while (dph > Math.PI) dph -= 2 * Math.PI;
      while (dph < -Math.PI) dph += 2 * Math.PI;
      pts[i].phu = pts[i - 1].phu + dph;
    } else pts[i].phu = pts[i].ph;
  }
  // unwrap so that low frequency sits near its asymptote (−90° per integrator)
  const nInt = M.kind === 'static' ? 2 : 3,
    target = (-nInt * Math.PI) / 2;
  let k = Math.round((target - pts[0].phu) / (2 * Math.PI));
  pts.forEach(p => (p.phu += 2 * Math.PI * k));
  let wc = null,
    pm = null,
    gm = null,
    w180 = null,
    gmN = null,
    w180N = null;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1],
      b = pts[i];
    if ((a.mag - 1) * (b.mag - 1) <= 0 && a.mag !== b.mag) {
      const f = Math.log(a.mag) / (Math.log(a.mag) - Math.log(b.mag)),
        w = a.w * Math.pow(b.w / a.w, f),
        ph = a.phu + (b.phu - a.phu) * f;
      let m = (((((ph * 180) / Math.PI + 180) % 360) + 540) % 360) - 180;
      if (pm == null || m < pm) {
        pm = m;
        wc = w;
      }
    }
    for (let q = -41; q <= 1; q += 2) {
      const lv = q * Math.PI;
      if ((a.phu - lv) * (b.phu - lv) < 0 && a.w > 0.02) {
        const f = (a.phu - lv) / (a.phu - b.phu),
          w = a.w * Math.pow(b.w / a.w, f),
          mg = Math.exp(Math.log(a.mag) + (Math.log(b.mag) - Math.log(a.mag)) * f);
        const g = -20 * Math.log10(mg);
        if (mg < 1 && (gm == null || g < gm)) {
          gm = g;
          w180 = w;
        }
        if (mg >= 1 && w > 0.05 && (gmN == null || g > gmN)) {
          gmN = g;
          w180N = w;
        }
      }
    }
  }
  let ms = 0;
  for (const p of pts) {
    const s = 1 / Cx.abs(Cx.add([1, 0], p.L));
    if (s > ms) ms = s;
  }
  const dm = pm != null && wc ? (pm * Math.PI) / 180 / wc : null;
  // Nyquist: change of arg(1+L) along the indented contour (clockwise); P = 0 open-loop RHP poles
  const argAlong = list => {
    let tot = 0,
      prev = null;
    for (const s of list) {
      const a = Cx.arg(Cx.add([1, 0], Ls(M, s)));
      if (prev != null) {
        let d = a - prev;
        while (d > Math.PI) d -= 2 * Math.PI;
        while (d < -Math.PI) d += 2 * Math.PI;
        tot += d;
      }
      prev = a;
    }
    return tot;
  };
  // the car with tyre slip uses the exact sampled plant, which repeats every 2π/T: its contour is the unit circle (ω up to π/T)
  const eps = 1e-3,
    wTop = M.dyn ? Math.log10(Math.PI / M.T) : 5,
    up = [];
  for (let i = 0; i <= 3000; i++) up.push([0, Math.pow(10, Math.log10(eps) + (i * (wTop - Math.log10(eps))) / 3000)]);
  const arc = [];
  for (let i = 0; i <= 400; i++) {
    const ph = -Math.PI / 2 + (Math.PI * i) / 400;
    arc.push([eps * Math.cos(ph), eps * Math.sin(ph)]);
  }
  const dTot = 2 * argAlong(up) + argAlong(arc),
    Ncw = Math.round(-dTot / (2 * Math.PI)),
    Pol = M.dyn ? M.dyn.P : 0; // P: open-loop unstable poles (an oversteering car above v_crit)
  if (Ncw + Pol !== 0 && gmN != null) {
    gm = gmN;
    w180 = w180N;
  } // unstable: negative GM = gain reduction needed
  return {pts, wc, pm, gm, w180, ms, dm, Ncw, P: Pol, wN};
}
// @end
function anCompute() {
  const M = anBuild();
  const R = {M};
  if (M.kind === 'none') {
    AN.res = R;
    return R;
  }
  const L = linLayout(M);
  R.L = L;
  const ev = eig(clMatrix(M, L, 1));
  R.zs = ev;
  R.unstableZ = ev.filter(z => Cx.abs(z) > 1 + 1e-7).length;
  R.poles = ev.map(z => zToS(z, M.T)).filter(Boolean);
  // dominant pole: slowest (largest real part) among those not at the pure delays
  let dom = null;
  for (const s of R.poles) {
    if (s[1] < -1e-9 || Math.hypot(s[0], s[1]) < 1e-6) continue;
    if (!dom || s[0] > dom[0] || (Math.abs(s[0] - dom[0]) < 1e-6 && s[1] > dom[1])) dom = s;
  }
  R.dom = dom;
  if (dom) {
    const wn = Math.hypot(dom[0], dom[1]);
    R.wn = wn;
    R.zeta = wn > 0 ? -dom[0] / wn : 1;
  }
  // root locus over a loop-gain multiplier k
  R.locus = [];
  for (let i = 0; i <= 48; i++) {
    const k = Math.pow(10, -1.2 + (2.4 * i) / 48);
    for (const z of eig(clMatrix(M, L, k))) {
      const s = zToS(z, M.T);
      if (s) R.locus.push([s[0], s[1], k]);
    }
  }
  R.F = anFreq(M);
  // open-loop poles and zeros of the rational part
  R.olp = pRoots(pMul(M.D, M.kind === 'mpc' ? [1] : [1]));
  R.olz = pRoots(M.N);
  const tEnd =
    R.zeta != null && R.wn && R.zeta <= 0.02
      ? Math.min(20, Math.max(3, (10 * 2 * Math.PI) / R.wn))
      : Math.min(20, Math.max(4, R.zeta && R.wn ? 6 / Math.max(0.2, R.zeta * R.wn) : 10));
  R.tEnd = tEnd;
  R.step = linResponse(M, L, 'offset', tEnd);
  R.bias = linResponse(M, L, 'bias', tEnd);
  R.smOff = stepMetrics(R.step, 'offset');
  R.smBias = stepMetrics(R.bias, 'bias');
  R.stable = R.unstableZ === 0;
  AN.res = R;
  return R;
}

// ---- experiments in the full nonlinear simulator ----
function biasUnit() {
  return isCar()
    ? {k: 'biasDeg', val: 2, unit: '°', toModel: v => (v * Math.PI) / 180}
    : {k: 'biasW', val: 0.1, unit: 'rad/s', toModel: v => v};
}
function runStepTest() {
  const R = AN.res,
    v0 = anV0(),
    kind = AN.stepKind,
    amp = AN.stepAmp,
    bu = biasUnit(),
    tEnd = R ? R.tEnd : 10;
  const B = makeBench(v0, 0, 0);
  benchPrime(B);
  benchSettle(B);
  if (kind === 'offset') inBench(B, () => benchPose(B, amp, 0));
  const saved = P[bu.k];
  if (kind === 'bias') P[bu.k] = bu.val;
  const out = [[0, kind === 'offset' ? 1 : 0]];
  let satT = 0,
    lastD = 0;
  // pose for the playback: [t, distance along the path, offset e, heading relative to the path, steering angle or turn rate]
  const R0 = anR(),
    ang = () => (R0 ? Math.atan2(B.robot.x, R0 - B.robot.y) : 0),
    u = () => (isCar() ? B.robot.d : B.robot.w);
  let a0 = ang(),
    aU = a0;
  const x0 = B.robot.x,
    along = () => {
      if (!R0) return B.robot.x - x0;
      let a = ang(),
        d = a - aU;
      while (d > Math.PI) d -= 2 * Math.PI;
      while (d < -Math.PI) d += 2 * Math.PI;
      aU += d;
      return R0 * (aU - a0);
    };
  const pose = [[0, 0, benchErr(B) - B.ess, wrap(B.robot.th - a0), u()]];
  try {
    inBench(B, () => {
      const N = Math.round(tEnd / DT);
      for (let i = 0; i < N; i++) {
        benchTick(B, null);
        const e = benchErr(B) - B.ess;
        if (isCar() && Math.abs(B.robot.d - lastD) / DT >= P.steerRate * 0.98) satT += DT;
        lastD = B.robot.d;
        out.push([B.t, kind === 'offset' ? e / amp : e / bu.toModel(bu.val)]);
        const s = along();
        pose.push([B.t, s, e, wrap(B.robot.th - (R0 ? aU : 0)), u()]);
      }
    });
  } finally {
    P[bu.k] = saved;
  }
  AN.meas.step = {kind, amp, data: out, pose, satT, coll: B.coll};
}
async function runInjection() {
  const R = AN.res;
  if (!R || !R.F || !R.F.wc) {
    AN.msg = 'Needs a crossover frequency to center the sweep.';
    return;
  }
  AN.busy = true;
  AN.meas.freq = [];
  renderAnalysis();
  const wc = R.F.wc,
    wN = Math.PI / DT,
    lo = wc / 6,
    hi = Math.min(wc * 6, 0.45 * wN),
    n = 9,
    big = AN.injAmp === 'large';
  const mpc = anCtl() === 'mpc',
    sAmp = (isCar() ? 0.02 : 0.05) * (big ? 10 : 1);
  for (let i = 0; i < n; i++) {
    const w = lo * Math.pow(hi / lo, i / (n - 1)),
      Tp = (2 * Math.PI) / w;
    const amp = mpc ? sAmp * w : sAmp;
    const B = makeBench(anV0(), 0, 0);
    benchPrime(B);
    benchSettle(B);
    const settle = Math.max(2 * Tp, 3),
      meas = Math.max(3 * Tp, 4),
      N1 = Math.round(settle / DT),
      N2 = Math.round((Math.ceil(meas / Tp) * Tp) / DT);
    let Uc = [0, 0],
      Up = [0, 0];
    inBench(B, () => {
      for (let k = 0; k < N1 + N2; k++) {
        const t = B.t + DT,
          dd = amp * Math.sin(w * t);
        const uc = benchTick(B, () => dd);
        if (k >= N1) {
          const ph = [Math.cos(w * t), -Math.sin(w * t)];
          Uc = Cx.add(Uc, Cx.scale(ph, uc));
          Up = Cx.add(Up, Cx.scale(ph, uc + dd));
        }
      }
    });
    const L = Cx.scale(Cx.div(Uc, Up), -1);
    AN.meas.freq.push({w, L, mag: Cx.abs(L), ph: Cx.arg(L)});
    AN.msg = `Measuring loop gain: ${i + 1}/${n} frequencies`;
    renderAnalysis();
    await new Promise(r => setTimeout(r, 0));
  }
  AN.busy = false;
  AN.msg = `Measured ${n} points by injecting a ${big ? 'large' : 'small'} sine at the actuator input.`;
  renderAnalysis();
}

// ---- what-if designs for Analyze: drag a closed-loop pole, get the gains that put it there ----
// The what-if loop is the same 20 Hz loop (hold delay, latency, actuator lag) with a state-feedback controller
// u = −(K_e e + K_θ θₑ). Without the delay its characteristic polynomial is s² + g K_θ s + g v₀ K_e.
function staticModel(M, Ke, Kth) {
  return {...M, kind: 'static', Ke, Kth, K: undefined, N: [M.g * Ke * M.v0, M.g * Kth], D: pMul([0, 0, 1], M.tau > 0 ? [1, M.tau] : [1])};
}
function domOf(ps) {
  let dom = null;
  for (const s of ps) {
    if (s[1] < -1e-9 || Math.hypot(s[0], s[1]) < 1e-6) continue;
    if (!dom || s[0] > dom[0] || (Math.abs(s[0] - dom[0]) < 1e-6 && s[1] > dom[1])) dom = s;
  }
  return dom;
}
function polesOf(M2) {
  const L = linLayout(M2),
    ev = eig(clMatrix(M2, L, 1));
  return {L, ev, ps: ev.map(z => zToS(z, M2.T)).filter(Boolean), unstable: ev.some(z => Cx.abs(z) > 1 + 1e-7)};
}
function nearestPole(ps, tg) {
  let b = null,
    bd = Infinity;
  for (const s of ps) {
    if (s[1] < -1e-9) continue;
    const d = Math.hypot(s[0] - tg[0], s[1] - tg[1]);
    if (d < bd) {
      bd = d;
      b = s;
    }
  }
  return b;
}
// two free gains: start from the delay-free formulas and correct the target until the real pole lands on it
// Pole placement for the delay-free two-integrator loop: s² + gK_θ s + g v K_e = 0, so a pair at damping ζ and natural
// frequency ω_n needs K_e = ω_n²/(g v) and K_θ = 2ζω_n/g; the target is the pair itself.
// @code lqr | placeGains and lqrGains: the design gains in closed form
function placeGains(M, zeta, wn) {
  const g = M.g,
    v = M.v0;
  return {Ke: (wn * wn) / (g * v), Kth: (2 * zeta * wn) / g, tg: [-zeta * wn, wn * Math.sqrt(Math.max(0, 1 - zeta * zeta))]};
}
// LQR for the same plant with cost ∫ q_e e² + q_θ θ² + r u² dt: the Riccati equation solves in closed form (chapter 6 §8),
// K_e = √(q_e/r), K_θ = √(q_θ/r + 2 v √(q_e/r) / g); the closed-loop pair follows from the gains.
function lqrGains(M, qe, qth, r) {
  const g = M.g,
    v = M.v0,
    Ke = Math.sqrt(qe / r),
    Kth = Math.sqrt(qth / r + (2 * v * Math.sqrt(qe / r)) / g),
    wn = Math.sqrt(g * v * Ke),
    zeta = (g * Kth) / (2 * wn);
  return {Ke, Kth, wn, zeta, tg: [-zeta * wn, wn * Math.sqrt(Math.max(0, 1 - Math.min(1, zeta * zeta)))]};
}
// @end
function placeTwo(M, tg) {
  let t = tg.slice(),
    best = null;
  for (let i = 0; i < 10; i++) {
    const wn2 = t[0] * t[0] + t[1] * t[1],
      Kth = (-2 * t[0]) / M.g,
      Ke = Math.max(0, wn2 / (M.g * M.v0)); // K_θ < 0 for a pole pair in the right half
    const r = polesOf(staticModel(M, Ke, Kth)),
      d = nearestPole(r.ps, tg);
    if (!d) break;
    const err = Math.hypot(d[0] - tg[0], d[1] - tg[1]);
    if (!best || err < best.err) best = {Ke, Kth, err};
    if (err < 1e-3 * Math.max(1, Math.hypot(tg[0], tg[1]))) break;
    t = [t[0] + 0.8 * (tg[0] - d[0]), Math.max(0, t[1] + 0.8 * (tg[1] - d[1]))];
  }
  if (!best) {
    const wn2 = tg[0] * tg[0] + tg[1] * tg[1];
    best = {Ke: Math.max(0, wn2 / (M.g * M.v0)), Kth: (-2 * tg[0]) / M.g, err: null};
  }
  return best;
}
// one-knob trackers: the curve their slowest pole pair follows as the knob turns (gains read from the code at each value)
function anKnobCurve(R) {
  const M = R.M;
  if (M.kind !== 'static') return null;
  const v = M.v0;
  let K;
  if (M.ctl === 'pp')
    K = {
      key: 'ppL0',
      sym: 'L_d',
      unit: 'm',
      lo: Math.max(0.1, 0.1 + P.ppK * v),
      hi: 2.5 + P.ppK * v,
      cur: Math.max(0.1, P.ppL0 + P.ppK * v),
      toParam: x => x - P.ppK * v,
      set: x => {
        P.ppL0 = x - P.ppK * v;
      },
      step: 0.05
    };
  else if (M.ctl === 'stanley')
    K = {
      key: 'stanK',
      sym: 'k',
      unit: '',
      lo: 0.1,
      hi: 8,
      cur: P.stanK,
      toParam: x => x,
      set: x => {
        P.stanK = x;
      },
      step: 0.1
    };
  else return null;
  const saved = P[K.key];
  K.pts = [];
  try {
    for (let i = 0; i <= 60; i++) {
      const x = K.lo * Math.pow(K.hi / K.lo, i / 60);
      K.set(x);
      const G = anGains(v),
        r = polesOf(staticModel(M, G.e, G.th));
      K.pts.push({x, Ke: G.e, Kth: G.th, dom: domOf(r.ps)});
    }
  } finally {
    P[K.key] = saved;
  }
  return K;
}
// rear-wheel feedback's linear gains per unit of k_e and k_θ (to turn a two-gain design into its settings)
function rwfUnits(v0) {
  const saved = {ctl: P.ctl, rwKe: P.rwKe, rwKth: P.rwKth};
  try {
    P.ctl = 'rwf';
    P.rwKe = 1;
    P.rwKth = 0;
    const a = anGains(v0);
    P.rwKe = 0;
    P.rwKth = 1;
    const b = anGains(v0);
    return {e: a.e, th0: a.th, th: b.th - a.th};
  } finally {
    Object.assign(P, saved);
  }
}
function anWhatIf(R, tg) {
  const M = R.M;
  let r;
  // a one-knob tracker cannot leave its curve, which stays in the left half: a target in the right half is shown as a
  // two-gain loop (rear-wheel feedback's form) with the gains that put it there
  if (R.knob && tg[0] <= 0) {
    let bi = -1,
      bd = Infinity;
    R.knob.pts.forEach((q, i) => {
      if (!q.dom) return;
      const d = Math.hypot(q.dom[0] - tg[0], q.dom[1] - tg[1]);
      if (d < bd) {
        bd = d;
        bi = i;
      }
    });
    if (bi < 0) return null;
    const q = R.knob.pts[bi];
    r = {Ke: q.Ke, Kth: q.Kth, x: q.x, tg: q.dom.slice(), knob: true};
  } else {
    const b = placeTwo(M, tg);
    r = {Ke: b.Ke, Kth: b.Kth, tg: tg.slice(), err: b.err, beyond: !!R.knob};
  }
  const M2 = staticModel(M, r.Ke, r.Kth),
    pr = polesOf(M2);
  r.ps = pr.ps;
  r.unstable = pr.unstable;
  r.dom = domOf(pr.ps);
  r.step = linResponse(M2, pr.L, 'offset', R.tEnd);
  r.bias = linResponse(M2, pr.L, 'bias', R.tEnd);
  r.sm = stepMetrics(r.step, 'offset');
  r.smB = stepMetrics(r.bias, 'bias');
  if (r.knob) {
    const pv = R.knob.toParam(r.x),
      st = R.knob.step,
      val = Math.round(pv / st) * st;
    r.set = {[R.knob.key]: +val.toFixed(2)};
    r.setTxt = `${R.knob.key === 'ppL0' ? 'L₀' : 'k'} = ${val.toFixed(2)}${R.knob.unit ? ' ' + R.knob.unit : ''}`;
  } else {
    const u = rwfUnits(M.v0),
      ke = u.e > 1e-9 ? r.Ke / u.e : 0,
      kth = u.th > 1e-9 ? (r.Kth - u.th0) / u.th : 0,
      cke = clamp(ke, 0, 12),
      ckth = clamp(kth, 0, 6);
    r.need = {ke, kth};
    r.applicable = ke >= -1e-6 && kth >= -1e-6; // the settings cannot go below 0: a negative gain steers away from the path
    r.set = {ctl: 'rwf', rwKe: +(Math.round(cke * 10) / 10).toFixed(1), rwKth: +(Math.round(ckth * 10) / 10).toFixed(1)};
    r.clamped = Math.abs(cke - ke) > 0.05 || Math.abs(ckth - kth) > 0.05;
    r.setTxt = `k_e = ${r.set.rwKe.toFixed(1)} 1/m², k_θ = ${r.set.rwKth.toFixed(1)} 1/m`;
  }
  return r;
}
