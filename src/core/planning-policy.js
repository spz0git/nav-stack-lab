/* ============================================================
   The end-to-end policy (Track C): from the lidar scan, the odometry and the goal in the robot frame straight to a
   short path, eight waypoints about 0.4 m apart (3 m ahead), which the path tracker follows; replanned every half
   second. A multilayer perceptron whose weights the build inlines (MODELS.policy), trained by behaviour cloning in
   training/policy from what the classical stack drove. No map, no search: what the policy knows is in its weights.
   ============================================================ */
const POLICY_N = 8; // waypoints, about 0.4 m apart (the expert path it was cloned from)
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
  const M = MODELS.policy;
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
    c = Math.cos(e.th),
    s = Math.sin(e.th),
    dg = hyp(wp.x - e.x, wp.y - e.y);
  // the waypoints come out in the robot frame in units of 4 m; the path ends at the goal once a waypoint is past it
  const pts = [[e.x, e.y]],
    dt = hyp(target.x - e.x, target.y - e.y);
  let ended = false;
  for (let k = 0; k < POLICY_N && !ended; k++) {
    const px = y[2 * k] * 4,
      py = y[2 * k + 1] * 4;
    if (hyp(px, py) >= dg - 0.1) {
      pts.push([wp.x, wp.y]);
      ended = true;
    } else if (target !== wp && hyp(px, py) >= dt - 0.1) {
      pts.push([target.x, target.y]);
      ended = true;
    } else pts.push([e.x + c * px - s * py, e.y + s * px + c * py]);
  }
  S.policyOut = pts.slice(1);
  // the safety layer every learned planner needs: a waypoint inside an inflated obstacle (the policy's error is about
  // 20 cm, the expert's clearance 40) is moved to the nearest free cell, counted; the path is cut only where no free
  // cell is near
  for (let i = 1; i < pts.length; i++) {
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
// @end
