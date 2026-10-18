// CHANGELOG.md → the page's What's new (the popover under the version label). Build-time only.
// A release is a "## vNN · YYYY-MM-DD" section; its body is paragraphs and "- " bullets whose continuation lines are
// indented, with the notes' inline markdown (`code`, **bold**, *em*, links). Relative links point at the file on
// GitHub, and "#NN" after "PR" or "PRs" links the pull request. "## Unreleased", the text before the first release
// and the text after the last one ("Earlier versions: …") are left out.
// Output, newest first: [{v, date, html}].
import fs from 'node:fs';
import {inline} from './notes.mjs';
const REPO = 'https://github.com/spz0git/nav-stack-lab';
function line(s) {
  // relative links → the file on GitHub (inline only links http(s) targets)
  s = s.replace(/\[([^\]]+)\]\((?!https?:)([^)\s]+)\)/g, (_, t, p) => `[${t}](${REPO}/blob/main/${p.replace(/^\.?\//, '')})`);
  return inline(s).replace(/\bPRs? #\d+(?:\s*[–-]\s*#\d+)?/g, m =>
    m.replace(/#(\d+)/g, (_, n) => `<a href="${REPO}/pull/${n}" target="_blank" rel="noopener">#${n}</a>`)
  );
}
function body(lines) {
  const out = [];
  let i = 0;
  while (i < lines.length) {
    if (!lines[i].trim()) {
      i++;
      continue;
    }
    if (/^[-*] /.test(lines[i])) {
      const items = [];
      while (i < lines.length && (/^[-*] /.test(lines[i]) || (/^\s+\S/.test(lines[i]) && items.length))) {
        if (/^[-*] /.test(lines[i])) items.push(lines[i].slice(2));
        else items[items.length - 1] += ' ' + lines[i].trim();
        i++;
      }
      out.push(`<ul>${items.map(x => `<li>${line(x)}</li>`).join('')}</ul>`);
      continue;
    }
    const buf = [];
    while (i < lines.length && lines[i].trim() && !/^[-*] /.test(lines[i])) buf.push(lines[i++].trim());
    out.push(`<p>${line(buf.join(' '))}</p>`);
  }
  return out.join('');
}
export function buildChangelog(file = 'CHANGELOG.md') {
  const lines = fs.readFileSync(file, 'utf8').split('\n'),
    out = [];
  let cur = null;
  for (const l of lines) {
    const h = /^## v(\d+) · (\d{4}-\d{2}-\d{2})\s*$/.exec(l);
    if (h) {
      cur = {v: +h[1], date: h[2], lines: []};
      out.push(cur);
    } else if (/^## Unreleased\s*$/.test(l))
      cur = null; // not released yet: not in the page
    else if (/^## /.test(l)) throw new Error(`CHANGELOG.md: a section that is not "## vNN · YYYY-MM-DD": ${l}`);
    else if (cur && /^Earlier versions:/.test(l)) cur = null;
    else if (cur) cur.lines.push(l);
  }
  for (let k = 1; k < out.length; k++)
    if (out[k].v >= out[k - 1].v) throw new Error(`CHANGELOG.md: v${out[k].v} after v${out[k - 1].v} (newest first)`);
  return out.map(r => ({v: r.v, date: r.date, html: body(r.lines)}));
}
