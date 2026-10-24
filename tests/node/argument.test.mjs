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
