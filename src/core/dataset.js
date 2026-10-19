/* ============================================================
   Training data for the learned blocks: one headless run of the core, recorded at every lidar scan. The same code
   writes the Python trainers' data (tools/collect-*.mjs) and the Train tab's (in a worker, ui/train.js).
     detector: the seven features per beam (detFeatures, with the map evidence detStatic) and one label per beam, 1
               when the beam's hit lies on a person (from the true pose and the people's true discs; the ranges are the
               noisy ones the page sees); the map condition (cond) alternates so the network sees the map right,
               unsettled and misplaced
     policy:   the policy's 139 inputs (policyFeatures) and the expert's answer from that state: the A* route to the
               goal, resampled to eight points 0.4 m apart in the robot frame, in units of 4 m
   A run is described by a spec: {block, level (index), seed, secs, map: {map, mapAdd, mapDel} or null, randomMap:
   number of random obstacles or 0, goals: 'level' | {random: n} | [[x, y, θ or null], …], people: 'alt' | 'scripted'
   | 'reactive', cond: the detector's map condition (detCond), noise (σ of the executed command's perturbation), driver: 'expert' | 'policy' (DAgger), polModel}.
   ============================================================ */
const DS_STEP = 0.4; // the policy's waypoint spacing, m
// the expert's route from (x, y) to the goal, as POLICY_N points DS_STEP apart in the robot frame at heading th
function expertLabel(x, y, th, wp) {
  const R = astar(x, y, wp.x, wp.y);
  if (!R.ok) return null;
  const pts = R.pts,
    y8 = new Float32Array(2 * POLICY_N),
    c = Math.cos(th),
    s = Math.sin(th);
  for (let k = 1; k <= POLICY_N; k++) {
    let want = k * DS_STEP,
      qx = pts[pts.length - 1][0],
      qy = pts[pts.length - 1][1];
    // walk the polyline to arc length `want`
    let d = 0,
      ax = pts[0][0],
      ay = pts[0][1];
    for (let i = 1; i < pts.length; i++) {
      const L = hyp(pts[i][0] - ax, pts[i][1] - ay);
      if (d + L >= want) {
        const f = (want - d) / (L || 1);
        qx = ax + f * (pts[i][0] - ax);
        qy = ay + f * (pts[i][1] - ay);
        break;
      }
      d += L;
      ax = pts[i][0];
      ay = pts[i][1];
    }
    const dx = qx - x,
      dy = qy - y;
    y8[2 * (k - 1)] = (c * dx + s * dy) / 4; // in units of 4 m, as the policy outputs
    y8[2 * (k - 1) + 1] = (-s * dx + c * dy) / 4;
  }
  return y8;
}
// Random obstacles on the paint grid (0.4 m cells): n boxes of 0.4–2 m a side, none within 1.2 m of the points in
// keep (the start, fixed goals) or of the outer walls. Returns the mapAdd list.
function randomMapCells(u, n, keep) {
  const cells = new Set();
  for (let t = 0, placed = 0; placed < n && t < n * 20; t++) {
    const w = 1 + Math.floor(u() * 5),
      h = 1 + Math.floor(u() * 5),
      i0 = 3 + Math.floor(u() * (PGW - 6 - w)),
      j0 = 3 + Math.floor(u() * (PGH - 6 - h)),
      cx = (i0 + w / 2) * PAINT,
      cy = (j0 + h / 2) * PAINT,
      rad = Math.max(w, h) * PAINT * 0.71;
    if (keep.some(p => hyp(p[0] - cx, p[1] - cy) < rad + 1.2)) continue;
    for (let j = j0; j < j0 + h; j++) for (let i = i0; i < i0 + w; i++) cells.add(j * PGW + i);
    placed++;
  }
  return [...cells].sort((a, b) => a - b).join(',');
}
// The detector's map condition for a run: 'oracle' (the prior map, the level's localization), 'mapping' (the robot
// builds its map) or 'drift' (the prior map, dead reckoning with noisy, biased odometry: the map is right and the pose
// is not). 'alt' or none: the three in turn by seed, which with the people's alternation by seed covers all six pairs
// in six seeds.
const DET_CONDS = ['oracle', 'mapping', 'drift'];
const detCond = sp => (DET_CONDS.includes(sp.cond) ? sp.cond : DET_CONDS[sp.seed % 3]);
// Sets the core up for one run of a spec: the level and its seed, the map, the people, the driver, the goals
function dsSetup(sp) {
  P.seed = sp.seed;
  loadLevel(sp.level);
  if (sp.map) for (const k of ['map', 'mapAdd', 'mapDel']) if (sp.map[k] != null) setParam(k, sp.map[k], false);
  const fixed = Array.isArray(sp.goals) ? sp.goals : sp.goals === 'level' ? (sp.map && sp.map.goals) || LV.wps : [];
  if (sp.randomMap > 0) {
    const u = mulberry32((sp.seed * 7919 + 17) >>> 0);
    setParam('map', 'empty', false);
    setParam('mapAdd', randomMapCells(u, sp.randomMap, [LV.start, ...fixed]), false);
  }
  if (sp.block === 'detector') {
    const cond = detCond(sp);
    for (const [k, v] of Object.entries({
      agents: 'truth',
      per: cond === 'mapping' ? 'mapping' : 'oracle',
      spd: 'st',
      people: sp.people === 'alt' || !sp.people ? (sp.seed % 2 ? 'scripted' : 'reactive') : sp.people,
      ...(cond === 'drift' ? {loc: 'dr', odoK: Math.max(P.odoK, 1), odoB: Math.max(P.odoB, 1)} : {})
    }))
      setParam(k, v, false);
  } else {
    setParam('spd', 'st', false);
    setParam('actNoise', sp.noise == null ? 0.3 : sp.noise, false);
    if (sp.people && sp.people !== 'alt') setParam('people', sp.people, false);
    if (sp.driver === 'policy') {
      if (sp.polModel) setParam('polModel', sp.polModel, false);
      setParam('plan', 'policy', false);
    }
  }
  if (sp.goals && sp.goals.random) {
    const g = [];
    for (let i = 0; i < sp.goals.random; i++) {
      const q = randomFree(S.rngA);
      g.push([q.x, q.y]);
    }
    setGoals(g);
  } else if (fixed !== LV.wps) setGoals(fixed);
  else if (sp.block === 'detector') startMission();
  else setGoals(LV.wps); // the policy collector always plans its goals afresh
}
// @code ds-collect | collectRun: one run of the core recorded as training data
async function collectRun(sp, onProgress) {
  dsSetup(sp);
  const det = sp.block === 'detector',
    N = Math.round((sp.secs || 120) / DT),
    NF = det ? NBEAM * DET_CH : NBEAM + 19,
    NY = det ? NBEAM : 2 * POLICY_N,
    xs = [],
    ys = [];
  let prev = null,
    prevT = 0,
    positives = 0;
  for (let i = 0; i < N; i++) {
    await advance(1);
    if (onProgress && i % 400 === 0) onProgress(i / N);
    if (!det && S.fsm.state === 'DONE') break;
    if (S.scanTick !== S.tick || !S.scan) continue;
    if (det) {
      const r = S.scan,
        rb = S.robot,
        v = S.odo ? S.odo.v : 0,
        w = S.odo ? S.odo.w : 0,
        y = new Uint8Array(NBEAM);
      xs.push(detFeatures(r, prev ? scanReproject(prev, v, w, S.t - prevT) : null, v, w, detStatic(r, S.est)));
      for (let k = 0; k < NBEAM; k++) {
        if (r[k] >= LMAX - 1e-3) continue;
        const a = rb.th - Math.PI + (k * TAU) / NBEAM,
          hx = rb.x + r[k] * Math.cos(a),
          hy = rb.y + r[k] * Math.sin(a);
        for (const p of S.peds)
          if (hyp(p.x - hx, p.y - hy) <= p.r + 0.12) {
            y[k] = 1;
            positives++;
            break;
          }
      }
      ys.push(y);
      prev = Float32Array.from(r);
      prevT = S.t;
      if (S.fsm.state === 'DONE') break;
    } else {
      if (!S.fsm.queue.length || (S.fsm.state !== 'DRIVE' && S.fsm.state !== 'NO_PATH')) continue;
      const wp = WPS[S.fsm.queue[0]],
        y = expertLabel(S.robot.x, S.robot.y, S.robot.th, wp);
      if (!y) continue;
      xs.push(policyFeatures(S.scan, S.robot, wp, S.odo));
      ys.push(y);
    }
  }
  const x = new Float32Array(xs.length * NF),
    y = det ? new Uint8Array(ys.length * NY) : new Float32Array(ys.length * NY);
  xs.forEach((f, i) => x.set(f, i * NF));
  ys.forEach((f, i) => y.set(f, i * NY));
  return {
    x,
    y,
    n: xs.length,
    positives,
    ...(det ? {cond: detCond(sp)} : {}),
    goalsDone: WPS.filter(g => g.done && !g.skipped).length,
    goals: WPS.length,
    t: +S.t.toFixed(1)
  };
}
// @end
