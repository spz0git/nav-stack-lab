/* ============================================================
   Simulation state
   ============================================================ */
let LV = LEVELS[0],
  S = null,
  WPS = [];
let running = false,
  pauseOnContact = false;
// What the simulation core needs from a user interface. The page overrides these; a worker leaves them as no-ops.
const UI = {
  draw() {},
  refresh() {},
  invalidate() {},
  levelChanged() {},
  slotStatus() {},
  runEnded() {},
  runMeta: () => null,
  mode: () => 'sim'
}; // runEnded: the run is about to be cleared (record.js); returns the page's copy of it, if it keeps one
const dirty = {occ: true, cost: true, search: true};

function prepLevel(L) {
  if (L.truthOcc) return;
  const occ = rasterize(L.shapes, GW, GH);
  L.truthOcc = occ;
  L.truthDist = distanceTransform(occ);
}
// The cells of a gw × gh grid whose centres lie in a shape (insideAny's test, cell by cell over each shape's bounding box)
function rasterize(shapes, gw, gh) {
  const occ = new Uint8Array(gw * gh);
  for (const s of shapes) {
    const one = [s],
      bx0 = s.t === 'r' ? s.x : s.x - s.r,
      by0 = s.t === 'r' ? s.y : s.y - s.r,
      bx1 = s.t === 'r' ? s.x + s.w : s.x + s.r,
      by1 = s.t === 'r' ? s.y + s.h : s.y + s.r,
      i0 = Math.max(0, Math.floor(bx0 / RES) - 1),
      j0 = Math.max(0, Math.floor(by0 / RES) - 1),
      i1 = Math.min(gw - 1, Math.ceil(bx1 / RES) + 1),
      j1 = Math.min(gh - 1, Math.ceil(by1 / RES) + 1);
    for (let j = j0; j <= j1; j++)
      for (let i = i0; i <= i1; i++) if (!occ[j * gw + i] && insideAny((i + 0.5) * RES, (j + 0.5) * RES, one)) occ[j * gw + i] = 1;
  }
  return occ;
}
function insideAny(x, y, shapes) {
  for (const s of shapes) {
    if (s.t === 'r') {
      if (x >= s.x && x <= s.x + s.w && y >= s.y && y <= s.y + s.h) return true;
    } else if (hyp(x - s.x, y - s.y) <= s.r) return true;
  }
  return false;
}
function circleHits(x, y, r, shapes) {
  for (const s of shapes) {
    if (s.t === 'r') {
      const cx = clamp(x, s.x, s.x + s.w),
        cy = clamp(y, s.y, s.y + s.h);
      if (hyp(x - cx, y - cy) < r) return true;
    } else if (hyp(x - s.x, y - s.y) < r + s.r) return true;
  }
  return false;
}
function rayCast(ox, oy, dx, dy, maxR, shapes) {
  let best = maxR;
  for (const s of shapes) {
    if (s.t === 'r') {
      let tmin = -Infinity,
        tmax = Infinity;
      if (Math.abs(dx) < 1e-12) {
        if (ox < s.x || ox > s.x + s.w) continue;
      } else {
        let t1 = (s.x - ox) / dx,
          t2 = (s.x + s.w - ox) / dx;
        if (t1 > t2) {
          const q = t1;
          t1 = t2;
          t2 = q;
        }
        tmin = Math.max(tmin, t1);
        tmax = Math.min(tmax, t2);
      }
      if (Math.abs(dy) < 1e-12) {
        if (oy < s.y || oy > s.y + s.h) continue;
      } else {
        let t1 = (s.y - oy) / dy,
          t2 = (s.y + s.h - oy) / dy;
        if (t1 > t2) {
          const q = t1;
          t1 = t2;
          t2 = q;
        }
        tmin = Math.max(tmin, t1);
        tmax = Math.min(tmax, t2);
      }
      if (tmin <= tmax && tmin >= 0 && tmin < best) best = tmin;
    } else {
      const fx = ox - s.x,
        fy = oy - s.y,
        b = fx * dx + fy * dy,
        c = fx * fx + fy * fy - s.r * s.r,
        disc = b * b - c;
      if (disc < 0) continue;
      const t = -b - Math.sqrt(disc);
      if (t >= 0 && t < best) best = t;
    }
  }
  return best;
}
// (on the world's grid, or on a gw × gh one: the world generator's, which is not the world's while it runs)
function distanceTransform(occ, gw = GW, gh = GH) {
  const nc = gw * gh;
  const d = new Float32Array(nc);
  const INF = 1e9;
  for (let i = 0; i < nc; i++) d[i] = occ[i] ? 0 : INF;
  for (let j = 0; j < gh; j++)
    for (let i = 0; i < gw; i++) {
      const k = j * gw + i;
      let m = d[k];
      if (m === 0) continue;
      if (i > 0) m = Math.min(m, d[k - 1] + 1);
      if (j > 0) {
        m = Math.min(m, d[k - gw] + 1);
        if (i > 0) m = Math.min(m, d[k - gw - 1] + SQ2);
        if (i < gw - 1) m = Math.min(m, d[k - gw + 1] + SQ2);
      }
      d[k] = m;
    }
  for (let j = gh - 1; j >= 0; j--)
    for (let i = gw - 1; i >= 0; i--) {
      const k = j * gw + i;
      let m = d[k];
      if (m === 0) continue;
      if (i < gw - 1) m = Math.min(m, d[k + 1] + 1);
      if (j < gh - 1) {
        m = Math.min(m, d[k + gw] + 1);
        if (i < gw - 1) m = Math.min(m, d[k + gw + 1] + SQ2);
        if (i > 0) m = Math.min(m, d[k + gw - 1] + SQ2);
      }
      d[k] = m;
    }
  for (let i = 0; i < nc; i++) d[i] *= RES;
  return d;
}

function reset() {
  keepGhost();
  prepLevel(LV);
  const st = LV.start;
  S = {
    t: 0,
    tick: 0,
    rngW: makeRng(P.seed * 7919 + 1),
    rngA: makeRng(P.seed * 104729 + 3),
    rngB: makeRng(P.seed * 7907 + 11),
    bDown: null,
    shapes: LV.shapes,
    peds: LV.peds.map(p => ({...p, s: p.s0 || 0, dir: 1, x: p.a[0], y: p.a[1], r: 0.3})),
    beacons: LV.beacons.map((b, i) => ({id: i, x: b[0], y: b[1]})),
    robot: {x: st[0], y: st[1], th: st[2], v: 0, w: 0, d: 0, vy: 0, r: 0, contact: false, pedContact: false},
    cmd: {v: 0, w: 0, steer: 0},
    cmdQ: [],
    odo: {v: 0, w: 0},
    plan: null,
    segIdx: 0,
    mpc: null,
    mpcStats: null,
    est: {x: st[0], y: st[1], th: st[2]},
    Pc: null,
    pf: null,
    lo: new Float32Array(NC),
    cm: {occ: new Uint8Array(NC), dist: null, lethal: new Uint8Array(NC), pen: new Float32Array(NC)},
    scan: null,
    scanPts: [],
    lastZ: [],
    gyroBiasEst: 0, // the zero-velocity update's running estimate of the gyro bias [rad/s]
    fsm: {state: 'IDLE', queue: [], lastPlanT: -99, lastBlockT: 0, prog: {t: 0, x: st[0], y: st[1]}, fails: 0, cost: null},
    track: null,
    pathId: 0,
    search: null,
    planStats: null,
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
    rejected: 0,
    customMark: null,
    agents: agInit(),
    collPedStill: 0,
    minPed: Infinity,
    safe: safeInit(), // contact events, clearances and leading indicators (core/safety.js)
    lap: 1 // the lap of the goal list (Repeat the goals)
  };
  for (const w of WPS) {
    w.done = false;
    w.skipped = false;
  }
  if (P.vehicles !== false) carsInit();
  updatePeds(0);
  initLoc(true);
  buildCostmap();
  dirty.occ = dirty.cost = true;
  logE(`${LV.id} ${LV.name} · seed ${P.seed}`);
  if (WPS.length) {
    startMission();
    doPlan('initial');
  }
  S.locInit = false;
  for (const k in SLOTS) if (SLOTS[k].worker) SLOTS[k].worker.reset();
  UI.refresh();
}

/* ---------- people ---------- */
function updatePeds(dt) {
  if (P.people === 'reactive' && dt > 0) {
    updatePedsReactive(dt);
    updateCars(dt);
    return;
  }
  for (const p of S.peds) {
    if (p.car) continue;
    const L = hyp(p.b[0] - p.a[0], p.b[1] - p.a[1]);
    if (p.dw) {
      if (p.wait > 0) p.wait -= dt;
      else {
        p.s += (p.dir * p.v * dt) / L;
        if (p.s >= 1) {
          p.s = 1;
          p.dir = -1;
          p.wait = p.dw;
        }
        if (p.s <= 0) {
          p.s = 0;
          p.dir = 1;
          p.wait = p.dw;
        }
      }
    } else {
      p.s += (p.dir * p.v * dt) / L;
      if (p.s > 1) {
        p.s = 2 - p.s;
        p.dir = -1;
      }
      if (p.s < 0) {
        p.s = -p.s;
        p.dir = 1;
      }
    }
    p.x = p.a[0] + (p.b[0] - p.a[0]) * p.s;
    p.y = p.a[1] + (p.b[1] - p.a[1]) * p.s;
    const mv = !(p.wait > 0);
    p.vx = mv ? (p.dir * p.v * (p.b[0] - p.a[0])) / L : 0;
    p.vy = mv ? (p.dir * p.v * (p.b[1] - p.a[1])) / L : 0;
  }
  if (dt > 0) updateCars(dt);
}
function pedShapes() {
  return S.peds.flatMap(p => (p.car ? carCircles(p) : [{t: 'c', x: p.x, y: p.y, r: p.r}]));
}
function allShapes() {
  return S.peds.length ? S.shapes.concat(pedShapes()) : S.shapes;
}
