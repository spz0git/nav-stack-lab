// Rounds a learned block's weights to a few significant figures, to make the page lighter (the build inlines src/models/*.json).
//   node tools/quantize-model.mjs <model> [digits]     e.g. node tools/quantize-model.mjs policy 3
// Every number array inside the model's `layers` (weights, biases, kernels) is rewritten as Number(x.toPrecision(digits));
// everything else (the metadata, the out-of-distribution `ref`, which depends on the inputs and not on the weights) is
// kept as it is. Rounding is idempotent, so running it twice changes nothing. After it: ./build.sh, then measure what the
// lessons quote from the model (tests/measure_plan.py, tests/measure_saf.mjs) before and after, and keep the rounding
// only if nothing they quote moves.
// The policy, saved at three decimals, is already at three significant figures or fewer in all but 209 of its 119 108
// numbers (this saves 239 bytes); what makes its inlined copy small is the build's integer encoding (tools/code.mjs,
// modelsSource). The detector and the predictor carry four to six significant figures.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [name, digitsArg] = process.argv.slice(2);
const digits = digitsArg == null ? 3 : +digitsArg;
if (!name || !Number.isInteger(digits) || digits < 1 || digits > 17) {
  console.error('usage: node tools/quantize-model.mjs <model> [digits 1–17, default 3]');
  process.exit(1);
}
const file = path.join(ROOT, 'src', 'models', `${name}.json`);
const before = fs.readFileSync(file, 'utf8'),
  M = JSON.parse(before);
if (!Array.isArray(M.layers)) throw new Error(`${file}: no layers`);
let count = 0,
  maxRel = 0;
const round = x => {
  const y = Number(x.toPrecision(digits));
  if (x !== 0) maxRel = Math.max(maxRel, Math.abs(y - x) / Math.abs(x));
  count++;
  return y;
};
const walk = o => {
  if (Array.isArray(o)) return o.every(x => typeof x === 'number') ? o.map(round) : o.map(walk);
  if (o && typeof o === 'object') return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, walk(v)]));
  return o;
};
M.layers = M.layers.map(walk);
const after = JSON.stringify(M);
fs.writeFileSync(file, after);
console.log(
  `${name}: ${count} numbers at ${digits} significant figures (largest relative change ${(maxRel * 100).toFixed(2)} %),`,
  `${before.length} → ${after.length} bytes`
);
