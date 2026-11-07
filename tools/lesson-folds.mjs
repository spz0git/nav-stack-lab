// What the build folds under "Show the math" in each lesson (tools/lessons.mjs, foldMath): per lesson, the leads that
// stay visible, then each fold's leads and its number of display equations. "marked" means the lesson sets its folds
// by hand (<!-- math --> … <!-- /math -->). Run from the repository root: node tools/lesson-folds.mjs [group]
import {buildLessons} from './lessons.mjs';
const report = [];
buildLessons('docs/lessons', {report});
const only = process.argv[2];
let nf = 0,
  ne = 0;
for (const r of report) {
  if (only && !r.file.startsWith(only + '/')) continue;
  nf += r.folds.length;
  ne += r.folds.reduce((a, f) => a + f.eqs, 0);
  console.log(`${r.file}${r.marked ? '  [marked]' : ''}`);
  console.log(`  visible: ${r.visible.join(' · ') || '—'}`);
  for (const c of r.colon) console.log(`  runs into the fold (no full stop): ${c}`);
  r.folds.forEach((f, k) => console.log(`  fold ${k + 1}: ${f.leads.join(' · ') || '(no lead)'}  [${f.eqs} eq]`));
}
console.log(`${report.length} lessons, ${nf} folds, ${ne} display equations folded`);
