// Build: src/ → dist/nav-stack-lab.html (single file). Usage: node build.mjs [--check]
import fs from 'node:fs';import path from 'node:path';import {execSync} from 'node:child_process';
const src=p=>fs.readFileSync(path.join('src',p),'utf8');
const manifest=JSON.parse(src('manifest.json'));
const js=manifest.map(f=>`/* ---- ${f} ---- */\n`+src(f)).join('\n');
const page=src('index.html').replace('/*__CSS__*/',()=>src('styles.css').trimEnd()).replace('/*__JS__*/',()=>"(()=>{\n'use strict';\n"+js+"\n})();");
const core=manifest.filter(f=>f.startsWith('core/')).map(f=>`/* ---- ${f} ---- */\n`+src(f)).join('\n')+'\n'+src('worker/main.js');
const worker="(()=>{\n'use strict';\n"+core+"\n})();";
fs.mkdirSync('dist',{recursive:true});
fs.writeFileSync('dist/core-worker.js',worker);
try{execSync('node --check dist/core-worker.js',{stdio:'pipe'});}catch(e){console.error(String(e.stderr));process.exit(1);}
const page2=page.replace('/*__WORKER__*/',()=>worker.replace(/<\/script/g,'<\\/script'));
fs.writeFileSync('dist/nav-stack-lab.html',page2);
fs.writeFileSync('dist/app.js',"(()=>{\n'use strict';\n"+js+"\n})();");
try{execSync('node --check dist/app.js',{stdio:'pipe'});}catch(e){console.error(String(e.stderr));process.exit(1);}
console.log('BUILD_OK',manifest.length,'modules,',(page2.length/1024).toFixed(0),'KB');
