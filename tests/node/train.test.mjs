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
  return new Function('const POLICY_N = 8;\n' + src + '\nreturn {nnInit, nnGrad, nnFlat, nnUnflat};')();
}

test('nnGrad: the gradient equals central differences (conv detector and MLP policy)', () => {
  const T = float64Trainer();
  let u = 12345;
  const rnd = () => ((u = (u * 1103515245 + 12345) % 2147483648) / 2147483648) * 2 - 1;
  for (const [block, hidden, n, nin, nout, loss] of [
    [
      'detector',
      [
        [5, 3],
        [4, 5]
      ],
      120,
      6,
      1,
      'bce'
    ],
    ['policy', [7, 6], 1, 139, 16, 'mse']
  ]) {
    const m = T.nnInit(block, hidden, 3),
      ns = 3,
      X = Float64Array.from({length: ns * n * nin}, rnd),
      Y = Float64Array.from({length: ns * n * nout}, () => (loss === 'bce' ? (rnd() > 0.6 ? 1 : 0) : rnd())),
      task = {loss, n, posW: 2.5},
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
    X = Float32Array.from({length: 4 * 720}, (_, i) => (Math.sin(i * 0.37) + 1) / 2),
    p = C.nnPredict(det, X, 4, 120);
  for (let s = 0; s < 4; s++) {
    const q = C.nnForward(det, X.subarray(s * 720, (s + 1) * 720), 120);
    for (let k = 0; k < 120; k++) assert.ok(Math.abs(q[k] - p[s * 120 + k]) < 1e-5, `detector scan ${s} beam ${k}`);
  }
  const Xp = Float32Array.from({length: 40 * 139}, (_, i) => Math.cos(i * 0.11)),
    pp = C.nnPredict(pol, Xp, 40, 1);
  for (let s = 0; s < 40; s++) {
    const q = C.mlpForward(pol, Xp.subarray(s * 139, (s + 1) * 139));
    for (let k = 0; k < 16; k++) assert.ok(Math.abs(q[k] - pp[s * 16 + k]) < 1e-5, `policy sample ${s} output ${k}`);
  }
});

test('collectRun: a detector run labels person beams; a policy run on random obstacles records the expert route', async () => {
  const d = await C.collectRun({block: 'detector', level: 4, seed: 1, secs: 20, goals: 'level', people: 'alt'});
  assert.ok(d.n > 100, `scans: ${d.n}`);
  assert.equal(d.x.length, d.n * 720);
  assert.equal(d.y.length, d.n * 120);
  assert.ok(d.positives > 0, 'some beams on a person');
  const p = await C.collectRun({block: 'policy', level: 0, seed: 3, secs: 30, randomMap: 10, goals: {random: 4}, noise: 0.3});
  assert.ok(C.P.map === 'empty' && C.P.mapAdd.split(',').length > 10, 'random obstacles painted on an empty floor');
  assert.ok(p.n > 50, `samples: ${p.n}`);
  assert.equal(p.x.length, p.n * 139);
  // the first waypoint of every label is 0.4 m from the robot or less (units of 4 m)
  for (let i = 0; i < p.n; i++) assert.ok(Math.hypot(p.y[i * 16], p.y[i * 16 + 1]) * 4 <= 0.41, `sample ${i}`);
});

test('nnTrain: a few epochs bring the loss down (policy, small MLP)', async () => {
  const p = await C.collectRun({block: 'policy', level: 1, seed: 1, secs: 60, goals: {random: 6}, noise: 0.4}),
    model = C.nnInit('policy', [32, 32], 1),
    task = {loss: 'mse', n: 1},
    losses = [];
  await C.nnTrain({
    model,
    nTrain: p.n,
    epochs: 6,
    batch: 64,
    lr: 0.003,
    seed: 1,
    grad: async (w, idx) => C.nnGrad(C.nnUnflat(model, w), p.x, p.y, idx, task),
    evaluate: async m => C.nnEvaluate(m, p.x, p.y, 'policy'),
    onEpoch: i => losses.push(i.loss)
  });
  assert.equal(losses.length, 6);
  assert.ok(losses[5] < losses[0] * 0.5, `loss ${losses[0]} → ${losses[5]}`);
});
