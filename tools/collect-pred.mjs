// Training data for the learned people predictor (training/predictor/train.py): at every lidar scan of headless runs on
// the levels that have people, each confirmed track near a person, with where that person really went over the next
// 3 s. Written as raw float32 (features, labels) with a JSON side file into training/data/, which is not committed.
//   node tools/collect-pred.mjs [seconds per run = 150] [seeds = 21..44] [--gen families or spec JSON]
// With --gen the runs are on generated worlds (four people each unless the spec says), one per seed
// (tests/node/core.mjs, collectSources).
// Features per sample, 24 (core/predict.js, predFeatures): the track's last second (five past positions and its
// velocity) in the person's frame, the robot's position and velocity in that frame, and free space along eight rays in
// the robot's map. Labels, 12: the true position at 0.5, 1, … 3 s in the same frame minus the constant-velocity point.
// The people alternate scripted and reactive by seed, and the robot alternates yielding (speed planning) and ignoring
// them, so that reactive people also meet it up close (core/dataset.js). The mission loops for the whole run. The seeds
// start at 21 so that the lessons' seeds (7 and 1–20) are runs the built-in model has not seen.
import fs from 'node:fs';
import path from 'node:path';
import {loadCore, ROOT, collectSources} from '../tests/node/core.mjs';
loadCore();
const SRC = collectSources(process.argv, L => (L.peds || []).length > 0, {people: 4, like: 'L5'});
const C = globalThis.__core,
  SECS = +(process.argv[2] || 150),
  SEEDS = (process.argv[3] || Array.from({length: 24}, (_, i) => 21 + i).join(',')).split(',').map(Number),
  NF = 24,
  NY = 12;
const X = [],
  Y = [],
  runs = [];
for (const src of SRC) {
  for (const seed of SEEDS) {
    const d = await C.collectRun({block: 'predictor', level: src.level, gen: src.gen, seed, secs: SECS, goals: 'level', people: 'alt'});
    X.push(d.x);
    Y.push(d.y);
    runs.push({level: src.label, seed, people: d.people, spd: d.spd, samples: d.n});
    console.log(`${src.label} seed ${seed} ${d.people} ${d.spd}: ${d.n} samples`);
  }
}
// the held-out runs go last: the last two seeds of each level (one scripted, one reactive)
const held = r => SEEDS.slice(-2).includes(r.seed),
  order = runs.map((r, i) => i).sort((a, b) => held(runs[a]) - held(runs[b]) || a - b),
  nHold = runs.filter(held).length;
const dir = path.join(ROOT, 'training', 'data');
fs.mkdirSync(dir, {recursive: true});
const n = runs.reduce((a, r) => a + r.samples, 0),
  fx = new Float32Array(n * NF),
  fy = new Float32Array(n * NY);
let o = 0;
for (const i of order) {
  fx.set(X[i], o * NF);
  fy.set(Y[i], o * NY);
  o += runs[i].samples;
}
fs.writeFileSync(path.join(dir, 'predictor-x.f32'), Buffer.from(fx.buffer));
fs.writeFileSync(path.join(dir, 'predictor-y.f32'), Buffer.from(fy.buffer));
fs.writeFileSync(
  path.join(dir, 'predictor.json'),
  JSON.stringify(
    {
      samples: n,
      features: NF,
      outputs: NY,
      runs: order.map(i => runs[i]),
      held_out: order.slice(-nHold).map(i => runs[i]),
      note: 'x: [samples, 24] float32; y: [samples, 12] float32 (true position at 0.5…3 s minus the constant-velocity point, person frame)'
    },
    null,
    1
  )
);
console.log(`${n} samples from ${runs.length} runs → training/data/`);
