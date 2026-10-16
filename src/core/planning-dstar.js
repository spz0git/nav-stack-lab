/* ============================================================
   D* Lite (Koenig & Likhachev 2002): the grid search of A*, kept alive between plans. The search runs from the goal
   toward the robot, so that when the robot moves or the costmap changes only the vertices the change touches are
   repaired; a replan after a wall appears costs tens of vertex updates where A* from scratch costs thousands. The
   same costs as gridSearch, so the paths are the same; the state lives in S.dstar and is dropped when the goal,
   the planner or ε changes.
   ============================================================ */
const DS_NBUF = new Int32Array(32); // the neighbour buffer dstarPlan fills (8 entries of 4)
// @code dstar | dstarPlan and its repair loop: the search kept between plans, patched where the map changed
function dstarPlan(sx, sy, gx, gy) {
  let s = cellIdx(sx, sy);
  const g = cellIdx(gx, gy);
  if (s < 0 || g < 0) return {ok: false, reason: 'outside the map'};
  if (S.cm.lethal[g]) return {ok: false, reason: goalBlocked(gx, gy) || 'goal is inside an inflated obstacle'};
  if (S.cm.lethal[s]) {
    s = nearestFree(s);
    if (s < 0) return {ok: false, reason: 'start is enclosed'};
  }
  const cm = S.cm,
    eps = P.eps;
  let D = S.dstar;
  const fresh = !D || D.goal !== g || D.eps !== eps;
  if (fresh) {
    D = S.dstar = {
      goal: g,
      eps,
      g: new Float64Array(NC).fill(Infinity),
      rhs: new Float64Array(NC).fill(Infinity),
      km: 0,
      sLast: s,
      heap: new Heap(),
      lethal: cm.lethal.slice(),
      pen: cm.pen.slice(),
      plans: 0,
      changed: 0,
      exp: 0
    };
    D.rhs[g] = 0;
  }
  const h = (a, b) => {
      // octile distance between cells a and b, scaled by ε (the same heuristic as A*)
      const dx = Math.abs((a % GW) - (b % GW)),
        dy = Math.abs(((a / GW) | 0) - ((b / GW) | 0));
      return (Math.max(dx, dy) + (SQ2 - 1) * Math.min(dx, dy)) * RES * eps;
    },
    // the cost of stepping from u to its neighbour v (Infinity when blocked): the same as gridSearch's
    cost = (u, v, c, di, dj) => {
      if (cm.lethal[v] || cm.lethal[u]) return Infinity;
      if (di && dj) {
        const ui = u % GW,
          uj = (u / GW) | 0;
        if (cm.lethal[uj * GW + ui + di] || cm.lethal[(uj + dj) * GW + ui]) return Infinity;
      }
      return c * RES * (1 + PENW * cm.pen[v]);
    },
    key = u => {
      const m = Math.min(D.g[u], D.rhs[u]);
      return m + h(s, u) + D.km + 1e-6 * m; // (k1, k2) packed into one number: k1 first, k2 breaks ties
    },
    // the neighbours of u into a shared buffer (index, step cost, di, dj per entry): no allocation per vertex
    NBUF = DS_NBUF,
    nbrs = u => {
      const ui = u % GW,
        uj = (u / GW) | 0;
      let n = 0;
      for (let q = 0; q < 8; q++) {
        const di = NB[q][0],
          dj = NB[q][1],
          vi = ui + di,
          vj = uj + dj;
        if (vi < 0 || vj < 0 || vi >= GW || vj >= GH) continue;
        NBUF[n * 4] = vj * GW + vi;
        NBUF[n * 4 + 1] = q;
        n++;
      }
      return n;
    },
    tr = {order: [], closedAt: new Int32Array(NC), openAt: new Int32Array(NC).fill(-1), par: new Int32Array(NC).fill(-1)};
  let exp = 0;
  // rhs(u) = min over successors of cost(u, v) + g(v); a vertex whose g and rhs disagree is inconsistent and queued
  const updateVertex = u => {
    if (u !== g) {
      let best = Infinity,
        bp = -1;
      const n = nbrs(u);
      for (let q = 0; q < n; q++) {
        const v = NBUF[q * 4],
          e = NB[NBUF[q * 4 + 1]],
          w = cost(u, v, e[2], e[0], e[1]) + D.g[v];
        if (w < best) {
          best = w;
          bp = v;
        }
      }
      D.rhs[u] = best;
      tr.par[u] = bp;
    }
    if (D.g[u] !== D.rhs[u]) {
      D.heap.push(u, key(u));
      if (tr.openAt[u] < 0) tr.openAt[u] = exp;
    }
  };
  if (fresh) updateVertex(g);
  else {
    // the robot moved: the heuristic term of every key is stale by at most h(old, new), absorbed into km
    D.km += h(D.sLast, s);
    D.sLast = s;
    // the costmap changed: every edge touching a changed cell has a new cost, so the cell and its neighbours are updated
    let changed = 0;
    const L0 = D.lethal,
      P0 = D.pen,
      L1 = cm.lethal,
      P1 = cm.pen;
    for (let k = 0; k < NC; k++) {
      // a cell counts as changed when it flips lethal or its penalty moves by more than 0.1: the inflation band
      // breathes with every scan, and chasing its last decimals would repair the whole band each time
      if (L1[k] === L0[k] && Math.abs(P1[k] - P0[k]) < 0.1) continue;
      changed++;
      L0[k] = L1[k];
      P0[k] = P1[k];
      updateVertex(k);
      const n = nbrs(k),
        buf = NBUF.slice(0, n * 4); // updateVertex reuses the buffer
      for (let q = 0; q < n; q++) updateVertex(buf[q * 4]);
    }
    D.changed = changed;
    updateVertex(g);
  }
  // computeShortestPath: pop the smallest key until the start is consistent and nothing ahead of it is cheaper
  const H = D.heap;
  while (H.size && (H.k[0] < key(s) || D.rhs[s] !== D.g[s])) {
    const kOld = H.k[0],
      u = H.pop();
    if (D.g[u] === D.rhs[u]) continue; // a stale entry: the vertex was fixed since it was queued
    const kNew = key(u);
    exp++;
    tr.order.push(u);
    tr.closedAt[u] = exp;
    if (kOld < kNew - 1e-9) H.push(u, kNew);
    else {
      const over = D.g[u] > D.rhs[u];
      if (over)
        D.g[u] = D.rhs[u]; // overconsistent: settle it and tell the predecessors
      else D.g[u] = Infinity; // underconsistent: a cost went up; it and its predecessors are recomputed
      const n = nbrs(u),
        buf = NBUF.slice(0, n * 4);
      if (!over) updateVertex(u);
      for (let q = 0; q < n; q++) updateVertex(buf[q * 4]);
    }
    if (exp > 4 * NC) break;
  }
  D.plans++;
  D.exp = exp;
  const closed = new Uint8Array(NC);
  for (const u of tr.order) closed[u] = 1;
  S.search = {type: 'astar', closed};
  S.searchTrace = {
    type: 'grid',
    name: 'D* Lite',
    n: exp,
    order: Int32Array.from(tr.order),
    closedAt: tr.closedAt,
    openAt: tr.openAt,
    par: tr.par
  };
  if (!isFinite(D.g[s])) return {ok: false, reason: 'no route in the current costmap', exp};
  // the path: from the start, always the successor with the smallest cost + g
  const cells = [s];
  let u = s;
  for (let i = 0; u !== g && i < NC; i++) {
    let best = Infinity,
      bv = -1;
    const n = nbrs(u);
    for (let q = 0; q < n; q++) {
      const v = NBUF[q * 4],
        e = NB[NBUF[q * 4 + 1]],
        w = cost(u, v, e[2], e[0], e[1]) + D.g[v];
      if (w < best) {
        best = w;
        bv = v;
      }
    }
    if (bv < 0) return {ok: false, reason: 'no route in the current costmap', exp};
    cells.push(bv);
    u = bv;
  }
  let pts = [[sx, sy]];
  for (let k = 1; k < cells.length - 1; k++) {
    const a = cells[k - 1],
      b = cells[k],
      c = cells[k + 1];
    if (b - a !== c - b) pts.push(center(b));
  }
  pts.push([gx, gy]);
  if (P.smooth) pts = smoothPath(pts);
  return {ok: true, pts, exp, cost: D.g[s], extra: fresh ? '' : `${D.changed} cells changed`};
}
// @end
