// Golden test: the L1–L5 regression summary of tests/test.py, computed by the headless core in Node and compared
// with tests/node/golden.json. Run with `node --test tests/node/` (npm test). Regenerate the file on purpose with
// `npm run golden -- --why "reason"` (prints the diff, writes only with a reason), commit it with a message line
// starting `golden:` (CI checks it) and say in the PR why the numbers moved. tests/test.py asserts the page against it.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {loadCore, CASES, caseLabel, pick, diffs, GOLDEN_FILE, CORE_FILE} from './core.mjs';
const golden = JSON.parse(fs.readFileSync(GOLDEN_FILE, 'utf8'));
const core = loadCore();
test('the golden file covers every case', () => {
  for (const c of CASES) assert.ok(golden[caseLabel(c)], caseLabel(c) + ' missing from golden.json');
});
for (const c of CASES)
  test(caseLabel(c), async () => {
    const s = await core.run(c),
      d = diffs(pick(s), golden[caseLabel(c)]);
    assert.deepEqual(d, [], `${caseLabel(c)} differs from golden.json (${CORE_FILE}):\n  ${d.join('\n  ')}`);
  });
