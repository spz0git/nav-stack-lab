// Scenario search headless (core/search.js, the same as Tools → Safety → Search): sample worlds from an ODD sheet,
// run each to Mission complete, refine around the worst, and print every run and the worst ones. The same search seed
// gives the same scenarios as the page.
//   node tools/search.mjs [--sheet ODD-1 | --sheet '{json}'] [--budget 40] [--rounds 2] [--seed 1] [--secs 300]
//                         [--set '{"guard": true}'] [--imp] [--json out.json]
// --set adds settings to every run (a mitigation to try against the same scenarios); --json writes the runs. --imp draws
// the random half by importance sampling (more people, each run weighted). After the runs: the random half's rates per
// hour of contacts and strikes with their 95 % intervals, and the leading indicators ranked against the contacts.
import fs from 'node:fs';
import {loadCore} from '../tests/node/core.mjs';
const core = loadCore(),
  C = globalThis.__core;
const arg = (k, d) => {
  const i = process.argv.indexOf('--' + k);
  return i < 0 ? d : process.argv[i + 1];
};
const sheetArg = arg('sheet', 'ODD-1'),
  sheet = sheetArg.trim().startsWith('{') ? JSON.parse(sheetArg) : C.ODD_SHEETS[sheetArg],
  budget = +arg('budget', 40),
  rounds = +arg('rounds', 2),
  seed = +arg('seed', 1),
  secs = +arg('secs', 300),
  extra = JSON.parse(arg('set', '{}')),
  imp = process.argv.includes('--imp'),
  out = arg('json', null);
const err = C.oddSheetError(sheet);
if (err) throw new Error('the sheet needs ' + err);
const u = C.makeRng(seed * 7919 + 17).u,
  results = [];
const t0 = Date.now();
for (const step of C.searchPlan(budget, rounds)) {
  const batch = C.searchBatch(step, results, sheet, u, imp);
  for (const sc of batch) {
    const s = await core.run({level: sc.level, seed: sc.seed, overrides: {...sc.set, ...extra}, secs, stopWhenDone: true}),
      r = {i: results.length, kind: step.kind, sc, margin: C.searchMargin(s), s, w: sc.w || 1};
    results.push(r);
    const L = sc.level;
    console.log(
      `${String(r.i).padStart(3)} ${step.kind.padEnd(6)} margin ${r.margin.toFixed(2).padStart(6)}  contacts ${s.events.length}  ` +
        `world ${L.seed} aisle ${L.aisle} people ${L.people} stepout ${L.stepout} ${sc.set.weather} ${sc.set.people}  run seed ${sc.seed}  ` +
        `${s.goalsDone}/${s.goals} in ${s.t} s`
    );
  }
}
const worst = results.slice().sort((a, b) => a.margin - b.margin || a.i - b.i);
const st = k => {
  const m = results.filter(r => r.kind === k).map(r => r.margin);
  return m.length ? `${m.length} runs, ${m.filter(x => x < 0).length} with a contact, worst ${Math.min(...m).toFixed(2)}` : 'none';
};
console.log(`\nrandom: ${st('random')}\nrefine: ${st('refine')}\n${((Date.now() - t0) / 1000).toFixed(0)} s`);
const rnd = results.filter(r => r.kind === 'random'),
  rr = ev => {
    const q = C.riskRate(rnd, ev);
    return `${q.k} in ${q.hours.toFixed(2)} h: ${q.rate.toFixed(2)} per hour, 95 % ${q.lo.toFixed(2)} to ${q.hi.toFixed(2)}${q.weighted ? ' (weighted)' : ''}`;
  };
console.log(`contacts: ${rr('contact')}\nstrikes: ${rr('strike')}`);
console.log('leading indicators, Spearman ρ against contacts per hour:');
for (const x of C.spiTable(rnd)) console.log(`  ${x.rho.toFixed(2).padStart(5)}  ${x.label} (${x.n} runs)`);
console.log('worst five:');
for (const r of worst.slice(0, 5)) console.log('  ' + JSON.stringify({margin: r.margin, ...r.sc}));
if (out)
  fs.writeFileSync(
    out,
    JSON.stringify(
      results.map(({s, ...r}) => ({...r, events: s.events, t: s.t, goals: `${s.goalsDone}/${s.goals}`})),
      null,
      1
    )
  );
