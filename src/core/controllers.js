/* ============================================================
   Controllers
   ============================================================ */
function goalDist(pr) {
  const T = S.track,
    g = T.pts[T.pts.length - 1];
  return Math.max(T.total - pr.s, hyp(g[0] - S.est.x, g[1] - S.est.y));
}
const decelCap = d =>
  isCar()
    ? Math.min(Math.sqrt(2 * (P.accel ? P.amax : 0.8) * Math.max(0, d - 0.02)), 0.1 + 0.6 * d) + (d > 0.03 ? 0.04 : 0) // car: linear ramp into each leg end
    : Math.sqrt(2 * (P.accel ? P.amax : 0.8) * Math.max(0, d - 0.08));
// Shared preamble. On a reverse leg the controller works in a virtual frame: heading θ+π, forward speed,
// and the steering sign flipped. For the rear-axle reference point this is exact for the bicycle model.
function kapAt(sArc) {
  const T = S.track;
  if (sArc < 0) return 0;
  sArc = Math.min(sArc, T.total - 1e-3); // hold the final curvature up to the cusp
  let i = T.idx;
  while (i > 0 && T.s[i] > sArc) i--;
  while (i < T.pts.length - 2 && T.s[i + 1] < sArc) i++;
  const t = (sArc - T.s[i]) / (T.s[i + 1] - T.s[i] || 1);
  return T.kv[i] + (T.kv[i + 1] - T.kv[i]) * t;
}
// Rear-wheel feedback (Samson; Paden et al. 2016 §V-A): curvature feedforward + heading and lateral feedback
// @code rwf | ctlRWF: rear-wheel feedback with the curvature feedforward
function ctlRWF() {
  const {e, T, pr, dir, thv} = trackPre(),
    q = pointAt(pr.s),
    i = Math.min(pr.i, T.hd.length - 1),
    thp = T.hd[i];
  const el = Math.cos(thp) * (e.y - q[1]) - Math.sin(thp) * (e.x - q[0]),
    the = wrap(thv - thp); // el > 0: left of path
  const vprev = Math.abs(S.odo.v),
    kmax = isCar() ? Math.tan(steerMax()) / P.wheelbase : 3;
  const k = clamp(kapAt(pr.s + 0.2), -kmax, kmax); // fixed preview covers steering-rate lag
  let kpk = 0;
  for (let ds = 0; ds <= 0.8; ds += 0.2) kpk = Math.max(kpk, Math.abs(kapAt(pr.s + ds)));
  let v = Math.min(P.vcruise, vCap(dir));
  if (kpk > 1e-6) v = Math.min(v, Math.sqrt(P.alat / kpk));
  v = Math.min(v, decelCap(goalDist(pr)));
  const sinc = Math.abs(the) < 1e-4 ? 1 : Math.sin(the) / the;
  const kc = (k * Math.cos(the)) / Math.max(0.3, 1 - k * el) - P.rwKth * the - P.rwKe * sinc * el;
  S.ctlViz = {carrot: q};
  if (isCar()) {
    const dv = clamp(Math.atan(P.wheelbase * kc), -steerMax(), steerMax());
    return {v: dir * v, steer: dir * dv};
  }
  if (Math.abs(the) > Math.PI / 2) return {v: 0, w: -Math.sign(the) * P.wmax * 0.7};
  return {v, w: clamp(v * kc, -P.wmax, P.wmax)};
}
// @end
const vCap = dir => (dir > 0 ? P.vmax : Math.min(0.35, 0.5 * P.vmax)); // reverse legs: manoeuvring speed
function trackPre() {
  const e = S.est,
    T = S.track,
    pr = project(e.x, e.y, true);
  T.idx = Math.max(T.idx, pr.i);
  const dir = T.dir || 1;
  return {e, T, pr, dir, thv: dir > 0 ? e.th : wrap(e.th + Math.PI)};
}
// @code pp | ctlPP: pure pursuit, the carrot and the curvature
function ctlPP() {
  const {e, pr, dir, thv} = trackPre();
  const Ld = Math.max(0.1, P.ppL0 + P.ppK * Math.abs(S.odo.v));
  const c = pointAt(pr.s + Ld, isCar()),
    dx = c[0] - e.x,
    dy = c[1] - e.y,
    L = Math.max(hyp(dx, dy), 1e-3),
    alpha = wrap(Math.atan2(dy, dx) - thv);
  S.ctlViz = {carrot: c};
  if (isCar()) {
    const dm = steerMax(),
      big = Math.abs(alpha) > Math.PI / 2;
    const dv = big ? Math.sign(alpha) * dm : clamp(Math.atan((P.wheelbase * 2 * Math.sin(alpha)) / L), -dm, dm);
    const k = Math.abs(Math.tan(dv)) / P.wheelbase;
    let v = Math.min(P.vcruise, vCap(dir));
    if (k > 1e-6) v = Math.min(v, Math.sqrt(P.alat / k));
    v = Math.min(v, decelCap(goalDist(pr)));
    if (big) v = Math.min(v, 0.2);
    return {v: dir * v, steer: dir * dv};
  }
  if (Math.abs(alpha) > Math.PI / 2) return {v: 0, w: Math.sign(alpha) * P.wmax * 0.7};
  const kap = (2 * Math.sin(alpha)) / L;
  let v = Math.min(P.vcruise, P.vmax);
  if (Math.abs(kap) > 1e-6) v = Math.min(v, Math.sqrt(P.alat / Math.abs(kap)));
  v = Math.min(v, decelCap(goalDist(pr)));
  let w = v * kap;
  if (Math.abs(w) > P.wmax) {
    w = Math.sign(w) * P.wmax;
    v = P.wmax / Math.abs(kap);
  }
  return {v, w};
}
// @end
// @code pid | ctlPID: PID on the heading error to the carrot
function ctlPID() {
  const {e, pr, dir, thv} = trackPre();
  const Ld = Math.max(0.1, P.ppL0 + P.ppK * Math.abs(S.odo.v));
  const c = pointAt(pr.s + Ld, isCar()),
    err = wrap(Math.atan2(c[1] - e.y, c[0] - e.x) - thv),
    C = S.ctlState;
  S.ctlViz = {carrot: c};
  C.I = clamp(C.I + err * DT, -1, 1);
  const D = C.prev == null ? 0 : wrap(err - C.prev) / DT;
  C.prev = err;
  if (isCar()) {
    const st = clamp(P.kp * err + P.ki * C.I + P.kd * D, -steerMax(), steerMax());
    let v = Math.min(P.vcruise, vCap(dir)) * Math.max(0.3, Math.cos(err) ** 2);
    v = Math.min(v, decelCap(goalDist(pr)));
    return {v: dir * v, steer: dir * st};
  }
  const w = clamp(P.kp * err + P.ki * C.I + P.kd * D, -P.wmax, P.wmax);
  let v = Math.min(P.vcruise, P.vmax) * Math.max(0, Math.cos(err)) ** 2;
  v = Math.min(v, decelCap(goalDist(pr)));
  return {v, w};
}
// @end
// Stanley (Hoffmann et al. 2007): front-axle cross-track + heading error. Forward legs only.
// @code stanley | ctlStanley: front-axle cross-track and heading error
function ctlStanley() {
  if (!isCar() || (S.track.dir || 1) < 0) return ctlPP();
  const {e, T, pr} = trackPre(),
    L = P.wheelbase,
    fx = e.x + L * Math.cos(e.th),
    fy = e.y + L * Math.sin(e.th),
    p = T.pts;
  let best = Infinity,
    bx = fx,
    by = fy,
    bth = e.th;
  for (let i = T.idx; i <= Math.min(p.length - 2, T.idx + 80); i++) {
    const a = p[i],
      b = p[i + 1],
      vx = b[0] - a[0],
      vy = b[1] - a[1],
      l2 = vx * vx + vy * vy;
    if (l2 < 1e-12) continue;
    let t = ((fx - a[0]) * vx + (fy - a[1]) * vy) / l2;
    t = i === p.length - 2 ? Math.max(0, t) : clamp(t, 0, 1);
    const qx = a[0] + vx * t,
      qy = a[1] + vy * t,
      d = (fx - qx) ** 2 + (fy - qy) ** 2;
    if (d < best) {
      best = d;
      bx = qx;
      by = qy;
      bth = Math.atan2(vy, vx);
    }
  }
  const eLeft = Math.cos(bth) * (fy - by) - Math.sin(bth) * (fx - bx),
    dm = steerMax();
  const d = clamp(wrap(bth - e.th) - Math.atan2(P.stanK * eLeft, 0.5 + Math.abs(S.odo.v)), -dm, dm);
  S.ctlViz = {carrot: [bx, by], from: [fx, fy]};
  const k = Math.abs(Math.tan(d)) / L;
  let v = Math.min(P.vcruise, P.vmax);
  if (k > 1e-6) v = Math.min(v, Math.sqrt(P.alat / k));
  return {v: Math.min(v, decelCap(goalDist(pr))), steer: d};
}
// @end
// @code dwa | ctlDWA: the dynamic window, rolled out and scored
function ctlDWA() {
  const {e, pr, dir} = trackPre(),
    car = isCar();
  const carrot = pointAt(pr.s + 1.6, car),
    dg = goalDist(pr);
  const A = P.accel ? P.amax : 3,
    AL = P.accel ? P.alpha : 8,
    win = 0.25,
    v0 = dir * S.odo.v,
    w0 = S.odo.w;
  const vtop = Math.min(P.vcruise, vCap(dir), decelCap(dg) + 0.05);
  const vlo = Math.max(0, v0 - A * win),
    vhi = Math.max(vlo, Math.min(vtop, v0 + A * win));
  // second sampled input: ω for diff-drive, steering angle δ for the car
  let wlo, whi;
  if (car) {
    const dm = steerMax(),
      d0 = S.robot.d;
    wlo = Math.max(-dm, d0 - P.steerRate * win);
    whi = Math.min(dm, d0 + P.steerRate * win);
  } else {
    wlo = Math.max(-P.wmax, w0 - AL * win);
    whi = Math.min(P.wmax, w0 + AL * win);
  }
  const pts = ((S.agents && S.agents.staticPts) || S.scanPts).filter(p => hyp(p[0] - e.x, p[1] - e.y) < 4.5),
    ags = agOn() ? agList(4.5 + P.dwaT * 2.5) : [];
  const NV = 7,
    NW = 15,
    hor = P.dwaT,
    sdt = 0.1,
    ns = Math.round(hor / sdt);
  let best = null;
  const trajs = [];
  for (let a = 0; a < NV; a++) {
    const vm = vlo + ((vhi - vlo) * a) / (NV - 1),
      v = dir * vm;
    for (let b = 0; b < NW; b++) {
      const u = wlo + ((whi - wlo) * b) / (NW - 1),
        w = car ? (v * Math.tan(u)) / P.wheelbase : u;
      let x = e.x,
        y = e.y,
        th = e.th,
        clear = Infinity;
      const tp = [x, y];
      for (let k = 0; k < ns; k++) {
        const n = integ(x, y, th, v, w, sdt);
        x = n.x;
        y = n.y;
        th = n.th;
        if (k % 2 === 1) tp.push(x, y);
        for (const [cx, cy, cr] of fpCircles(x, y, th))
          for (const p of pts) {
            const d = hyp(p[0] - cx, p[1] - cy) - cr;
            if (d < clear) clear = d;
          }
        for (const a of ags) {
          const q = agPred(a, (k + 1) * sdt);
          for (const [cx, cy, cr] of fpCircles(x, y, th)) {
            const d = hyp(q[0] - cx, q[1] - cy) - cr - q[2];
            if (d < clear) clear = d;
          }
        }
        if (clear < 0.05) break;
      }
      const ok = clear >= 0.05 && vm <= Math.sqrt(2 * A * Math.max(0, clear)) + 1e-3;
      let cost = Infinity;
      if (ok) {
        const thv = dir > 0 ? th : th + Math.PI,
          dgoal = hyp(carrot[0] - x, carrot[1] - y),
          head = Math.abs(wrap(Math.atan2(carrot[1] - y, carrot[0] - x) - thv));
        cost = P.dwaG * (dgoal + 0.3 * head) + P.dwaO * (1 / Math.min(Math.max(clear, 0.05), 3)) + P.dwaV * (vtop - vm);
        if (!best || cost < best.cost) best = {v, u, cost, i: trajs.length};
      }
      trajs.push({pts: tp, ok});
    }
  }
  S.ctlViz = {carrot, trajs, best: best ? best.i : -1};
  if (!best) {
    if (car) return {v: 0, steer: S.robot.d};
    const a = wrap(Math.atan2(carrot[1] - e.y, carrot[0] - e.x) - e.th);
    return {v: 0, w: Math.sign(a || 1) * Math.min(0.6, P.wmax)};
  }
  return car ? {v: best.v, steer: best.u} : {v: best.v, w: best.u};
}
// @end
/* ============================================================
   Model predictive control
   Gauss–Newton SQP on the condensed (single-shooting) problem.
   NMPC: relinearize about the latest nonlinear rollout every iteration.
   LTV:  linearize once about the reference and predict with that linear model.
   Inputs are actuator rates, so input bounds are exact (box QP);
   state constraints use augmented-Lagrangian penalties.
   ============================================================ */
// State x = [x, y, θ, v, s, (v_cmd, s_cmd)], s = δ (car) or ω (diff); input u = [a, ṡ]
