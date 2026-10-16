/* ============================================================
   High-level planning: mission ordering + state machine
   ============================================================ */
function remaining() {
  return WPS.map((w, i) => (w.done ? -1 : i)).filter(i => i >= 0);
}
function computeOrder(idx) {
  if (idx.length < 2 || P.mis === 'sequential') return {order: idx.slice(), cost: null};
  const pts = [[S.est.x, S.est.y], ...idx.map(i => [WPS[i].x, WPS[i].y])],
    n = idx.length;
  const C = [];
  for (let a = 0; a <= n; a++) {
    let s = cellIdx(pts[a][0], pts[a][1]);
    if (S.cm.lethal[s]) s = nearestFree(s);
    const R = gridSearch(s, -1, 1);
    C.push(
      pts.map(p => {
        const k = cellIdx(p[0], p[1]);
        const v = R.gs[k];
        return isFinite(v) ? v : 1e6;
      })
    );
  }
  let order;
  if (P.mis === 'greedy') {
    order = [];
    const used = new Array(n + 1).fill(false);
    let u = 0;
    for (let k = 0; k < n; k++) {
      let b = -1;
      for (let v = 1; v <= n; v++) if (!used[v] && (b < 0 || C[u][v] < C[u][b])) b = v;
      used[b] = true;
      order.push(b);
      u = b;
    }
  } else {
    let best = Infinity,
      bestP = null;
    const used = new Array(n + 1).fill(false),
      cur = [];
    (function dfs(u, c, d) {
      if (c >= best) return;
      if (d === n) {
        best = c;
        bestP = cur.slice();
        return;
      }
      for (let v = 1; v <= n; v++)
        if (!used[v]) {
          used[v] = true;
          cur.push(v);
          dfs(v, c + C[u][v], d + 1);
          cur.pop();
          used[v] = false;
        }
    })(0, 0, 0);
    order = bestP;
  }
  let cost = 0,
    u = 0;
  for (const v of order) {
    cost += C[u][v];
    u = v;
  }
  return {order: order.map(v => idx[v - 1]), cost};
}
// Frontier exploration (Yamauchi 1997): a frontier cell is known free with an unknown 4-neighbour; frontiers are
// 8-connected clusters of at least P.exploreMin cells, each summarized by the member cell nearest its centroid. The
// goal the planner gets is the nearest known-free cell with some margin beyond the inflated obstacles (a frontier
// cell sits next to unknown space, which the cautious policy inflates); a frontier with no such cell nearby is skipped.
const exploring = () => P.mis === 'explore' && P.per === 'mapping';
// @code frontiers | frontiers: the frontier cells, clustered, with a goal cell each
function frontiers() {
  const lo = S.lo,
    isF = new Uint8Array(NC),
    unk = i => Math.abs(lo[i]) < 0.05,
    n = Math.ceil(LETHAL / RES);
  // a seen obstacle within the lethal radius (not the unknown: that would rule out every frontier under the cautious policy)
  const nearWall = (i, j) => {
    for (let dj = -n; dj <= n; dj++)
      for (let di = -n; di <= n; di++) {
        const ii = i + di,
          jj = j + dj;
        if (ii < 0 || jj < 0 || ii >= GW || jj >= GH || di * di + dj * dj > n * n) continue;
        if (lo[jj * GW + ii] > 0.5) return true;
      }
    return false;
  };
  for (let j = 1; j < GH - 1; j++)
    for (let i = 1; i < GW - 1; i++) {
      const k = j * GW + i;
      if (lo[k] < -0.05 && (unk(k - 1) || unk(k + 1) || unk(k - GW) || unk(k + GW)) && !nearWall(i, j)) isF[k] = 1;
    }
  const seen = new Uint8Array(NC),
    out = [];
  for (let s = 0; s < NC; s++) {
    if (!isF[s] || seen[s]) continue;
    const cells = [s],
      q = [s];
    seen[s] = 1;
    while (q.length) {
      const k = q.pop(),
        i = k % GW,
        j = (k - i) / GW;
      for (let dj = -1; dj <= 1; dj++)
        for (let di = -1; di <= 1; di++) {
          const ii = i + di,
            jj = j + dj,
            kk = jj * GW + ii;
          if (ii < 0 || jj < 0 || ii >= GW || jj >= GH || !isF[kk] || seen[kk]) continue;
          seen[kk] = 1;
          cells.push(kk);
          q.push(kk);
        }
    }
    if (cells.length < P.exploreMin) continue;
    let cx = 0,
      cy = 0;
    for (const k of cells) {
      cx += k % GW;
      cy += (k - (k % GW)) / GW;
    }
    cx /= cells.length;
    cy /= cells.length;
    let best = cells[0],
      bd = Infinity;
    for (const k of cells) {
      const d = ((k % GW) - cx) ** 2 + ((k - (k % GW)) / GW - cy) ** 2;
      if (d < bd) {
        bd = d;
        best = k;
      }
    }
    const g = nearestKnownFree(best);
    if (g < 0) continue;
    out.push({cells, size: cells.length, x: ((g % GW) + 0.5) * RES, y: ((g - (g % GW)) / GW + 0.5) * RES, key: best});
  }
  return out;
}
// @end
// the nearest known-free cell 0.2 m or more beyond the inflated obstacles, within about 2 m of cell s; in a corridor
// too narrow for that margin the nearest known-free cell that is merely not lethal; for a sliver seen through a door,
// where every known cell is lethal, the nearest cell that is not lethal at all (unknown, when unknown counts as free:
// the planner then heads into the unknown, which is the point) (−1: none)
function nearestKnownFree(s) {
  const seen = new Uint8Array(NC),
    q = [s],
    lim = Math.round(2 / RES);
  seen[s] = 1;
  const si = s % GW,
    sj = (s - si) / GW;
  let fallback = -1,
    last = -1;
  for (let h = 0; h < q.length; h++) {
    const u = q[h];
    if (!S.cm.lethal[u]) {
      if (S.lo[u] < -0.05) {
        if (S.cm.dist[u] >= LETHAL + 0.2) return u;
        if (fallback < 0) fallback = u;
      } else if (last < 0) last = u;
    }
    const ui = u % GW,
      uj = (u - ui) / GW;
    for (const [di, dj] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1]
    ]) {
      const vi = ui + di,
        vj = uj + dj;
      if (vi < 0 || vj < 0 || vi >= GW || vj >= GH || Math.abs(vi - si) > lim || Math.abs(vj - sj) > lim) continue;
      const v = vj * GW + vi;
      if (seen[v]) continue;
      seen[v] = 1;
      q.push(v);
    }
  }
  return fallback >= 0 ? fallback : last;
}
// The next frontier to visit: the largest nearby one (size per metre of distance), skipping the ones that failed;
// the goal list becomes that one goal. Returns false when nothing is left to see.
function exploreNext(reason, quiet) {
  const fr = frontiers(),
    e = S.est,
    failed = S.exploreFailed || (S.exploreFailed = new Set());
  S.frontiers = fr;
  let best = null,
    bs = -Infinity;
  for (const f of fr) {
    if (failed.has(f.key)) continue;
    const d = hyp(f.x - e.x, f.y - e.y),
      s = f.size / (1 + d);
    if (s > bs) {
      bs = s;
      best = f;
    }
  }
  if (!best && failed.size && !S.exploreRetried) {
    // nothing left but the frontiers that failed: one more try at each, from wherever the robot is now
    S.exploreRetried = true;
    failed.clear();
    logE('Explore: only the frontiers that failed are left, trying them once more');
    return exploreNext(reason, quiet);
  }
  if (!best) {
    if (quiet) return false;
    const pct = exploredFrac();
    logE(
      `Explored: ${fr.length ? `${fr.length} frontier${fr.length === 1 ? '' : 's'} left, none reachable` : 'no frontier left'} · ${(100 * pct).toFixed(0)} % of the floor seen`,
      'ok'
    );
    return false;
  }
  WPS = [{x: best.x, y: best.y, th: null, done: false, explore: true, key: best.key, cells: best.cells}];
  S.fsm.queue = [0];
  logE(
    `Explore${reason ? ` (${reason})` : ''}: frontier of ${best.size} cells at (${best.x.toFixed(1)}, ${best.y.toFixed(1)}), ${fr.length} frontier${fr.length === 1 ? '' : 's'}, ${(100 * exploredFrac()).toFixed(0)} % seen`
  );
  return true;
}
// how much of the floor the robot could stand on has been seen (known cells among the true free cells)
function exploredFrac() {
  const lo = S.lo,
    tr = LV.truthOcc;
  if (!tr || P.per !== 'mapping') return null;
  let n = 0,
    k = 0;
  for (let i = 0; i < NC; i++) {
    if (tr[i]) continue;
    n++;
    if (Math.abs(lo[i]) >= 0.05) k++;
  }
  return n ? k / n : 0;
}
// a frontier goal is pointless once none of its cells borders unknown space any more (seen on the way there)
function frontierGone(wp) {
  const lo = S.lo,
    unk = i => Math.abs(lo[i]) < 0.05;
  for (const k of wp.cells) if (lo[k] < -0.05 && (unk(k - 1) || unk(k + 1) || unk(k - GW) || unk(k + GW))) return false;
  return true;
}
// how much of the built map agrees with the truth: among the known cells, the share whose class (occupied above
// log-odds 0.5, else free) matches the level's map; what a SLAM is judged by
function mapAgree() {
  const lo = S.lo,
    tr = LV.truthOcc;
  if (!tr || P.per !== 'mapping') return null;
  let n = 0,
    ok = 0;
  for (let i = 0; i < NC; i++) {
    if (Math.abs(lo[i]) < 0.05) continue;
    n++;
    if ((lo[i] > 0.5 ? 1 : 0) === (tr[i] ? 1 : 0)) ok++;
  }
  return n ? ok / n : null;
}
// when a frontier goal is done or given up: the next frontier, or the end of the exploration
function exploreMore(failedKey) {
  if (!exploring()) return false;
  if (failedKey != null) (S.exploreFailed || (S.exploreFailed = new Set())).add(failedKey);
  return exploreNext(failedKey != null ? 'that one failed' : 'next');
}
// A goal list from outside (a Try's own goals, the collectors' random goals): the mission restarts on it
function setGoals(list) {
  WPS = list.map(g => ({x: g[0], y: g[1], th: g.length > 2 && g[2] != null ? g[2] : null, done: false}));
  startMission();
  doPlan('initial');
}
function startMission() {
  const F = S.fsm;
  if (exploring()) {
    S.exploreFailed = new Set();
    S.exploreRetried = false;
    F.stuckN = 0;
    F.queue = [];
    F.scanT = S.t; // PLAN waits for the first scan when nothing is known yet (missionTick), up to 3 s
    F.state = 'PLAN';
    F.pendingReason = 'initial';
    return;
  }
  if (WPS.length && WPS[0].explore) WPS = LV.wps.map(w => ({x: w[0], y: w[1], th: w.length > 2 ? w[2] : null, done: false})); // back from exploring
  const rem = remaining();
  if (!rem.length) {
    F.state = WPS.length ? 'DONE' : 'IDLE';
    F.queue = [];
    S.track = null;
    S.plan = null;
    return;
  }
  const r = computeOrder(rem);
  F.queue = r.order;
  F.cost = r.cost;
  F.state = 'PLAN';
  const names = {sequential: 'in order', greedy: 'greedy nearest', optimal: 'optimal'};
  logE(
    `Mission: ${F.queue.length} goal${F.queue.length > 1 ? 's' : ''}, ${names[P.mis]}${r.cost != null ? ` · cost ${r.cost.toFixed(1)}` : ''}`
  );
}
const POSE_PLANNERS = ['hybrid', 'rs', 'custom'],
  ALIGN_TOL = 0.035; // planners that take the goal heading; unicycle alignment tolerance [rad]
const PLAN_NAMES = {
  straight: 'Straight',
  astar: 'A*',
  dstar: 'D* Lite',
  policy: 'Learned policy',
  rrtstar: 'RRT*',
  rs: 'Reeds–Shepp',
  hybrid: 'Hybrid A*',
  stastar: 'Space-time A*',
  custom: 'Your code'
};
function doPlan(reason) {
  const F = S.fsm;
  if (!F.queue.length) {
    F.state = 'DONE';
    S.track = null;
    S.plan = null;
    return;
  }
  const agL = reason === 'agent blocking' && P.plan !== 'stastar' && agCostLayer(); // predicted agents enter the costmap for this plan only
  const wp = WPS[F.queue[0]],
    e = S.est,
    t0 = performance.now();
  let res;
  S.searchTrace = null;
  if (P.plan === 'custom') {
    customPlanStart(wp, reason);
    if (agL) buildCostmap();
    return;
  }
  if (P.plan === 'straight')
    res = {
      ok: true,
      pts: [
        [e.x, e.y],
        [wp.x, wp.y]
      ],
      exp: 0
    };
  else if (P.plan === 'astar') res = astar(e.x, e.y, wp.x, wp.y);
  else if (P.plan === 'dstar') res = dstarPlan(e.x, e.y, wp.x, wp.y);
  else if (P.plan === 'policy') res = policyPlan(e, wp);
  else if (P.plan === 'rs') res = rsPlan(e, wp);
  else if (P.plan === 'hybrid') res = hybridAstar(e, wp);
  else if (P.plan === 'stastar') res = stAstar(e.x, e.y, wp.x, wp.y);
  else res = rrtstar(e.x, e.y, wp.x, wp.y);
  if (P.plan === 'straight' || P.plan === 'policy') S.search = null;
  applyPlanResult(res, PLAN_NAMES[P.plan], reason, t0, agL);
}
function applyPlanResult(res, name, reason, t0, agL) {
  S.planTot = S.planTot || {n: 0, exp: 0, ms: 0};
  S.planTot.n++;
  S.planTot.exp += res.exp || 0;
  S.planTot.ms += performance.now() - t0;
  const F = S.fsm,
    e = S.est,
    ms = performance.now() - t0;
  F.lastPlanT = S.t;
  if (agL) buildCostmap();
  if (!F.queue.length) return;
  if (res.ok) {
    setPlan(res.segs || [{pts: res.pts, dir: 1}]);
    F.state = 'DRIVE';
    F.fails = 0;
    if (reason === 'initial' || reason === 'relocalized') F.prog = {t: S.t, x: e.x, y: e.y};
    S.ctlState = {I: 0, prev: null};
    S.planStats = {
      name,
      len: res.len != null ? res.len : pathLen(res.pts || res.segs.flatMap(s => s.pts)),
      exp: res.exp,
      ms,
      extra: res.extra || ''
    };
    if (reason !== 'periodic')
      logE(
        `${reason === 'initial' ? 'Plan' : 'Replan (' + reason + ')'} · ${name} ${S.planStats.len.toFixed(1)} m${P.plan === 'astar' || P.plan === 'dstar' || P.plan === 'hybrid' || P.plan === 'stastar' || (P.plan === 'custom' && res.exp) ? ` · ${res.exp} expansions` : P.plan === 'rrtstar' ? ` · ${res.exp} nodes` : ''}${res.extra ? ' · ' + res.extra : ''} · ${ms.toFixed(0)} ms`,
        reason === 'initial' ? '' : 'warn'
      );
  } else {
    F.state = 'NO_PATH';
    F.fails++;
    S.track = null;
    S.plan = null;
    logE(`${name}: no path to goal ${wpLabel(F.queue[0])} (${res.reason})`, 'bad');
    if (F.fails >= 3) {
      logE(`Skipping goal ${wpLabel(F.queue[0])} after 3 attempts`, 'bad');
      const fk = WPS[F.queue[0]].explore ? WPS[F.queue[0]].key : null;
      WPS[F.queue[0]].done = true;
      WPS[F.queue[0]].skipped = true;
      F.queue.shift();
      F.fails = 0;
      F.state = F.queue.length || exploreMore(fk) ? 'PLAN' : 'DONE';
    }
  }
}
function wpLabel(i) {
  return i + 1;
}
const posSigma = () => (S.Pc ? Math.sqrt(Math.max(0, S.Pc[0] + S.Pc[4])) : 0);
// One tick of the mission state machine (IDLE, PLAN, DRIVE, NO_PATH, LOST, DONE): goals reached by the estimate, replans on
// blocked, off path, stuck or timer, the lost guard, and the heading alignment at posed goals.
// @code mission-tick | missionTick: the behaviour layer, one tick of the state machine
function missionTick() {
  const F = S.fsm;
  if (F.state === 'PLAN') {
    if (F.planPending) return;
    if (exploring() && !F.queue.length) {
      // the first frontier once the first scan is in; an empty map after 3 s, or no frontier left, ends the exploration
      const waiting = S.t - (F.scanT || 0) < 3;
      if (!exploreNext(F.scanT != null ? 'start' : 'next', waiting)) {
        if (!waiting) {
          F.state = 'DONE';
          S.track = null;
          S.plan = null;
        }
        return;
      }
      F.scanT = null;
    }
    doPlan(F.pendingReason || 'initial');
    F.pendingReason = null;
    return;
  }
  if (F.state === 'NO_PATH') {
    if (S.t - F.lastPlanT > 2) {
      F.state = 'PLAN';
      F.pendingReason = 'retry';
    }
    return;
  }
  if (F.state === 'LOST') {
    if (posSigma() < 0.4) {
      logE(`Relocalized (σ ${posSigma().toFixed(2)} m). Resuming.`, 'ok');
      F.state = 'PLAN';
      F.pendingReason = 'relocalized';
    }
    return;
  }
  if (F.state !== 'DRIVE') return;
  if (P.lostGuard && S.Pc && posSigma() > 1.0) {
    F.state = 'LOST';
    logE(`Position σ ${posSigma().toFixed(1)} m: holding and turning in place to find beacons`, 'warn');
    return;
  }
  const wp = WPS[F.queue[0]],
    e = S.est;
  if (wp.explore && S.t - (F.frontierT || 0) >= 1) {
    F.frontierT = S.t;
    if (frontierGone(wp)) {
      logE(`Frontier at (${wp.x.toFixed(1)}, ${wp.y.toFixed(1)}) seen on the way: next`);
      wp.done = true;
      F.queue.shift();
      F.stuckN = 0;
      S.ctlState = {I: 0, prev: null};
      if (exploreMore()) {
        F.state = 'PLAN';
        F.pendingReason = 'initial';
      } else {
        F.state = 'DONE';
        S.track = null;
        S.plan = null;
        logE(`Exploration complete in ${S.t.toFixed(1)} s`, 'ok');
      }
      return;
    }
  }
  let lastSeg = !S.plan || S.segIdx >= S.plan.segs.length - 1;
  if (!lastSeg) {
    const pr = project(e.x, e.y, true),
      T = S.track,
      end = T.pts[T.pts.length - 1];
    if (T.total - pr.s < 0.12 || hyp(end[0] - e.x, end[1] - e.y) < 0.1) {
      S.segIdx++;
      loadSeg(S.segIdx);
      F.prog = {t: S.t, x: e.x, y: e.y};
      logE(`Cusp → ${S.track.dir > 0 ? 'forward' : 'reverse'} (leg ${S.segIdx + 1}/${S.plan.segs.length})`);
      lastSeg = S.segIdx >= S.plan.segs.length - 1;
    }
  }
  // A goal with a heading: the car's pose planners (Hybrid A*, Reeds–Shepp, your code) arrive with it; the unicycle
  // drives to the point and then turns in place (F.align) until the estimate faces the goal heading within ALIGN_TOL.
  // Point planners on the car cannot honour it, so the heading is reported and not waited for.
  const posed = wp.th != null && (!isCar() || POSE_PLANNERS.includes(P.plan));
  if (wp.th != null && isCar() && !posed && F.headWarn !== F.queue[0]) {
    F.headWarn = F.queue[0];
    logE(`${PLAN_NAMES[P.plan]} plans to a point and ignores the goal heading; Hybrid A* or Reeds–Shepp arrive with it`, 'warn');
  }
  const hErr = posed ? Math.abs(wrap(e.th - wp.th)) : 0,
    headOK = !posed || hErr < (isCar() ? 0.2 : ALIGN_TOL);
  const legDone = !isCar() || !S.track || S.track.total - project(e.x, e.y, true).s < 0.08;
  const near = hyp(e.x - wp.x, e.y - wp.y) < (posed && isCar() ? 0.2 : ARRIVE);
  if (posed && !isCar() && lastSeg && near && !headOK && !F.align) {
    F.align = true;
    F.prog = {t: S.t, x: e.x, y: e.y};
    logE(`At goal ${wpLabel(F.queue[0])}: turning in place to ${deg(wp.th).toFixed(0)}° (${deg(hErr).toFixed(0)}° to go)`);
  }
  if (F.align && (!near || !posed)) {
    F.align = false;
  }
  if (F.align) {
    if (!headOK) return;
  }
  if (lastSeg && headOK && legDone && near) {
    F.align = false;
    const te = hyp(S.robot.x - wp.x, S.robot.y - wp.y),
      he = posed ? Math.abs(deg(wrap(S.robot.th - wp.th))) : 0;
    logE(
      `Reached goal ${wpLabel(F.queue[0])} by estimate · true error ${te.toFixed(2)} m${posed ? ` · ${he.toFixed(0)}°` : ''}`,
      te > 0.5 || he > 20 ? 'warn' : 'ok'
    );
    wp.done = true;
    F.queue.shift();
    F.stuckN = 0;
    S.ctlState = {I: 0, prev: null};
    if (F.queue.length || exploreMore()) {
      F.state = 'PLAN';
      F.pendingReason = 'initial';
    } else {
      F.state = 'DONE';
      S.track = null;
      S.plan = null;
      logE(exploring() ? `Exploration complete in ${S.t.toFixed(1)} s` : `Mission complete in ${S.t.toFixed(1)} s`, 'ok');
    }
    return;
  }
  // the estimate is far from the path (kidnapped, relocalized, pushed aside): plan again from where the robot is now
  if (S.t - F.lastPlanT > 0.5 && project(e.x, e.y, true).d > OFFPATH) {
    F.state = 'PLAN';
    F.pendingReason = 'off path';
    return;
  }
  const per = P.plan === 'policy' ? Math.min(0.5, P.replan || 0.5) : P.replan; // the policy's trajectory is 4 s long: refreshed every half second
  if (per > 0 && S.t - F.lastPlanT >= per) {
    F.state = 'PLAN';
    F.pendingReason = 'periodic';
    return;
  }
  if (P.plan === 'hybrid' && isCar() && S.t - F.lastBlockT > 0.5) {
    // footprint check of the remaining legs (poses carry heading)
    F.lastBlockT = S.t;
    const pr = project(e.x, e.y, true);
    let trav = 0,
      first = true;
    for (let gi = S.segIdx; gi < S.plan.segs.length && trav < 6; gi++) {
      const pts = S.plan.segs[gi].pts;
      for (let i = gi === S.segIdx ? pr.i + 2 : 1; i < pts.length && trav < 6; i++) {
        trav += hyp(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
        const c = fpClear(pts[i][0], pts[i][1], pts[i][2], S.cm.dist);
        if (c < 0 && first) continue;
        first = false;
        if (c < 0) {
          F.state = 'PLAN';
          F.pendingReason = 'path blocked';
          return;
        }
      }
    }
  } else if (P.plan !== 'straight' && P.plan !== 'rs' && S.t - F.lastBlockT > 0.5) {
    F.lastBlockT = S.t;
    const pr = project(e.x, e.y, true);
    let exiting = true;
    for (let s = pr.s + 0.2; s < Math.min(S.track.total, pr.s + 6); s += 0.1) {
      const p = pointAt(s),
        k = cellIdx(p[0], p[1]);
      const bad = k >= 0 && S.cm.lethal[k];
      if (bad && exiting) continue;
      exiting = false;
      if (bad) {
        F.state = 'PLAN';
        F.pendingReason = 'path blocked';
        return;
      }
    }
  }
  if (S.t - F.prog.t > 5) {
    if (hyp(e.x - F.prog.x, e.y - F.prog.y) < 0.15) {
      F.stuckN = (F.stuckN || 0) + 1;
      if (F.stuckN >= 3) {
        logE(`Skipping goal ${wpLabel(F.queue[0])}: stuck 3 times`, 'bad');
        const fk = WPS[F.queue[0]].explore ? WPS[F.queue[0]].key : null;
        WPS[F.queue[0]].done = true;
        WPS[F.queue[0]].skipped = true;
        F.queue.shift();
        F.stuckN = 0;
        F.state = F.queue.length || exploreMore(fk) ? 'PLAN' : 'DONE';
        F.pendingReason = 'initial';
        if (!F.queue.length) {
          S.track = null;
          S.plan = null;
        }
      } else {
        F.state = 'PLAN';
        F.pendingReason = 'stuck';
      }
    }
    F.prog = {t: S.t, x: e.x, y: e.y};
  }
}
// @end
