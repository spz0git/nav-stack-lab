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
const X = [],
  Y = [],
  runs = [];
for (let L = 0; L < C.LEVELS.length; L++) {
  if ((C.LEVELS[L].peds || []).length || C.LEVELS[L].cfg.model === 'car') continue;
  for (const seed of SEEDS) {
    // the run itself is the core's (core/dataset.js: six random goals, the expert's A* route as the label), the same
    // code the page's Train tab collects with
    const d = await C.collectRun({block: 'policy', level: L, seed, secs: SECS, goals: {random: 6}, noise: NOISE, driver: MODE});
    for (let i = 0; i < d.n; i++) {
      X.push(d.x.subarray(i * NF, (i + 1) * NF));
      Y.push(d.y.subarray(i * 2 * NW, (i + 1) * 2 * NW));
    }
    runs.push({level: C.LEVELS[L].id, seed, samples: d.n, mode: MODE, noise: NOISE});
    console.log(`${C.LEVELS[L].id} seed ${seed} (${MODE}): ${d.n} samples`);
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
