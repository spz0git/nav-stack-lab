// Build: src/ → dist/nav-stack-lab.html (single file). Usage: node build.mjs [--check]
import fs from 'node:fs';
import path from 'node:path';
import {execSync} from 'node:child_process';
import {buildNotes} from './tools/notes.mjs';
import {buildLessons} from './tools/lessons.mjs';
import {buildChangelog} from './tools/changelog.mjs';
import {buildCode, buildExamples, buildModels, modelRefProblems, modelsSource} from './tools/code.mjs';
import {texSource} from './tools/tex.mjs';
const src = p => fs.readFileSync(path.join('src', p), 'utf8');
// a module's TEX`…` literals (the How it works panels, the Analyze derivations): TeX → MathML
const mod = f => texSource(src(f), 'src/' + f);
const manifest = JSON.parse(src('manifest.json'));
const notes = buildNotes(); // docs/notes/*.md → the Learn column's companion chapters
const lessons = buildLessons(); // docs/lessons/<group>/*.md → the lessons
const changes = buildChangelog(); // CHANGELOG.md → What's new under the version label
const code = buildCode(), // the "// @code" snippets the lessons show
  examples = buildExamples(), // src/examples → the Code tab's slot examples
  models = buildModels(); // src/models → the learned blocks' weights
for (const g of Object.keys(lessons))
  for (const L of lessons[g]) {
    if (!L.code) continue;
    if (!code[L.code.snip]) throw new Error(`lesson "${L.t}": no code snippet "${L.code.snip}" (// @code marker)`);
    if (L.code.ex) {
      const [slot, id] = L.code.ex.split('/');
      if (!(examples[slot] || []).some(e => e.id === id)) throw new Error(`lesson "${L.t}": no example "${L.code.ex}" in src/examples`);
    }
  }
const modelsJS = modelsSource(models); // the weights as source text, the policy's as integers (tools/code.mjs)
const inlineData = s =>
  s
    .replace(/\/\*__EXAMPLES__\*\/\s*\{\s*\}/, () => JSON.stringify(examples).replace(/<\/script/g, '<\\/script'))
    .replace(/\/\*__MODELS__\*\/\s*\{\s*\}/, () => modelsJS)
    .replace(/\/\*__CODE__\*\/\s*\{\s*\}/, () => JSON.stringify(code).replace(/<\/script/g, '<\\/script'));
const js = inlineData(manifest.map(f => `/* ---- ${f} ---- */\n` + mod(f)).join('\n'))
  // the placeholders are a comment plus an empty literal, matched loosely so that a formatter cannot break them
  .replace(/\/\*__CHAPTERS__\*\/\s*\[\s*\]/, () => JSON.stringify(notes).replace(/<\/script/g, '<\\/script'))
  .replace(/\/\*__LESSONS__\*\/\s*\{[^}]*\}/, () => JSON.stringify(lessons).replace(/<\/script/g, '<\\/script'))
  .replace(/\/\*__CHANGES__\*\/\s*\[\s*\]/, () => JSON.stringify(changes).replace(/<\/script/g, '<\\/script'));
// Version label: src/version.json is bumped with every release (no build time or commit hash, so dist/ stays reproducible)
const ver = JSON.parse(src('version.json')),
  verText = `v${ver.version} · ${ver.date}`;
// Fonts: src/fonts/fonts.json lists the faces; each file is embedded as a data: URI so the page makes no network request at runtime
const fonts = JSON.parse(src('fonts/fonts.json'))
  .map(
    f =>
      `@font-face{font-family:"${f.family}";font-style:${f.style};font-weight:${f.weight};font-display:swap;src:url(data:font/woff2;base64,${fs.readFileSync(path.join('src/fonts', f.file)).toString('base64')}) format("woff2");unicode-range:${f.unicodeRange}}`
  )
  .join('\n');
// Favicon: src/icon.svg inlined as a data: URI (the page makes no network request; the CSP allows img-src data:)
const icon = 'data:image/svg+xml,' + encodeURIComponent(src('icon.svg').trim());
const page = src('index.html')
  .replace('/*__FONTS__*/', () => fonts)
  .replace('__ICON__', () => icon)
  .replace('__VERSION__', () => verText)
  .replace('/*__CSS__*/', () => src('styles.css').trimEnd())
  .replace('/*__JS__*/', () => "(()=>{\n'use strict';\n" + js + '\n})();');
const core =
  inlineData(
    manifest
      .filter(f => f.startsWith('core/'))
      .map(f => `/* ---- ${f} ---- */\n` + src(f))
      .join('\n')
  ) +
  '\n' +
  src('worker/main.js');
const worker = "(()=>{\n'use strict';\n" + core + '\n})();';
fs.mkdirSync('dist', {recursive: true});
fs.writeFileSync('dist/core-worker.js', worker);
try {
  execSync('node --check dist/core-worker.js', {stdio: 'pipe'});
} catch (e) {
  console.error(String(e.stderr));
  process.exit(1);
}
// The page does not carry the worker's source twice: the core modules come first in the page's own script, so the
// page cuts them from it at runtime (coreWorkerSource, ui/experiments.js) between the first core module's marker and
// the first other module's; the core-worker-src block holds only worker/main.js and those two module names.
const coreMods = manifest.filter(f => f.startsWith('core/')),
  afterCore = manifest[coreMods.length];
if (manifest.slice(0, coreMods.length).some(f => !f.startsWith('core/')) || !afterCore)
  throw new Error('BUILD FAILED: the manifest must list every core/ module first, then at least one other module');
const workerMain = src('worker/main.js');
if (/<\/script/i.test(workerMain)) throw new Error('BUILD FAILED: worker/main.js contains "</script"');
const page2 = page
  .replace('__CORE_FROM__', () => coreMods[0])
  .replace('__CORE_TO__', () => afterCore)
  .replace('/*__WORKER__*/', () => workerMain);
{
  // what the page will assemble (the same steps as coreWorkerSource) must be dist/core-worker.js, character for character
  const blk = page2.match(/<script type="text\/plain" id="core-worker-src" data-from="([^"]*)" data-to="([^"]*)">([\s\S]*?)<\/script>/),
    app = (page2.match(/<script id="app-js">([\s\S]*?)<\/script>/) || [])[1];
  const from = app ? app.indexOf(`/* ---- ${blk[1]} ---- */\n`) : -1,
    to = from < 0 ? -1 : app.indexOf(`\n/* ---- ${blk[2]} ---- */\n`, from);
  if (!blk || from < 0 || to < 0 || "(()=>{\n'use strict';\n" + app.slice(from, to) + '\n' + blk[3] + '\n})();' !== worker)
    throw new Error('BUILD FAILED: the worker source the page assembles from its own script differs from dist/core-worker.js');
}
if (
  !/"id":"ch1"/.test(page2) ||
  !/"t":"Dead reckoning drifts/.test(page2) ||
  /__EXAMPLES__|__CODE__|__MODELS__|__CHANGES__/.test(page2) ||
  /\bTEX`/.test(page2)
) {
  console.error(
    'BUILD FAILED: the chapters, the lessons, the changelog, the examples, the code snippets or a TEX`…` literal did not get inlined (placeholder mismatch)'
  );
  process.exit(1);
}
fs.writeFileSync('dist/nav-stack-lab.html', page2);
fs.writeFileSync('dist/app.js', "(()=>{\n'use strict';\n" + js + '\n})();');
try {
  execSync('node --check dist/app.js', {stdio: 'pipe'});
} catch (e) {
  console.error(String(e.stderr));
  process.exit(1);
}
// a model without its out-of-distribution reference is a warning, not a failure (tools/code.mjs, modelRefProblems)
for (const m of modelRefProblems(models)) console.warn('WARNING:', m);
console.log(
  'BUILD_OK',
  verText,
  '·',
  manifest.length,
  'modules,',
  notes.length,
  'chapters,',
  Object.values(lessons).reduce((a, b) => a + b.length, 0),
  'lessons,',
  (page2.length / 1024).toFixed(0),
  'KB'
);
