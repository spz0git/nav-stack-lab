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
  POLICY_SIG = 0.05, // the mixture's σ in training, in the outputs' units of 4 m (0.2 m)
  POLICY_CLEAR = LETHAL + 0.1; // the distance from obstacles the safety layer keeps the path at
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
  if (!P.lidar) return {ok: false, reason: 'the learned policy reads the lidar scan, and the lidar is off (Sensors)'};
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
  const f = policyFeatures(S.scan, e, target, S.odo);
  oodNote('policy', f, M); // how far this input is from what the policy was trained on (core/learnmon.js)
  const y = mlpForward(M, f),
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
  // the best-scoring candidate whose waypoints and segments clear the costmap by POLICY_CLEAR (the first segment may
  // start inside the margin on its way out, but its waypoint must be outside it: segClear alone would pass a first
  // segment that never leaves, one pointing into the shelf the robot is touching); a lower-scored one taken is counted
  const outside = q => {
      const k = cellIdx(q[0], q[1]);
      return k >= 0 && S.cm.dist[k] >= POLICY_CLEAR;
    },
    clear = cands.filter(
      C => (C.clear = C.pts.every((q, i) => !i || (outside(q) && segClear(...C.pts[i - 1], ...q, POLICY_CLEAR, i === 1))))
    ),
    // commitment: of the clear candidates, the one nearest the path being driven, unless the best-scoring clear one
    // is more than twice as likely; without it the pick can flip from "left of the shelf" to "right of it" between
    // two refreshes, and the tracker cuts the reversal into the shelf
    prev = S.policyPrevFor === wp ? S.policyPrev : null,
    near = C => {
      let d = 0;
      for (const q of C.pts.slice(1, 5)) d += Math.min(...prev.map(r => hyp(r[0] - q[0], r[1] - q[1])));
      return d;
    },
    held = prev && clear.length > 1 ? clear.reduce((a, b) => (near(b) < near(a) ? b : a)) : null,
    pick = held && clear[0].p <= 2 * held.p ? held : clear[0];
  if (pick && pick !== cands[0]) S.policyAlt = (S.policyAlt || 0) + 1;
  S.policyCands = cands;
  (pick || cands[0]).used = true;
  const pts = (pick || cands[0]).pts.map(q => q.slice());
  S.policyPrev = pick ? pick.pts.slice(1) : null;
  S.policyPrevFor = wp;
  S.policyOut = pts.slice(1);
  // none clears: the safety layer every learned planner needs, on the best-scoring one: a waypoint inside an inflated
  // obstacle (the policy's error is about 20 cm, the expert's clearance 40), or less than 10 cm outside one, is moved
  // to the nearest cell that clear, counted; the path is cut only where no such cell is near. The 10 cm are the margin
  // A*'s smoothing keeps: the costmap's cells put an obstacle up to half a cell farther than it is, so the lethal edge
  // itself is touching.
  for (let i = 1; i < pts.length && !pick; i++) {
    const k = cellIdx(pts[i][0], pts[i][1]);
    if (k >= 0 && S.cm.dist[k] >= POLICY_CLEAR) continue;
    const f = k >= 0 ? nearestFree(k, POLICY_CLEAR) : -1;
    if (f >= 0 && hyp(((f % GW) + 0.5) * RES - pts[i][0], (((f / GW) | 0) + 0.5) * RES - pts[i][1]) < 0.6) {
      pts[i] = [((f % GW) + 0.5) * RES, (((f / GW) | 0) + 0.5) * RES];
      S.policySnap = (S.policySnap || 0) + 1;
    } else {
      S.policyBad = (S.policyBad || 0) + 1;
      pts.length = Math.max(2, i);
      break;
    }
  }
  policyShield(pts, e, target); // on a candidate that clears, only its fallback can act: a path too short to drive
  if (pathLen(pts) < 0.05) return {ok: false, reason: 'the policy proposes no motion'};
  return {ok: true, pts, exp: 0, cost: pathLen(pts)};
}
// The rest of the safety layer. Points alone are not enough: two free waypoints 0.4 m apart can have a shelf end
// between them, and a policy that averages "left of it" and "right of it" draws exactly that line. Each segment is
// checked against the inflated obstacles; one that comes too close is replaced by A* between its two ends, if that detour is
// short, and the path is cut before it otherwise. What is left can be too short to drive: pinned against a shelf,
// the policy keeps asking for forward (the demonstrations never show backing out), every point lands in the shelf,
// and the same scan gives the same answer at every refresh. Then the robot gets 1.5 m of the A* route instead, which
// takes it to a state where the policy can drive again.
function policyShield(pts, e, target) {
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1],
      [bx, by] = pts[i],
      L = hyp(bx - ax, by - ay);
    // the first segment may start inside the margin, on its way out
    if (segClear(ax, ay, bx, by, POLICY_CLEAR, i === 1)) continue;
    const R = astar(ax, ay, bx, by);
    S.searchTrace = null;
    if (R.ok && pathLen(R.pts) < 3 * L + 1) {
      pts.splice(i, 1, ...R.pts.slice(1));
      i += R.pts.length - 2;
      S.policyRepair = (S.policyRepair || 0) + 1;
    } else {
      S.policyBad = (S.policyBad || 0) + 1;
      pts.length = i;
      break;
    }
  }
  if (pathLen(pts) >= 0.3) return;
  const R = astar(e.x, e.y, target.x, target.y);
  S.searchTrace = null;
  if (!R.ok) return;
  pts.length = 1;
  for (let i = 1, acc = 0; i < R.pts.length && acc < 1.5; i++) {
    const [ax, ay] = R.pts[i - 1],
      d = hyp(R.pts[i][0] - ax, R.pts[i][1] - ay),
      f = Math.min(1, (1.5 - acc) / d);
    pts.push([ax + f * (R.pts[i][0] - ax), ay + f * (R.pts[i][1] - ay)]);
    acc += d;
  }
  S.policyFallback = (S.policyFallback || 0) + 1;
}
// @end
