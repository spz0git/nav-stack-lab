/* ============================================================
   The end-to-end policy (Track C): from the lidar scan, the odometry and the goal in the robot frame straight to a
   short path, eight waypoints about 0.4 m apart (3 m ahead), which the path tracker follows; replanned every half
   second. A multilayer perceptron whose weights the build inlines (MODELS.policy), trained by behaviour cloning in
   training/policy from what the classical stack drove, or one trained in the Train tab (nnModel). No map, no
   search: what the policy knows is in its weights. It proposes K candidate paths with a score each (a mixture, so
   "left of the shelf" and "right of it" stay two answers instead of averaging into one through it); the page takes
   the best-scoring candidate that clears the costmap.
   ============================================================ */
const POLICY_N = 8, // waypoints, about 0.4 m apart (the expert path it was cloned from)
  POLICY_K = 4, // candidate paths, each with a score
  POLICY_SIG = 0.05; // the mixture's σ in training, in the outputs' units of 4 m (0.2 m)
// The candidates a model outputs: K scores then K paths, or one path alone (a model trained before the candidates)
function policyK(M) {
  const n = M.layers[M.layers.length - 1].nout;
  return n === 2 * POLICY_N ? 1 : Math.round(n / (1 + 2 * POLICY_N));
}
// @code policy | policyPlan: the scan and the goal in, a trajectory out
function policyFeatures(scan, e, wp, odo) {
  // 120 ranges/8, the nearest range in each of 12 sectors of 30° (an obstacle signal a flat network reads more easily
  // than 120 raw beams), the goal in the robot frame (dx/10, dy/10 clipped to ±1, distance/10, cos and sin of its
  // bearing), the odometry's v/1.5 and ω/2: 139 numbers, the same order tools/collect-policy.mjs writes
  const NS = 12,
    f = new Float32Array(NBEAM + NS + 7),
    c = Math.cos(e.th),
    s = Math.sin(e.th),
    gx = wp.x - e.x,
    gy = wp.y - e.y,
    rx = c * gx + s * gy,
    ry = -s * gx + c * gy,
    d = hyp(rx, ry),
    b = Math.atan2(ry, rx);
  for (let j = 0; j < NS; j++) f[NBEAM + j] = 1;
  for (let k = 0; k < NBEAM; k++) {
    const r = Math.min(scan ? scan[k] : LMAX, LMAX) / LMAX,
      j = Math.floor((k * NS) / NBEAM);
    f[k] = r;
    if (r < f[NBEAM + j]) f[NBEAM + j] = r;
  }
  const o = NBEAM + NS;
  f[o] = clamp(rx / 10, -1, 1);
  f[o + 1] = clamp(ry / 10, -1, 1);
  f[o + 2] = Math.min(d / 10, 1);
  f[o + 3] = Math.cos(b);
  f[o + 4] = Math.sin(b);
  f[o + 5] = (odo ? odo.v : 0) / 1.5;
  f[o + 6] = (odo ? odo.w : 0) / 2;
  return f;
}
function policyPlan(e, wp) {
  const M = nnModel('policy');
  if (!M) return {ok: false, reason: 'no policy model in this build (training/policy)'};
  // the hybrid: a global planner's route, and the policy is pointed at the point 3 m along it instead of the goal
  let target = wp;
  if (P.policyGoal === 'subgoal') {
    const R = astar(e.x, e.y, wp.x, wp.y);
    S.searchTrace = null;
    if (R.ok) {
      let acc = 0,
        q = R.pts[R.pts.length - 1];
      for (let i = 1; i < R.pts.length; i++) {
        const d = hyp(R.pts[i][0] - R.pts[i - 1][0], R.pts[i][1] - R.pts[i - 1][1]);
        if (acc + d >= 3) {
          const f = (3 - acc) / d;
          q = [R.pts[i - 1][0] + f * (R.pts[i][0] - R.pts[i - 1][0]), R.pts[i - 1][1] + f * (R.pts[i][1] - R.pts[i - 1][1])];
          break;
        }
        acc += d;
      }
      target = {x: q[0], y: q[1]};
      S.policySub = q;
    }
  } else S.policySub = null;
  const y = mlpForward(M, policyFeatures(S.scan, e, target, S.odo)),
    K = policyK(M),
    c = Math.cos(e.th),
    s = Math.sin(e.th);
  // each candidate's waypoints come out in the robot frame in units of 4 m; its path ends at the goal (or the subgoal)
  // once a waypoint is within a step of it, as the expert's routes do. The scores become probabilities (softmax), and
  // the candidates are tried best first
  let mx = -Infinity,
    z = 0;
  for (let k = 0; k < K; k++) mx = Math.max(mx, K > 1 ? y[k] : 0);
  const cands = Array.from({length: K}, (_, k) => {
    const o = K > 1 ? K + 2 * POLICY_N * k : 0,
      pts = [[e.x, e.y]],
      p = Math.exp((K > 1 ? y[k] : 0) - mx);
    z += p;
    for (let i = 0; i < POLICY_N; i++) {
      const px = y[o + 2 * i] * 4,
        py = y[o + 2 * i + 1] * 4,
        q = [e.x + c * px - s * py, e.y + s * px + c * py],
        end = [wp, target].find(g => hyp(g.x - q[0], g.y - q[1]) < DS_STEP);
      pts.push(end ? [end.x, end.y] : q);
      if (end) break;
    }
    return {pts, p};
  }).sort((a, b) => b.p - a.p);
  for (const C of cands) C.p /= z;
  // the best-scoring candidate whose segments clear the costmap; a lower-scored one taken instead is counted
  const pick = cands.find(C => (C.clear = policyClear(C.pts)));
  if (pick && pick !== cands[0]) S.policyAlt = (S.policyAlt || 0) + 1;
  S.policyCands = cands;
  (pick || cands[0]).used = true;
  const pts = (pick || cands[0]).pts.map(q => q.slice());
  S.policyOut = pts.slice(1);
  // none clears: the safety layer every learned planner needs, on the best-scoring one: a waypoint inside an inflated
  // obstacle (the policy's error is about 20 cm, the expert's clearance 40) is moved to the nearest free cell, counted;
  // the path is cut only where no free cell is near
  for (let i = 1; i < pts.length && !pick; i++) {
    const k = cellIdx(pts[i][0], pts[i][1]);
    if (k >= 0 && !S.cm.lethal[k]) continue;
    const f = k >= 0 ? nearestFree(k) : -1;
    if (f >= 0 && hyp(((f % GW) + 0.5) * RES - pts[i][0], (((f / GW) | 0) + 0.5) * RES - pts[i][1]) < 0.6) {
      pts[i] = [((f % GW) + 0.5) * RES, (((f / GW) | 0) + 0.5) * RES];
      S.policySnap = (S.policySnap || 0) + 1;
    } else {
      S.policyBad = (S.policyBad || 0) + 1;
      pts.length = Math.max(2, i);
      break;
    }
  }
  if (pathLen(pts) < 0.05) return {ok: false, reason: 'the policy proposes no motion'};
  return {ok: true, pts, exp: 0, cost: pathLen(pts)};
}
// Does a candidate clear the costmap? Every 5 cm along its segments, the distance to the nearest obstacle must be at
// least the lethal radius, except that a robot already inside the inflation may leave it, never closer to the
// obstacle than it is now
function policyClear(pts) {
  const d = S.cm.dist;
  if (!d) return true;
  const k0 = cellIdx(pts[0][0], pts[0][1]),
    d0 = k0 >= 0 ? d[k0] : 0;
  let exiting = d0 < LETHAL;
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1],
      dx = pts[i][0] - ax,
      dy = pts[i][1] - ay,
      n = Math.max(1, Math.ceil(hyp(dx, dy) / (RES / 2)));
    for (let j = 1; j <= n; j++) {
      const k = cellIdx(ax + (dx * j) / n, ay + (dy * j) / n);
      if (k < 0) return false;
      if (d[k] >= LETHAL) exiting = false;
      else if (!exiting || d[k] < d0 - 0.02) return false;
    }
  }
  return true;
}
// @end
