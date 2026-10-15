/* ============================================================
   Map tools (7.3), as in RViz: a toolbar on the map picks what a tap does (Select, Goal, Goal with heading, Kidnap,
   Beacon on/off) and the active tool is always visible; Esc returns to Goal. Select pins a card with the live values of
   the robot, its estimate, a goal, a person, an agent track or a beacon. The Layers button opens the map's display
   list: a switch and a one-line status for each overlay.
   ============================================================ */
const ICON={
  select:'<path d="M4 2.5l8.5 5-3.8 1.1L6.6 12.6z" fill="currentColor" stroke="none"/>',
  wp:'<circle cx="8" cy="8" r="5"/><path d="M8 5.2v5.6M5.2 8h5.6"/>',
  pose:'<circle cx="5" cy="11" r="2.6"/><path d="M7 9l5.5-5.5M8.8 3.5h3.7v3.7"/>',
  kidnap:'<circle cx="4.2" cy="11.8" r="2.2" fill="currentColor" stroke="none"/><path d="M6 10l4.6-4.6" stroke-dasharray="1.8 1.6"/><circle cx="12" cy="4" r="2.2"/>',
  beacon:'<path d="M8 2.2l5.2 5.8L8 13.8 2.8 8z"/><path d="M4.4 4.4l7.2 7.2"/>',
  clear:'<path d="M3 4.6h10M6.4 4.6V3h3.2v1.6M4.6 4.6l.7 8.6h5.4l.7-8.6"/>',
  layers:'<path d="M8 2.4l5.8 2.9L8 8.2 2.2 5.3z"/><path d="M2.2 8.2L8 11.1l5.8-2.9M2.2 11L8 13.9l5.8-2.9"/>'};
const svgI=k=>`<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[k]}</svg>`;
const TOOLS=[['select','Select','V','Select: click the robot, its estimate, a goal, a person, a track or a beacon to see its values'],
  ['wp','Goal','G','Goal: tap the map to add a goal (up to 8 open)'],
  ['pose','Goal with heading','H','Goal with heading: press and drag the way the robot should face'],
  ['kidnap','Kidnap','K','Kidnap: tap where to put the robot. The estimator is not told'],
  ['beacon','Beacon on/off','B','Beacon: tap a diamond to switch it off or on']];
let toolBefore='wp',toolHintT=0;
function setTool(id){
  if(id!=='kidnap')toolBefore=id;tapMode=id;
  $('#maptools').querySelectorAll('[data-tool]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.tool===id)));
  cv.style.touchAction=id==='pose'?'none':'manipulation';cv.dataset.tool=id;
  const h=$('#toolhint'),T=TOOLS.find(t=>t[0]===id);h.textContent=T[3];h.hidden=id==='wp';clearTimeout(toolHintT);
  if(id!=='wp'&&id!=='kidnap')toolHintT=setTimeout(()=>{h.hidden=true;},5000);   // Kidnap is one tap and then gone, so its hint stays
  if(id==='kidnap')logE('Tap the map where the robot should be teleported','warn');
}
{const bar=document.createElement('div');bar.className='maptools';bar.id='maptools';bar.setAttribute('role','toolbar');bar.setAttribute('aria-label','Map tools');
 bar.innerHTML=TOOLS.map(([id,name,key])=>`<button type="button" data-tool="${id}" aria-pressed="false" aria-label="${name}" title="${name} (${key})">${svgI(id)}</button>`).join('')+
   `<span class="mt-sep"></span><button type="button" id="clearwp" aria-label="Clear goals and trails" title="Remove every goal and the trails driven so far (the previous run has its own Forget, bottom right)">${svgI('clear')}</button>`;
 const hint=document.createElement('div');hint.className='toolhint';hint.id='toolhint';hint.hidden=true;hint.setAttribute('aria-live','polite');
 const mw=$('.mapwrap');mw.insertBefore(hint,mw.firstChild);mw.insertBefore(bar,mw.firstChild);
 bar.querySelectorAll('[data-tool]').forEach(b=>b.onclick=()=>setTool(b.dataset.tool===tapMode&&b.dataset.tool!=='wp'?'wp':b.dataset.tool));}
$('#clearwp').onclick=()=>{WPS=[];S.fsm.queue=[];S.fsm.state='IDLE';S.track=null;S.plan=null;S.ctlViz=null;S.search=null;S.trailT=[];S.trailE=[];if(SEL&&SEL.k==='goal')SEL=null;logE('Goals and trails cleared');draw();refreshAll();};
setTool('wp');

/* ---------- Select: a pinned card with live values ---------- */
let SEL=null;
function mapSelectAt(x,y){const best=mapPick(x,y,18);SEL=best?best[2]:null;renderSelection();draw();}
// the selected thing in the shown state (live, or the replayed frame), or null when it no longer exists
function selResolve(V){
  if(!SEL)return null;const k=SEL.k;
  if(k==='robot')return V.robot;if(k==='est')return P.loc==='truth'?null:V.est;
  if(k==='goal')return WPS[SEL.i]||null;if(k==='ped')return V.peds[SEL.i]||null;
  if(k==='track')return V.agents&&V.agents.tracks.find(t=>t.id===SEL.id)||null;
  if(k==='beacon')return S.beacons.find(b=>b.id===SEL.id)||null;return null;
}
function selCard(V){
  const o=selResolve(V);if(!o)return null;const r=V.robot,e=V.est,f2=v=>(+v).toFixed(2),row=(a,b)=>`<dt>${a}</dt><dd>${b}</dd>`;
  const LOCN={truth:'ground truth',dr:'dead reckoning',ekf:'EKF',pf:'particle filter',slam:'EKF-SLAM',custom:'your code'};
  switch(SEL.k){
    case'robot':return['True pose',row('position',`${f2(o.x)}, ${f2(o.y)} m`)+row('heading',`${deg(o.th).toFixed(1)}°`)+row('speed',`${f2(o.v)} m/s`)+
      (isCar()?row('steering δ',`${deg(o.d).toFixed(1)}°`):row('turn rate ω',`${f2(o.w)} rad/s`))+row('command',`${f2(V.cmd.v)} m/s · ${isCar()?deg(V.cmd.steer||0).toFixed(1)+'°':f2(V.cmd.w)+' rad/s'}`)+
      row('contact',o.contact||o.pedContact?'<span class="bad">yes</span>':'no')];
    case'est':{const P3=V.Pc,sd=i=>P3?Math.sqrt(Math.max(0,P3[i])):null;
      return[`Estimate · ${LOCN[P.loc]||P.loc}`,row('position',`${f2(o.x)}, ${f2(o.y)} m`)+row('heading',`${deg(o.th).toFixed(1)}°`)+
      row('error',`${f2(hyp(r.x-o.x,r.y-o.y))} m · ${deg(Math.abs(wrap(r.th-o.th))).toFixed(1)}°`)+
      (P3?row('σ x · y · θ',`${f2(sd(0))} · ${f2(sd(4))} m · ${deg(sd(8)).toFixed(1)}°`):'')+
      (V===S&&S.pf?row('particles',`N_eff ${S.pf.neff.toFixed(0)} of ${S.pf.N}`):'')];}
    case'goal':{const q=S.fsm.queue.indexOf(SEL.i);return[`Goal ${q>=0?q+1:SEL.i+1}`,row('status',o.done?(o.skipped?'skipped':'reached'):q===0?'active':'queued')+
      row('position',`${f2(o.x)}, ${f2(o.y)} m`)+(o.th!=null?row('heading',`${deg(o.th).toFixed(0)}°`):'')+row('distance',`${f2(hyp(r.x-o.x,r.y-o.y))} m from the robot`)];}
    case'ped':return[o.car?'Vehicle (ground truth)':`Person ${SEL.i+1} (ground truth)`,row('position',`${f2(o.x)}, ${f2(o.y)} m`)+
      row('speed',`${f2(o.car?o.v:hyp(o.vx||0,o.vy||0))} m/s${o.wait>0?' · paused':''}`)+row('distance',`${f2(Math.max(0,hyp(r.x-o.x,r.y-o.y)-(o.r||0.3)))} m to the robot's centre, minus its radius`)];
    case'track':{const pr=agOn()?agPred(o,P.agT):null;return[`Agent track #${o.id}`,row('status',o.conf?'confirmed':'tentative')+row('position',`${f2(o.x)}, ${f2(o.y)} m`)+
      row('velocity',`${f2(hyp(o.vx,o.vy))} m/s · ${deg(Math.atan2(o.vy,o.vx)).toFixed(0)}°`)+row('radius',`${f2(o.r)} m`)+row('hits',String(o.hits))+
      row('σ position',`${f2(Math.sqrt(Math.max(0,o.pxx)))} m`)+(pr?row(`in ${P.agT} s`,`${f2(pr[0])}, ${f2(pr[1])} m (r ${f2(pr[2])})`):'')];}
    case'beacon':{const d=hyp(r.x-o.x,r.y-o.y);return[`Beacon ${o.id}`,row('status',beaconsOff().has(o.id)?'switched off':V.bDown&&V.bDown[o.id]?'in an outage':'on')+
      row('position',`${f2(o.x)}, ${f2(o.y)} m`)+row('range',`${f2(d)} m from the robot${d>P.lmRange?' (beyond the '+P.lmRange+' m sensor range)':''}`)];}
  }
  return null;
}
{const c=document.createElement('div');c.className='selcard';c.id='selcard';c.hidden=true;c.setAttribute('aria-live','polite');
 c.innerHTML='<div class="selhead"><b id="sel-title"></b><button type="button" class="ibtn" id="sel-x" aria-label="Clear the selection" title="Clear the selection (Esc)">×</button></div><dl id="sel-body"></dl>';
 $('.mapwrap').appendChild(c);$('#sel-x').onclick=()=>{SEL=null;renderSelection();draw();};}
function renderSelection(){
  const c=$('#selcard');if(!SEL||!S){c.hidden=true;return;}
  const f=replayFrame(),card=selCard(f?frameView(f):S);if(!card){c.hidden=true;return;}
  c.hidden=false;$('#sel-title').textContent=card[0];$('#sel-body').innerHTML=card[1];
}
// a dashed ring around the selected thing (drawn in world coordinates by draw())
function drawSelection(px){
  const o=selResolve(S);if(!o||o.x==null)return;const rr=SEL.k==='ped'||SEL.k==='track'?(o.r||0.3)+px(6):px(14);
  ctx.save();ctx.strokeStyle=TOK.accent;ctx.lineWidth=px(2);ctx.setLineDash([px(4),px(3)]);ctx.beginPath();ctx.arc(o.x,o.y,Math.max(rr,px(12)),0,TAU);ctx.stroke();ctx.restore();
}

/* ---------- Layers: the map's display list, with a status line per overlay ---------- */
const LAYER_DEFS=[['belief','Belief','Particles or the 95 % covariance ellipse','loc'],['beam','Beacon readings','Rays from the estimate','loc'],['trail','Trails','Solid = truth, dashed = estimate','loc'],
  ['lidar','Lidar hits','As perceived','per'],['cost','Costmap','Inflation','per'],['ghost','True-map outline','Over the built map','per'],['agents','Agents','Tracks, predictions, ego positions at the same times','per'],
  ['search','Planner search','A* closed set, Hybrid A* nodes or the RRT* tree','plan'],['dwa','Local plan','DWA rollouts, MPC prediction and reference','ctl'],['look','Lookahead','The path tracker\'s carrot','ctl'],
  ['ghostrun','Previous run','Ghost trail and ghost plot series','']];
// [has something to draw now?, status text]
function layerStatus(k){
  const tr=P.loc==='truth',ctlTr=['pp','rwf','stanley','pid'].includes(P.ctl);
  switch(k){
    case'belief':return S.pf?[1,`${S.pf.N} particles`]:S.Pc?[1,'95 % ellipse']:[0,tr?'ground truth has no belief':'no covariance yet'];
    case'beam':return tr||P.loc==='dr'?[0,`${tr?'ground truth':'dead reckoning'} uses no beacons`]:[1,`${S.lastZ.length} readings this scan`];
    case'trail':return S.trailT.length>1?[1,`${S.trailT.length} points`]:[0,'starts when the robot moves'];
    case'lidar':return S.scanPts.length?[1,`${S.scanPts.length} hits`]:[0,'no scan yet'];
    case'cost':return[1,`inflation ${P.infl} m`];
    case'ghost':return P.per==='mapping'?[1,'over the lidar map']:[0,'only with lidar mapping (Perceive)'];
    case'agents':return agOn()?[1,`${S.agents?S.agents.tracks.length:0} tracks`]:[0,'agent tracking is off (Perceive)'];
    case'search':return S.search?[1,S.planStats?`${S.planStats.name} · ${S.planStats.exp||0} ${S.planStats.name==='RRT*'?'nodes':'expansions'}`:'last search']:[0,'no search to show (straight line or no plan yet)'];
    case'dwa':return P.ctl==='dwa'||P.ctl==='mpc'?[S.ctlViz?1:0,P.ctl==='mpc'?'MPC prediction':'DWA rollouts']:[0,'only DWA and MPC'];
    case'look':return ctlTr?[S.ctlViz&&S.ctlViz.carrot?1:0,'carrot of the path tracker']:[0,'only the path trackers'];
    case'ghostrun':return GHOST&&GHOST.level===LV.id?[1,GHOST.label]:[0,'no previous run on this level'];
  }
  return[0,''];
}
function layerPopHTML(){
  return`<div class="lp-head"><b>Layers</b><span class="lbl">${layersEdited?'your choice':'set by the tab'}</span>${layersEdited?`<button type="button" class="linkbtn" id="lp-auto">Let each tab choose</button>`:''}</div>`+
    LAYER_DEFS.map(([k,name,sub,sys])=>{const[has,st]=layerStatus(k),on=!!LAYERS[k];
      return`<label class="lp-row${on?'':' off'}"${sys?` data-sys="${sys}"`:''}><input type="checkbox" data-layer="${k}" ${on?'checked':''}><span class="lp-name">${name}<small>${sub}</small></span><span class="lp-st ${on&&has?'live':on?'idle':''}" title="${esc(st)}">${esc(st)}</span></label>`;}).join('')+
    (GHOST&&GHOST.level===LV.id?`<p class="lp-foot">Previous run: ${esc(GHOST.label)} (${GHOST.t.toFixed(0)} s). <button type="button" class="linkbtn" id="lp-forget">Forget it</button></p>`:'')+
    `<p class="lp-foot">Drawing only; nothing here changes the simulation.</p>`;
}
let lpKey='';
function renderLayerPop(force){
  const p=$('#layerpop');if(!p||p.hidden)return;
  const key=LAYER_DEFS.map(([k])=>(LAYERS[k]?1:0)+layerStatus(k).join('/')).join('|')+layersEdited;if(key===lpKey&&!force)return;lpKey=key;
  const foc=document.activeElement&&p.contains(document.activeElement)?document.activeElement.dataset.layer:null;
  p.innerHTML=layerPopHTML();
  p.querySelectorAll('input[data-layer]').forEach(cb=>cb.onchange=()=>{LAYERS[cb.dataset.layer]=cb.checked;layersEdited=true;renderLayerPop(true);if(activeTab==='view')renderAllPanes();draw();});
  const fg=$('#lp-forget');if(fg)fg.onclick=()=>{forgetGhost();renderLayerPop(true);};
  const au=$('#lp-auto');if(au)au.onclick=()=>{layersEdited=false;layersKey='';applyTabLayers(true);renderLayerPop(true);if(activeTab==='view')renderAllPanes();};
  if(foc){const el=p.querySelector(`input[data-layer="${foc}"]`);if(el)el.focus();}
}
function toggleLayerPop(on){
  const p=$('#layerpop'),b=$('#mv-layers');on=on==null?p.hidden:on;p.hidden=!on;b.setAttribute('aria-expanded',String(on));
  if(on){renderLayerPop(true);const f=p.querySelector('input');if(f)f.focus();}
}
{const b=document.createElement('button');b.id='mv-layers';b.type='button';b.title='Layers: what the map draws (L)';b.setAttribute('aria-label','Layers');b.setAttribute('aria-expanded','false');b.setAttribute('aria-controls','layerpop');b.innerHTML=svgI('layers');
 const vb=$('.mapview');vb.insertBefore(b,$('#mv-key'));b.onclick=()=>toggleLayerPop();
 const p=document.createElement('div');p.className='layerpop';p.id='layerpop';p.hidden=true;p.setAttribute('role','dialog');p.setAttribute('aria-label','Map layers');$('.mapwrap').appendChild(p);
 document.addEventListener('pointerdown',e=>{if(!p.hidden&&!p.contains(e.target)&&!b.contains(e.target))toggleLayerPop(false);},true);}

/* ---------- the previous run's path: a chip on the map names it and offers Hide (the layer) and Forget ---------- */
function forgetGhost(){GHOST=null;renderGhostChip();if(activeTab==='view')renderAllPanes();draw();drawPlot();}
let ghKey='';
function renderGhostChip(){
  const c=$('#ghostchip');if(!c)return;const on=!!(GHOST&&GHOST.level===LV.id&&LAYERS.ghostrun&&AN.mode==='sim');
  const key=on?GHOST.label+GHOST.t:'';if(key===ghKey)return;ghKey=key;c.hidden=!on;if(!on)return;
  c.innerHTML=`<span class="gh-swatch" aria-hidden="true"></span><span class="gh-txt" title="${esc(GHOST.label)}">Previous run (${GHOST.t.toFixed(0)} s)</span><button type="button" class="linkbtn" id="gh-hide" title="Hide the previous-run layer (Layers → Previous run brings it back)">Hide</button><button type="button" class="linkbtn" id="gh-forget" title="Remove the previous run from the map and the plots">Forget</button>`;
  $('#gh-hide').onclick=()=>{LAYERS.ghostrun=false;layersEdited=true;renderGhostChip();renderLayerPop(true);if(activeTab==='view')renderAllPanes();draw();drawPlot();};
  $('#gh-forget').onclick=forgetGhost;
}
{const c=document.createElement('div');c.id='ghostchip';c.className='ghostchip';c.hidden=true;$('.mapwrap').appendChild(c);}

/* ---------- keys: V G H K B pick a tool, L opens Layers, Esc closes Layers, clears the selection, returns to Goal ---------- */
document.addEventListener('keydown',e=>{
  const t=e.target,tag=t&&t.tagName;if(e.metaKey||e.ctrlKey||e.altKey||tag==='TEXTAREA')return;
  if(e.key==='Escape'){if(!$('#layerpop').hidden){toggleLayerPop(false);$('#mv-layers').focus();return;}if(SEL){SEL=null;renderSelection();draw();return;}if(tapMode!=='wp')setTool('wp');return;}
  if(tag==='INPUT'&&t.type!=='range'&&t.type!=='checkbox'||tag==='TEXTAREA'||tag==='SELECT'||AN.mode!=='sim')return;
  const k=e.key.toLowerCase(),T=TOOLS.find(x=>x[2].toLowerCase()===k);
  if(T){e.preventDefault();setTool(T[0]);}else if(k==='l'){e.preventDefault();toggleLayerPop();}
});
