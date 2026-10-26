// Code behind the lessons, build-time only.
//   buildCode():     an index of the snippets marked in the source with "// @code <id> | <title>" … "// @end":
//                    {id: {file, title, from, to}}. The text itself is not copied: the page cuts it from its own
//                    source at runtime by the same markers (codeSnippet in ui/source.js). A lesson's "## Code:"
//                    section names one by id; the Learn column shows it read-only with the lesson's focus lines
//                    marked, and the source viewer opens the whole module. Ids must be unique across the manifest.
//   buildExamples(): src/examples/<slot>/<nn>-<id>.js → {slot: [{id, name, code}]}: the slot examples the Code tab
//                    offers and a lesson's "Edit and run" button loads. The first line is "// @example <name>"; the
//                    rest is the code as the editor shows it, written against the slot API (teaching code, kept
//                    compact: src/examples/ is not formatted by Prettier).
import fs from 'node:fs';
import path from 'node:path';
export function buildCode(manifestFile = 'src/manifest.json') {
  const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
  const out = {};
  for (const f of manifest) {
    const lines = fs.readFileSync(path.join('src', f), 'utf8').split('\n');
    for (let i = 0; i < lines.length; i++) {
      const m = /^\s*\/\/ @code (\S+)\s*\|\s*(.*)$/.exec(lines[i]);
      if (!m) continue;
      const id = m[1],
        title = m[2].trim();
      if (out[id]) throw new Error(`code snippet "${id}" marked twice (${out[id].file} and ${f})`);
      let j = i + 1;
      while (j < lines.length && !/^\s*\/\/ @end\b/.test(lines[j])) j++;
      if (j >= lines.length) throw new Error(`${f}: "// @code ${id}" has no "// @end"`);
      out[id] = {id, file: f, title, from: i + 2, to: j};
      i = j;
    }
  }
  return out;
}
// src/models/<name>.json → {name: model}: the learned blocks' weights the page runs (nn.js)
export function buildModels(dir = 'src/models') {
  const out = {};
  if (!fs.existsSync(dir)) return out;
  for (const f of fs
    .readdirSync(dir)
    .filter(f => f.endsWith('.json'))
    .sort())
    out[f.replace(/\.json$/, '')] = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
  return out;
}
// The models as source text, for the MODELS literal in core/models-data.js (in the page and the worker). A model whose
// layers' numbers are all exact thousandths (the policy, saved at three decimals) carries them as integers, -46 for
// -0.046, and a short decoder divides them by 1000 when the script starts: k / 1000 is the double nearest to the
// decimal, the very number JSON.parse gives for "-0.046", so the weights are bit for bit the file's (checked here) in
// about 55 % of the characters. The other models are inlined as they are.
const layerArrays = M => (Array.isArray(M && M.layers) ? M.layers.flatMap(L => Object.values(L).filter(v => Array.isArray(v))) : []);
const milliExact = M => {
  const arrs = layerArrays(M);
  return arrs.length > 0 && arrs.every(a => a.every(x => typeof x === 'number' && Object.is(Math.round(x * 1000) / 1000, x)));
};
export function modelsSource(models) {
  const enc = {},
    names = [];
  for (const [name, M] of Object.entries(models)) {
    if (!milliExact(M)) {
      enc[name] = M;
      continue;
    }
    names.push(name);
    const ints = L => Object.fromEntries(Object.entries(L).map(([k, v]) => [k, Array.isArray(v) ? v.map(x => Math.round(x * 1000)) : v]));
    enc[name] = {...M, layers: M.layers.map(ints)};
  }
  const json = JSON.stringify(enc);
  if (!names.length) return json;
  const src =
    `(m => {\n  // ${names.join(', ')}: weights in thousandths (tools/code.mjs, modelsSource)\n` +
    `  for (const n of ${JSON.stringify(names)}) for (const L of m[n].layers) for (const k in L) if (Array.isArray(L[k])) L[k] = L[k].map(x => x / 1000);\n` +
    `  return m;\n})(${json})`;
  // decoding must give back the very same model, every number bit for bit
  const dec = new Function(`return ${src};`)();
  for (const n of names) {
    const a = layerArrays(models[n]),
      b = layerArrays(dec[n]);
    if (
      a.length !== b.length ||
      a.some((x, i) => x.length !== b[i].length || x.some((v, j) => !Object.is(v, b[i][j]))) ||
      JSON.stringify(dec[n]) !== JSON.stringify(models[n])
    )
      throw new Error(`BUILD FAILED: model "${n}" does not decode to its own weights (tools/code.mjs, modelsSource)`);
  }
  return src;
}
// The models whose `ref` (the out-of-distribution reference core/learnmon.js scores inputs against) is missing or
// malformed, one message each. A trainer (training/<block>/train.py) writes its model without one; tools/ood-ref.mjs
// adds it by replaying the training runs on the built core, so the build only warns: the model has to be built before
// its reference can be computed (and the page runs a model without one, unwatched).
export function modelRefProblems(models) {
  const out = [];
  for (const [name, M] of Object.entries(models)) {
    const R = M && M.ref;
    if (R && Array.isArray(R.mean) && Array.isArray(R.sd) && R.mean.length === R.sd.length && Number.isFinite(R.thr)) continue;
    out.push(
      `src/models/${name}.json has ${R ? 'a malformed' : 'no'} ref (the out-of-distribution reference): ` +
        `run tools/ood-ref.mjs on this build (node tools/ood-ref.mjs ${name}), then ./build.sh again`
    );
  }
  return out;
}
export function buildExamples(dir = 'src/examples') {
  const out = {};
  for (const slot of fs.readdirSync(dir).sort()) {
    const d = path.join(dir, slot);
    if (!fs.statSync(d).isDirectory()) continue;
    out[slot] = [];
    for (const f of fs
      .readdirSync(d)
      .filter(f => f.endsWith('.js'))
      .sort()) {
      const src = fs.readFileSync(path.join(d, f), 'utf8'),
        nl = src.indexOf('\n'),
        m = /^\/\/ @example (.+)$/.exec(src.slice(0, nl));
      if (!m) throw new Error(`${d}/${f}: the first line must be "// @example <name>"`);
      out[slot].push({id: f.replace(/^\d+-/, '').replace(/\.js$/, ''), name: m[1].trim(), code: src.slice(nl + 1)});
    }
  }
  return out;
}
