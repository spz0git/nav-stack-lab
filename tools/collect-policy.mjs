// Training data for the end-to-end policy (training/policy/train.py). At every lidar scan of a headless run the
// policy's inputs are recorded with the expert's answer from that state: the A* route to the goal, resampled to eight
// points 0.4 m apart in the robot frame. Two ways to reach states:
//   expert: the classical stack drives, its executed commands perturbed (actuation noise) so the data covers the
//           neighbourhood of the demonstrated path (DART);
//   policy: the current learned policy drives (the build must carry it) and the expert labels the states it reaches,
//           which is DAgger: the student's mistakes get the teacher's answer.
// Each call writes one tagged dataset into training/data/ (policy-<tag>.json, -x.f32, -y.f32); the trainer uses all.
//   node tools/collect-policy.mjs <tag> [mode = expert|policy] [noise = 0.3] [seeds = 1..6] [seconds = 150]
import fs from 'node:fs';
import path from 'node:path';
import {loadCore, ROOT} from '../tests/node/core.mjs';
loadCore();
const C = globalThis.__core,
  TAG = process.argv[2] || 'expert',
  MODE = process.argv[3] || 'expert',
  NOISE = process.argv[4] == null ? 0.3 : +process.argv[4],
  SEEDS = (process.argv[5] || '1,2,3,4,5,6').split(',').map(Number),
  SECS = +(process.argv[6] || 150),
  NB = 120,
  NF = C.policyFeatures(new Float32Array(NB).fill(8), {x: 0, y: 0, th: 0}, {x: 1, y: 0}, {v: 0, w: 0}).length,
  NW = 8,
  STEP = 0.4;
// the expert's route from (x, y) to the goal, as NW points STEP apart in the robot frame at heading th
function expertLabel(x, y, th, wp) {
  const R = C.astar(x, y, wp.x, wp.y);
  if (!R.ok) return null;
  const pts = R.pts,
    y8 = new Float32Array(2 * NW),
    c = Math.cos(th),
    s = Math.sin(th);
  let seg = 1,
    acc = 0,
    px = pts[0][0],
    py = pts[0][1];
  for (let k = 1; k <= NW; k++) {
    let want = k * STEP,
      qx = pts[pts.length - 1][0],
      qy = pts[pts.length - 1][1];
    // walk the polyline to arc length `want`
    let d = acc,
      i = seg,
      ax = px,
      ay = py;
    for (; i < pts.length; i++) {
      const L = Math.hypot(pts[i][0] - ax, pts[i][1] - ay);
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
const X = [],
  Y = [],
  runs = [];
for (let L = 0; L < C.LEVELS.length; L++) {
  if ((C.LEVELS[L].peds || []).length || C.LEVELS[L].cfg.model === 'car') continue;
  for (const seed of SEEDS) {
    C.P.seed = seed;
    C.loadLevel(L);
    C.setParam('spd', 'st', false);
    C.setParam('actNoise', NOISE, false);
    if (MODE === 'policy') C.setParam('plan', 'policy', false);
    const S = C.S,
      goals = [];
    for (let i = 0; i < 6; i++) {
      const g = C.randomFree(S.rngA);
      goals.push([g.x, g.y]);
    }
    C.setGoals(goals);
    const N = Math.round(SECS / 0.05);
    let n = 0;
    for (let i = 0; i < N; i++) {
      await C.advance(1);
      if (S.fsm.state === 'DONE') break;
      if (S.scanTick !== S.tick || !S.scan || !S.fsm.queue.length) continue;
      if (S.fsm.state !== 'DRIVE' && S.fsm.state !== 'NO_PATH') continue;
      const wp = C.WPS[S.fsm.queue[0]],
        y = expertLabel(S.robot.x, S.robot.y, S.robot.th, wp);
      if (!y) continue;
      X.push(C.policyFeatures(S.scan, S.robot, wp, S.odo));
      Y.push(y);
      n++;
    }
    runs.push({level: C.LEVELS[L].id, seed, samples: n, mode: MODE, noise: NOISE});
    console.log(`${C.LEVELS[L].id} seed ${seed} (${MODE}): ${n} samples`);
  }
}
const dir = path.join(ROOT, 'training', 'data');
fs.mkdirSync(dir, {recursive: true});
const fx = new Float32Array(X.length * NF),
  fy = new Float32Array(Y.length * 2 * NW);
X.forEach((f, i) => fx.set(f, i * NF));
Y.forEach((y, i) => fy.set(y, i * 2 * NW));
fs.writeFileSync(path.join(dir, `policy-${TAG}-x.f32`), Buffer.from(fx.buffer));
fs.writeFileSync(path.join(dir, `policy-${TAG}-y.f32`), Buffer.from(fy.buffer));
fs.writeFileSync(
  path.join(dir, `policy-${TAG}.json`),
  JSON.stringify(
    {
      tag: TAG,
      mode: MODE,
      samples: X.length,
      features: NF,
      waypoints: NW,
      step: STEP,
      runs,
      note: 'x: [samples, 139] float32 (120 ranges/8, 12 sector minima/8, goal dx/10, dy/10, dist/10, cos b, sin b, v/1.5, w/2); y: [samples, 16] float32, the A* route ahead at 0.4 m steps in the robot frame / 4 m'
    },
    null,
    1
  )
);
console.log(`${X.length} samples, ${runs.length} runs → training/data/policy-${TAG}`);
