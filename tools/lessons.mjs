// Lessons: docs/lessons/<group>/<nn>-<slug>.md → the lesson objects the Learn column renders. Build-time only.
// A lesson file is front matter ("key: value" lines: group, title, and extra: true for the control lessons that
// were added after the first ten), then the body (HTML, kept verbatim up to the first "## " line), then sections:
//   ## Try: <label>          one experiment; the lines that follow, each "Key: value" on one line:
//     cfg: {json}              the Try configuration (tryGo when it has "sim": true, lessonGo otherwise)
//     Setup: … / See: … / Shows: …    the explanation (optional; all three make an explained Try)
//     Predict: <question>      then one "- option" line per answer and "Answer: <index>" (0-based)
//     | a | b |                a pipe table right after Setup, See or Shows (header row, a |---| row, then one row
//                              per line) joins that field; plain lines after the table continue the same field.
//                              The field is printed inside a <p>, so the table closes it and opens a new one.
//   ## Code: <title>         the code behind the lesson (optional, one per lesson): the lines that follow
//     snippet: <id>            a "// @code <id>" snippet in the source (tools/code.mjs)
//     focus: <text>            a line of the snippet to mark, by a substring (repeatable); "focus: a … b" marks the
//                              lines from the first match of a to the first match of b
//     example: <slot>/<id>     the slot example "Edit and run" loads (src/examples/<slot>/<nn>-<id>.js)
//     Note: …                  what to look at, what to change
//   ## Think about           "Q: …" and "A: …" pairs
//   ## Check yourself        Q: … / Answer: <number> / Tolerance: <number> (optional, 0 = exact) / Unit: … / How: …
// Math is TeX, as in the companion notes: $ … $ inline, $$ … $$ display (in the body it may span lines; in a one-line
// field it stays on that line). The build turns it into MathML (tools/tex.mjs); the page never sees the TeX.
// The output has the same shape as the objects the JS files used to hold: {t, b, tries:[[label, cfg, {setup, see,
// shows, predict:{q, opts, a}}]], q:[[question, answer]], check:{q, a, tol, unit, how}}.
import fs from 'node:fs';
import path from 'node:path';
import {texText} from './tex.mjs';
const GROUPS = ['loc', 'per', 'plan', 'ctl', 'saf'];
export function parseLesson(md, file) {
  const lines = md.split('\n');
  let i = 0;
  const meta = {};
  while (i < lines.length && /^\w+:\s/.test(lines[i])) {
    const m = /^(\w+):\s*(.*)$/.exec(lines[i]);
    meta[m[1]] = m[2];
    i++;
  }
  if (!meta.title || !meta.group) throw new Error(`${file}: front matter needs group and title`);
  while (i < lines.length && !lines[i].trim()) i++;
  const body = [];
  while (i < lines.length && !/^## /.test(lines[i])) body.push(lines[i++]);
  const L = {t: meta.title, b: body.join('\n').replace(/\n+$/, ''), tries: []};
  const kv = l => {
    const m = /^([A-Za-z]+):\s?(.*)$/.exec(l);
    return m ? [m[1], m[2]] : null;
  };
  while (i < lines.length) {
    const h = /^## (.*)$/.exec(lines[i]);
    if (!h) {
      i++;
      continue;
    }
    const sec = h[1].trim();
    i++;
    const buf = [];
    while (i < lines.length && !/^## /.test(lines[i])) buf.push(lines[i++]);
    const items = buf.filter(l => l.trim());
    if (/^Try:/.test(sec)) {
      const label = sec.replace(/^Try:\s*/, ''),
        x = {};
      let cfg = null,
        predict = null,
        field = null,
        rows = null;
      const flush = () => {
        if (rows) x[field] = (x[field] || '') + runTable(rows, file, label);
        rows = null;
      };
      for (const l of items) {
        if (/^\|/.test(l)) {
          if (!field) throw new Error(`${file}: Try "${label}": a table must follow Setup, See or Shows`);
          (rows = rows || []).push(l);
          continue;
        }
        if (rows) {
          flush();
          const p = kv(l);
          if (!/^- /.test(l) && !(p && /^(cfg|Setup|See|Shows|Predict|Answer)$/.test(p[0]))) {
            x[field] += l;
            continue;
          }
        }
        field = null;
        if (/^- /.test(l)) {
          if (predict) predict.opts.push(l.slice(2));
          continue;
        }
        const p = kv(l);
        if (!p) throw new Error(`${file}: Try "${label}": cannot read "${l.slice(0, 60)}"`);
        const [k, v] = p;
        if (k === 'cfg') cfg = JSON.parse(v);
        else if (k === 'Setup') x[(field = 'setup')] = v;
        else if (k === 'See') x[(field = 'see')] = v;
        else if (k === 'Shows') x[(field = 'shows')] = v;
        else if (k === 'Predict') predict = {q: v, opts: [], a: 0};
        else if (k === 'Answer') {
          if (!predict) throw new Error(`${file}: Answer without Predict`);
          predict.a = +v;
        } else throw new Error(`${file}: Try "${label}": unknown key ${k}`);
      }
      flush();
      if (!cfg) throw new Error(`${file}: Try "${label}" has no cfg`);
      if (predict) x.predict = predict;
      L.tries.push(Object.keys(x).length ? [label, cfg, x] : [label, cfg]);
    } else if (/^Code:/.test(sec)) {
      const c = {t: sec.replace(/^Code:\s*/, ''), focus: []};
      for (const l of items) {
        const p = kv(l);
        if (!p) throw new Error(`${file}: Code: cannot read "${l.slice(0, 60)}"`);
        const [k, v] = p;
        if (k === 'snippet') c.snip = v.trim();
        else if (k === 'focus') {
          const m = /^(.*?)\s+…\s+(.*)$/.exec(v);
          c.focus.push(m ? [m[1], m[2]] : [v]);
        } else if (k === 'example') c.ex = v.trim();
        else if (k === 'Note') c.note = v;
        else throw new Error(`${file}: Code: unknown key ${k}`);
      }
      if (!c.snip) throw new Error(`${file}: Code section without a snippet`);
      L.code = c;
    } else if (sec === 'Think about') {
      L.q = [];
      let q = null;
      for (const l of items) {
        const p = kv(l);
        if (!p) throw new Error(`${file}: Think about: cannot read "${l.slice(0, 60)}"`);
        if (p[0] === 'Q') q = p[1];
        else if (p[0] === 'A') {
          L.q.push([q, p[1]]);
          q = null;
        }
      }
    } else if (sec === 'Check yourself') {
      const c = {};
      for (const l of items) {
        const p = kv(l);
        if (!p) continue;
        const [k, v] = p;
        if (k === 'Q') c.q = v;
        else if (k === 'Answer') c.a = +v;
        else if (k === 'Tolerance') c.tol = +v;
        else if (k === 'Unit') c.unit = v;
        else if (k === 'How') c.how = v;
      }
      // no Tolerance line: the answer must match exactly (an undefined tol would reject every answer)
      if (!isFinite(c.a)) console.warn(`WARNING ${file}: Check yourself has no numeric Answer`);
      L.check = {q: c.q, a: c.a, tol: isFinite(c.tol) ? c.tol : 0, unit: c.unit || '', how: c.how};
    } else throw new Error(`${file}: unknown section "${sec}"`);
  }
  if (/class="eq"/.test(L.b)) throw new Error(`${file}: a <div class="eq"> block: write the formula in TeX ($$ … $$)`);
  texLesson(L, file);
  return {group: meta.group, extra: meta.extra === 'true', L};
}
// A run log as a table: the first row is the header, the second the |---| separator, then the rows. It closes the
// field's paragraph and opens the next, and takes the workspace's numeric table style (.exptab: first column left,
// the rest right-aligned in tabular figures, scrolling sideways on a phone).
function runTable(lines, file, label) {
  const rows = lines.map(l =>
    l
      .trim()
      .replace(/^\||\|$/g, '')
      .split('|')
      .map(c => c.trim())
  );
  if (rows.length < 3 || !rows[1].every(c => /^:?-+:?$/.test(c)))
    throw new Error(`${file}: Try "${label}": a table needs a header row, a |---| row and at least one row`);
  const n = rows[0].length;
  for (const r of rows)
    if (r.length !== n) throw new Error(`${file}: Try "${label}": table row "${r.join(' | ')}" has ${r.length} cells, the header ${n}`);
  const head = `<thead><tr>${rows[0].map(c => `<th>${c}</th>`).join('')}</tr></thead>`,
    body = `<tbody>${rows
      .slice(2)
      .map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`)
      .join('')}</tbody>`;
  return `</p><div class="exptab"><table>${head}${body}</table></div><p>`;
}
// Every text field of a parsed lesson: TeX → MathML
function texLesson(L, file) {
  const t = s => texText(s, file);
  L.b = t(L.b);
  for (const tr of L.tries) {
    const x = tr[2];
    if (!x) continue;
    for (const k of ['setup', 'see', 'shows']) if (x[k]) x[k] = t(x[k]);
    if (x.predict) {
      x.predict.q = t(x.predict.q);
      x.predict.opts = x.predict.opts.map(t);
    }
  }
  if (L.code && L.code.note) L.code.note = t(L.code.note);
  if (L.q) L.q = L.q.map(([q, a]) => [t(q), t(a)]);
  if (L.check) for (const k of ['q', 'how']) if (L.check[k]) L.check[k] = t(L.check[k]);
}
export function buildLessons(dir = 'docs/lessons') {
  const out = {};
  for (const g of GROUPS) out[g] = [];
  out.ctlExtra = [];
  for (const g of GROUPS) {
    const d = path.join(dir, g);
    if (!fs.existsSync(d)) continue;
    for (const f of fs
      .readdirSync(d)
      .filter(f => f.endsWith('.md'))
      .sort()) {
      const r = parseLesson(fs.readFileSync(path.join(d, f), 'utf8'), path.join(d, f));
      if (r.group !== g) throw new Error(`${f}: group ${r.group} in folder ${g}`);
      (g === 'ctl' && r.extra ? out.ctlExtra : out[g]).push(r.L);
    }
  }
  return out;
}
