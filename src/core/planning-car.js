/* ---------- Reeds–Shepp only (ignores obstacles) ---------- */
function rsPlan(e, wp) {
  const R = planR(),
    th = wp.th != null ? wp.th : Math.atan2(wp.y - e.y, wp.x - e.x);
  const c = RS.solve([e.x, e.y, e.th], [wp.x, wp.y, th], R)[0];
  S.search = null;
  if (!c) return {ok: false, reason: 'no Reeds–Shepp solution'};
  const segs = RS.sample([e.x, e.y, e.th], c, R, 0.1);
  return {ok: true, segs, len: c.len * R, exp: 0, extra: `${c.T} · ${segs.length - 1} cusp${segs.length === 2 ? '' : 's'}`};
}

/* ---------- Hybrid A* (Dolgov et al. 2008) ---------- */
const HY = {XY: 0.2, NT: 72};
let HYB = null;
// the search's lattice follows the world's size (setWorld); its buffers are made again at the next search
function hySize() {
  HY.NX = Math.ceil(W / HY.XY);
  HY.NY = Math.ceil(H / HY.XY);
  HY.N = HY.NX * HY.NY * HY.NT;
  HYB = null;
}
hySize();
function hyBuf() {
  if (!HYB)
    HYB = {
      g: new Float32Array(HY.N),
      closed: new Uint8Array(HY.N),
      par: new Int32Array(HY.N),
      x: new Float32Array(HY.N),
      y: new Float32Array(HY.N),
      th: new Float32Array(HY.N),
      dir: new Int8Array(HY.N),
      st: new Float32Array(HY.N)
    };
  HYB.g.fill(Infinity);
  HYB.closed.fill(0);
  return HYB;
}
// obstacle-aware, non-holonomic-free heuristic: 8-connected Dijkstra from the goal on the 0.1 m grid
function holoField(gx, gy, dist, thr) {
  const h = new Float32Array(NC).fill(Infinity),
    done = new Uint8Array(NC),
    heap = new Heap(),
    g = cellIdx(gx, gy);
  if (g < 0) return h;
  h[g] = 0;
  heap.push(g, 0);
  while (heap.size) {
    const u = heap.pop();
    if (done[u]) continue;
    done[u] = 1;
    const ui = u % GW,
      uj = (u / GW) | 0;
    for (const [di, dj, c] of NB) {
      const vi = ui + di,
        vj = uj + dj;
      if (vi < 0 || vj < 0 || vi >= GW || vj >= GH) continue;
      const v = vj * GW + vi;
      if (done[v] || dist[v] < thr) continue;
      const ng = h[u] + c * RES;
      if (ng < h[v]) {
        h[v] = ng;
        heap.push(v, ng);
      }
    }
  }
  return h;
}
// Hybrid A*: a search over (x, y, θ) with arc primitives at the planning lock, Reeds–Shepp shots to the goal, the
// max(2D Dijkstra, Reeds–Shepp) heuristic, gear and steering penalties, and an expansion budget.
// @code hybrid | hybridAstar: motion primitives on a pose grid, with Reeds–Shepp shots
function hybridAstar(e, wp) {
  const dist = S.cm.dist,
    L = P.wheelbase,
    dm = planSteer(),
    R = planR(),
    MARG = 0.15,
    STEP = 0.4,
    SUB = 0.1,
    BUDGET = 60000;
  const goalTh = wp.th != null ? wp.th : null,
    q1 = [wp.x, wp.y, goalTh];
  const clearAt = hyFootprint(dist);
  if (goalTh != null && clearAt(wp.x, wp.y, goalTh) < MARG)
    return {ok: false, reason: goalBlocked(wp.x, wp.y) || 'the goal pose overlaps an obstacle'};
  if (goalTh == null && cellIdx(wp.x, wp.y) >= 0 && dist[cellIdx(wp.x, wp.y)] < CAR.width / 2 + MARG)
    return {ok: false, reason: goalBlocked(wp.x, wp.y) || 'goal is too close to an obstacle for the car'};
  const startClear = clearAt(e.x, e.y, e.th);
  const hAt = hyHeuristic(wp, q1, R, dist);
  const B = hyBuf();
  const steers = [-dm, -dm / 2, 0, dm / 2, dm],
    dirs = P.revOK ? [1, -1] : [1];
  const s0 = hyKey(e.x, e.y, e.th);
  if (s0 < 0) return {ok: false, reason: 'start is outside the map'};
  const H = {B, e, wp, goalTh, q1, R, L, dm, MARG, STEP, SUB, BUDGET, clearAt, hAt, startClear, steers, dirs, s0};
  // A car touching something may back out at reduced margin. Clearance reads come in whole 0.1 m cells, so a start
  // one cell above MARG can be boxed in too: a 1 cm move drops the reading by a cell and every way out of a tight
  // slot fails. Such a start gets the same leniency, but only when the strict search runs out of nodes.
  let r = hySearch(H, startClear < MARG);
  if (r.fin < 0 && r.exp < BUDGET && startClear >= MARG && startClear - RES < MARG) {
    hyBuf();
    r = hySearch(H, true);
  }
  const {viz, exp, fin, tail, pix} = r;
  S.search = {type: 'hybrid', pts: viz};
  S.searchTrace = {type: 'pts', name: 'Hybrid A*', n: viz.length / 2, pts: viz, pix, cell: 0};
  if (fin < 0)
    return {ok: false, reason: exp >= BUDGET ? `search budget of ${BUDGET} expansions used up` : 'no kinematically feasible route', exp};
  const segs = hyRebuild(H, fin, tail);
  let len = 0;
  for (const g of segs) len += pathLen(g.pts);
  return {ok: true, segs, len, exp, extra: `${segs.length - 1} cusp${segs.length === 2 ? '' : 's'}${tail ? ' · RS shot' : ''}`};
}
// The car's footprint as three discs along its length: returns clearAt(x, y, θ), the smallest clearance of the three
// discs on the distance field dist [m] (-1 off the map).
function hyFootprint(dist) {
  const part = carLen() / 3,
    rc = Math.hypot(part / 2, CAR.width / 2),
    offs = [0, 1, 2].map(i => -CAR.rear + part * (i + 0.5));
  return (x, y, th) => {
    const c = Math.cos(th),
      s = Math.sin(th);
    let m = Infinity;
    for (const o of offs) {
      const k = cellIdx(x + o * c, y + o * s);
      if (k < 0) return -1;
      const d = dist[k] - rc;
      if (d < m) m = d;
    }
    return m;
  };
}
// The heuristic: returns hAt(x, y, θ), the 2D Dijkstra distance to the goal wp on dist, raised to the Reeds–Shepp
// length to the goal pose q1 (turning radius R) near the goal when the goal has a heading and P.hybH is 'both'.
function hyHeuristic(wp, q1, R, dist) {
  const h2 = holoField(wp.x, wp.y, dist, CAR.width / 2 + 0.02);
  const h2At = (x, y) => {
    const k = cellIdx(x, y);
    if (k < 0) return Infinity;
    const v = h2[k];
    return isFinite(v) ? v : hyp(x - wp.x, y - wp.y) + 20;
  };
  const useRS = q1[2] != null && P.hybH === 'both';
  return (x, y, th) => {
    let h = h2At(x, y);
    if (useRS && h < 5) {
      const r = RS.length([x, y, th], q1, R);
      if (r > h) h = r;
    }
    return h;
  };
}
// The lattice cell of a pose: index into the search buffers, -1 off the lattice
function hyKey(x, y, th) {
  const NT = HY.NT,
    XY = HY.XY,
    NX = HY.NX;
  const i = Math.floor(x / XY),
    j = Math.floor(y / XY);
  if (i < 0 || j < 0 || i >= NX || j >= HY.NY) return -1;
  return (j * NX + i) * NT + (((Math.round(th / (TAU / NT)) % NT) + NT) % NT);
}
// Analytic expansion from (x, y, θ): the first collision-free Reeds–Shepp shot to the goal among the four shortest
// usable ones (no reverse legs when reversing is off, no gear leg under 0.25 m); returns its legs, or null.
function hyShot(H, x, y, th) {
  const {q1, R, clearAt, MARG, SUB} = H;
  let tail = null;
  const cs = RS.solve([x, y, th], q1, R);
  for (let ci = 0, tried = 0; ci < cs.length && tried < 4 && !tail; ci++) {
    if (!P.revOK && cs[ci].L.some(d => d < -1e-9)) continue; // Allow reversing off: forward-only shots, as the expansions
    // reject shots with gear legs too short to execute (< 0.25 m)
    let short = false,
      acc = 0,
      sg0 = 0;
    for (const d of cs[ci].L) {
      const sg = Math.sign(d);
      if (Math.abs(d) < 1e-9) continue;
      if (sg !== sg0 && sg0 !== 0) {
        if (acc < 0.25) short = true;
        acc = 0;
      }
      sg0 = sg;
      acc += Math.abs(d) * R;
    }
    if (acc < 0.25 && cs[ci].len * R > 0.25) short = true;
    if (short) continue;
    tried++;
    const segs = RS.sample([x, y, th], cs[ci], R, SUB);
    let ok = true;
    for (const sg of segs) {
      for (const p of sg.pts) {
        if (clearAt(p[0], p[1], p[2]) < MARG) {
          ok = false;
          break;
        }
      }
      if (!ok) break;
    }
    if (ok) tail = segs;
  }
  return tail;
}
// Expands node u: every primitive (direction × steering) integrated in SUB steps over STEP, rejected where the
// footprint's clearance drops below the margin, costed (length, reverse, steering, steering change, gear change,
// proximity) and pushed onto the heap where it improves the target cell.
function hyExpand(H, heap, u, lenient) {
  const {B, e, L, dm, MARG, STEP, SUB, clearAt, hAt, startClear, steers, dirs} = H;
  const x = B.x[u],
    y = B.y[u],
    th = B.th[u];
  for (const d of dirs)
    for (const st of steers) {
      let nx = x,
        ny = y,
        nt = th,
        minC = Infinity,
        ok = true;
      const w = (d * Math.tan(st)) / L;
      for (let k = 0; k < Math.round(STEP / SUB); k++) {
        const n = integ(nx, ny, nt, d, w, SUB);
        nx = n.x;
        ny = n.y;
        nt = n.th;
        const c = clearAt(nx, ny, nt),
          need = lenient && hyp(nx - e.x, ny - e.y) < 1.0 ? startClear - RES : MARG; // let a car in a tight spot back out
        if (c < need) {
          ok = false;
          break;
        }
        if (c < minC) minC = c;
      }
      if (!ok) continue;
      const v = hyKey(nx, ny, nt);
      if (v < 0 || B.closed[v]) continue;
      const prox = Math.max(0, (0.4 - minC) / 0.4);
      const cost =
        STEP * (d > 0 ? 1 : P.revPen) +
        (0.05 * Math.abs(st)) / dm +
        (0.1 * Math.abs(st - B.st[u])) / dm +
        (B.dir[u] !== 0 && B.dir[u] !== d ? P.gearPen : 0) +
        STEP * 2 * prox * prox;
      const ng = B.g[u] + cost;
      if (ng < B.g[v]) {
        B.g[v] = ng;
        B.par[v] = u;
        B.x[v] = nx;
        B.y[v] = ny;
        B.th[v] = nt;
        B.dir[v] = d;
        B.st[v] = st;
        heap.push(v, ng + P.eps * hAt(nx, ny, nt));
      }
    }
}
// One search from s0 on H.B: {viz, exp, fin (final node, -1: none), tail (the shot's legs or null), shots, pix (each
// expansion's parent as an index into the expansion order, for playback)}. lenient: within 1 m of the start,
// primitives need only startClear − RES (one grid cell below the start's reading).
function hySearch(H, lenient) {
  const {B, e, wp, goalTh, s0, BUDGET, hAt} = H;
  B.g[s0] = 0;
  B.par[s0] = -1;
  B.x[s0] = e.x;
  B.y[s0] = e.y;
  B.th[s0] = e.th;
  B.dir[s0] = 0;
  B.st[s0] = S.robot.d || 0;
  const heap = new Heap();
  heap.push(s0, P.eps * hAt(e.x, e.y, e.th));
  const viz = [],
    pix = [],
    im = new Map();
  let exp = 0,
    fin = -1,
    tail = null,
    shots = 0;
  while (heap.size && exp < BUDGET) {
    const u = heap.pop();
    if (B.closed[u]) continue;
    B.closed[u] = 1;
    exp++;
    const x = B.x[u],
      y = B.y[u],
      th = B.th[u];
    im.set(u, exp - 1);
    if (viz.length < 40000) {
      viz.push(x, y);
      const pu = B.par[u];
      pix.push(pu >= 0 && im.has(pu) ? im.get(pu) : -1);
    }
    const dg = hyp(x - wp.x, y - wp.y);
    if (dg < 0.15 && (goalTh == null || Math.abs(wrap(th - goalTh)) < 0.12)) {
      fin = u;
      break;
    } // inside the arrival tolerance
    // analytic expansion: try a Reeds–Shepp shot to the goal
    if (goalTh != null && (dg < 2.5 || exp % 10 === 0)) {
      shots++;
      tail = hyShot(H, x, y, th);
      if (tail) {
        fin = u;
        break;
      }
    }
    hyExpand(H, heap, u, lenient);
  }
  return {viz, exp, fin, tail, shots, pix};
}
// rebuild: re-simulate each primitive from its parent pose, from fin back to s0, then append the shot's legs (tail);
// returns the path split into legs by gear, [{dir, pts: [[x, y, θ]]}]
function hyRebuild(H, fin, tail) {
  const {B, e, s0, L, STEP, SUB} = H;
  const chain = [];
  for (let k = fin; k !== s0 && k >= 0; k = B.par[k]) chain.push(k);
  chain.reverse();
  const segs = [];
  let cur = null;
  const add = (dir, pt) => {
    if (!cur || cur.dir !== dir) {
      const st = cur ? cur.pts[cur.pts.length - 1] : [e.x, e.y, e.th];
      cur = {dir, pts: [st]};
      segs.push(cur);
    }
    cur.pts.push(pt);
  };
  for (const k of chain) {
    const p = B.par[k],
      d = B.dir[k],
      w = (d * Math.tan(B.st[k])) / L;
    let nx = B.x[p],
      ny = B.y[p],
      nt = B.th[p];
    for (let i = 0; i < Math.round(STEP / SUB); i++) {
      const n = integ(nx, ny, nt, d, w, SUB);
      nx = n.x;
      ny = n.y;
      nt = n.th;
      add(d, [nx, ny, nt]);
    }
  }
  if (tail) for (const g of tail) for (let i = 1; i < g.pts.length; i++) add(g.dir, g.pts[i]);
  if (!segs.length)
    segs.push({
      dir: 1,
      pts: [
        [e.x, e.y, e.th],
        [e.x + 1e-3 * Math.cos(e.th), e.y + 1e-3 * Math.sin(e.th), e.th]
      ]
    });
  return segs;
}
// @end
