// The built page's link preview and favicon: the head names an image that the Pages workflow serves beside the page,
// with the size it really has, and the icon is inlined so the page makes no network request. `npm test`.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const head = fs.readFileSync(path.join(ROOT, 'dist', 'nav-stack-lab.html'), 'utf8').split('</head>')[0];
const meta = name => {
  const m = head.match(new RegExp(`<meta (?:property|name)="${name}" content="([^"]*)"`));
  return m && m[1];
};
const SITE = 'https://spz0git.github.io/nav-stack-lab/';

test('the page names its preview image, and the file has the declared size', () => {
  assert.equal(meta('og:image'), SITE + 'preview.png');
  assert.equal(meta('twitter:image'), SITE + 'preview.png');
  assert.equal(meta('og:url'), SITE);
  assert.ok(meta('og:title') && meta('og:description') && meta('og:image:alt'), 'title, description and alt');
  assert.equal(meta('twitter:card'), 'summary_large_image');
  const png = fs.readFileSync(path.join(ROOT, 'docs', 'readme', 'preview.png'));
  assert.equal(png.toString('latin1', 1, 4), 'PNG');
  const [w, h] = [png.readUInt32BE(16), png.readUInt32BE(20)];
  assert.equal(String(w), meta('og:image:width'));
  assert.equal(String(h), meta('og:image:height'));
  assert.ok(Math.abs(w / h - 1200 / 630) < 0.01, `${w}×${h} is not 1.91:1`);
  const pages = fs.readFileSync(path.join(ROOT, '.github', 'workflows', 'pages.yml'), 'utf8');
  assert.match(pages, /cp docs\/readme\/preview\.png site\//, 'the Pages workflow serves the image');
});

test('the favicon is inlined from src/icon.svg', () => {
  const m = head.match(/<link rel="icon" href="(data:image\/svg\+xml,[^"]+)"/);
  assert.ok(m, 'a data: icon');
  const svg = decodeURIComponent(m[1].slice('data:image/svg+xml,'.length));
  assert.equal(svg, fs.readFileSync(path.join(ROOT, 'src', 'icon.svg'), 'utf8').trim());
  assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
});
