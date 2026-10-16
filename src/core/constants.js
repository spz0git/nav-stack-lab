/* ============================================================
   Constants & helpers
   ============================================================ */
const W = 24,
  H = 16,
  RES = 0.1,
  GW = 240,
  GH = 160,
  NC = GW * GH,
  DT = 0.05,
  RR = 0.3,
  LETHAL = 0.4,
  LMAX = 8,
  NBEAM = 120,
  PENW = 3,
  SQ2 = Math.SQRT2,
  TAU = Math.PI * 2;
const ARRIVE = 0.25,
  OFFPATH = 1.0; // arrival radius; replan when the estimate is this far from the path [m]
const $ = s => (typeof document !== 'undefined' ? document.querySelector(s) : null);
const CAR = {rear: 0.15, front: 0.15, width: 0.5}; // overhangs and width [m]; pose = rear-axle center
const wrap = a => {
  a = (a + Math.PI) % TAU;
  if (a < 0) a += TAU;
  return a - Math.PI;
};
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const hyp = Math.hypot;
const deg = r => (r * 180) / Math.PI;
function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function makeRng(seed) {
  const u = mulberry32(seed >>> 0);
  let spare = null;
  return {
    u,
    n() {
      if (spare !== null) {
        const s = spare;
        spare = null;
        return s;
      }
      let a;
      do {
        a = u();
      } while (a <= 1e-12);
      const b = u();
      const r = Math.sqrt(-2 * Math.log(a));
      spare = r * Math.sin(TAU * b);
      return r * Math.cos(TAU * b);
    }
  };
}
const cellI = x => Math.floor(x / RES),
  cellIdx = (x, y) => {
    const i = Math.floor(x / RES),
      j = Math.floor(y / RES);
    if (i < 0 || j < 0 || i >= GW || j >= GH) return -1;
    return j * GW + i;
  };
function integ(x, y, th, v, w, dt) {
  if (Math.abs(w) < 1e-6) return {x: x + v * dt * Math.cos(th), y: y + v * dt * Math.sin(th), th: wrap(th + w * dt)};
  const r = v / w,
    th2 = th + w * dt;
  return {x: x + r * (Math.sin(th2) - Math.sin(th)), y: y - r * (Math.cos(th2) - Math.cos(th)), th: wrap(th2)};
}
const isCar = () => P.model === 'car';
const isDyn = () => isCar() && P.carPhys === 'dyn'; // car with tyre slip (dynamic bicycle model, vehicle.js)
const steerMax = () => (P.steerMaxDeg * Math.PI) / 180;
const minTurnR = () => P.wheelbase / Math.tan(steerMax());
const planSteer = () => (steerMax() * P.planPct) / 100,
  planR = () => P.wheelbase / Math.tan(planSteer()); // planners keep steering margin for feedback
const carLen = () => CAR.rear + P.wheelbase + CAR.front;
// Footprint as covering circles (used by planners and DWA). Diff-drive: one circle.
function fpCircles(x, y, th) {
  if (!isCar()) return [[x, y, RR]];
  const part = carLen() / 3,
    r = Math.hypot(part / 2, CAR.width / 2),
    c = Math.cos(th),
    s = Math.sin(th),
    out = [];
  for (let i = 0; i < 3; i++) {
    const o = -CAR.rear + part * (i + 0.5);
    out.push([x + o * c, y + o * s, r]);
  }
  return out;
}
// Exact oriented-rectangle test for the car body (used by physics)
function carHits(x, y, th, shapes, m) {
  m = m || 0;
  const c = Math.cos(th),
    s = Math.sin(th),
    hl = carLen() / 2 + m,
    hw = CAR.width / 2 + m,
    off = carLen() / 2 - CAR.rear,
    cx = x + off * c,
    cy = y + off * s,
    ac = Math.abs(c),
    as = Math.abs(s);
  for (const sh of shapes) {
    if (sh.t === 'c') {
      const dx = sh.x - cx,
        dy = sh.y - cy,
        lx = dx * c + dy * s,
        ly = -dx * s + dy * c,
        qx = clamp(lx, -hl, hl),
        qy = clamp(ly, -hw, hw);
      if (Math.hypot(lx - qx, ly - qy) < sh.r) return true;
      continue;
    }
    const ex = sh.w / 2,
      ey = sh.h / 2,
      dx = sh.x + ex - cx,
      dy = sh.y + ey - cy;
    if (Math.abs(dx) > ex + hl * ac + hw * as) continue;
    if (Math.abs(dy) > ey + hl * as + hw * ac) continue;
    if (Math.abs(dx * c + dy * s) > hl + ex * ac + ey * as) continue;
    if (Math.abs(-dx * s + dy * c) > hw + ex * as + ey * ac) continue;
    return true;
  }
  return false;
}
const bodyHits = (x, y, th, shapes, m) => (isCar() ? carHits(x, y, th, shapes, m) : circleHits(x, y, RR + (m || 0), shapes));
// Smallest footprint clearance against a distance field
function fpClear(x, y, th, dist) {
  let m = Infinity;
  for (const [cx, cy, r] of fpCircles(x, y, th)) {
    const k = cellIdx(cx, cy);
    if (k < 0) return -1;
    const d = dist[k] - r;
    if (d < m) m = d;
  }
  return m;
}
class Heap {
  constructor() {
    this.k = [];
    this.v = [];
  }
  get size() {
    return this.k.length;
  }
  push(v, k) {
    const K = this.k,
      V = this.v;
    let i = K.length;
    K.push(k);
    V.push(v);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (K[p] <= k) break;
      K[i] = K[p];
      V[i] = V[p];
      i = p;
    }
    K[i] = k;
    V[i] = v;
  }
  pop() {
    const K = this.k,
      V = this.v;
    const top = V[0];
    const lk = K.pop(),
      lv = V.pop();
    const n = K.length;
    if (n > 0) {
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        if (l >= n) break;
        const r = l + 1;
        const m = r < n && K[r] < K[l] ? r : l;
        if (K[m] >= lk) break;
        K[i] = K[m];
        V[i] = V[m];
        i = m;
      }
      K[i] = lk;
      V[i] = lv;
    }
    return top;
  }
}
