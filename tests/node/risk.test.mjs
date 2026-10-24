// Risk from a search (core/search.js; safety lesson 8): the exact Poisson interval, the rate per hour from run
// summaries, importance sampling's draws and weights, and the leading indicators' ranking. `npm test`.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {loadCore} from './core.mjs';
loadCore();
const C = globalThis.__core;
const near = (a, b, tol, what) => assert.ok(Math.abs(a - b) <= tol, `${what}: ${a} not within ${tol} of ${b}`);

test('the exact Poisson interval (Garwood) and the rule of three', () => {
  const [a0, b0] = C.poissonCI(0);
  assert.equal(a0, 0);
  near(b0, 3.689, 0.002, 'no event: the two-sided top is −ln 0.025');
  const [a5, b5] = C.poissonCI(5);
  near(a5, 1.6235, 0.002, 'five events, lower');
  near(b5, 11.668, 0.002, 'five events, upper');
  near(C.riskHoursFor(0.001), 2995.7, 0.1, 'one per 1 000 h at 95 %: about 3 000 hours');
});

test('a rate per hour from run summaries: moving contacts only, the robot standing still not counted', () => {
  const run = (opS, ev) => ({s: {opS, events: ev}}),
    hit = (sev, still = false) => ({kind: 'person', still, sev, v: 1}),
    q = C.riskRate([run(1800, [hit('bump'), hit('strike')]), run(1800, [hit('bump', true)]), run(3600, [])], 'contact');
  assert.equal(q.k, 2);
  near(q.hours, 2, 1e-9, 'hours of operation');
  near(q.rate, 1, 1e-9, 'two contacts in two hours');
  assert.equal(C.riskRate([run(3600, [hit('bump'), hit('strike')])], 'strike').k, 1);
});

test('importance sampling: more people, each run weighted 1 / (2x); without it, the draws are unchanged', () => {
  const sh = C.ODD_SHEETS['ODD-1'],
    plain = [],
    plain2 = [],
    imp = [];
  let u = C.makeRng(5).u;
  for (let i = 0; i < 400; i++) plain.push(C.searchBatch({kind: 'random', n: 1}, [], sh, u)[0]);
  u = C.makeRng(5).u;
  for (let i = 0; i < 400; i++) plain2.push(C.searchBatch({kind: 'random', n: 1}, [], sh, u, false)[0]);
  assert.deepEqual(plain, plain2, 'the plain search draws the same scenarios as before');
  u = C.makeRng(5).u;
  for (let i = 0; i < 400; i++) imp.push(C.searchBatch({kind: 'random', n: 1}, [], sh, u, true)[0]);
  const mean = L => L.reduce((a, s) => a + s.level.people, 0) / L.length;
  assert.ok(mean(imp) > mean(plain) + 0.3, `more people (${mean(imp).toFixed(2)} against ${mean(plain).toFixed(2)})`);
  // the weight is p / q of the continuous draw (the generator then rounds the count): unbiased for anything the run's
  // outcome depends on, so each lies between 0.5 (x = 1) and 10 (x clipped at 0.05)
  for (const s of imp) assert.ok(s.w >= 0.5 && s.w <= 10, `a weight between 0.5 and 10 (${s.w})`);
  near(imp.reduce((a, s) => a + s.w, 0) / imp.length, 1, 0.15, 'the weights average to about 1');
});

test('the leading indicators: a measure that orders the runs as their contacts do ranks first', () => {
  const runs = Array.from({length: 12}, (_, i) => ({
    s: {
      opS: 3600,
      events: Array.from({length: i}, () => ({kind: 'person', still: false, sev: 'bump', v: 0.5})),
      nearS: i * 2,
      near2S: (i * 7) % 5,
      ttc1S: 1,
      minPed: 1 - i / 20
    }
  }));
  const T = C.spiTable(runs);
  assert.equal(T[0].rho, 1);
  assert.ok(['nearS', 'minPed'].includes(T[0].id));
  assert.ok(T.find(x => x.id === 'near2S').rho < 0.9);
});
