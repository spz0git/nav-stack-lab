// A safety argument checked headless (core/argument.js, the same as Tools → Safety → Argument): every solution's evidence
// run on the core, its verdict, and each node's status, the top claim last.
//   node tools/argument.mjs [--arg file.json] [--set '{"people": "scripted"}']
// --set adds settings to every run of the evidence, as the page adds your changes.
import fs from 'node:fs';
import {loadCore} from '../tests/node/core.mjs';
const core = loadCore(),
  C = globalThis.__core;
const arg = (k, d) => {
  const i = process.argv.indexOf('--' + k);
  return i < 0 ? d : process.argv[i + 1];
};
const A = arg('arg', null) ? JSON.parse(fs.readFileSync(arg('arg'), 'utf8')) : C.ARG_BUILTIN,
  extra = JSON.parse(arg('set', '{}')),
  err = C.argError(A);
if (err) throw new Error('the argument needs ' + err);
const verdicts = {},
  t0 = Date.now();
for (const n of A.nodes.filter(n => n.evidence)) {
  const jobs = C.argJobs(n.evidence, extra),
    sums = [];
  for (const j of jobs) sums.push(await core.run({level: j.level, seed: j.seed, overrides: j.set, secs: j.secs, stopWhenDone: true}));
  verdicts[n.id] = C.argVerdict(n.evidence, sums, jobs);
  const v = verdicts[n.id];
  console.log(
    `${n.id}  ${v.pass ? 'pass' : 'FAIL'}  ${n.evidence.metric} = ${v.value == null ? '—' : +(+v.value).toFixed(3)} (${n.evidence.op} ${n.evidence.value}, ${jobs.length} runs)`
  );
}
const st = C.argStatus(A, verdicts);
for (const n of A.nodes) if (st[n.id]) console.log(`${n.id.padEnd(4)} ${n.type.padEnd(9)} ${st[n.id].padEnd(5)} ${n.text}`);
console.log(`${((Date.now() - t0) / 1000).toFixed(0)} s`);
