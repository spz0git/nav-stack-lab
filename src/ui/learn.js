/* ============================================================
   UI: the three modes (Simulate · Analyze · Learn) and the Learn column
   ============================================================ */
// uiMode is what the switch shows. The left side is AN.mode (map or loop analysis); in Learn it follows the lesson.
let uiMode='sim',lessonOpen=null,userLayers=null;
const MODES=[['sim','Simulate','mode-sim'],['an','Analyze','mode-an'],['learn','Learn','tab-learn']];   // Learn keeps the old tab's id
const MODE_HINT={sim:'Run the stack on the map; tune it in the tabs on the right',an:'Linear analysis of the tracking loop: margins, Bode, Nyquist, poles',learn:'Guided lessons: open one, read it, press its Try buttons'};
function setUIMode(m){
  if(m==='learn'){if(uiMode==='learn'&&lessonOpen)lessonBack();uiMode='learn';}
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
function renderLearn(){
  const v=$('#learnview'),cur=lessonOpen&&lessonItem(lessonOpen);
  const all=LESSON_GROUPS().flatMap(G=>G.items.map((_,i)=>`${G.id}:${i}`)),k=cur?all.indexOf(lessonOpen):-1;
  v.classList.toggle('reading',!!cur);
  v.innerHTML=`<div class="learn-head">${cur?`<button class="btn small" id="learn-back" type="button" title="Back to the list; your map layers come back">← All lessons</button><span class="lbl" data-sys="${cur.G.id}">${cur.G.title} · ${cur.i+1} of ${cur.G.items.length}</span>${k<all.length-1?`<button class="linkbtn" id="learn-next" type="button">Next lesson →</button>`:''}<button class="linkbtn" id="learn-link" type="button" title="A link that opens this lesson">Copy link</button><span class="lbl" id="learn-msg"></span>`
     :`<h2>Lessons</h2><p class="note">Grouped by subsystem. Open one, read it, press its Try buttons. Opening a lesson shows the map layers it is about; <b>All lessons</b> brings yours back. The Symbols tab defines every symbol used.</p>`}</div>`+
   LESSON_GROUPS().map(G=>`<section class="lgroup${cur&&cur.G.id===G.id?' cur':''}" data-sys="${G.id}"><h3>${G.title}</h3>${G.note?`<p class="note">${G.note}</p>`:''}`+
    G.items.map((L,i)=>{const id=`${G.id}:${i}`;return`<details class="lesson" data-l="${id}" ${lessonOpen===id?'open':''}><summary><span class="lnum">${i+1}</span>${L.t}</summary><div class="how-body">${L.b}<div class="tries">${L.tries.map((t,j)=>`<button class="btn small" data-try="${id}:${j}">${t[0]}</button>`).join('')}</div></div></details>`;}).join('')+`</section>`).join('');
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
