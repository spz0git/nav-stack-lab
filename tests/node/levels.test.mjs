// Levels as data (core/levels.js) and the world generator (core/worldgen.js): a built-in level converted to the JSON
// format and back is the same level and runs the same golden numbers; the format rejects what it cannot run; the
// generator gives the same level for the same spec and sizes the world from it. `npm test`.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {loadCore, CASES, caseLabel, pick, diffs, GOLDEN_FILE} from './core.mjs';
const core = loadCore(),
  C = globalThis.__core,
  golden = JSON.parse(fs.readFileSync(GOLDEN_FILE, 'utf8'));
const strip = L =>
  JSON.parse(
    JSON.stringify({s: L.shapes0 || L.shapes, b: L.beacons, p: L.peds, c: L.cars || null, st: L.start, g: L.wps, cfg: L.cfg, sz: L.size})
  );

test('every built-in level survives the round trip through the format', () => {
  for (const L of C.LEVELS) {
    const j = JSON.parse(JSON.stringify(C.levelToJSON(L))),
      R = C.levelFromJSON(j);
    const a = strip(L),
      b = strip(R);
    // the format leaves out the settings that belong to a run (none of the built-ins sets them)
    assert.deepEqual(b, a, L.id);
  }
});

for (const c of CASES.filter((_, i) => i % 3 === 0))
  test('round-tripped ' + caseLabel(c) + ' matches golden.json', async () => {
    const lv = JSON.parse(JSON.stringify(C.levelToJSON(C.LEVELS[c.level]))),
      s = await core.run({...c, level: lv});
    assert.deepEqual(diffs(pick(s), golden[caseLabel(c)]), []);
  });

test('the format rejects what it cannot run', () => {
  const ok = C.levelToJSON(C.LEVELS[0]);
  for (const [why, j] of [
    ['format', {...ok, format: 'x'}],
    ['size', {...ok, size: [60, 40]}],
    ['area', {...ok, size: [48, 40]}],
    ['start', {...ok, start: [30, 2, 0]}],
    ['shape', {...ok, shapes: [{box: [1, 1, 1, 1]}]}],
    ['setting type', {...ok, settings: {loc: 3}}],
    ['fault schedule', {...ok, settings: {sched: [{t: 'soon', set: {lidar: false}}]}}],
    ['trigger', {...ok, people: [{from: [2, 2], to: [8, 2], trigger: {near: [40, 2], r: 3}}]}]
  ])
    assert.throws(() => C.levelFromJSON(j), Error, why);
  const L = C.levelFromJSON({...ok, name: '<img src=x onerror=alert(1)>', settings: {nonsense: 1, seed: 3, loc: 'ekf'}});
  assert.ok(!/[<>]/.test(L.name), 'the name is plain text');
  assert.deepEqual(L.cfg, {loc: 'ekf'}, 'unknown keys and run settings are left out');
});

test("a level's settings are checked as a link's: a wrong choice or a number out of range is left out and logged", async () => {
  const j = {...C.levelToJSON(C.LEVELS[1]), settings: {plan: 'foo', loc: 'pf', npart: -5}},
    L = C.levelFromJSON(j);
  assert.deepEqual(L.cfg, {loc: 'pf'});
  assert.ok(
    L.warn.some(w => w.includes('plan') && w.includes('"foo"')),
    L.warn.join(' / ')
  );
  assert.ok(L.warn.some(w => w.includes('npart') && w.includes('-5')));
  const s = await core.run({level: j, secs: 3});
  assert.equal(C.P.plan, 'astar', 'the default');
  assert.equal(C.P.npart, 400, 'the default');
  assert.ok(s.dist > 0, 'the robot moves');
  const log = C.S.log.map(l => l.msg);
  assert.ok(
    log.some(m => m.startsWith(`Ignored the level's setting: plan has no value "foo" (one of straight, astar`)),
    log.join(' / ')
  );
  assert.ok(log.some(m => /^Ignored the level's setting: npart must be from \d+ to \d+, not -5$/.test(m)));
});

test('a generated level is the same for the same spec, and sets the world size', async () => {
  for (const gen of Object.keys(C.GEN_FAMILIES)) {
    const a = C.genLevel({gen, seed: 5, w: 32, h: 20.4}),
      b = C.genLevel({gen, seed: 5, w: 32, h: 20.4}),
      c = C.genLevel({gen, seed: 6, w: 32, h: 20.4});
    assert.deepEqual(a, b, gen);
    assert.notDeepEqual(a.shapes, c.shapes, gen + ': another seed, another world');
    assert.ok(a.goals.length >= 3 && a.beacons.length >= 4, gen);
    C.loadLevel({gen, seed: 5, w: 32, h: 20.4});
    assert.deepEqual([C.W, C.H, C.GW, C.GH], [32, 20.4, 320, 204]);
    assert.equal(C.LV.truthOcc.length, 320 * 204);
  }
  C.loadLevel(0);
  assert.deepEqual([C.W, C.H, C.GW, C.GH], [24, 16, 240, 160], 'a built-in level sets it back');
});

test('people who wait for the robot: the format keeps the trigger, they stand until it comes near, then walk', async () => {
  for (const gen of Object.keys(C.GEN_FAMILIES))
    assert.deepEqual(C.genLevel({gen, seed: 5}), C.genLevel({gen, seed: 5, stepout: 0}), gen + ': stepout 0 changes nothing');
  const j = C.genLevel({gen: 'warehouse', seed: 3, people: 0, stepout: 3}),
    R = C.levelFromJSON(JSON.parse(JSON.stringify(C.levelToJSON(C.levelFromJSON(j)))));
  assert.equal(j.people.length, 3);
  assert.ok(
    j.people.every(p => p.trigger && p.trigger.r === 3),
    'each has a trigger'
  );
  assert.deepEqual(
    R.peds.map(p => p.tr),
    C.levelFromJSON(j).peds.map(p => p.tr),
    'the trigger survives the round trip'
  );
  C.P.seed = 7;
  C.loadLevel(j);
  C.startMission();
  const at = () => C.S.peds.map(p => [p.x, p.y]),
    p0 = at();
  let moved = 0;
  for (let k = 0; k < 2400; k++) {
    await C.advance(1);
    const p = C.S.peds,
      r = C.S.robot;
    p.forEach((q, i) => {
      const near = Math.hypot(r.x - q.tr.p[0], r.y - q.tr.p[1]) < q.tr.r;
      if (!q.go) assert.deepEqual([q.x, q.y], p0[i], 'stands until the robot comes near');
      if (q.go && !near && Math.hypot(q.x - p0[i][0], q.y - p0[i][1]) > 0.5) moved |= 1 << i;
    });
  }
  assert.ok(moved, 'someone stepped out and walked');
  assert.ok(
    C.S.log.some(l => /steps out/.test(l.msg)),
    'the log says so'
  );
  C.loadLevel(0);
});
