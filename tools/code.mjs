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
