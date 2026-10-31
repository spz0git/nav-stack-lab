// The safety argument (core/argument.js; safety lesson 9): the format's checks, the jobs each kind of evidence needs,
// the status a failed solution sends up the graph, and one solution checked on the core. `npm test`.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {loadCore} from './core.mjs';
const core = loadCore();
const C = globalThis.__core;
const copy = x => JSON.parse(JSON.stringify(x));

test('the built-in argument is well formed, and malformed ones say why', () => {
  assert.equal(C.argError(C.ARG_BUILTIN), null);
  const A = copy(C.ARG_BUILTIN);
  A.nodes.push({id: 'G1', type: 'goal', parent: 'S1', text: 'again'});
  assert.match(C.argError(A), /repeated/);
  const B = copy(C.ARG_BUILTIN);
  B.nodes.find(n => n.id === 'G1').parent = 'G2';
  assert.match(C.argError(B), /top node|own ancestor/);
  const D = copy(C.ARG_BUILTIN);
  D.nodes.find(n => n.id === 'E1').evidence.metric = 'happiness';
  assert.match(C.argError(D), /metric/);
});

test('the jobs: runs at each seed, a search of its budget, the changes added to every one', () => {
  const E = C.ARG_BUILTIN.nodes.find(n => n.id === 'E1').evidence,
    J = C.argJobs(E, {people: 'scripted'});
  assert.equal(J.length, 6);
  assert.ok(
    J.every(j => j.set.people === 'scripted'),
    'your changes win over the evidence'
  );
  const S2 = C.argJobs(C.ARG_BUILTIN.nodes.find(n => n.id === 'E2').evidence, {});
  assert.equal(S2.length, 40);
  assert.ok(S2.every(j => j.set.people === 'reactive' && j.level.gen === 'warehouse'));
});

test('a failed solution turns its goals red to the top; context is not judged', () => {
  const A = C.ARG_BUILTIN,
    pass = {E1: {pass: true}, E2: {pass: true}, E3: {pass: true}, E4: {pass: true}},
    st = C.argStatus(A, pass);
  assert.equal(st.G1, 'pass');
  assert.equal(st.C1, null);
  const st2 = C.argStatus(A, {...pass, E3: {pass: false}});
  assert.equal(st2.G4, 'fail');
  assert.equal(st2.S1, 'fail');
  assert.equal(st2.G1, 'fail');
  assert.equal(st2.G2, 'pass');
  assert.equal(C.argStatus(A, {E1: {pass: true}}).G1, null, 'not checked yet: no verdict at the top');
});

test('the ODD monitor sees fog within 2 s, and the solution that says so passes; off, it fails', async () => {
  const n = C.ARG_BUILTIN.nodes.find(q => q.id === 'E4'),
    run = async extra => {
      const jobs = C.argJobs(n.evidence, extra),
        sums = [];
      for (const j of jobs) sums.push(await core.run({level: j.level, seed: j.seed, overrides: j.set, secs: j.secs}));
      return C.argVerdict(n.evidence, sums, jobs);
    };
  const on = await run({}),
    off = await run({oddMon: false});
  assert.ok(on.pass && on.value <= 2, `seen at ${on.value} s`);
  assert.ok(!off.pass && off.value === Infinity, 'never seen with the monitor off');
});

test('a verdict says which runs count against it, and when', () => {
  const ev = (t, kind, v, still = false) => ({t, kind, v, still, sev: v >= 1 ? 'strike' : v >= 0.3 ? 'bump' : 'touch'}),
    sums = [
      {events: [], oddFirst: 1.2, goals: 4, goalsDone: 4},
      {events: [ev(12, 'static', 0.2), ev(40, 'static', 0.52)], oddFirst: null, goals: 4, goalsDone: 2},
      {events: [ev(30, 'person', 1.1), ev(31, 'person', 0.5, true)], oddFirst: 3, goals: 4, goalsDone: 4}
    ],
    jobs = sums.map((_, k) => ({level: 4, set: {}, seed: k + 1})),
    V = (metric, op, value) => C.argVerdict({kind: 'runs', metric, op, value}, sums, jobs);
  const rack = V('rackSpeed', '<=', 0.3);
  assert.equal(rack.pass, false);
  assert.deepEqual(
    rack.runs.map(r => [r.bad, r.v, r.t]),
    [
      [false, 0, null],
      [true, 0.52, 40],
      [false, 0, null]
    ],
    'the fastest rack contact of each run, judged run by run'
  );
  const cont = V('contacts', '<=', 0);
  assert.deepEqual(
    cont.runs.map(r => [r.bad, r.v, r.t]),
    [
      [false, 0, null],
      [false, 0, null],
      [true, 1, 30]
    ],
    'a count: a run counts against it when it adds to it; a person walking into the robot standing still does not'
  );
  const odd = V('oddFirst', '<=', 2);
  assert.deepEqual(
    odd.runs.map(r => r.bad),
    [false, true, true],
    'never seen outside, or seen too late'
  );
  assert.equal(C.argVerdict({kind: 'runs', metric: 'contacts', op: '<=', value: 0}, [null], [jobs[0]]).runs[0].bad, true);
});
