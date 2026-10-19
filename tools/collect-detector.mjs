// Training data for the learned people detector (training/detector/train.py): every lidar scan of headless runs on
// the levels that have people, with one label per beam, 1 when the beam's hit lies on a person. Written as raw
// float32 (features) and uint8 (labels) with a JSON side file into training/data/, which is not committed.
//   node tools/collect-detector.mjs [seconds per run = 120] [seeds = 21..38]
// Features per beam, 7 channels: range/8, the previous scan reprojected through the odometry into this frame /8 (so a
// static wall reads the same range twice and a person does not), the change clipped to ±1, hit flag, the odometry's
// v/1.5 and ω/2 broadcast over the beams, and the map's evidence that the hit is static. The runs take the three map
// conditions in turn (prior map; built by lidar; prior map with dead-reckoning drift; core/dataset.js). Labels come
// from the true pose and the people's true discs; the ranges are the noisy ones the page sees. The seeds start at 21
// so that the lessons' seeds (7 and 1–20) are runs the built-in model has not seen.
import fs from 'node:fs';
import path from 'node:path';
import {loadCore, ROOT} from '../tests/node/core.mjs';
loadCore();
const C = globalThis.__core,
  SECS = +(process.argv[2] || 120),
  SEEDS = (process.argv[3] || Array.from({length: 18}, (_, i) => 21 + i).join(',')).split(',').map(Number),
  NB = 120,
  CH = 7;
const X = [],
  Y = [],
  runs = [];
let positives = 0;
for (let L = 0; L < C.LEVELS.length; L++) {
  if (!C.LEVELS[L].peds || !C.LEVELS[L].peds.length) continue;
  for (const seed of SEEDS) {
    // the run itself is the core's (core/dataset.js), the same code the page's Train tab collects with
    const d = await C.collectRun({block: 'detector', level: L, seed, secs: SECS, goals: 'level', people: 'alt'});
    for (let i = 0; i < d.n; i++) {
      X.push(d.x.subarray(i * NB * CH, (i + 1) * NB * CH));
      Y.push(d.y.subarray(i * NB, (i + 1) * NB));
    }
    positives += d.positives;
    runs.push({level: C.LEVELS[L].id, seed, cond: d.cond, scans: d.n});
    console.log(`${C.LEVELS[L].id} seed ${seed} ${d.cond}: ${d.n} scans`);
  }
}
const dir = path.join(ROOT, 'training', 'data');
fs.mkdirSync(dir, {recursive: true});
const fx = new Float32Array(X.length * NB * CH),
  fy = new Uint8Array(Y.length * NB);
X.forEach((f, i) => fx.set(f, i * NB * CH));
Y.forEach((y, i) => fy.set(y, i * NB));
fs.writeFileSync(path.join(dir, 'detector-x.f32'), Buffer.from(fx.buffer));
fs.writeFileSync(path.join(dir, 'detector-y.u8'), Buffer.from(fy.buffer));
fs.writeFileSync(
  path.join(dir, 'detector.json'),
  JSON.stringify(
    {scans: X.length, beams: NB, channels: CH, runs, positives, note: 'x: [scans, beams, channels] float32; y: [scans, beams] uint8'},
    null,
    1
  )
);
console.log(
  `${X.length} scans, ${positives} person beams (${((100 * positives) / (X.length * NB)).toFixed(1)} %), ${runs.length} runs → training/data/`
);
