/* ============================================================
   Vehicle: actuator + unicycle integration
   ============================================================ */
function actuate() {
  const r = S.robot,
    c = S.cmd;
  let dyn = null;
  let vt = clamp(c.v, -0.5 * P.vmax, P.vmax),
    wt;
  if (isCar()) {
    // bicycle: command (v, δ) → lag → accel limit → steering-rate limit → ω = v tanδ / L
    const dm = steerMax();
    let st = clamp(c.steer || 0, -dm, dm);
    if (P.lag > 0) {
      const a = 1 - Math.exp(-DT / P.lag);
      vt = r.v + (vt - r.v) * a;
      st = r.d + (st - r.d) * a;
    }
    if (P.accel) vt = clamp(vt, r.v - P.amax * DT, r.v + P.amax * DT);
    r.d = clamp(st, r.d - P.steerRate * DT, r.d + P.steerRate * DT);
    wt = (vt * Math.tan(r.d + ((P.biasDeg || 0) * Math.PI) / 180)) / P.wheelbase; // misalignment: the wheels sit biasDeg off what the encoder reads
    if (isDyn()) {
      r.wk = wt;
      dyn = dynStep(r, vt, r.d + ((P.biasDeg || 0) * Math.PI) / 180);
      wt = dyn.r;
    } // tyre slip: the yaw rate is a state, wt only what the encoders imply
  } else {
    const wa = r.wa ?? r.w; // actuator state (turn rate the motors are trying to produce)
    wt = clamp(c.w, -P.wmax, P.wmax);
    if (P.lag > 0) {
      const a = 1 - Math.exp(-DT / P.lag);
      vt = r.v + (vt - r.v) * a;
      wt = wa + (wt - wa) * a;
    }
    if (P.accel) {
      vt = clamp(vt, r.v - P.amax * DT, r.v + P.amax * DT);
      wt = clamp(wt, wa - P.alpha * DT, wa + P.alpha * DT);
    }
    r.wa = wt;
    wt += P.biasW || 0; // bias: e.g. one weaker motor
  }
  const n = dyn || integ(r.x, r.y, r.th, vt, wt, DT);
  if (bodyHits(n.x, n.y, n.th, S.shapes)) {
    if (!isCar()) r.th = wrap(r.th + wt * DT);
    r.v = 0;
    r.w = isCar() ? 0 : wt;
    if (dyn) {
      r.vy = 0;
      r.r = 0;
    }
    if (!r.contact && Math.abs(vt) > 0.01) {
      S.coll++;
      logE('Collision with static obstacle', 'bad');
      S.halt = true;
    }
    r.contact = true;
  } else {
    S.dist += hyp(n.x - r.x, n.y - r.y);
    r.x = n.x;
    r.y = n.y;
    r.th = n.th;
    r.v = vt;
    r.w = wt;
    if (dyn) {
      r.vy = dyn.vy;
      r.r = dyn.r;
    }
    if (r.contact && !bodyHits(r.x, r.y, r.th, S.shapes, 0.05)) r.contact = false;
  }
  let pc = false;
  if (isCar()) pc = S.peds.length > 0 && carHits(r.x, r.y, r.th, pedShapes());
  else for (const c of pedShapes()) if (hyp(c.x - r.x, c.y - r.y) < RR + c.r) pc = true;
  if (S.peds.length) {
    let g = Infinity;
    for (const p of S.peds) g = Math.min(g, bodyGap(r, p));
    if (g < S.minPed) S.minPed = g;
  }
  if (pc && !r.pedContact) {
    S.collPed++;
    const still = Math.abs(r.v) < 0.05;
    if (still) S.collPedStill = (S.collPedStill || 0) + 1;
    logE(still ? 'A person walked into the stopped robot' : 'Contact with a person', 'bad');
    S.halt = true;
  }
  r.pedContact = pc;
}

/* ---------- car with tyre slip: the dynamic bicycle model (chapter 1 §4) ----------
   States at the centre of mass: lateral velocity v_y and yaw rate r; the forward speed v_x comes from the
   longitudinal chain above. Slip angles α_f = tanδ − (v_y + l_f r)/v_x, α_r = −(v_y − l_r r)/v_x (chapter 1's
   small-angle model with tanδ for δ, so that stiff tyres give exactly the kinematic r = v tanδ / L; sign-flipped in
   reverse, so the tyres always oppose sliding), linear tyres F = C·α clipped at μ·F_z with static loads. Passing
   through standstill (v_x changes sign within a tick when there are no acceleration limits) starts from v_y = r = 0. Below |v_x| 0.3 m/s the slip angles lose meaning (they divide by v_x), so the state blends to the kinematic
   one (r = v tanδ / L, v_y = l_r r), fully kinematic below 0.15 m/s. The yaw mode is fast (time constants of a few ms
   at low speed with grippy tyres), so one tick is DYN_SUB substeps of a 2-stage Rosenbrock method (ROS2: second order,
   L-stable, so stiff tyres converge to the kinematic car instead of blowing up). The pose stays at the rear axle,
   whose body-frame velocity is (v_x, v_y − l_r r); each substep moves it with the new velocities (semi-implicit). */
const DYN_SUB = 20,
  GRAV = 9.81,
  ROS_G = 1 + Math.SQRT1_2;
function dynGeom() {
  const L = P.wheelbase,
    lf = clamp(P.lf, 0.05 * L, 0.95 * L);
  return {L, lf, lr: L - lf, m: P.mass, Iz: P.Iz};
}
// Steady-state quantities for the UI and the analysis: understeer gradient, characteristic speed, friction limit
function dynInfo() {
  const {L, lf, lr, m} = dynGeom(),
    K = (m / L) * (lr / P.Cf - lf / P.Cr);
  return {K, vch: K > 0 ? Math.sqrt(L / K) : null, vcrit: K < 0 ? Math.sqrt(-L / K) : null, aMax: P.mu * GRAV, L, lf, lr};
}
// The linear model about straight driving at speed vx: [v̇_y, ṙ] = A [v_y, r] + B tanδ (chapter 1 §4; Analyze uses it)
function dynLin(vx) {
  const {L, lf, lr, m, Iz} = dynGeom(),
    Cf = P.Cf,
    Cr = P.Cr,
    u = Math.max(Math.abs(vx), 1e-3),
    sg = vx < 0 ? -1 : 1;
  return {
    A: [
      [-(Cf + Cr) / (m * u), -vx - (lf * Cf - lr * Cr) / (m * u)],
      [-(lf * Cf - lr * Cr) / (Iz * u), -(lf * lf * Cf + lr * lr * Cr) / (Iz * u)]
    ],
    B: [(sg * Cf) / m, (sg * lf * Cf) / Iz]
  };
}
// Its yaw mode in words: natural frequency and damping, or two time constants
function dynModes(vx) {
  const {A} = dynLin(vx),
    tr = A[0][0] + A[1][1],
    det = A[0][0] * A[1][1] - A[0][1] * A[1][0],
    disc = (tr * tr) / 4 - det;
  if (det <= 0) return {unstable: true, text: 'unstable (one eigenvalue is positive)'};
  if (disc < 0) {
    const wn = Math.sqrt(det),
      z = -tr / 2 / wn;
    return {wn, z, text: `ω_n ${wn.toFixed(1)} rad/s, ζ ${z.toFixed(2)}`};
  }
  const l1 = tr / 2 + Math.sqrt(disc),
    l2 = tr / 2 - Math.sqrt(disc);
  return {tau: [-1 / l1, -1 / l2], text: `time constants ${(-1000 / l1).toFixed(0)} and ${(-1000 / l2).toFixed(0)} ms`};
}
// Lateral dynamics at forward speed vx and wheel angle de: o = [v̇_y, ṙ]; also returns slip angles and forces in T
function dynF(vy, yr, vx, de, G, o, T) {
  const sg = vx < 0 ? -1 : 1,
    af = sg * (G.td - (vy + G.lf * yr) / vx),
    ar = (-sg * (vy - G.lr * yr)) / vx;
  const Ff = clamp(P.Cf * af, -G.ff, G.ff),
    Fr = clamp(P.Cr * ar, -G.fr, G.fr),
    Fc = Ff * Math.cos(de);
  o[0] = (Fc + Fr) / G.m - vx * yr;
  o[1] = (G.lf * Fc - G.lr * Fr) / G.Iz;
  if (T) {
    T.af = af;
    T.ar = ar;
    T.Ff = Ff;
    T.Fr = Fr;
  }
  return o;
}
function dynStep(r, vx, de) {
  const G = dynGeom();
  G.ff = (P.mu * G.m * GRAV * G.lr) / G.L;
  G.fr = (P.mu * G.m * GRAV * G.lf) / G.L;
  G.td = Math.tan(de);
  const h = DT / DYN_SUB,
    rk = (vx * G.td) / G.L,
    yk = G.lr * rk,
    wB = clamp((Math.abs(vx) - 0.15) / 0.15, 0, 1);
  let vy = r.vy || 0,
    yr = r.r || 0,
    x = r.x,
    y = r.y,
    th = r.th;
  if (vx * r.v < 0) {
    vy = 0;
    yr = 0;
  }
  const f0 = [0, 0],
    f1 = [0, 0],
    fa = [0, 0],
    fb = [0, 0];
  for (let i = 0; i < DYN_SUB; i++) {
    if (wB > 0) {
      dynF(vy, yr, vx, de, G, f0);
      // Jacobian by differences, then M = I − γhJ and its inverse (2×2)
      const e1 = 1e-6 * (1 + Math.abs(vy)),
        e2 = 1e-6 * (1 + Math.abs(yr));
      dynF(vy + e1, yr, vx, de, G, fa);
      dynF(vy, yr + e2, vx, de, G, fb);
      const gh = ROS_G * h,
        m11 = 1 - (gh * (fa[0] - f0[0])) / e1,
        m12 = (-gh * (fb[0] - f0[0])) / e2,
        m21 = (-gh * (fa[1] - f0[1])) / e1,
        m22 = 1 - (gh * (fb[1] - f0[1])) / e2,
        dt = m11 * m22 - m12 * m21;
      const sol = (a, b) => [(m22 * a - m12 * b) / dt, (m11 * b - m21 * a) / dt];
      const k1 = sol(f0[0], f0[1]);
      dynF(vy + h * k1[0], yr + h * k1[1], vx, de, G, f1);
      const k2 = sol(f1[0] - 2 * k1[0], f1[1] - 2 * k1[1]);
      vy += h * (1.5 * k1[0] + 0.5 * k2[0]);
      yr += h * (1.5 * k1[1] + 0.5 * k2[1]);
      if (wB < 1) {
        vy = wB * vy + (1 - wB) * yk;
        yr = wB * yr + (1 - wB) * rk;
      }
    } else {
      vy = yk;
      yr = rk;
    }
    const n = integ(x, y, th, vx, yr, h),
      ly = (vy - G.lr * yr) * h,
      tm = th + 0.5 * yr * h; // arc of the rear axle plus its sideways slide
    x = n.x - ly * Math.sin(tm);
    y = n.y + ly * Math.cos(tm);
    th = n.th;
  }
  return {x, y, th, vy, r: yr};
}
// Slip state of the current motion (UI signals): slip angles, sideslip at the CoM, lateral acceleration
function dynSlip(rb) {
  const G = dynGeom();
  G.ff = (P.mu * G.m * GRAV * G.lr) / G.L;
  G.fr = (P.mu * G.m * GRAV * G.lf) / G.L;
  const vx = rb.v,
    de = (rb.d || 0) + ((P.biasDeg || 0) * Math.PI) / 180,
    T = {},
    o = [0, 0];
  if (Math.abs(vx) < 0.05) return {af: 0, ar: 0, beta: 0, ay: 0, Ff: 0, Fr: 0};
  G.td = Math.tan(de);
  dynF(rb.vy || 0, rb.r || 0, vx, de, G, o, T);
  return {af: T.af, ar: T.ar, beta: Math.atan2(rb.vy || 0, Math.abs(vx)), ay: (T.Ff * Math.cos(de) + T.Fr) / G.m, Ff: T.Ff, Fr: T.Fr};
}

// The slip state for the plots and the health light, in display units (recorded in each replay frame's sig.dyn)
function dynSig(rb) {
  const q = dynSlip(rb);
  return {beta: deg(q.beta), r: rb.r || 0, rk: rb.wk != null ? rb.wk : 0, ay: q.ay, mug: P.mu * GRAV, af: deg(q.af), ar: deg(q.ar)};
}

/* ---------- odometry model ---------- */
const sigV = (v, w, k) => k * (0.1 * Math.abs(v) + 0.02);
const sigW = (v, w, k) => k * (0.2 * Math.abs(w) + 0.1 * Math.abs(v) + 0.02);
const gyroSig = () => (P.gyroSig * Math.PI) / 180,
  gyroBias = () => (P.gyroBias * Math.PI) / 180;
function odometry() {
  const r = S.robot,
    g = S.rngW,
    k = P.odoK;
  // the car with tyre slip measures ω from the wheels and the steering encoder (v tanδ / L), so slip is odometry error;
  // a yaw-rate gyro (P.gyro) reports the true yaw rate instead, for every vehicle, with its own noise and bias and
  // none of the wheels' turn-rate bias; standing still, the zero-velocity update averages the reading into a bias
  // estimate that is subtracted from then on (what a real IMU driver does at every stop)
  const w = isDyn() && !P.gyro && r.wk != null ? r.wk : r.w;
  const vb = r.v * (1 + 0.02 * P.odoB),
    vo = vb + sigV(r.v, w, k) * g.n(); // the speed's draw first, then the turn rate's: the random sequence of every run before the gyro
  let wo;
  if (P.gyro) {
    wo = w + gyroBias() + gyroSig() * g.n();
    if (P.zupt) {
      if (Math.abs(r.v) < 0.01 && Math.abs(S.cmd.w || 0) < 1e-6 && Math.abs(r.w) < 1e-4) S.gyroBiasEst += 0.1 * (wo - S.gyroBiasEst); // settles within a 2 s hold (40 readings), noise averaged about 4× down
      wo -= S.gyroBiasEst;
    }
  } else wo = w + 0.01 * P.odoB * r.v + sigW(r.v, w, k) * g.n();
  S.odo = {v: vo, w: wo};
}
// the filter's assumed turn-rate noise: the gyro's σ (scaled by the assumed-noise slider) when the gyro is on
const filtSigW = (v, w) => (P.gyro ? P.filtK * gyroSig() : sigW(v, w, assumedK()));
const assumedK = () => P.filtK * Math.max(P.odoK, 0.25);
// odometry error when driving straight at v, for the UI and notes: random σ per reading and the fixed bias (as in odometry())
const odoErr = v => ({sv: sigV(v, 0, P.odoK), sw: sigW(v, 0, P.odoK), bv: 0.02 * P.odoB * v, bw: 0.01 * P.odoB * v});
const sigR = () => 0.08 * Math.max(P.lmK, 0.25),
  sigB = () => 0.03 * Math.max(P.lmK, 0.25);
