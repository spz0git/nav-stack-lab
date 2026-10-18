// TeX → MathML at build time (tools/vendor/temml), shared by the companion notes and the lessons; the page gets the
// MathML and keeps zero runtime dependencies.
//   tex(src, display, where)   one formula; a TeX error stops the build and names the file
//   texText(s, where)          a lesson's text: "$$ … $$" (may span lines) → <div class="math">, "$ … $" → inline MathML
import {createRequire} from 'node:module';
const temml = createRequire(import.meta.url)('./vendor/temml/temml.cjs');
export function tex(src, display, where = 'notes') {
  try {
    return temml.renderToString(src, {displayMode: display, throwOnError: true, strict: false});
  } catch (e) {
    console.error(`TeX error in ${where}:`, e.message, '\n  ' + src);
    process.exit(1);
  }
}
export function texText(s, where) {
  if (typeof s !== 'string' || !s.includes('$')) return s;
  s = s.replace(/\$\$([\s\S]+?)\$\$/g, (_, t) => `<div class="math">${tex(t.trim(), true, where)}</div>`);
  s = s.replace(/\$([^$\n]+?)\$/g, (_, t) => tex(t, false, where));
  if (s.includes('$')) {
    console.error(`TeX error in ${where}: an unmatched $`);
    process.exit(1);
  }
  return s;
}
// TeX in the JS source (the Simulate tabs' "How it works" panels, the Analyze derivations): a template literal tagged
// TEX (String.raw in the source, so ESLint and Prettier see plain JS) is replaced by a plain template literal holding
// the MathML. "${expr}" stays an interpolation: inside $ … $ it becomes <mn>${expr}</mn> (a number), outside it stays
// as it is. texSource(js, where) rewrites every TEX`…` in one file; the page never sees the TeX.
export function texSource(js, where) {
  let out = '',
    i = 0;
  const die = msg => {
    console.error(`TEX\`…\` in ${where}: ${msg}`);
    process.exit(1);
  };
  for (;;) {
    const at = js.indexOf('TEX`', i);
    if (at < 0) return out + js.slice(i);
    if (/[\w$]/.test(js[at - 1] || '')) {
      out += js.slice(i, at + 4);
      i = at + 4;
      continue;
    }
    out += js.slice(i, at);
    const exprs = [];
    let k = at + 4,
      body = '';
    for (;;) {
      if (k >= js.length) die('no closing backtick');
      const c = js[k];
      if (c === '`') break;
      if (c === '$' && js[k + 1] === '{') {
        let depth = 1,
          j = k + 2;
        for (; j < js.length && depth; j++) {
          if (js[j] === '`') die('a backtick inside ${…}');
          depth += js[j] === '{' ? 1 : js[j] === '}' ? -1 : 0;
        }
        exprs.push(js.slice(k + 2, j - 1));
        body += `\\text{@${exprs.length - 1}@}`;
        k = j;
        continue;
      }
      body += c;
      k++;
    }
    const line = js.slice(0, at).split('\n').length;
    let html = texText(body, `${where}:${line}`).replace(/\\|`|\$\{/g, m => '\\' + m);
    html = html.replace(/<mtext>@(\d+)@<\/mtext>/g, (_, n) => '<mn>${' + exprs[n] + '}</mn>');
    html = html.replace(/\\\\text\{@(\d+)@\}/g, (_, n) => '${' + exprs[n] + '}');
    if (/@\d+@/.test(html)) die(`line ${line}: an interpolation inside \\text{…} or a subscript`);
    out += '`' + html + '`';
    i = k + 1;
  }
}
