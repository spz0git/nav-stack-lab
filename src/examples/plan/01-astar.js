// @example A* on the costmap
// Your global planner. Called whenever the mission needs a path (initial plan, replans).
// Return { path: [[x, y], ...] } from the start to the goal, or { error: 'reason' } when there is none.
// A car may return { segs: [{ pts: [[x, y, th], ...], dir: +1 | -1 }, ...] } with reverse legs.
//
// obs.start  {x, y, th}      estimated pose
// obs.goal   {x, y, th|null} the goal, heading only for posed goals
// obs.grid   {w, h, res}     the costmap grid: w × h cells of res metres
// obs.lethal Uint8Array      1 where the robot centre may not go (w*h, row-major, cell (i, j) = j*w + i)
// obs.dist   Float32Array    distance to the nearest obstacle per cell [m]
// obs.vehicle {model, wheelbase, steerMax, minTurnR, revOK}
// Budget: 3 s per call. mem persists between calls.

function plan(obs, mem) {
  const { w, h, res } = obs.grid, L = obs.lethal;
  const cell = (x, y) => [Math.floor(x / res), Math.floor(y / res)];
  const [si, sj] = cell(obs.start.x, obs.start.y), [gi, gj] = cell(obs.goal.x, obs.goal.y);
  // 8-connected A* with the octile heuristic
  const g = new Float32Array(w * h).fill(Infinity), par = new Int32Array(w * h).fill(-1), closed = new Uint8Array(w * h);
  const heur = (i, j) => { const dx = Math.abs(i - gi), dy = Math.abs(j - gj); return Math.max(dx, dy) + 0.414 * Math.min(dx, dy); };
  const open = [[heur(si, sj), sj * w + si]]; g[sj * w + si] = 0;
  const NB = [[1,0,1],[-1,0,1],[0,1,1],[0,-1,1],[1,1,1.414],[1,-1,1.414],[-1,1,1.414],[-1,-1,1.414]];
  let found = false, expansions = 0;
  while (open.length) {
    let b = 0; for (let k = 1; k < open.length; k++) if (open[k][0] < open[b][0]) b = k;   // a heap would be faster
    const [, u] = open.splice(b, 1)[0]; if (closed[u]) continue; closed[u] = 1; expansions++;
    if (u === gj * w + gi) { found = true; break; }
    const ui = u % w, uj = (u / w) | 0;
    for (const [di, dj, c] of NB) { const vi = ui + di, vj = uj + dj; if (vi < 0 || vj < 0 || vi >= w || vj >= h) continue;
      const v = vj * w + vi; if (L[v] || closed[v]) continue;
      if (di && dj && (L[uj * w + vi] || L[vj * w + ui])) continue;           // no corner cutting
      const ng = g[u] + c * (1 + 3 * Math.max(0, 0.6 - obs.dist[v]));         // stay away from walls when it is cheap to
      if (ng < g[v]) { g[v] = ng; par[v] = u; open.push([ng + heur(vi, vj), v]); } }
  }
  if (!found) return { error: 'no path on the grid' };
  const path = []; for (let u = gj * w + gi; u >= 0; u = par[u]) path.push([(u % w + 0.5) * res, (((u / w) | 0) + 0.5) * res]);
  path.reverse(); path[0] = [obs.start.x, obs.start.y]; path[path.length - 1] = [obs.goal.x, obs.goal.y];
  return { path, expansions };
}
