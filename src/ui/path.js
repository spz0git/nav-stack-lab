/* ============================================================
   UI: the learning path. A "Start here" card at the top of the Learn column (who the lessons are for, what they
   assume, how lessons, chapters, levels and Symbols relate) and a recommended first pass through eight lessons.
   What the reader has opened is remembered in this browser (localStorage, guarded).
   ============================================================ */
const LEARN_KEY='nav-stack-lab.learn';
const LEARN={start:true};   // start: the Start here card is unfolded
try{const s=JSON.parse(localStorage.getItem(LEARN_KEY)||'null');if(s&&typeof s==='object')Object.assign(LEARN,s);}catch(_){}
function learnSave(){try{localStorage.setItem(LEARN_KEY,JSON.stringify(LEARN));}catch(_){}}
// The first pass: concrete and visual first (the simulator), the linear analysis once the loop has been seen running.
const LEARN_PATH=[
  ['loc:0','what odometry alone does, and why the filter has to know it'],
  ['loc:1','how a beacon reading corrects the pose, and how to tell when a filter lies'],
  ['per:0','how lidar hits become a map'],
  ['per:1','how a map becomes a cost the planner can use'],
  ['plan:0','the planner everyone starts with, and what ε buys'],
  ['ctl:0','the steering loop as two integrators: the model behind every tracker'],
  ['ctl:1','pure pursuit has one knob, and this is what it turns'],
  ['ctl:2','how to read the Bode plot the Analyze view draws']];
// Minutes to read a lesson's text (the experiments run for one to three minutes each on top)
function lessonMinutes(L){const words=L.b.replace(/<[^>]+>/g,' ').split(/\s+/).filter(Boolean).length;return Math.max(3,Math.round(words/170));}
function startHereHTML(){
  const steps=LEARN_PATH.map(([id,why],n)=>{const it=lessonItem(id);if(!it)return'';const[g,i]=id.split(':');
    return`<li><a class="lsref" href="#lesson=${g}:${+i+1}" data-sys="${g}">${it.L.t}</a> <span class="note">${why} · ${lessonMinutes(it.L)} min</span></li>`;}).join('');
  const mins=LEARN_PATH.reduce((a,[id])=>{const it=lessonItem(id);return a+(it?lessonMinutes(it.L):0);},0);
  return`<details class="starthere" id="starthere" ${LEARN.start?'open':''}><summary><h3>Start here</h3></summary><div class="sh-body">
<p><b>Who this is for.</b> Students and engineers who want to see localization, perception, planning and control work together on one robot, change one thing, and watch what happens. The lessons assume vectors and matrices, a little probability (a Gaussian, a variance) and derivatives. The control lessons also use transfer functions and Bode plots; if those are new, chapter 6 builds them in order.</p>
<p><b>How the pieces fit.</b> A <b>lesson</b> is a short read with experiments: each button sets the lab up and runs it, and the numbers in the text were measured in this simulator. A <b>chapter</b> (the companion notes at the end of this list) derives the formulas a lesson uses; the <i>Derivation</i> links go there and Back returns. The <b>levels</b> L1 to L7 are the floors the robot drives on; each has quick one-click experiments in its own panel under Simulate. The <b>Symbols</b> tab under Reference lists every symbol with its meaning; dotted terms in a lesson show their definition on hover or tap.</p>
<p><b>A first pass, about ${mins} minutes of reading plus the experiments.</b> Eight lessons that visit every part of the stack once; then go deeper in whichever group interests you.</p>
<ol class="path">${steps}</ol>
<button class="btn small primary" type="button" id="path-start">Start with lesson 1</button></div></details>`;
}
function wireStartHere(v){
  const d=v.querySelector('#starthere');if(!d)return;
  d.ontoggle=()=>{LEARN.start=d.open;learnSave();};
  const b=v.querySelector('#path-start');if(b)b.onclick=()=>openLesson(LEARN_PATH[0][0]);
}
