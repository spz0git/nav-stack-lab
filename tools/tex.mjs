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
