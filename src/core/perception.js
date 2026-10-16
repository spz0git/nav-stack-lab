/* ============================================================
   Perception: occupancy mapping + costmap
   ============================================================ */
const L_FREE = -0.4,
  L_OCC = 0.85,
  L_CLAMP = 4;
function integrateScan(ranges) {
  const e = S.est,
    lo = S.lo;
  const i0 = cellI(e.x),
    j0 = cellI(e.y);
  for (let k = 0; k < NBEAM; k++) {
    const hit = ranges[k] < LMAX - 1e-3,
      a = e.th - Math.PI + (k * TAU) / NBEAM,
      r = Math.min(ranges[k], LMAX);
    const i1 = cellI(e.x + r * Math.cos(a)),
      j1 = cellI(e.y + r * Math.sin(a));
    let x = i0,
      y = j0;
    const dx = Math.abs(i1 - i0),
      dy = -Math.abs(j1 - j0),
      sx = i0 < i1 ? 1 : -1,
      sy = j0 < j1 ? 1 : -1;
    let err = dx + dy;
    for (let guard = 0; guard < 200; guard++) {
      if (x < 0 || y < 0 || x >= GW || y >= GH) break;
      const idx = y * GW + x,
        last = x === i1 && y === j1;
      lo[idx] = clamp(lo[idx] + (last && hit ? L_OCC : L_FREE), -L_CLAMP, L_CLAMP);
      if (last) break;
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
}
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
function nearestFree(s) {
  const seen = new Uint8Array(NC);
  const q = [s];
  seen[s] = 1;
  for (let h = 0; h < q.length && h < 6000; h++) {
    const u = q[h];
    if (!S.cm.lethal[u]) return u;
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
