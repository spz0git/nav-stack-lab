/* ============================================================
   The learned blocks under watch (safety lesson 6; docs/safety-lab.md phase 3). Observation only, like core/safety.js:
   nothing here changes what the robot does, and nothing draws a random number, so a run is the same with or without it.
   - Detection by slice: at every lidar scan of a people tracker that detects (the rule's clusters or the learned
     detector's), each person the scan really hits (a beam's true end point on their disc, from the true pose) is
     visible, and found when a detection lies within 0.6 m of where the estimate's frame puts them; a detection near
     nobody is false. Slices: how far (under 2.5 m, 2.5 to 5 m, farther), next to a wall or rack (the person's disc
     within 0.4 m of a static obstacle) or in the open, walking or standing. Vehicles are matched but not counted.
   - Prediction by slice: core/predict.js scores both predictors at 1 s and 2 s; each 2 s prediction also carries its
     slice: a person walking on as they were, one who changes (turns by more than 30°, stops or starts) before the time
     comes, or one standing throughout; within 3 m of the robot or farther.
   - Out of distribution: a model built in carries the statistics of a short description of its inputs over the runs it
     was trained on (ref: mean and σ per element, and thr, the score's 99th percentile on those runs; written by
     tools/ood-ref.mjs, or by the Train tab from its own data). At every use the description's distance from them, the
     root mean square of its z-scores (each clipped at 10), is the score; above thr the input counts as outside what
     the model was trained on. Counted while the mission runs.
   ============================================================ */
const LM_FOUND = 0.6, // a detection this close to a person found them [m]
  LM_WALL = 0.4, // a person whose disc is this close to a static obstacle stands by a wall or rack [m]
  LM_RANGE = [2.5, 5], // the range slices' limits [m]
  LM_SLICES = ['near', 'mid', 'far', 'wall', 'open', 'walking', 'standing'];
function learnInit() {
  const sl = () => Object.fromEntries(LM_SLICES.map(k => [k, [0, 0]])); // [found, visible]
  return {det: {scans: 0, fp: 0, sl: sl()}, ood: {}};
}
// One lidar scan of a detecting tracker (core/agents.js agentsTick, after the detection)
function learnDetTick() {
  const L = S.learn,
    A = S.agents,
    R = S.scan;
  if (!L || !R || (P.agents !== 'lidar' && P.agents !== 'learned') || S.fsm.state === 'IDLE' || S.fsm.state === 'DONE') return;
  const r = S.robot,
    tf = predTruthFrame(),
    D = LV.truthDist,
    seen = new Uint8Array(S.peds.length);
  for (let k = 0; k < NBEAM; k++) {
    if (R[k] >= LMAX - 1e-3) continue;
    const a = r.th - Math.PI + (k * TAU) / NBEAM,
      hx = r.x + R[k] * Math.cos(a),
      hy = r.y + R[k] * Math.sin(a);
    S.peds.forEach((p, i) => {
      if (!seen[i] && hyp(p.x - hx, p.y - hy) <= p.r + 0.12) seen[i] = 1;
    });
  }
  const at = S.peds.map(p => tf(p.x, p.y)),
    used = new Uint8Array(A.det.length);
  S.peds.forEach((p, i) => {
    const q = at[i];
    let found = false;
    A.det.forEach((d, j) => {
      if (hyp(d.x - q[0], d.y - q[1]) < LM_FOUND + (p.car ? 0.6 : 0)) {
        used[j] = 1;
        found = true;
      }
    });
    if (!seen[i] || p.car) return;
    const dist = hyp(p.x - r.x, p.y - r.y),
      ci = Math.floor(p.x / RES),
      cj = Math.floor(p.y / RES),
      wallD = D && ci >= 0 && cj >= 0 && ci < GW && cj < GH ? D[cj * GW + ci] - p.r : Infinity,
      keys = [
        dist < LM_RANGE[0] ? 'near' : dist < LM_RANGE[1] ? 'mid' : 'far',
        wallD < LM_WALL ? 'wall' : 'open',
        hyp(p.vx || 0, p.vy || 0) > 0.1 ? 'walking' : 'standing'
      ];
    for (const k of keys) {
      L.det.sl[k][1]++;
      if (found) L.det.sl[k][0]++;
    }
  });
  L.det.scans++;
  for (let j = 0; j < A.det.length; j++) if (!used[j]) L.det.fp++;
}
// The slice of a 2 s prediction of person j made now (core/predict.js predScore), finished when its time comes
function predSliceAt(j) {
  const p = S.peds[j],
    r = S.robot;
  return {v0: [p.vx || 0, p.vy || 0], near: hyp(p.x - r.x, p.y - r.y) < 3};
}
function predSliceAdd(d, p, err) {
  const L = S.learn;
  if (!L || !d.v0) return;
  const s0 = hyp(d.v0[0], d.v0[1]),
    vx = p.vx || 0,
    vy = p.vy || 0,
    s1 = hyp(vx, vy),
    turn = s0 > 0.1 && s1 > 0.1 ? Math.abs(wrap(Math.atan2(vy, vx) - Math.atan2(d.v0[1], d.v0[0]))) : 0,
    kind = s0 <= 0.1 && s1 <= 0.1 ? 'standing' : s0 <= 0.1 || s1 <= 0.1 || turn > Math.PI / 6 ? 'changing' : 'steady';
  if (!L.pred) L.pred = {};
  if (!L.pred[d.kind]) L.pred[d.kind] = {};
  const E = L.pred[d.kind];
  for (const k of [kind, d.near ? 'near' : 'far']) {
    if (!E[k]) E[k] = [0, 0];
    E[k][0] += err;
    E[k][1]++;
  }
}
// The description of a model's input that its out-of-distribution score compares: the detector's scan (mean and σ of
// the ranges, the share of beams that return and of those that return within 1.5 m, the mean change from the last
// scan, the speed and turn rate, the map's mean evidence on the hits), the policy's scan (its 12 sector minima, the
// mean range, the shares that return and within 1.5 m), goal distance, speed and turn rate, and the predictor's 24
// inputs as they are
function oodDesc(block, f) {
  if (block === 'predictor') return f;
  if (block === 'detector') {
    const CH = f.length / NBEAM;
    let s = 0,
      s2 = 0,
      hit = 0,
      near = 0,
      dch = 0,
      ev = 0;
    for (let k = 0; k < NBEAM; k++) {
      const r = f[k * CH],
        h = f[k * CH + 3];
      s += r;
      s2 += r * r;
      hit += h;
      if (h && r * LMAX < 1.5) near++;
      dch += Math.abs(f[k * CH + 2]);
      if (CH > 6 && h) ev += f[k * CH + 6];
    }
    const m = s / NBEAM;
    return [m, Math.sqrt(Math.max(0, s2 / NBEAM - m * m)), hit / NBEAM, near / NBEAM, dch / NBEAM, f[4], f[5], hit ? ev / hit : 0];
  }
  const NS = 12,
    o = NBEAM + NS;
  let s = 0,
    hit = 0,
    near = 0;
  for (let k = 0; k < NBEAM; k++) {
    s += f[k];
    if (f[k] < 1 - 1e-4) {
      hit++;
      if (f[k] * LMAX < 1.5) near++;
    }
  }
  return [...f.subarray(NBEAM, o), s / NBEAM, hit / NBEAM, near / NBEAM, f[o + 2], f[o + 5], f[o + 6]];
}
// The score of a description against a reference {mean, sd}
function oodScore(x, ref) {
  let s = 0;
  for (let i = 0; i < x.length; i++) {
    const z = Math.min(10, Math.abs(x[i] - ref.mean[i]) / Math.max(ref.sd[i], 1e-3));
    s += z * z;
  }
  return Math.sqrt(s / x.length);
}
// A reference from descriptions of the training inputs: mean, σ, and the 99th percentile of their own scores
function oodRef(descs) {
  const n = descs.length,
    m = descs[0].length,
    mean = new Array(m).fill(0),
    sd = new Array(m).fill(0);
  for (const x of descs) for (let i = 0; i < m; i++) mean[i] += x[i] / n;
  for (const x of descs) for (let i = 0; i < m; i++) sd[i] += (x[i] - mean[i]) ** 2 / n;
  for (let i = 0; i < m; i++) sd[i] = Math.sqrt(sd[i]);
  const ref = {mean: mean.map(v => +v.toPrecision(5)), sd: sd.map(v => +v.toPrecision(5)), n};
  const sc = descs.map(x => oodScore(x, ref)).sort((a, b) => a - b);
  ref.thr = +sc[Math.min(n - 1, Math.floor(0.99 * n))].toFixed(3);
  return ref;
}
// Called where a learned block reads its input (core/agents.js, core/predict.js, core/planning-policy.js)
function oodNote(block, f, M) {
  const L = S.learn;
  if (!L || !M || !M.ref) return;
  const sc = oodScore(oodDesc(block, f), M.ref);
  if (!L.ood[block]) L.ood[block] = {n: 0, sum: 0, out: 0, max: 0, last: 0, thr: M.ref.thr};
  const O = L.ood[block];
  O.last = sc;
  O.thr = M.ref.thr;
  if (!O.win) O.win = [];
  O.win.push([S.t, sc > M.ref.thr]);
  while (O.win.length && O.win[0][0] < S.t - LM_WIN) O.win.shift();
  if (S.fsm.state === 'IDLE' || S.fsm.state === 'DONE') return;
  O.n++;
  O.sum += sc;
  if (sc > M.ref.thr) O.out++;
  if (sc > O.max) O.max = sc;
}
// The health check (core/health.js): a block in use whose inputs were outside its training data for more than half of
// the last LM_WIN seconds. Live state only: a recorded frame has no window, so the check is off in a replay.
const LM_WIN = 5,
  LM_USE = {
    detector: ['per', () => P.agents === 'learned', 'detector'],
    predictor: ['per', () => P.agents !== 'off' && P.agPred === 'learned', 'predictor'],
    policy: ['plan', () => P.plan === 'policy', 'policy']
  };
function learnHealth(C, k, f) {
  const L = S.learn;
  for (const [b, [sys, used, name]] of Object.entries(LM_USE)) {
    if (sys !== k || !used()) continue;
    const W = !f && L && L.ood[b] && L.ood[b].win,
      share = W && W.length >= 3 ? W.filter(w => w[1]).length / W.length : 0;
    C(
      k,
      `Out of distribution (${name})`,
      share > 0.5,
      'warn',
      `the learned ${name}'s input is unlike its training data: ${(100 * share).toFixed(0)} % of the last ${LM_WIN} s outside`
    );
  }
}
// The scores now, of the blocks in use, for the recorded frames' signals (core/record.js); null when none is in use
function learnSig() {
  const L = S.learn;
  let out = null;
  for (const [b, [, used]] of Object.entries(LM_USE))
    if (used() && L && L.ood[b]) {
      if (!out) out = {};
      out[b] = L.ood[b].last;
    }
  return out;
}
// The summary's fields (src/worker/main.js runSummary): recall and false detections per scan, overall and per slice;
// each predictor's mean 2 s error per slice; each block's mean score, share outside and worst score
function learnSummary() {
  const L = S.learn;
  if (!L) return {};
  const f = (x, n = 2) => (x == null || !isFinite(x) ? null : +x.toFixed(n)),
    D = L.det,
    all = ['near', 'mid', 'far'].reduce((a, k) => [a[0] + D.sl[k][0], a[1] + D.sl[k][1]], [0, 0]),
    out = {};
  if (D.scans)
    out.det = {
      scans: D.scans,
      recall: all[1] ? f(all[0] / all[1], 3) : null,
      fpScan: f(D.fp / D.scans, 3),
      slices: Object.fromEntries(LM_SLICES.map(k => [k, D.sl[k][1] ? [f(D.sl[k][0] / D.sl[k][1], 3), D.sl[k][1]] : [null, 0]]))
    };
  if (L.pred)
    out.predSl = Object.fromEntries(
      Object.entries(L.pred).map(([kind, E]) => [kind, Object.fromEntries(Object.entries(E).map(([k, s]) => [k, [f(s[0] / s[1]), s[1]]]))])
    );
  const O = Object.entries(L.ood);
  if (O.length)
    out.ood = Object.fromEntries(
      O.map(([b, o]) => [b, {mean: o.n ? f(o.sum / o.n) : null, out: o.n ? f(o.out / o.n, 3) : null, max: f(o.max), thr: o.thr, n: o.n}])
    );
  return out;
}
