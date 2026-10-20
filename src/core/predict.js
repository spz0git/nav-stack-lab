/* ============================================================
   The learned people predictor: a small multilayer perceptron (MODELS.predictor, trained in training/predictor, or one
   trained in the Train tab) that reads a tracked person's last second and the robot's place and motion, and gives K = 3
   futures for the next 3 s with a probability each. It predicts the correction to constant velocity, so a network
   that outputs zeros is constant velocity.
   The frame is the person's: the origin at the tracked position now, x along the way they have been walking over the
   last second (towards the robot when they stand), so that a person walking an aisle looks the same whichever way
   the aisle runs. Features (24):
     5 past positions at 0.2 … 1.0 s ago, relative to now (m)          10
     the tracked velocity (m/s)                                          2
     the robot's position /4 (clipped at 8 m) and velocity (m/s)         4
     free space along 8 rays from the person, every 45°, in the
     robot's map, /4 (clipped at 4 m)                                    8
   Output (39): K logits, then for each mode 6 points (0.5 … 3 s) of (x, y) minus the constant-velocity point.
   It also keeps every run's prediction error at 1 s and 2 s, constant velocity and learned side by side (truth is
   only used for that score and for the training labels).
   ============================================================ */
// (PRED_K, PRED_H, PRED_LAGS, PRED_RAYS, PRED_NF, PRED_NO: core/constants.js)
const PRED_PMIN = 0.2; // modes the planners treat as obstacles: at least this probable (the most probable always)
// Each track's recent positions [t, x, y], kept by id outside the track (the ground-truth tracker rebuilds its tracks
// every tick), at most one per 0.1 s and 1.3 s long
function predHistTick() {
  const A = S.agents;
  if (!A.hist) A.hist = new Map();
  const H = A.hist,
    seen = new Set();
  for (const t of A.tracks) {
    seen.add(t.id);
    let h = H.get(t.id);
    if (!h) H.set(t.id, (h = []));
    if (h.length && S.t - h[h.length - 1][0] < 0.09) continue;
    h.push([S.t, t.x, t.y]);
    while (h.length && S.t - h[0][0] > 1.3) h.shift();
  }
  for (const id of [...H.keys()]) if (!seen.has(id)) H.delete(id);
}
// The track's position tau s ago, from its history (linear between samples); before the history starts, constant
// velocity backwards from the oldest sample
function predPast(t, h, tau) {
  const tq = S.t - tau;
  if (!h || !h.length) return [t.x - t.vx * tau, t.y - t.vy * tau];
  if (tq <= h[0][0]) {
    const d = h[0][0] - tq;
    return [h[0][1] - t.vx * d, h[0][2] - t.vy * d];
  }
  for (let i = h.length - 1; i > 0; i--)
    if (h[i - 1][0] <= tq) {
      const a = h[i - 1],
        b = h[i],
        f = (tq - a[0]) / Math.max(1e-6, b[0] - a[0]);
      return [a[1] + f * (b[1] - a[1]), a[2] + f * (b[2] - a[2])];
    }
  return [t.x, t.y];
}
// Free space from (x, y) along direction a in the robot's map, by sphere tracing the distance transform, up to 4 m
function predRay(x, y, a) {
  const c = Math.cos(a),
    s = Math.sin(a),
    D = S.cm.dist;
  let d = 0;
  while (d < 4) {
    const k = cellIdx(x + d * c, y + d * s);
    if (k < 0) break;
    const r = D[k];
    if (r < 0.06) break;
    d += Math.max(0.05, r - 0.05);
  }
  return Math.min(d, 4);
}
// @code pred-features | predFeatures: what the predictor reads, in the person's frame
// t: a track; h: its history; e: the robot's estimated pose; v: the robot's speed along its heading. Returns the 24
// numbers and the frame {x, y, c, s} (origin and heading) that turns the outputs back into the map.
function predFeatures(t, h, e, v) {
  const old = predPast(t, h, 1.0);
  let hx = t.x - old[0],
    hy = t.y - old[1];
  if (hyp(hx, hy) < 0.15) {
    hx = e.x - t.x; // standing: face the robot
    hy = e.y - t.y;
  }
  const n = hyp(hx, hy) || 1,
    c = hx / n,
    s = hy / n,
    rot = (dx, dy) => [c * dx + s * dy, -s * dx + c * dy], // map → person frame
    f = new Float32Array(PRED_NF);
  let o = 0;
  for (const tau of PRED_LAGS) {
    const p = predPast(t, h, tau),
      q = rot(p[0] - t.x, p[1] - t.y);
    f[o++] = q[0];
    f[o++] = q[1];
  }
  const vq = rot(t.vx, t.vy);
  f[o++] = vq[0];
  f[o++] = vq[1];
  let rx = e.x - t.x,
    ry = e.y - t.y;
  const rd = hyp(rx, ry);
  if (rd > 8) {
    rx *= 8 / rd;
    ry *= 8 / rd;
  }
  const rq = rot(rx, ry),
    rv = rot(v * Math.cos(e.th), v * Math.sin(e.th));
  f[o++] = rq[0] / 4;
  f[o++] = rq[1] / 4;
  f[o++] = rv[0];
  f[o++] = rv[1];
  const a0 = Math.atan2(s, c);
  for (let k = 0; k < PRED_RAYS; k++) f[o++] = predRay(t.x, t.y, a0 + (k * TAU) / PRED_RAYS) / 4;
  return {f, fr: {x: t.x, y: t.y, c, s}};
}
// @end
// @code pred-decode | predDecode: the network's 39 numbers as three futures with a probability each
// Softmax over the K logits; each mode's points are the constant-velocity points (the tracked velocity, f[10], f[11])
// plus the network's correction, rotated back into the map.
function predDecode(out, f, fr) {
  let mx = -Infinity;
  for (let k = 0; k < PRED_K; k++) mx = Math.max(mx, out[k]);
  let z = 0;
  const e = [];
  for (let k = 0; k < PRED_K; k++) z += e[k] = Math.exp(out[k] - mx);
  const vx = f[10],
    vy = f[11],
    NH = PRED_H.length;
  return Array.from({length: PRED_K}, (_, k) => ({
    p: e[k] / z,
    pts: PRED_H.map((tt, j) => {
      const o = PRED_K + (k * NH + j) * 2,
        qx = vx * tt + out[o],
        qy = vy * tt + out[o + 1];
      return [fr.x + fr.c * qx - fr.s * qy, fr.y + fr.s * qx + fr.c * qy];
    })
  })).sort((a, b) => b.p - a.p);
}
// @end
// The learned futures of one track now: [{p, pts}] most probable first, or null without a model
function predLearned(t, M) {
  const e = S.est,
    v = S.odo ? S.odo.v : 0,
    {f, fr} = predFeatures(t, S.agents.hist && S.agents.hist.get(t.id), e, v);
  return predDecode(mlpForward(M, f), f, fr);
}
// Every scan: the learned futures of each confirmed track (when a model is there and the learned predictor is picked or
// the scores are kept), and the score of both predictors
function predTick() {
  const A = S.agents,
    M = nnModel('predictor');
  predHistTick();
  for (const t of A.tracks) {
    t.lp = null;
    if (M && t.conf) t.lp = {t0: S.t, modes: predLearned(t, M)};
  }
  predScore();
}
// The true positions as the robot's map has them now: through the pose estimate (a person 2 m ahead of the true robot
// is 2 m ahead of the estimated one), so that a localization error is not counted as the predictor's. Returns
// (x, y) → [x, y] for this moment's poses. Ground-truth tracks are in the true frame already.
function predTruthFrame() {
  if (P.agents === 'truth') return (x, y) => [x, y];
  const {x: rx, y: ry, th: rth} = S.robot, // copies: the poses move on
    {x: ex, y: ey, th: eth} = S.est,
    c = Math.cos(eth - rth),
    s = Math.sin(eth - rth);
  return (x, y) => {
    const dx = x - rx,
      dy = y - ry;
    return [ex + c * dx - s * dy, ey + s * dx + c * dy];
  };
}
// The person nearest track t (within 0.8 m, in the estimate's frame), or −1
function predNearest(t, tf) {
  let j = -1,
    best = 0.8;
  S.peds.forEach((p, i) => {
    const q = tf(p.x, p.y),
      d = hyp(q[0] - t.x, q[1] - t.y);
    if (d < best) {
      best = d;
      j = i;
    }
  });
  return j;
}
// @code pred-score | predScore: each predictor's error at 1 s and 2 s, against where the person really is
// At every scan each confirmed track near a person makes its predictions for 1 s and 2 s ahead (constant velocity, and
// the learned model's most probable mode); when that time comes they are compared with the person's true position, seen
// through the pose estimate of the moment the prediction was made (tf). No new predictions once the mission is done.
function predScore() {
  const A = S.agents;
  if (!A.pe) A.pe = {cv: [0, 0, 0, 0], ln: [0, 0, 0, 0], due: []}; // [Σ err at 1 s, count, Σ err at 2 s, count]
  const E = A.pe;
  for (let i = E.due.length - 1; i >= 0; i--) {
    const d = E.due[i];
    if (d.t > S.t + 1e-6) continue;
    const p = S.peds[d.j];
    if (p) {
      const q = d.tf(p.x, p.y),
        err = hyp(q[0] - d.x, q[1] - d.y),
        s = E[d.kind];
      s[d.h ? 2 : 0] += err;
      s[d.h ? 3 : 1]++;
    }
    E.due.splice(i, 1);
  }
  if (S.fsm.state === 'DONE') return; // the score covers the mission: it stays put once the last goal is reached
  const tf = predTruthFrame();
  for (const t of A.tracks) {
    if (!t.conf) continue;
    const j = predNearest(t, tf);
    if (j < 0) continue;
    for (const [h, tt] of [
      [0, 1],
      [1, 2]
    ]) {
      E.due.push({t: S.t + tt, j, h, tf, kind: 'cv', x: t.x + t.vx * tt, y: t.y + t.vy * tt});
      if (t.lp) {
        const q = predAt(t.lp.modes[0], tt);
        E.due.push({t: S.t + tt, j, h, tf, kind: 'ln', x: q[0], y: q[1]});
      }
    }
  }
}
// @end
// The mean errors so far: {cv: [at 1 s, at 2 s], ln: [...], n} (null where there is no sample)
function predErrors() {
  const E = S.agents && S.agents.pe;
  if (!E) return null;
  const m = (s, i) => (s[i + 1] ? s[i] / s[i + 1] : null);
  return {cv: [m(E.cv, 0), m(E.cv, 2)], ln: [m(E.ln, 0), m(E.ln, 2)], n: E.cv[1]};
}
// A mode's position at time tt: linear between its points, from the person's position at 0; past 3 s, its last
// segment continued
function predAt(m, tt, x0, y0) {
  const P0 = x0 == null ? m.pts[0] : null,
    pts = m.pts;
  if (tt <= PRED_H[0]) {
    if (P0) return pts[0];
    const f = tt / PRED_H[0];
    return [x0 + f * (pts[0][0] - x0), y0 + f * (pts[0][1] - y0)];
  }
  const NH = PRED_H.length;
  let j = 1;
  while (j < NH - 1 && PRED_H[j] < tt) j++;
  const a = pts[j - 1],
    b = pts[j],
    f = (tt - PRED_H[j - 1]) / (PRED_H[j] - PRED_H[j - 1]);
  return [a[0] + f * (b[0] - a[0]), a[1] + f * (b[1] - a[1])];
}
// The track's predicted disc at tt with the learned futures: mode a.mode (the planners' copies, agListModes) or the
// most probable one; the radius grows like constant velocity's, so that only the centre differs between the two
function predLearnedDisc(t, tt) {
  const L = t.lp,
    m = L.modes[t.mode || 0],
    q = predAt(m, tt + (S.t - L.t0), t.x, t.y);
  return [q[0], q[1], t.r + P.agGrow * tt];
}
// The tracks the planners avoid. With the learned predictor and P.predModes 'all', each mode at least PRED_PMIN probable
// is its own copy (same id, its mode); otherwise the tracks themselves (the learned one: its most probable future)
function agListModes(rng) {
  const L = agList(rng);
  if (P.agPred !== 'learned' || P.predModes !== 'all') return L;
  const out = [];
  for (const t of L) {
    if (!t.lp) {
      out.push(t);
      continue;
    }
    t.lp.modes.forEach((m, k) => {
      if (k === 0 || m.p >= PRED_PMIN) out.push(k ? {...t, mode: k} : t);
    });
  }
  return out;
}
