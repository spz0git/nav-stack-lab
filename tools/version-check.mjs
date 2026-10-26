// One source of truth for the version: src/version.json ({version: NN, date}) is what the page shows; every other
// place that names the version must agree with it. Checks package.json and package-lock.json (`NN.0.0`),
// CITATION.cff (`version: "NN"`, `date-released: date`) and every "vNN · date" label in the issue templates
// (.github/ISSUE_TEMPLATE/*.yml). Exits 1 naming each mismatch. `npm run version:check`; CI runs it after the build.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const {version, date} = JSON.parse(read('src/version.json'));
const semver = `${version}.0.0`,
  label = `v${version} · ${date}`,
  bad = [];
const expect = (where, got, want) => {
  if (String(got) !== String(want)) bad.push(`${where}: ${JSON.stringify(got ?? null)}, expected ${JSON.stringify(want)}`);
};
const pkg = JSON.parse(read('package.json'));
expect('package.json version', pkg.version, semver);
const lock = JSON.parse(read('package-lock.json'));
expect('package-lock.json version', lock.version, semver);
expect('package-lock.json packages[""].version', lock.packages?.['']?.version, semver);
const cff = read('CITATION.cff');
expect('CITATION.cff version', cff.match(/^version:\s*["']?([^"'\s]+)["']?\s*$/m)?.[1], String(version));
expect('CITATION.cff date-released', cff.match(/^date-released:\s*["']?([^"'\s]+)["']?\s*$/m)?.[1], date);
const tdir = path.join('.github', 'ISSUE_TEMPLATE');
for (const f of fs
  .readdirSync(path.join(ROOT, tdir))
  .filter(f => /\.ya?ml$/.test(f))
  .sort()) {
  const lines = read(path.join(tdir, f)).split('\n');
  lines.forEach((l, i) => {
    for (const m of l.matchAll(/v\d+ · \d{4}-\d\d-\d\d/g)) expect(`${tdir}/${f}:${i + 1}`, m[0], label);
  });
}
if (bad.length) {
  console.error(`version:check: ${bad.length} place${bad.length > 1 ? 's' : ''} disagree with src/version.json (${label}):`);
  for (const b of bad) console.error('  ' + b);
  process.exit(1);
}
console.log(`version:check: package.json, package-lock.json, CITATION.cff and the issue templates agree with ${label}`);
