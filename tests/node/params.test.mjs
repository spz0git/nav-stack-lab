// The parameter boundary (core/config.js setParam, core/params.js PARAM_RANGE): a value out of range from a setup link,
// a worker override or the fault schedule is ignored with a log line, never hangs or breaks the run; the fault schedule
// applies a change with every effect a released slider has. `npm test`.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {loadCore} from './core.mjs';
const core = loadCore(),
  C = globalThis.__core;
const logHas = re => C.S.log.some(l => re.test(l.msg));

test('a negative latency from an override is ignored and the run completes', async () => {
  const s = await core.run({level: 0, overrides: {latency: -0.1}, secs: 3});
  assert.equal(C.P.latency, 0);
  assert.ok(s.dist > 0, 'the robot moves');
  assert.ok(logHas(/Ignored: latency must be from 0 to 2, not -0\.1/));
});

test('a negative latency from the fault schedule is ignored and the run completes', async () => {
  const s = await core.run({level: 0, overrides: {latency: 0.1, sched: [{t: 1, set: {latency: -5}}]}, secs: 3});
  assert.equal(C.P.latency, 0.1, 'the old value is kept');
  assert.ok(s.dist > 0);
  assert.ok(logHas(/Ignored: latency must be from 0 to 2, not -5/));
});

test('an empty MPC horizon, a car without mass or wheelbase do not break the run', async () => {
  for (const o of [
    {ctl: 'mpc', mpcNp: 0},
    {model: 'car', carPhys: 'dyn', mass: 0},
    {model: 'car', carPhys: 'dyn', Iz: 0},
    {model: 'car', wheelbase: 0}
  ]) {
    const s = await core.run({level: 0, overrides: o, secs: 3});
    assert.ok(s.dist > 0 && isFinite(C.S.robot.x), JSON.stringify(o) + ': the robot moves');
    assert.equal(s.coll, 0, JSON.stringify(o) + ': no phantom collision');
  }
});

test('npart is capped', () => {
  C.loadLevel(2);
  const n = C.P.npart;
  C.setParam('npart', 1e7, false);
  assert.equal(C.P.npart, n);
});

test('the command queue never takes a negative length', async () => {
  await core.run({level: 0, secs: 1});
  C.P.latency = -0.5; // past setParam, as a stale value would be
  await C.advance(5);
  C.P.latency = 0;
  assert.ok(C.S.t > 1);
});

test('a scheduled inflation change rebuilds the costmap and replans', async () => {
  await core.run({level: 1, overrides: {sched: [{t: 1, set: {infl: 2}}]}, secs: 3});
  assert.equal(C.P.infl, 2);
  assert.ok(logHas(/^Replan \(costmap changed\)/), C.S.log.map(l => l.msg).join(' / '));
});
