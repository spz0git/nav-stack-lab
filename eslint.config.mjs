// Lint for a page whose modules share one scope. The src/ modules are concatenated in manifest order inside one
// IIFE, so a name declared at the top level of any module is a global for every other one; this config parses each
// module and collects those names, and then `no-undef` catches a misspelled or missing cross-module reference,
// which otherwise is a ReferenceError only when that code path runs. `npm run lint`.
import fs from 'node:fs';
import path from 'node:path';
import * as espree from 'espree';
import globalsPkg from 'globals';
const manifest = JSON.parse(fs.readFileSync('src/manifest.json', 'utf8'));
const files = [...manifest, 'worker/main.js'].map(f => path.join('src', f));
function declared(src) {
  const out = new Set();
  const ast = espree.parse(src, {ecmaVersion: 'latest', sourceType: 'script', loc: false});
  const names = p => {
    if (!p) return;
    if (p.type === 'Identifier') out.add(p.name);
    else if (p.type === 'ObjectPattern') p.properties.forEach(q => names(q.type === 'RestElement' ? q.argument : q.value));
    else if (p.type === 'ArrayPattern') p.elements.forEach(names);
    else if (p.type === 'AssignmentPattern') names(p.left);
    else if (p.type === 'RestElement') names(p.argument);
  };
  for (const n of ast.body) {
    if (n.type === 'VariableDeclaration') n.declarations.forEach(d => names(d.id));
    else if (n.type === 'FunctionDeclaration' || n.type === 'ClassDeclaration') out.add(n.id.name);
    else if (n.type === 'BlockStatement') {
    } // a top-level block keeps its declarations to itself
  }
  return out;
}
const shared = {};
for (const f of files) for (const n of declared(fs.readFileSync(f, 'utf8'))) shared[n] = 'writable';
const sharedCount = Object.keys(shared).length;
export default [
  // .claude/: the app's session worktrees, each a full checkout (its tools/vendor/ is not the one ignored above)
  {ignores: ['dist/**', 'node_modules/**', 'tools/vendor/**', '.venv/**', '**/.venv/**', '.claude/**']},
  {
    files: ['src/**/*.js'],
    languageOptions: {ecmaVersion: 'latest', sourceType: 'script', globals: {...globalsPkg.browser, ...globalsPkg.worker, ...shared}},
    rules: {
      'no-undef': 'error',
      'no-dupe-keys': 'error',
      'no-dupe-args': 'error',
      'no-duplicate-case': 'error',
      'no-unreachable': 'error',
      'no-self-assign': 'error',
      'use-isnan': 'error',
      'valid-typeof': 'error',
      'no-const-assign': 'error',
      'no-func-assign': 'error',
      'no-unsafe-negation': 'error',
      'no-sparse-arrays': 'error',
      'no-debugger': 'error'
    }
  },
  {
    files: ['build.mjs', 'tools/*.mjs', 'tests/node/*.mjs', 'eslint.config.mjs'],
    languageOptions: {ecmaVersion: 'latest', sourceType: 'module', globals: {...globalsPkg.node}},
    rules: {'no-undef': 'error', 'no-dupe-keys': 'error', 'no-unreachable': 'error', 'no-const-assign': 'error', 'no-redeclare': 'error', 'no-func-assign': 'error'}
  }
];
console.error(`eslint: ${sharedCount} shared names from ${files.length} modules`);
