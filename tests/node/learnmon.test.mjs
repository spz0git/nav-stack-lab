// The learned blocks under watch and the radar emergency brake (core/learnmon.js, core/radar.js; safety lessons 6 and
// 7): the score and its reference, every built-in model's reference against its description, and both in a run of the
// worker. `npm test`.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {loadCore} from './core.mjs';
const core = loadCore();
const C = globalThis.__core;

test('the score: 0 at the mean, the threshold the 99th percentile of the reference inputs', () => {
  const descs = Array.from({length: 1000}, (_, i) => [Math.sin(i), Math.cos(3 * i), (i % 10) / 10]),
    ref = C.oodRef(descs);
  assert.equal(C.oodScore(ref.mean, ref), 0);
  const sc = descs.map(x => C.oodScore(x, ref)),
    above = sc.filter(s => s > ref.thr).length;
  assert.ok(above <= 10, `at most 1 % of the reference above its threshold: ${above}`);
  assert.ok(C.oodScore([100, 100, 100], ref) <= 10, 'each z-score is clipped at 10');
});

test("every built-in model carries a reference that matches its input's description", () => {
  const inputs = {
    detector: new Float32Array(120 * 7).fill(0.5),
    predictor: new Float32Array(24),
    policy: C.policyFeatures(new Float32Array(120).fill(8), {x: 0, y: 0, th: 0}, {x: 1, y: 0}, {v: 0, w: 0})
  };
  for (const [b, f] of Object.entries(inputs)) {
    const R = C.MODELS[b].ref,
      d = C.oodDesc(b, f);
    assert.ok(R && R.thr > 1 && R.thr < 4, `${b}: a threshold near 2 (${R && R.thr})`);
    assert.equal(R.mean.length, d.length, `${b}: the reference has one mean per element`);
    assert.equal(R.sd.length, d.length);
  }
});

test('in fog the learned detector is outside its data, and its light warns', async () => {
  const s = await core.run({level: 4, overrides: {agents: 'learned', weather: 'fog'}, secs: 30, seed: 7});
  assert.ok(s.det && s.det.scans > 100, 'detection by slice is counted');
  assert.ok(s.ood.detector.out > 0.5, `most of the scans outside (${s.ood.detector.out})`);
  assert.ok(s.health['per/Out of distribution (detector)'], 'the Perceive light warned');
});

test('in fog the radar brake stops, and counts what it stopped for (lesson 7, seed 7)', async () => {
  const s = await core.run({level: 4, overrides: {weather: 'fog', radar: true, radBrake: true}, secs: 125, seed: 7, stopWhenDone: true});
  assert.ok(s.brakes > 0 && s.brakeS > 0, `the brake stopped (${s.brakes}, ${s.brakeS} s)`);
  assert.ok(s.brakesFalse > 0 && s.brakesFalse < s.brakes, `some of its stops were for nothing (${s.brakesFalse} of ${s.brakes})`);
});

test('off by default: no brake, no out-of-distribution light, in clear air with the rule tracker', async () => {
  const s = await core.run({level: 4, secs: 60, seed: 7});
  assert.equal(s.brakes, 0);
  assert.ok(!Object.keys(s.health).some(k => /distribution/.test(k)));
  assert.ok(s.predSl && s.predSl.cv && s.predSl.cv.steady[1] > 0, 'the predictors are scored by slice');
});
