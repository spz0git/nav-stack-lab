// The out-of-distribution references of the built-in models (core/learnmon.js): the runs each model file lists as
// trained_on are replayed on the headless core, the description of every input the model would have read is taken
// (oodDesc), and their mean, σ and the score's 99th percentile are written into the model file as `ref`. The policy's
// file lists datasets, not runs: its runs are the collector's recipes in training/policy/README.md (expert: noise 0.4,
// seeds 1–8, 150 s; dagger1: the built-in policy driving, noise 0.1, seeds 11–16, 120 s, on the levels without people).
// The core has changed since the models were trained, so the replayed runs are close to the training runs, not equal.
//   node tools/ood-ref.mjs detector; node tools/ood-ref.mjs predictor; node tools/ood-ref.mjs policy; then ./build.sh
// It runs the built core (dist/core-worker.js), so after a training/<block>/train.py: ./build.sh (which warns that the
// model has no ref), this, ./build.sh again (training/README.md).
// One block per process, as the collectors run: a run's settings carry over to the next run in the same core.
import fs from 'node:fs';
import path from 'node:path';
import {loadCore, ROOT, collectSources} from '../tests/node/core.mjs';
loadCore();
const C = globalThis.__core,
  which = [process.argv[2] || 'detector'],
  levelIdx = id => C.LEVELS.findIndex(L => L.id === id);
async function runs(block, list) {
  const descs = [];
  for (const sp of list) {
    const d = await C.collectRun({block, goals: 'level', ...sp}),
      NF = d.n ? d.x.length / d.n : 0;
    for (let i = 0; i < d.n; i++) descs.push(C.oodDesc(block, d.x.subarray(i * NF, (i + 1) * NF)));
    process.stdout.write(`${block} ${JSON.stringify({level: sp.level, seed: sp.seed})}: ${d.n} inputs\n`);
  }
  return descs;
}
for (const block of which) {
  const file = path.join(ROOT, 'src', 'models', `${block}.json`),
    M = JSON.parse(fs.readFileSync(file, 'utf8')),
    T = M.trained_on;
  let list;
  if (block === 'detector')
    list = T.runs.map(r => ({level: levelIdx(r.level), seed: r.seed, cond: r.cond, secs: Math.round(r.scans / 10), people: 'alt'}));
  else if (block === 'predictor')
    list = T.runs.map(r => ({level: levelIdx(r.level), seed: r.seed, people: r.people, spd: r.spd, secs: 150}));
  else {
    const SRC = collectSources([], L => !(L.peds || []).length && L.cfg.model !== 'car');
    list = [];
    for (const s of SRC) {
      for (const seed of [1, 2, 3, 4, 5, 6, 7, 8])
        list.push({level: s.level, seed, secs: 150, goals: {random: 6}, noise: 0.4, driver: 'expert'});
      for (const seed of [11, 12, 13, 14, 15, 16])
        list.push({level: s.level, seed, secs: 120, goals: {random: 6}, noise: 0.1, driver: 'policy'});
    }
  }
  const descs = await runs(block, list),
    ref = C.oodRef(descs);
  ref.from = block === 'policy' ? 'the collector recipes of training/policy/README.md, replayed' : 'the trained_on runs, replayed';
  M.ref = ref;
  fs.writeFileSync(file, JSON.stringify(M));
  console.log(`${block}: ${ref.n} inputs, threshold ${ref.thr}`);
}
