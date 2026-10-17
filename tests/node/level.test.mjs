// Changing level: a level picked by the user (switchLevel) keeps the settings changed from the old level's own setup,
// except the map edits and the beacons switched off, and a planner or tracker the new vehicle cannot use; loadLevel (Try
// buttons, lessons, links) still starts from the level's own setup, the seed and the trained models aside. `npm test`.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {loadCore} from './core.mjs';
loadCore();
const C = globalThis.__core;

test('switchLevel keeps changed settings, not the map edits', () => {
  C.loadLevel(0);
  C.setParam('ctl', 'pid', false);
  C.setParam('lidarSig', 0.05, false);
  C.setParam('mapAdd', '10,11,12', false);
  C.setParam('detModel', 'det1', false);
  const {kept, dropped} = C.switchLevel(4);
  assert.equal(C.P.ctl, 'pid');
  assert.equal(C.P.lidarSig, 0.05);
  assert.equal(C.P.detModel, 'det1');
  assert.equal(C.P.mapAdd, '', 'painted cells belong to the old level');
  assert.equal(C.P.plan, C.LEVELS[4].cfg.plan, "an untouched setting takes the new level's value");
  assert.deepEqual(Object.keys(dropped), []);
  assert.ok('ctl' in kept && 'lidarSig' in kept && !('mapAdd' in kept));
});

test("a setting changed back to the old level's value is not carried; carried twice it stays", () => {
  C.loadLevel(0);
  C.setParam('ctl', 'pid', false);
  C.switchLevel(1);
  C.switchLevel(2);
  assert.equal(C.P.ctl, 'pid');
  C.setParam('ctl', 'pp', false); // L3's own tracker
  C.switchLevel(3);
  assert.equal(C.P.ctl, C.LEVELS[3].cfg.ctl);
});

test('a planner or tracker the new vehicle cannot use is not carried', () => {
  C.loadLevel(1);
  C.setParam('plan', 'stastar', false); // diff-drive only
  const r = C.switchLevel(5); // L6: the car
  assert.equal(C.P.model, 'car');
  assert.equal(C.P.plan, C.LEVELS[5].cfg.plan);
  assert.equal(r.dropped.plan, 'stastar');
  C.setParam('ctl', 'stanley', false); // car only
  const r2 = C.switchLevel(0);
  assert.equal(C.P.model, 'diff');
  assert.notEqual(C.P.ctl, 'stanley');
  assert.equal(r2.dropped.ctl, 'stanley');
});

test("loadLevel (Try buttons, lessons, links) still starts from the level's own setup", () => {
  C.loadLevel(0);
  C.setParam('ctl', 'pid', false);
  C.setParam('detModel', 'det1', false);
  C.loadLevel(4);
  assert.equal(C.P.ctl, C.LEVELS[4].cfg.ctl);
  assert.equal(C.P.detModel, 'det1', 'the trained model picked stays');
  C.setParam('detModel', 'builtin', false);
});
