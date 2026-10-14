/* ============================================================
   Finding things (7.5). The command palette (Ctrl K or ⌘K, or /) searches every setting, action, layer, level,
   lesson, chapter section, symbol and signal, and does or opens what you pick. "Changed" lists every setting that
   differs from the level's defaults, with a reset for each, and keeps named setups in this browser.
   ============================================================ */
const plain=h=>String(h).replace(/<[^>]+>/g,'').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/\s+/g,' ').trim();
const TAB_NAME=Object.fromEntries(TABS.map(t=>[t.id,t.name]));
// every setting with a key: {k, f (schema field), tab}
function settingFields(){const out=[];for(const t of Object.keys(SCHEMA))for(const f of SCHEMA[t])if(f.k)out.push({k:f.k,f,tab:t});
  out.push({k:'bOff',f:{k:'bOff',type:'beacons',label:'Beacons switched off'},tab:'loc'});   // the chips field has no key of its own
  return out;}
function fieldValText(f,v){
  if(f.type==='seg'){const o=(typeof f.opts==='function'?f.opts():f.opts).find(x=>x[0]===v);return o?plain(o[1]):String(v);}
  if(f.type==='bool')return v?'on':'off';if(f.type==='beacons'||f.k==='bOff')return v===''?'all on':`off: ${v}`;
  if(typeof v==='number')return fmtVal(f,v);return String(v);
}
// a small message at the bottom of the page
function toast(msg,ms=3200){let t=$('#toast');if(!t){t=document.createElement('div');t.id='toast';t.className='toast';t.setAttribute('role','status');document.body.appendChild(t);}
  t.textContent=msg;t.hidden=false;clearTimeout(toast.h);toast.h=setTimeout(()=>{t.hidden=true;},ms);}
// open the tab that holds a setting, scroll to it and flash it
function goToField(k){
  const s=settingFields().find(x=>x.k===k);if(!s)return;
  if(uiMode==='learn')setUIMode(AN.mode);if(WS.inspOff)wsInspector(true);
  activeTab=s.tab;consoleOpen=true;buildTabs();renderAllPanes();
  const el=document.querySelector(`#pane [data-k="${k}"]`)||(k==='bOff'?document.querySelector('#pane .bchips'):null);
  if(!el){const why=revealedBy(s);toast(`“${plain(s.f.label)}” appears in ${TAB_NAME[s.tab]} ${why?`when ${why}`:'only with other choices there'}.`,5600);return;}
  const box=el.closest('.field')||el.closest('.check')||el;box.scrollIntoView({block:'center',behavior:'smooth'});
  box.classList.remove('flash');void box.offsetWidth;box.classList.add('flash');
  const inp=box.querySelector('input,button');if(inp)setTimeout(()=>inp.focus({preventScroll:true}),350);
}

// Which choice shows a hidden setting: try each option of the choice fields in the schema (show() only reads P; P is restored at once)
function revealedBy(s){
  if(!s.f.show)return null;
  for(const t of Object.keys(SCHEMA))for(const g of SCHEMA[t]){if(g.type!=='seg'||!g.k||g.k===s.k)continue;const old=P[g.k];
    for(const[v,l]of(typeof g.opts==='function'?g.opts():g.opts)){if(v===old)continue;P[g.k]=v;let ok=false;try{ok=!!s.f.show();}catch(_){}P[g.k]=old;
      if(ok)return`${plain(g.label)} is ${plain(l)}${t!==s.tab?` (${TAB_NAME[t]})`:''}`;}}
  return null;
}
/* ---------- palette ---------- */
const PAL={items:[],q:'',sel:0,shown:[],recent:[]};
try{PAL.recent=JSON.parse(localStorage.getItem('nav-stack-lab.recent')||'[]').slice(0,6);}catch(_){}
function palItems(){
  const I=[],add=(id,name,kind,sys,run,detail,keys)=>I.push({id,name,kind,sys:sys||'',run,detail:detail||'',keys:keys||'',hay:(name+' '+kind+' '+(detail||'')).toLowerCase()});
  const act=(id,name,run,keys,detail)=>add('a:'+id,name,'Action','',run,detail,keys);
  act('run',running?'Pause':'Run',()=>$('#run').click(),'Space');act('step','Step 0.5 s',()=>$('#stepb').click(),'N');act('reset','Reset the run',()=>$('#resetb').click(),'R');
  if(REPLAY.active)act('live','Back to live',exitReplay,'End');
  LEVELS.forEach((L,i)=>add('lv:'+i,`${L.id} ${L.name}`,'Level','',()=>loadLevel(i),plain(L.adds).slice(0,90)));
  MODES.forEach(([v,l])=>add('m:'+v,l,'Mode','',()=>setUIMode(v),MODE_HINT[v]));
  TOOLS.forEach(([id,name,key,hint])=>add('t:'+id,`Tool: ${name}`,'Map','',()=>{if(AN.mode!=='sim')setUIMode('sim');setTool(id);},hint,key));
  act('layers','Layers…',()=>{if(AN.mode!=='sim')setUIMode('sim');toggleLayerPop(true);},'L','what the map draws');
  act('clear','Clear goals',()=>$('#clearwp').click());act('fit','Fit the map',()=>$('#mv-fit').click(),'0');act('follow','Follow the robot',()=>$('#mv-follow').click(),'F');
  act('kidnap','Kidnap the robot to a random free spot',()=>kidnapTo(null),'','the estimator is not told');
  if(P.loc==='pf')act('scatter','Scatter the particles',()=>scatterParticles(),'','global localization');
  act('dock','Show or hide the telemetry dock',()=>wsDock(WS.dockOff));act('insp','Show or hide the panel',()=>wsInspector(WS.inspOff));
  act('addplot','Add a plot',()=>{const i=addPane([]);if(i!=null)openSigBrowser(i,$('#plotcol').querySelector(`.ppane[data-p="${i}"] [data-add]`));});
  act('whole','Plots: whole run',()=>$('#pl-all').click());act('csv','Save the run as CSV',()=>$('#pl-csv').click(),'','every signal, 10 Hz');act('png','Save the plots as PNG',()=>$('#pl-png').click());
  act('link','Copy a link to this setup',copySetupLink);act('changed','Changed settings and saved setups…',()=>toggleChanged(true));
  act('runs','Runs: keep, compare, export…',()=>{if(AN.mode!=='sim')setUIMode('sim');toggleRuns(true);});
  act('src','View the source',()=>showSource('core/step.js'));
  for(const s of settingFields()){if(s.k==='seed'&&!SCHEMA[s.tab].includes(s.f))continue;
    add('p:'+s.k,plain(s.f.label),`Setting · ${TAB_NAME[s.tab]}`,SYS[s.tab]?s.tab:'',()=>goToField(s.k),fieldValText(s.f,P[s.k])+(chgMark(s.f)?' · changed':''));
    I[I.length-1].hay+=' '+s.k.toLowerCase()+' '+(TIPS[s.k]||'').toLowerCase();}   // the key and the tooltip are searchable too
  LAYER_DEFS.forEach(([k,name,sub,sys])=>add('ly:'+k,`Layer: ${name}`,'Layer',sys,()=>{LAYERS[k]=!LAYERS[k];layersEdited=true;draw();renderLayerPop(true);if(activeTab==='view')renderAllPanes();toast(`${name}: ${LAYERS[k]?'on':'off'}`);},LAYERS[k]?'on':'off'));
  LESSON_GROUPS().forEach(G=>G.items.forEach((L,i)=>add(`ls:${G.id}:${i}`,plain(L.t),`Lesson · ${G.title}`,G.id,()=>{setUIMode('learn');openLesson(`${G.id}:${i}`);})));
  CHAPTERS.forEach(c=>{add('ch:'+c.id,`Chapter ${c.num}: ${c.title}`,'Chapter',c.sys,()=>{setUIMode('learn');openChapter(c.id);},plain(c.summary||'').slice(0,90));
    (c.toc||[]).forEach(t=>add(`cs:${c.id}/${t.id}`,plain(t.text),`Chapter ${c.num}`,c.sys,()=>{setUIMode('learn');openChapter(c.id,t.id);}));});
  NOMEN.forEach(g=>g.rows.forEach(([sy,d,u],j)=>add(`sy:${g.id}:${j}`,`${plain(sy)} — ${plain(d)}`,`Symbol · ${g.title}`,'',()=>showSym(g.id),u?`[${u}]`:'')));
  SIGNALS.forEach(([id,name,,sys])=>add('sg:'+id,`Plot: ${name}`,'Signal',sys,()=>{let i=PANES.length-1;if(i<0||PANES[i].sigs.length>=8){i=addPane([]);if(i==null){toast('Up to three added plots: remove one first');return;}}
    if(!PANES[i].sigs.includes(id))PANES[i].sigs.push(id);renderPanes();if(AN.mode!=='sim')setUIMode('sim');if(WS.dockOff)wsDock(true);}));
  return I;
}
function palScore(it,toks){
  if(!toks.length)return 1;let sc=0;const n=it.name.toLowerCase();
  for(const t of toks){const i=it.hay.indexOf(t);if(i<0)return 0;const j=n.indexOf(t);sc+=j===0?6:j>0&&/[\s(·:—-]/.test(n[j-1])?4:j>0?2:1;}
  return sc+(it.kind==='Action'?1.5:it.kind.startsWith('Setting')?1:0)-n.length/200;
}
function palRender(){
  const toks=PAL.q.toLowerCase().split(/\s+/).filter(Boolean);
  let L;if(!toks.length){const rec=PAL.recent.map(id=>PAL.items.find(x=>x.id===id)).filter(Boolean);L=rec.concat(PAL.items.filter(x=>x.kind==='Action'&&!rec.includes(x))).slice(0,14);}
  else L=PAL.items.map(it=>[palScore(it,toks),it]).filter(x=>x[0]>0).sort((a,b)=>b[0]-a[0]).slice(0,40).map(x=>x[1]);
  PAL.shown=L;PAL.sel=clamp(PAL.sel,0,Math.max(0,L.length-1));
  const ul=$('#pal-list');
  ul.innerHTML=L.length?L.map((it,i)=>`<li role="option" id="pal-o${i}" data-i="${i}" aria-selected="${i===PAL.sel}"${it.sys?` data-sys="${it.sys}"`:''}><span class="pal-name">${esc(it.name)}</span>${it.detail?`<span class="pal-detail">${esc(it.detail)}</span>`:''}<span class="pal-kind">${esc(it.kind)}${it.keys?` <kbd>${esc(it.keys)}</kbd>`:''}</span></li>`).join('')
    :`<li class="pal-none">Nothing matches “${esc(PAL.q)}”</li>`;
  $('#pal-q').setAttribute('aria-activedescendant',L.length?'pal-o'+PAL.sel:'');
  const cur=ul.querySelector('[aria-selected="true"]');if(cur)cur.scrollIntoView({block:'nearest'});
  $('#pal-hint').textContent=toks.length?`${L.length}${L.length===40?'+':''} results`:'Recent and actions · type to search settings, lessons, chapters, symbols, signals';
}
function palRun(it){if(!it)return;closePalette();PAL.recent=[it.id,...PAL.recent.filter(x=>x!==it.id)].slice(0,6);try{localStorage.setItem('nav-stack-lab.recent',JSON.stringify(PAL.recent));}catch(_){}
  try{it.run();}catch(e){toast('Could not do that: '+e.message);}}
let palFocus=null;
function openPalette(){
  let d=$('#palette');
  if(!d){d=document.createElement('div');d.id='palette';d.className='palette';d.hidden=true;
    d.innerHTML=`<div class="pal-box" role="dialog" aria-modal="true" aria-label="Search"><div class="pal-in"><svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="7" cy="7" r="4.5"/><path d="M10.4 10.4L14 14"/></svg><input id="pal-q" type="text" role="combobox" aria-expanded="true" aria-controls="pal-list" aria-autocomplete="list" placeholder="Search settings, actions, lessons, chapters, symbols, signals…" autocomplete="off" spellcheck="false"><kbd>Esc</kbd></div><ul id="pal-list" role="listbox" aria-label="Results"></ul><p class="pal-hint" id="pal-hint"></p></div>`;
    document.body.appendChild(d);
    d.addEventListener('pointerdown',e=>{if(e.target===d)closePalette();});
    const q=$('#pal-q');q.oninput=()=>{PAL.q=q.value;PAL.sel=0;palRender();};
    q.onkeydown=e=>{if(e.key==='ArrowDown'){e.preventDefault();PAL.sel=Math.min(PAL.shown.length-1,PAL.sel+1);palRender();}
      else if(e.key==='ArrowUp'){e.preventDefault();PAL.sel=Math.max(0,PAL.sel-1);palRender();}
      else if(e.key==='Enter'){e.preventDefault();palRun(PAL.shown[PAL.sel]);}
      else if(e.key==='Escape'){e.preventDefault();e.stopPropagation();closePalette();}};
    $('#pal-list').addEventListener('click',e=>{const li=e.target.closest('li[data-i]');if(li)palRun(PAL.shown[+li.dataset.i]);});
    $('#pal-list').addEventListener('pointermove',e=>{const li=e.target.closest('li[data-i]');if(li&&+li.dataset.i!==PAL.sel){PAL.sel=+li.dataset.i;$('#pal-list').querySelectorAll('li').forEach(x=>x.setAttribute('aria-selected',String(x===li)));}});}
  palFocus=document.activeElement;PAL.items=palItems();PAL.q='';PAL.sel=0;d.hidden=false;const q=$('#pal-q');q.value='';palRender();q.focus();
}
function closePalette(){const d=$('#palette');if(!d||d.hidden)return;d.hidden=true;if(palFocus&&palFocus.focus)palFocus.focus({preventScroll:true});}
document.addEventListener('keydown',e=>{
  if((e.ctrlKey||e.metaKey)&&!e.altKey&&(e.key==='k'||e.key==='K')){e.preventDefault();const d=$('#palette');if(d&&!d.hidden)closePalette();else openPalette();return;}
  const t=e.target,tag=t&&t.tagName;if(e.key==='/'&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&!(tag==='INPUT'&&t.type!=='range'&&t.type!=='checkbox'||tag==='TEXTAREA'||tag==='SELECT')){e.preventDefault();openPalette();}
},true);
{const mac=/Mac|iPhone|iPad/.test(navigator.platform||navigator.userAgent);
 const b=document.createElement('button');b.type='button';b.id='tg-pal';b.className='ibtn palbtn';b.title=`Search settings, actions, lessons, chapters, symbols and signals (${mac?'⌘':'Ctrl '}K or /)`;b.setAttribute('aria-label','Search');
 b.innerHTML=`<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="7" cy="7" r="4.5"/><path d="M10.4 10.4L14 14"/></svg><span>Search</span><kbd>${mac?'⌘':'Ctrl '}K</kbd>`;
 $('.brand').appendChild(b);b.onclick=openPalette;}

/* ---------- Changed from defaults, and saved setups ---------- */
function changedList(){const out=[];for(const s of settingFields()){const d=lvlDefault(s.k);if(d===undefined||P[s.k]===d)continue;out.push({...s,d});}return out;}
const SETUP_KEY='nav-stack-lab.setups';
function setupsLoad(){try{const a=JSON.parse(localStorage.getItem(SETUP_KEY)||'[]');return Array.isArray(a)?a:[];}catch(_){return[];}}
function setupsSave(a){try{localStorage.setItem(SETUP_KEY,JSON.stringify(a));return true;}catch(_){return false;}}
function copySetupLink(){const u=configURL();try{history.replaceState(null,'','#'+u.split('#')[1]);}catch(_){}
  if(navigator.clipboard)navigator.clipboard.writeText(u).then(()=>toast('Link copied: it opens this level with these settings and goals'),()=>toast(u,8000));else toast(u,8000);}
function changedHTML(){
  const C=changedList(),S2=setupsLoad();
  return`<div class="chg-head"><b>Changed from ${LV.id} defaults</b><span class="lbl">${C.length} setting${C.length===1?'':'s'}</span><button type="button" class="ibtn" id="chg-x" aria-label="Close">×</button></div>`+
   (C.length?`<ul class="chg-list">${C.map(c=>`<li${SYS[c.tab]?` data-sys="${c.tab}"`:''}><button type="button" class="linkbtn chg-go" data-go="${c.k}" title="Open it in ${TAB_NAME[c.tab]}">${esc(plain(c.f.label))}</button><span class="chg-tab">${TAB_NAME[c.tab]}</span><span class="chg-v"><b>${esc(fieldValText(c.f,P[c.k]))}</b> <s>${esc(fieldValText(c.f,c.d))}</s></span><button type="button" class="rst" data-rst="${c.k}" title="Back to the default (${esc(fieldValText(c.f,c.d))})">↺</button></li>`).join('')}</ul>
     <div class="controls"><button type="button" class="btn small" id="chg-all">Reset all</button><button type="button" class="btn small" id="chg-link">Copy link</button></div>`
   :`<p class="note">Everything is at this level's defaults.</p><div class="controls"><button type="button" class="btn small" id="chg-link">Copy link</button></div>`)+
   `<h4 class="chg-h">Saved setups <span class="lbl">in this browser only</span></h4>
   <form class="chg-save" id="chg-save"><input type="text" id="chg-name" maxlength="60" placeholder="Name this setup (${LV.id}, ${C.length} changed)" aria-label="Setup name"><button type="submit" class="btn small">Save</button></form>`+
   (S2.length?`<ul class="setups">${S2.map((x,i)=>`<li><button type="button" class="linkbtn" data-load="${i}" title="Load: ${esc(x.cfg.level)} with ${esc(fmtOv(x.cfg.params||{}))}">${esc(x.name)}</button><span class="lbl">${esc(x.cfg.level)} · ${Object.keys(x.cfg.params||{}).length} changed${x.cfg.goals?' · own goals':''}</span><button type="button" class="ibtn" data-del="${i}" aria-label="Delete ${esc(x.name)}" title="Delete">×</button></li>`).join('')}</ul>`:`<p class="note">None yet. A saved setup keeps the level, the seed, every changed setting and the goals.</p>`);
}
function renderChanged(){
  const p=$('#chgpanel');if(!p||p.hidden)return;p.innerHTML=changedHTML();
  $('#chg-x').onclick=()=>toggleChanged(false);
  p.querySelectorAll('[data-rst]').forEach(b=>b.onclick=()=>{setParam(b.dataset.rst,lvlDefault(b.dataset.rst),false);renderAllPanes();renderChanged();});
  p.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>goToField(b.dataset.go));
  const all=$('#chg-all');if(all)all.onclick=()=>{for(const c of changedList())setParam(c.k,c.d,false);renderAllPanes();renderChanged();toast(`${LV.id} defaults restored`);};
  $('#chg-link').onclick=copySetupLink;
  $('#chg-save').onsubmit=e=>{e.preventDefault();const a=setupsLoad(),nm=$('#chg-name').value.trim()||`${LV.id} · ${new Date().toLocaleString()}`;
    a.unshift({name:nm,cfg:currentConfig(),at:Date.now()});if(setupsSave(a.slice(0,30)))toast(`Saved “${nm}”`);else toast('This browser does not allow saving here; use Copy link instead');renderChanged();};
  p.querySelectorAll('[data-load]').forEach(b=>b.onclick=()=>{const x=setupsLoad()[+b.dataset.load];if(!x)return;try{applyConfig(x.cfg);renderAllPanes();toast(`Loaded “${x.name}”`);}catch(err){toast('Could not load it: '+err.message);}renderChanged();});
  p.querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>{const a=setupsLoad();a.splice(+b.dataset.del,1);setupsSave(a);renderChanged();});
}
function toggleChanged(on){
  const p=$('#chgpanel'),b=$('#tg-chg');on=on==null?p.hidden:on;p.hidden=!on;b.setAttribute('aria-expanded',String(on));
  if(on){if(narrowUI()){p.classList.add('sheet');}else p.classList.remove('sheet');renderChanged();const f=p.querySelector('button,input');if(f)f.focus();}
}
{const b=document.createElement('button');b.type='button';b.id='tg-chg';b.className='ibtn';b.setAttribute('aria-expanded','false');b.setAttribute('aria-controls','chgpanel');
 b.title='Settings that differ from this level\'s defaults, and saved setups';b.innerHTML='Changed <span class="badge" id="chg-n">0</span>';
 $('#bartools').insertBefore(b,$('#bartools').firstChild);b.onclick=()=>toggleChanged();
 const p=document.createElement('div');p.id='chgpanel';p.className='chgpanel';p.hidden=true;p.setAttribute('role','dialog');p.setAttribute('aria-label','Changed settings and saved setups');document.body.appendChild(p);
 document.addEventListener('pointerdown',e=>{if(!p.hidden&&!p.contains(e.target)&&!b.contains(e.target))toggleChanged(false);},true);
 p.addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();toggleChanged(false);b.focus();}});}
let chgKey='';
function renderChangedBadge(){const C=changedList(),key=C.map(c=>c.k+'='+P[c.k]).join('|')+LV.id;if(key===chgKey)return;chgKey=key;
  const n=$('#chg-n');n.textContent=String(C.length);n.dataset.n=String(C.length);renderChanged();}
