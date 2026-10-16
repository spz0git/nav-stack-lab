// The page's simulation core in Node: loads dist/core-worker.js (core/* + worker/main.js, no DOM) into this process
// and runs headless missions through the worker's message protocol.
//   import {loadCore, CASES} from './core.mjs'; const core=loadCore(); const s=await core.run(CASES[0]);
//   node tests/node/core.mjs                 prints the summary of every golden case
//   node tests/node/core.mjs --write-golden  rewrites tests/node/golden.json from the current build (say why in the PR)
import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';import {fileURLToPath} from 'node:url';
export const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..','..');
export const CORE_FILE=process.env.NAV_LAB_CORE||path.join(ROOT,'dist','core-worker.js');
export const GOLDEN_FILE=path.join(path.dirname(fileURLToPath(import.meta.url)),'golden.json');
// The L1–L5 regression cases of tests/test.py: level index, parameter overrides, seconds of simulated time (seed 7).
export const CASES=[
  {level:0,overrides:{},secs:90},{level:0,overrides:{ctl:'pid'},secs:90},{level:0,overrides:{ctl:'dwa'},secs:90},
  {level:1,overrides:{},secs:120},{level:1,overrides:{plan:'rrtstar'},secs:120},{level:1,overrides:{plan:'straight'},secs:60},{level:1,overrides:{mis:'optimal'},secs:120},
  {level:2,overrides:{},secs:150},{level:2,overrides:{loc:'ekf'},secs:150},{level:2,overrides:{loc:'pf'},secs:150},
  {level:3,overrides:{},secs:200},{level:3,overrides:{unknownAs:'lethal'},secs:200},
  {level:4,overrides:{},secs:200},{level:4,overrides:{ctl:'dwa'},secs:200}];
export const caseLabel=c=>`L${c.level+1} ${JSON.stringify(c.overrides)} ${c.secs}s`;
// What the golden file keeps of a run summary, and how close a rerun must be (null: exact).
export const FIELDS={state:null,goalsDone:null,goals:null,skipped:null,coll:null,ped:null,replans:null,t:0.1,dist:0.05,poseRMS:0.002,cteRMS:0.002,nees:0.05};
let loaded=null,pending=null;
export function loadCore(file=CORE_FILE){
  // Runs in this context, not a vm sandbox: a sandbox makes every global lookup (Math, typed arrays) go through an
  // interceptor and the core runs 30× slower. The script only defines self.onmessage; everything else stays in its IIFE.
  if(loaded&&loaded!==file)throw new Error('the core is already loaded from '+loaded);
  if(!loaded){
    globalThis.self=globalThis;
    globalThis.postMessage=m=>{if(!m.done||!pending)return;const p=pending;pending=null;m.error?p.reject(new Error(m.error)):p.resolve(m);};
    vm.runInThisContext(fs.readFileSync(file,'utf8'),{filename:path.basename(file)});loaded=file;
  }
  return{
    file,
    async run({level,overrides={},secs=120,seed=7,codes}){
      if(pending)throw new Error('one run at a time');
      const done=new Promise((resolve,reject)=>{pending={resolve,reject};});
      await globalThis.self.onmessage({data:{cmd:'run',id:1,level,seed,overrides,secs,codes,stopWhenDone:false}});
      const m=await done;return{...m.summary,ms:m.ms};
    }};
}
export const pick=s=>Object.fromEntries(Object.keys(FIELDS).map(k=>[k,s[k]??null]));
// Compares a summary with its golden entry; returns the list of differences (empty when it matches).
export function diffs(got,want){
  const out=[];
  for(const[k,tol]of Object.entries(FIELDS)){const g=got[k]??null,w=want[k]??null;
    if(tol==null||g==null||w==null){if(g!==w)out.push(`${k}: ${g} ≠ ${w}`);}
    else if(Math.abs(g-w)>tol)out.push(`${k}: ${g} ≠ ${w} (±${tol})`);}
  return out;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const core=loadCore(),golden={},t0=performance.now();
  for(const c of CASES){const s=await core.run(c);golden[caseLabel(c)]=pick(s);console.log(caseLabel(c).padEnd(40),JSON.stringify(pick(s)),s.ms+' ms');}
  console.log(`${CASES.length} cases in ${((performance.now()-t0)/1000).toFixed(1)} s`);
  if(process.argv.includes('--write-golden')){fs.writeFileSync(GOLDEN_FILE,JSON.stringify(golden,null,1)+'\n');console.log('wrote',GOLDEN_FILE);}
}
