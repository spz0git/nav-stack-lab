// Unit tests for training in the page (core/nn-train.js, core/dataset.js), on the built worker core. `npm test`.
// Backpropagation against central differences (in double precision, a copy of the source with Float64Array, so that
// the difference quotient is exact enough to compare), the fast forward pass against the page's nnForward /
// mlpForward on the built-in models, one collection run of each block (on a random-obstacle map for the policy), and
// a few epochs of training that must bring the loss down.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {loadCore, ROOT} from './core.mjs';
loadCore();
const C = globalThis.__core;

function float64Trainer() {
  const src = ['core/constants.js', 'core/nn.js', 'core/nn-train.js']
    .map(f => fs.readFileSync(path.join(ROOT, 'src', f), 'utf8'))
    .join('\n')
    .replace(/Float32Array/g, 'Float64Array');
  return new Function('const POLICY_N = 8, POLICY_K = 4;\n' + src + '\nreturn {nnInit, nnGrad, nnFlat, nnUnflat};')();
}

test('nnGrad: the gradient equals central differences (conv detector, MLP policy and predictor with the mixture loss)', () => {
  const T = float64Trainer();
  let u = 12345;
  const rnd = () => ((u = (u * 1103515245 + 12345) % 2147483648) / 2147483648) * 2 - 1;
  for (const [block, hidden, n, nin, nout, loss, K] of [
    [
      'detector',
      [
        [5, 3],
        [4, 5]
      ],
      120,
      7,
      1,
      'bce'
    ],
    ['policy', [7, 6], 1, 139, 16, 'mix', 4],
    ['predictor', [7, 6], 1, 24, 12, 'mix', 3]
  ]) {
    const m = T.nnInit(block, hidden, 3),
      ns = 3,
      X = Float64Array.from({length: ns * n * nin}, rnd),
      Y = Float64Array.from({length: ns * n * nout}, () => (loss === 'bce' ? (rnd() > 0.6 ? 1 : 0) : rnd())),
      task = {loss, n, posW: 2.5, K, ny: nout, sigma: 0.5},
      idx = [0, 1, 2],
      {g} = T.nnGrad(m, X, Y, idx, task),
      w = T.nnFlat(m);
    for (let t = 0; t < 60; t++) {
      const i = (t * 7919) % w.length,
        h = 1e-6,
        wp = w.slice(),
        wm = w.slice();
      wp[i] += h;
      wm[i] -= h;
      const num =
        (T.nnGrad(T.nnUnflat(m, wp), X, Y, idx, {...task}).loss - T.nnGrad(T.nnUnflat(m, wm), X, Y, idx, {...task}).loss) / (2 * h);
      assert.ok(Math.abs(num - g[i]) <= 1e-5 * Math.max(1, Math.abs(num)), `${block} weight ${i}: backprop ${g[i]}, differences ${num}`);
    }
  }
});

test('nnPredict reproduces nnForward and mlpForward on the built-in models', () => {
  const det = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/models/detector.json'), 'utf8')),
    pol = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/models/policy.json'), 'utf8')),
    X = Float32Array.from({length: 4 * 840}, (_, i) => (Math.sin(i * 0.37) + 1) / 2),
    p = C.nnPredict(det, X, 4, 120);
  for (let s = 0; s < 4; s++) {
    const q = C.nnForward(det, X.subarray(s * 840, (s + 1) * 840), 120);
    for (let k = 0; k < 120; k++) assert.ok(Math.abs(q[k] - p[s * 120 + k]) < 1e-5, `detector scan ${s} beam ${k}`);
  }
  const Xp = Float32Array.from({length: 40 * 139}, (_, i) => Math.cos(i * 0.11)),
    pp = C.nnPredict(pol, Xp, 40, 1),
    NO = pol.layers[pol.layers.length - 1].nout;
  assert.equal(NO, 4 + 4 * 16, 'four scores and four candidate paths');
  for (let s = 0; s < 40; s++) {
    const q = C.mlpForward(pol, Xp.subarray(s * 139, (s + 1) * 139));
    for (let k = 0; k < NO; k++) assert.ok(Math.abs(q[k] - pp[s * NO + k]) < 1e-5, `policy sample ${s} output ${k}`);
  }
  const prd = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/models/predictor.json'), 'utf8')),
    Xq = Float32Array.from({length: 20 * 24}, (_, i) => Math.sin(i * 0.23)),
    pq = C.nnPredict(prd, Xq, 20, 1);
  for (let s = 0; s < 20; s++) {
    const q = C.mlpForward(prd, Xq.subarray(s * 24, (s + 1) * 24));
    for (let k = 0; k < 39; k++) assert.ok(Math.abs(q[k] - pq[s * 39 + k]) < 1e-5, `predictor sample ${s} output ${k}`);
  }
});

test('collectRun: a predictor run pairs each tracked person with where they went; the built-in model beats constant velocity on it', async () => {
  const d = await C.collectRun({block: 'predictor', level: 4, seed: 3, secs: 60, goals: 'level', people: 'alt'});
  assert.ok(d.n > 100, `samples: ${d.n}`);
  assert.equal(d.x.length, d.n * 24);
  assert.equal(d.y.length, d.n * 12);
  assert.equal(C.P.misLoop, true, 'the mission loops');
  const M = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/models/predictor.json'), 'utf8')),
    ev = C.nnEvaluate(M, d.x, d.y, 'predictor');
  assert.ok(ev.top[1] < ev.cv[1], `error at 2 s: learned ${ev.top[1]}, constant velocity ${ev.cv[1]}`);
  assert.ok(ev.best[1] <= ev.top[1], 'the best of three is no worse than the most probable');
});

test('collectRun: a detector run labels person beams; a policy run on random obstacles records the expert route', async () => {
  const d = await C.collectRun({block: 'detector', level: 4, seed: 1, secs: 20, goals: 'level', people: 'alt'});
  assert.ok(d.n > 100, `scans: ${d.n}`);
  assert.equal(d.x.length, d.n * 840);
  assert.equal(d.y.length, d.n * 120);
  assert.ok(d.positives > 0, 'some beams on a person');
  // the map condition follows the seed (prior map, built map, drift) and shows in the map-evidence channel
  assert.equal(d.cond, 'mapping');
  const evidence = x => {
    let e = 0;
    for (let i = 6; i < 840; i += 7) e += x[i] / 120;
    return e;
  };
  const evM = evidence(d.x);
  assert.ok(evM < 0.3, `the first scan of a map being built is barely explained: ${evM}`);
  const o = await C.collectRun({block: 'detector', level: 4, seed: 3, secs: 5, goals: 'level', people: 'alt'});
  assert.equal(o.cond, 'oracle');
  const evO = evidence(o.x);
  assert.ok(evO > evM + 0.3, `on the prior map the hits are explained from the first scan: ${evO} against ${evM}`);
  const p = await C.collectRun({block: 'policy', level: 0, seed: 3, secs: 30, randomMap: 10, goals: {random: 4}, noise: 0.3});
  assert.ok(C.P.map === 'empty' && C.P.mapAdd.split(',').length > 10, 'random obstacles painted on an empty floor');
  assert.ok(p.n > 50, `samples: ${p.n}`);
  assert.equal(p.x.length, p.n * 139);
  // the first waypoint of every label is 0.4 m from the robot or less (units of 4 m)
  for (let i = 0; i < p.n; i++) assert.ok(Math.hypot(p.y[i * 16], p.y[i * 16 + 1]) * 4 <= 0.41, `sample ${i}`);
});

test('nnTrain: a few epochs of the mixture loss bring the policy nearer the expert route (small MLP)', async () => {
  const p = await C.collectRun({block: 'policy', level: 1, seed: 1, secs: 60, goals: {random: 6}, noise: 0.4}),
    model = C.nnInit('policy', [32, 32], 1),
    task = {loss: 'mix', n: 1, K: 4, ny: 16, sigma: 0.05},
    losses = [],
    ev0 = C.nnEvaluate(model, p.x, p.y, 'policy');
  let ev = null;
  await C.nnTrain({
    model,
    nTrain: p.n,
    epochs: 6,
    batch: 64,
    lr: 0.003,
    seed: 1,
    grad: async (w, idx) => C.nnGrad(C.nnUnflat(model, w), p.x, p.y, idx, task),
    evaluate: async m => (ev = C.nnEvaluate(m, p.x, p.y, 'policy')),
    onEpoch: i => losses.push(i.loss)
  });
  assert.equal(losses.length, 6);
  assert.ok(losses[5] < losses[0] * 0.5, `loss ${losses[0]} → ${losses[5]}`);
  assert.equal(ev.K, 4);
  assert.ok(ev.best < ev0.best * 0.5, `best of 4: ${ev0.best} → ${ev.best} m`);
  assert.ok(ev.best <= ev.rms, 'the best of four is no worse than the best-scoring');
});

test('nnTrain: a few epochs of the mixture loss bring the predictor below constant velocity on its data', async () => {
  const d = await C.collectRun({block: 'predictor', level: 5, seed: 1, secs: 90, goals: 'level', people: 'alt'}),
    model = C.nnInit('predictor', [32, 32], 1),
    task = {loss: 'mix', n: 1, K: 3, ny: 12, sigma: 0.3},
    losses = [];
  let ev = null;
  await C.nnTrain({
    model,
    nTrain: d.n,
    epochs: 8,
    batch: 64,
    lr: 0.003,
    seed: 1,
    grad: async (w, idx) => C.nnGrad(C.nnUnflat(model, w), d.x, d.y, idx, task),
    evaluate: async m => (ev = C.nnEvaluate(m, d.x, d.y, 'predictor')),
    onEpoch: i => losses.push(i.loss)
  });
  assert.ok(losses[7] < losses[0], `loss ${losses[0]} → ${losses[7]}`);
  assert.ok(ev.top[1] < ev.cv[1], `error at 2 s: ${ev.top[1]} against constant velocity ${ev.cv[1]}`);
});
