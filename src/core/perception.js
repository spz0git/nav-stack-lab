/* ============================================================
   Perception: occupancy mapping + costmap
   ============================================================ */
const L_FREE = -0.4,
  L_OCC = 0.85,
  L_CLAMP = 4,
  SUBRAYS = 5, // virtual rays per gap between beams, one every 0.6°: about 8 cm apart at the lidar's 8 m
  L_GAP = Math.fround(-0.06); // what a virtual ray leaves in an unseen cell (a value no beam produces; see below)
// A cell no beam has crossed: untouched, or only reached by the virtual rays between beams. Those count as free for the
// costmap, so the cautious policy can plan through them, and as unseen for everything that asks whether the robot has
// looked (frontiers, the floor seen, the map's agreement), which therefore sees the same map as without them.
const unseen = l => Math.abs(l) < 0.05 || l === L_GAP;
// @code logodds | integrateScan: a lidar scan into the log-odds grid
// the same, from hit points in the body frame (a keyframe's scan): each point is a beam that hit at its range
function integrateScanPts(pts) {
  const ranges = new Float32Array(NBEAM).fill(LMAX);
  for (const [px, py] of pts) {
    const k = Math.round(((Math.atan2(py, px) + Math.PI) / TAU) * NBEAM) % NBEAM;
    ranges[k] = Math.min(ranges[k], hyp(px, py));
  }
  integrateScan(ranges);
}
function integrateScan(ranges) {
  const e = S.est,
    lo = S.lo;
  const i0 = cellI(e.x),
    j0 = cellI(e.y);
  for (let k = 0; k < NBEAM; k++) {
    const hit = ranges[k] < LMAX - 1e-3,
      a = e.th - Math.PI + (k * TAU) / NBEAM,
      r = Math.min(ranges[k], LMAX);
    rayCells(i0, j0, cellI(e.x + r * Math.cos(a)), cellI(e.y + r * Math.sin(a)), (idx, last) => {
      if (lo[idx] === L_GAP) lo[idx] = 0; // a real beam starts from unknown, whatever a virtual ray left
      lo[idx] = clamp(lo[idx] + (last && hit ? L_OCC : L_FREE), -L_CLAMP, L_CLAMP);
    });
  }
  // The gaps between beams: 3° apart, the beams leave unseen cells beyond about 2 m, which the cautious policy
  // (unknown = lethal) inflates into a wall about 3 m out. Virtual rays between neighbouring beams reach the cells
  // closer than both hits, one cell short, and mark an untouched one L_GAP: free for the costmap, still unseen for the
  // rest (unseen above). A cell a beam has crossed keeps its value, and a ray stops at one seen occupied; an obstacle
  // corner between two beams can be marked, and the first beam that hits it makes it occupied as if never marked.
  for (let k = 0; k < NBEAM; k++) {
    const r = Math.min(ranges[k], ranges[(k + 1) % NBEAM], LMAX) - RES;
    if (r <= RES) continue;
    for (let m = 1; m < SUBRAYS; m++) {
      const a = e.th - Math.PI + ((k + m / SUBRAYS) * TAU) / NBEAM;
      rayCells(i0, j0, cellI(e.x + r * Math.cos(a)), cellI(e.y + r * Math.sin(a)), idx => {
        if (lo[idx] > 0) return false;
        if (Math.abs(lo[idx]) < 0.05) lo[idx] = L_GAP;
      });
    }
  }
}
// Bresenham's walk from cell (i0, j0) to (i1, j1), calling f(idx, last) on each cell in the grid; f returns false to stop
function rayCells(i0, j0, i1, j1, f) {
  let x = i0,
    y = j0;
  const dx = Math.abs(i1 - i0),
    dy = -Math.abs(j1 - j0),
    sx = i0 < i1 ? 1 : -1,
    sy = j0 < j1 ? 1 : -1;
  let err = dx + dy;
  for (let guard = 0; guard < 200; guard++) {
    if (x < 0 || y < 0 || x >= GW || y >= GH) return;
    const idx = y * GW + x,
      last = x === i1 && y === j1;
    if (f(idx, last) === false || last) return;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
}
// @end
// @code costmap | buildCostmap: lethal cells and the inflation band from the distance transform
function buildCostmap() {
  const cm = S.cm,
    occ = cm.occ;
  if (P.per === 'oracle') occ.set(LV.truthOcc);
  else {
    const lo = S.lo;
    for (let i = 0; i < NC; i++) {
      const l = lo[i];
      occ[i] = l > 0.5 ? 1 : P.unknownAs === 'lethal' && Math.abs(l) < 0.05 ? 1 : 0;
    }
  }
  cm.dist = distanceTransform(occ);
  const d = cm.dist,
    inf = Math.max(P.infl, 0.01);
  for (let i = 0; i < NC; i++) {
    cm.lethal[i] = d[i] < LETHAL ? 1 : 0;
    const q = (LETHAL + inf - d[i]) / inf;
    cm.pen[i] = d[i] < LETHAL ? 1 : q > 0 ? q * q : 0;
  }
  dirty.cost = true;
}
// @end
// Why a goal cell is lethal, for the planners' log line: under the cautious policy, unexplored cells are obstacles,
// so a goal in or next to unseen space is blocked by the unknown, not by anything the lidar saw
function goalBlocked(gx, gy) {
  if (P.per === 'mapping' && P.unknownAs === 'lethal') {
    const i0 = cellI(gx),
      j0 = cellI(gy),
      n = Math.ceil(LETHAL / RES);
    for (let j = j0 - n; j <= j0 + n; j++)
      for (let i = i0 - n; i <= i0 + n; i++) {
        if (i < 0 || j < 0 || i >= GW || j >= GH) continue;
        if (Math.abs(S.lo[j * GW + i]) < 0.05)
          return 'goal is in unexplored space, and unknown space is lethal (Perceive): the robot stays where it can see; Mission → Explore picks goals it can reach';
      }
  }
  return null;
}
// the nearest cell that is not lethal, or with a clearance given, the nearest at least that far from an obstacle
function nearestFree(s, clear) {
  const seen = new Uint8Array(NC);
  const q = [s];
  seen[s] = 1;
  for (let h = 0; h < q.length && h < 6000; h++) {
    const u = q[h];
    if (clear ? S.cm.dist[u] >= clear : !S.cm.lethal[u]) return u;
    const ui = u % GW,
      uj = (u / GW) | 0;
    for (const [di, dj] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1]
    ]) {
      const vi = ui + di,
        vj = uj + dj;
      if (vi < 0 || vj < 0 || vi >= GW || vj >= GH) continue;
      const v = vj * GW + vi;
      if (!seen[v]) {
        seen[v] = 1;
        q.push(v);
      }
    }
  }
  return -1;
}
// Segment check against costmap. allowExit: ignore leading samples inside an obstacle region (start pose near a wall).
function segClear(ax, ay, bx, by, margin, allowExit) {
  const L = hyp(bx - ax, by - ay),
    n = Math.max(1, Math.ceil(L / 0.05));
  let exiting = allowExit;
  for (let k = 0; k <= n; k++) {
    const t = k / n,
      idx = cellIdx(ax + (bx - ax) * t, ay + (by - ay) * t);
    if (idx < 0) return false;
    if (S.cm.dist[idx] < margin) {
      if (exiting) continue;
      return false;
    }
    exiting = false;
  }
  return true;
}
