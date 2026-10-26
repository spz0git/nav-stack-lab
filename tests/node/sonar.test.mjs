// The ultrasonic ring (core/sensors.js): off by default it leaves no trace in a run; on, a run is repeatable at a
// seed; and the particle filter localizes on the sonars against the prior map alone (Perceive lesson 9). `npm test`.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {loadCore} from './core.mjs';
const core = loadCore();
const C = globalThis.__core;

test('off by default: no sonar state after a run', async () => {
  assert.equal(C.P.sonar, false);
  await core.run({level: 3, secs: 10});
  assert.equal(C.S.sonArcs, null, 'the ring never fired');
  assert.equal(C.S.son, null);
});

test('on: a sonar-only mapping run is the same twice at one seed', async () => {
  const cfg = {level: 3, overrides: {sonar: true, mapSrc: 'sonar'}, secs: 30, seed: 7};
  const a = await core.run(cfg),
    arcs = C.S.sonArcs.filter(Boolean).length,
    b = await core.run(cfg);
  assert.equal(arcs, 8, 'every sonar of the ring has a reading');
  for (const k of ['coll', 'replans', 'dist', 'poseRMS', 'goalsDone']) assert.equal(a[k], b[k], k);
});

test('the particle filter localizes on the sonar ring alone (L3, every beacon off)', async () => {
  const s = await core.run({
    level: 2,
    overrides: {loc: 'pf', pfLidar: false, sonar: true, pfSonar: true, bOff: 'all'},
    secs: 100,
    seed: 7
  });
  assert.ok(s.poseRMS < 0.25, `pose RMS ${s.poseRMS} m`);
  assert.ok(s.goalsDone >= 4, `${s.goalsDone} goals`);
});
