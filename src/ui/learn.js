/* ============================================================
   UI: the three modes (Simulate · Analyze · Learn) and the Learn column
   ============================================================ */
// uiMode is what the switch shows. The left side is AN.mode (map or loop analysis); in Learn it follows the lesson.
let uiMode='sim',lessonOpen=null,userLayers=null;
const MODES=[['sim','Simulate','mode-sim'],['an','Analyze','mode-an'],['learn','Learn','tab-learn']];   // Learn keeps the old tab's id
const MODE_HINT={sim:'Run the stack on the map; tune it in the tabs on the right',an:'Linear analysis of the tracking loop: margins, Bode, Nyquist, poles',learn:'Guided lessons: open one, read it, press its Try buttons'};
function setUIMode(m){
  if(m==='learn'){if(uiMode==='learn'&&lessonOpen)lessonBack();if(uiMode==='learn'&&chapterOpen)chapterBack();uiMode='learn';}
  else{uiMode=m;setMode(m);}
  syncModeUI();
}
function syncModeUI(){
  $('#modesel').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.v===uiMode)));
  $('.layout').dataset.mode=uiMode;$('#learnview').hidden=uiMode!=='learn';$('#modehint').textContent=MODE_HINT[uiMode];
}
$('#modesel').innerHTML=MODES.map(([v,l,id])=>`<button type="button" id="${id}" data-v="${v}" aria-pressed="${v===uiMode}">${l}</button>`).join('');
$('#modesel').querySelectorAll('button').forEach(b=>b.onclick=()=>setUIMode(b.dataset.v));

// Map layers each lesson is about (Layers tab keys); opening a lesson shows only these, Back restores the user's set.
const LESSON_LAYERS={
  loc:[['belief','trail'],['belief','beam','trail'],['belief','beam','trail'],['belief','beam','lidar'],['belief','beam','trail']],
  per:[['lidar','ghost'],['cost','lidar','ghost'],['lidar','agents'],['lidar','agents'],['agents','lidar']],
  plan:[['search','cost'],['search','cost'],['search','cost','trail'],['search','cost','trail'],['search','agents']],
  ctl:[]};
function lessonLayers(id){const[g,i]=id.split(':');const L=(LESSON_LAYERS[g]||[])[+i]||['trail','dwa','look'];
  return Object.fromEntries(Object.keys(LAYERS).map(k=>[k,L.includes(k)]));}
const lessonItem=id=>{const[g,i]=id.split(':'),G=LESSON_GROUPS().find(x=>x.id===g);return G&&G.items[+i]?{G,i:+i,L:G.items[+i]}:null;};
function openLesson(id){
  if(!lessonItem(id))return false;
  if(!userLayers)userLayers={...LAYERS};
  lessonOpen=id;Object.assign(LAYERS,lessonLayers(id));renderLearn();draw();
  const v=$('#learnview');if(v.getBoundingClientRect().top<0)v.scrollIntoView({block:'start'});return true;
}
function lessonBack(){
  lessonOpen=null;if(userLayers){Object.assign(LAYERS,userLayers);userLayers=null;}
  renderLearn();draw();if(activeTab==='view')renderAllPanes();
}
function lessonLink(id){const[g,i]=id.split(':');return location.href.split('#')[0]+`#lesson=${g}:${+i+1}`;}
// A lesson body: the text, its experiments, questions, then its terms. A try is [label, cfg] or, explained,
// [label, cfg, {setup, see, shows}]; explained tries render as numbered cards. L.q = [[question, answer], …].
function lessonBodyHTML(L,id){
  const explained=L.tries.some(t=>t[2]),btn=j=>`<button class="btn small" data-try="${id}:${j}">\u0002${j}\u0002</button>`;   // labels are restored after marking
  const tries=explained
    ?`<h4 class="exph">Experiments</h4><ol class="experiments">`+L.tries.map((t,j)=>{const x=t[2]||{};return`<li><div class="exp-head">${btn(j)}</div>`+
        (x.setup?`<p><b>Setup.</b> ${x.setup}</p>`:'')+(x.see?`<p><b>What you will see.</b> ${x.see}</p>`:'')+(x.shows?`<p><b>What it shows.</b> ${x.shows}</p>`:'')+`</li>`;}).join('')+`</ol>`
    :`<div class="tries">${L.tries.map((t,j)=>btn(j)).join('')}</div>`;
  const q=L.q&&L.q.length?`<h4 class="exph">Think about</h4><div class="questions">${L.q.map(([qq,a])=>`<details class="q"><summary>${qq}</summary><p>${a}</p></details>`).join('')}</div>`:'';
  return glossMarkFor(L,L.b+tries+q).replace(/\u0002(\d+)\u0002/g,(_,j)=>L.tries[+j][0])+glossTermsHTML(L);
}
function renderLearn(){
  const v=$('#learnview');v.classList.remove('chapter');if(chapterOpen)return renderChapter();
  const cur=lessonOpen&&lessonItem(lessonOpen);
  const all=LESSON_GROUPS().flatMap(G=>G.items.map((_,i)=>`${G.id}:${i}`)),k=cur?all.indexOf(lessonOpen):-1;
  v.classList.toggle('reading',!!cur);
  v.innerHTML=`<div class="learn-head">${cur?`<button class="btn small" id="learn-back" type="button" title="Back to the list; your map layers come back">← All lessons</button><span class="lbl" data-sys="${cur.G.id}">${cur.G.title} · ${cur.i+1} of ${cur.G.items.length}</span>${k<all.length-1?`<button class="linkbtn" id="learn-next" type="button">Next lesson →</button>`:''}<button class="linkbtn" id="learn-link" type="button" title="A link that opens this lesson">Copy link</button><span class="lbl" id="learn-msg"></span>`
     :`<h2>Lessons</h2><p class="note">Grouped by subsystem. Open one, read it, press its Try buttons. The companion notes at the end derive the mathematics. Opening a lesson shows the map layers it is about; <b>All lessons</b> brings yours back. Dotted terms show a short definition on hover or tap, and each lesson ends with its terms and symbols; the Symbols tab has them all.</p>`}</div>`+
   LESSON_GROUPS().map(G=>`<section class="lgroup${cur&&cur.G.id===G.id?' cur':''}" data-sys="${G.id}"><h3>${G.title}</h3>${G.note?`<p class="note">${G.note}</p>`:''}`+
    G.items.map((L,i)=>{const id=`${G.id}:${i}`;return`<details class="lesson" data-l="${id}" ${lessonOpen===id?'open':''}><summary><span class="lnum">${i+1}</span>${L.t}</summary><div class="how-body">${lessonBodyHTML(L,id)}</div></details>`;}).join('')+`</section>`).join('')+(cur?'':chaptersListHTML());
  v.querySelectorAll('.chapter-open').forEach(b=>b.onclick=()=>openChapter(b.dataset.ch));
  v.querySelectorAll('a.chref').forEach(a=>a.onclick=e=>{e.preventDefault();const m=/^#notes=([\w-]+)(?:\/([\w-]+))?$/.exec(a.getAttribute('href'));   // "Derivation: chapter 2 §4" links in lessons
    if(!m)return;try{history.replaceState(null,'',a.getAttribute('href'));}catch(_){}openChapter(m[1],m[2]);});
  v.querySelectorAll('details.lesson>summary').forEach(s=>s.onclick=e=>{e.preventDefault();const id=s.parentNode.dataset.l;if(lessonOpen===id)lessonBack();else openLesson(id);});
  v.querySelectorAll('[data-try]').forEach(b=>b.onclick=()=>{const[g,i,j]=b.dataset.try.split(':'),id=g+':'+i;if(lessonOpen!==id)openLesson(id);
    const cfg=lessonItem(id).L.tries[+j][1];
    if(cfg.sim)return tryGo({...cfg,layers:{...lessonLayers(id),...(cfg.layers||{})}});lessonGo(cfg);});   // loading the level must not undo the lesson's layers
  const bk=$('#learn-back');if(bk)bk.onclick=lessonBack;
  const nx=$('#learn-next');if(nx)nx.onclick=()=>openLesson(all[k+1]);
  const lk=$('#learn-link');if(lk)lk.onclick=()=>{const u=lessonLink(lessonOpen),msg=$('#learn-msg');
    try{history.replaceState(null,'','#'+u.split('#')[1]);}catch(_){}
    if(navigator.clipboard)navigator.clipboard.writeText(u).then(()=>{msg.textContent='Link copied.';},()=>{msg.textContent=u;});else msg.textContent=u;};
}
// #lesson=loc:3 opens Learn on that lesson (numbers as shown in the list)
function lessonFromHash(){
  const m=/^lesson=(\w+):(\d+)$/.exec(location.hash.slice(1));if(!m)return false;
  const id=`${m[1]}:${+m[2]-1}`;if(!lessonItem(id))return false;
  setUIMode('learn');return openLesson(id);
}
window.addEventListener('hashchange',lessonFromHash);
// Term pop-ups: hover (mouse), tap or keyboard focus on a dotted term shows its short definition
const termTip=document.createElement('div');termTip.className='termtip';termTip.id='termtip';termTip.setAttribute('role','tooltip');termTip.hidden=true;document.body.appendChild(termTip);
let termAt=null;
function showTerm(el){
  const id=el.dataset.g;if(!GLOSS[id])return;if(termAt&&termAt!==el)termAt.removeAttribute('aria-describedby');
  termAt=el;el.setAttribute('aria-describedby','termtip');termTip.innerHTML=`<b${glossWord(id)?' class="w"':''}>${GLOSS[id][0]}</b> ${glossDef(id)}`;termTip.hidden=false;
  const r=el.getBoundingClientRect(),w=termTip.offsetWidth,h=termTip.offsetHeight;
  termTip.style.left=Math.max(8,Math.min(r.left+r.width/2-w/2,innerWidth-w-8))+'px';
  termTip.style.top=(r.bottom+6+h>innerHeight-8?Math.max(8,r.top-h-6):r.bottom+6)+'px';
}
function hideTerm(){if(termAt)termAt.removeAttribute('aria-describedby');termAt=null;termTip.hidden=true;}
{const v=$('#learnview'),term=e=>e.target.closest&&e.target.closest('.term');
  v.addEventListener('pointerover',e=>{const t=term(e);if(t&&e.pointerType==='mouse')showTerm(t);});
  v.addEventListener('pointerout',e=>{const t=term(e);if(t&&e.pointerType==='mouse'&&!t.contains(e.relatedTarget))hideTerm();});
  v.addEventListener('click',e=>{const t=term(e);if(t)showTerm(t);});
  v.addEventListener('focusin',e=>{const t=term(e);if(t)showTerm(t);});
  v.addEventListener('focusout',e=>{if(term(e)===termAt)hideTerm();});
  document.addEventListener('pointerdown',e=>{if(termAt&&!term(e))hideTerm();},true);
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&termAt)hideTerm();});
  addEventListener('scroll',()=>{if(termAt)hideTerm();},true);addEventListener('resize',()=>{if(termAt)hideTerm();});}
