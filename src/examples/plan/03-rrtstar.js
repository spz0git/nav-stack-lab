// @example RRT*
// Your global planner: RRT* (Karaman & Frazzoli 2011), the page's rrtstar written plainly. Each iteration samples a
// point (the goal one time in ten), steers from the nearest tree node toward it by one step, picks the cheapest
// collision-free parent among the near nodes, and rewires the near nodes through the new one when that is cheaper.
// The random numbers come from a fixed seed, so a rerun grows the same tree; the path is shortcut-smoothed at the end.
// Return { path } or { error }.
//
// obs.start {x, y, th}, obs.goal {x, y}, obs.grid {w, h, res}, obs.lethal Uint8Array (1 where the centre may not go)

function plan(obs, mem) {
  const { w, h, res } = obs.grid, L = obs.lethal, W = w * res, H = h * res, STEP = 0.6, IT = 1500;
  const free = (x, y) => { const i = Math.floor(x / res), j = Math.floor(y / res); return i >= 0 && j >= 0 && i < w && j < h && !L[j * w + i]; };
  const clear = (ax, ay, bx, by) => {            // the segment sampled every half cell
    const n = Math.ceil(Math.hypot(bx - ax, by - ay) / (res / 2)) + 1;
    for (let k = 0; k <= n; k++) { const t = k / n; if (!free(ax + (bx - ax) * t, ay + (by - ay) * t)) return false; }
    return true;
  };
  let seed = 7; const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
  const sx = obs.start.x, sy = obs.start.y, gx = obs.goal.x, gy = obs.goal.y;
  if (!free(gx, gy)) return { error: 'goal is inside an inflated obstacle' };
  const X = [sx], Y = [sy], Pa = [-1], Co = [0];   // the tree: positions, parent index, cost from the start
  for (let it = 0; it < IT; it++) {
    let qx, qy;
    if (rnd() < 0.1) { qx = gx; qy = gy; } else { qx = rnd() * W; qy = rnd() * H; }   // 1. sample
    let ni = 0, nd = Infinity;                                                        // 2. nearest node
    for (let i = 0; i < X.length; i++) { const d2 = (X[i] - qx) ** 2 + (Y[i] - qy) ** 2; if (d2 < nd) { nd = d2; ni = i; } }
    const d = Math.sqrt(nd); if (d < 1e-6) continue;
    const sc = Math.min(STEP, d) / d, nx = X[ni] + (qx - X[ni]) * sc, ny = Y[ni] + (qy - Y[ni]) * sc;   // 3. steer one step
    if (!free(nx, ny)) continue;
    const n = X.length, rad = Math.min(8 * Math.sqrt(Math.log(n + 1) / (n + 1)), 1.5), near = [];        // 4. the near nodes
    for (let i = 0; i < n; i++) if ((X[i] - nx) ** 2 + (Y[i] - ny) ** 2 <= rad * rad) near.push(i);
    let bp = -1, bc = Infinity;                                                                            // 5. the cheapest parent
    for (const i of near.length ? near : [ni]) { const c = Co[i] + Math.hypot(nx - X[i], ny - Y[i]); if (c < bc && clear(X[i], Y[i], nx, ny)) { bc = c; bp = i; } }
    if (bp < 0) continue;
    X.push(nx); Y.push(ny); Pa.push(bp); Co.push(bc);
    for (const i of near) {                                                                                // 6. rewire through the new node
      const c = bc + Math.hypot(nx - X[i], ny - Y[i]);
      if (c < Co[i] && clear(nx, ny, X[i], Y[i])) { Pa[i] = n; Co[i] = c; }
    }
  }
  let best = -1, bc = Infinity;                   // the node that reaches the goal most cheaply (within 1 m, in the clear)
  for (let i = 0; i < X.length; i++) {
    const dg = Math.hypot(X[i] - gx, Y[i] - gy);
    if (dg > 1 || !clear(X[i], Y[i], gx, gy)) continue;
    if (Co[i] + dg < bc) { bc = Co[i] + dg; best = i; }
  }
  if (best < 0) return { error: 'no connection to the goal after ' + IT + ' samples' };
  let path = [[gx, gy]];
  for (let k = best; k >= 0; k = Pa[k]) path.push([X[k], Y[k]]);
  path.reverse();
  // shortcut smoothing, as the built-in does: skip every point the next one can be reached from in a straight line
  const out = [path[0]];
  for (let i = 0; i < path.length - 1; ) {
    let j = path.length - 1;
    while (j > i + 1 && !clear(path[i][0], path[i][1], path[j][0], path[j][1])) j--;
    out.push(path[j]); i = j;
  }
  return { path: out, nodes: X.length };
}
