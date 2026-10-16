/* ============================================================
   Plot dock (7.4): up to three more plot panes under the preset one, each with any recorded signals (signals.js).
   All panes share one time window: the wheel zooms it about the pointer, a drag pans it, a double-click goes back
   to following the last 30 s; Whole run shows everything recorded. Hover and click work as in 7.2 (cursor, seek).
   CSV saves every signal of the run; PNG saves the panes as one image.
   ============================================================ */
const TW={span:30,end:null,all:false};   // end: right edge in s, or null to follow the live time / the replayed moment
function timeWindow(dMin,dMax){
  const span=TW.all?Math.max(1,dMax-dMin):TW.span;let t1;
  if(TW.end!=null&&!TW.all)t1=TW.end;
  else if(REPLAY.active&&!TW.all)t1=Math.max(shownT()+span*0.2,dMin+span);
  else t1=dMax;
  t1=Math.min(dMax,t1);const t0=Math.max(dMin,t1-span);return[t0,Math.max(t1,t0+1e-3)];
}
const twLabel=(t0,t1)=>TW.all?`whole run, ${t0.toFixed(0)}–${t1.toFixed(0)} s`:TW.end!=null?`${t0.toFixed(0)}–${t1.toFixed(0)} s`:`last ${Math.round(t1-t0)} s`;
function twRange(){const A=S&&S.plot.length?S.plot:REC.frames;if(A.length<2)return null;const R=[A[0].t,A[A.length-1].t];
  return REPLAY.loop?[Math.max(R[0],REPLAY.loop[0]),Math.min(R[1],REPLAY.loop[1])]:R;}   // a loop region trims the window
function twSet(span,end){const R=twRange();if(!R)return;TW.all=false;TW.span=clamp(span,2,Math.max(2,R[1]-R[0]));TW.end=end==null||end>=R[1]-0.05?null:Math.max(R[0]+TW.span,end);syncTW();drawPlot();}
function twReset(){TW.all=false;TW.span=30;TW.end=null;syncTW();drawPlot();}
function syncTW(){const b=$('#pl-all');if(b)b.setAttribute('aria-pressed',String(TW.all));}

/* ---------- panes ---------- */
const PANES=[];   // [{sigs:[id…], off:Set of hidden ids}]
const PANE_COLORS=['ink','accent','rose','amber','ok','beacon','warn','bad'];
function paneGeomAt(cvs){return cvs.__geom||null;}
function drawPanes(){
  const host=$('#plotcol');if(!host)return;
  PANES.forEach((P1,i)=>{const el=host.querySelector(`.ppane[data-p="${i}"] canvas`);if(el)drawPane(P1,el,i);});
}
function drawPane(P1,c,pi){
  const g=c.getContext('2d'),dpr=sizeCanvas(c),w=c.width,h=c.height;g.setTransform(1,0,0,1,0,0);g.fillStyle=TOK['map-bg'];g.fillRect(0,0,w,h);
  const font=`${Math.round(10*dpr)}px ${getComputedStyle(document.body).getPropertyValue('--f-mono')||'monospace'}`;g.font=font;
  const R=twRange(),vis=P1.sigs.filter(id=>!P1.off.has(id));
  const msg=t=>{g.fillStyle=TOK.muted;g.textAlign='center';g.textBaseline='middle';g.fillText(t,w/2,h/2);c.__geom=null;};
  if(!P1.sigs.length)return msg('Add signals with + Signal');
  if(!R)return msg('Press Run to record');
  const[t0,t1]=timeWindow(R[0],R[1]),padL=44*dpr,padR=8*dpr,padT=8*dpr,padB=14*dpr;
  let lo=Infinity,hi=-Infinity;
  for(const id of vis){const G=SIG[id],A=sigData(G);for(const d of A){if(d.t<t0||d.t>t1)continue;const v=G.get(d);if(v==null||!isFinite(v))continue;lo=Math.min(lo,v);hi=Math.max(hi,v);}}
  if(cmpOn())for(const id of vis){const[A,get]=cmpData(SIG[id]);for(const d of A){if(d.t<t0||d.t>t1)continue;const v=get(d);if(v==null||!isFinite(v))continue;lo=Math.min(lo,v);hi=Math.max(hi,v);}}
  if(!isFinite(lo)){lo=0;hi=1;}if(lo>=0&&lo<hi*0.5)lo=0;if(hi-lo<1e-9){hi+=0.5;lo-=0.5;}const m=(hi-lo)*0.08;hi+=m;if(lo!==0)lo-=m;
  const X=t=>padL+(t-t0)/Math.max(1e-6,t1-t0)*(w-padL-padR),Y=v=>padT+(hi-v)/(hi-lo)*(h-padT-padB);
  g.strokeStyle=TOK.line;g.lineWidth=1;if(lo<0&&hi>0){g.beginPath();g.moveTo(padL,Y(0));g.lineTo(w-padR,Y(0));g.stroke();}
  g.strokeRect(padL+.5,padT+.5,w-padL-padR,h-padT-padB);
  g.fillStyle=TOK.muted;g.textAlign='right';g.textBaseline='middle';g.fillText(sigFmt(hi),padL-5*dpr,Y(hi));g.fillText(sigFmt(lo),padL-5*dpr,Y(lo));
  g.textAlign='left';g.textBaseline='bottom';g.fillText(twLabel(t0,t1),padL+4*dpr,h-1*dpr);
  P1.sigs.forEach((id,k)=>{if(P1.off.has(id))return;const G=SIG[id],A=sigData(G);g.strokeStyle=TOK[PANE_COLORS[k%PANE_COLORS.length]];g.lineWidth=1.5*dpr;g.beginPath();let up=true;
    for(const d of A){if(d.t<t0||d.t>t1)continue;const v=G.get(d);if(v==null||!isFinite(v)){up=true;continue;}if(up){g.moveTo(X(d.t),Y(v));up=false;}else g.lineTo(X(d.t),Y(v));}g.stroke();});
  if(cmpOn())P1.sigs.forEach((id,k)=>{if(P1.off.has(id))return;const[A,get]=cmpData(SIG[id]);g.strokeStyle=rgba(TOK[PANE_COLORS[k%PANE_COLORS.length]],0.75);g.lineWidth=1.2*dpr;g.setLineDash([5*dpr,3*dpr]);g.beginPath();let up=true;   // the compared run, dashed
    for(const d of A){if(d.t<t0||d.t>t1)continue;const v=get(d);if(v==null||!isFinite(v)){up=true;continue;}if(up){g.moveTo(X(d.t),Y(v));up=false;}else g.lineTo(X(d.t),Y(v));}g.stroke();g.setLineDash([]);});
  const cur=(t,dash)=>{if(t==null||t<t0||t>t1)return;g.strokeStyle=dash?TOK.muted:TOK.ink;g.lineWidth=dpr;g.setLineDash(dash?[3*dpr,3*dpr]:[]);g.beginPath();g.moveTo(X(t),padT);g.lineTo(X(t),h-padB);g.stroke();g.setLineDash([]);};
  if(REPLAY.active)cur(shownT(),false);if(CURSOR.hover!=null)cur(CURSOR.hover,true);
  c.__geom={t0,t1,padL,padR,w,dpr};
  // legend values at the cursor (hover, replay or live)
  const t=valuesT(),host=c.parentNode;host.querySelectorAll('.pp-chip').forEach(ch=>{const v=sigAt(ch.dataset.sig,t),u=sigUnit(SIG[ch.dataset.sig]);const o=ch.querySelector('output');if(o)o.textContent=sigFmt(v)+(v!=null&&u?' '+u:'');});
}
function paneHTML(P1,i){
  return`<div class="ppane" data-p="${i}"><div class="pp-head">${P1.sigs.map((id,k)=>`<span class="pp-chip${P1.off.has(id)?' off':''}" data-sig="${id}" style="--c:var(--${PANE_COLORS[k%PANE_COLORS.length]})"><button type="button" class="pp-tg" aria-pressed="${!P1.off.has(id)}" title="${esc(SIG[id].name)}: show or hide"><i></i>${esc(SIG[id].name)} <output></output></button><button type="button" class="pp-x" aria-label="Remove ${esc(SIG[id].name)}" title="Remove">×</button></span>`).join('')}
    <button type="button" class="ibtn pp-add" data-add="${i}" aria-haspopup="dialog">+ Signal</button><button type="button" class="ibtn pp-close" data-close="${i}" aria-label="Remove this plot" title="Remove this plot">×</button></div><canvas aria-label="Plot ${i+2}"></canvas></div>`;
}
function renderPanes(){
  const host=$('#plotcol');host.querySelectorAll('.ppane').forEach(e=>e.remove());
  host.insertAdjacentHTML('beforeend',PANES.map(paneHTML).join(''));host.dataset.n=String(PANES.length+1);
  host.querySelectorAll('.ppane').forEach(pe=>{const i=+pe.dataset.p,P1=PANES[i];
    pe.querySelectorAll('.pp-chip').forEach(ch=>{const id=ch.dataset.sig;
      ch.querySelector('.pp-x').onclick=()=>{P1.sigs=P1.sigs.filter(x=>x!==id);P1.off.delete(id);renderPanes();};
      ch.querySelector('.pp-tg').onclick=e=>{if(P1.off.has(id))P1.off.delete(id);else P1.off.add(id);ch.classList.toggle('off',P1.off.has(id));e.currentTarget.setAttribute('aria-pressed',String(!P1.off.has(id)));drawPlot();};});
    pe.querySelector('[data-add]').onclick=e=>openSigBrowser(i,e.currentTarget);
    pe.querySelector('[data-close]').onclick=()=>{PANES.splice(i,1);renderPanes();};
    wirePlotCanvas(pe.querySelector('canvas'));});
  $('#pl-add').disabled=PANES.length>=3;
  if(PANES.length)wsEnsureDock(190+120*PANES.length);
  requestAnimationFrame(drawPlot);
}
function addPane(sigs){if(PANES.length>=3)return null;PANES.push({sigs:sigs||[],off:new Set()});renderPanes();return PANES.length-1;}

/* ---------- signal browser ---------- */
let sbPane=null;
function openSigBrowser(i,anchor){
  let d=$('#sigbrowser');
  if(!d){d=document.createElement('div');d.id='sigbrowser';d.className='sigbrowser';d.setAttribute('role','dialog');d.setAttribute('aria-label','Add signals');document.body.appendChild(d);
    document.addEventListener('pointerdown',e=>{if(!d.hidden&&!d.contains(e.target)&&!e.target.closest('[data-add],#pl-add'))d.hidden=true;},true);
    d.addEventListener('keydown',e=>{if(e.key==='Escape'){d.hidden=true;e.stopPropagation();}});}
  sbPane=i;const P1=PANES[i];
  d.innerHTML=`<input type="search" class="symsearch" id="sb-q" placeholder="Search signals…" aria-label="Search signals"><div class="sb-list">${SIG_GROUPS.map(([sys,title])=>`<section${sys?` data-sys="${sys}"`:''}><h4>${title}</h4>${SIGNALS.filter(s=>s[3]===sys).map(([id,name])=>{const u=sigUnit(SIG[id]);return`<label class="sb-row" data-name="${esc(name.toLowerCase())}"><input type="checkbox" data-sig="${id}" ${P1.sigs.includes(id)?'checked':''}><span>${esc(name)}${u?` <small>[${u}]</small>`:''}</span></label>`;}).join('')}</section>`).join('')}</div><p class="sb-foot">Up to 8 signals per plot; they share its axis.</p>`;
  d.hidden=false;const r=anchor.getBoundingClientRect(),W2=Math.min(320,innerWidth-16);d.style.width=W2+'px';
  d.style.left=clamp(r.left,8,innerWidth-W2-8)+'px';const below=r.bottom+6,ht=Math.min(420,innerHeight-16);d.style.maxHeight=ht+'px';d.style.top=(below+ht>innerHeight-8?Math.max(8,r.top-ht-6):below)+'px';
  const q=$('#sb-q');q.focus();q.oninput=()=>{const s=q.value.trim().toLowerCase();d.querySelectorAll('.sb-row').forEach(l=>{l.hidden=!!s&&!l.dataset.name.includes(s);});};
  d.querySelectorAll('input[data-sig]').forEach(cb=>cb.onchange=()=>{const P2=PANES[sbPane];if(!P2)return;const id=cb.dataset.sig;
    if(cb.checked){if(P2.sigs.length>=8){cb.checked=false;return;}P2.sigs.push(id);}else{P2.sigs=P2.sigs.filter(x=>x!==id);P2.off.delete(id);}
    renderPanes();});
}

/* ---------- pointer: hover cursor, click to seek, drag to pan, wheel to zoom, double-click to follow again ---------- */
function wirePlotCanvas(c){
  const geom=()=>c===pv?(plotCh==='st'?null:plotGeom):c.__geom;
  const tAt=(e,inside)=>{const G=geom();if(!G)return null;const r=c.getBoundingClientRect(),x=(e.clientX-r.left)*G.dpr;if(inside&&(x<G.padL||x>G.w-G.padR))return null;return G.t0+(x-G.padL)/Math.max(1e-6,G.w-G.padL-G.padR)*(G.t1-G.t0);};
  let drag=null;
  c.addEventListener('pointerdown',e=>{if(e.button!==0)return;const G=geom();if(!G)return;drag={x:e.clientX,t0:G.t0,t1:G.t1,moved:false,w:c.getBoundingClientRect().width*(G.w-G.padL-G.padR)/G.w};try{c.setPointerCapture(e.pointerId);}catch(_){}});
  c.addEventListener('pointermove',e=>{
    if(drag){const dx=e.clientX-drag.x;if(Math.abs(dx)>4)drag.moved=true;if(drag.moved){const dt=-dx/Math.max(1,drag.w)*(drag.t1-drag.t0);twSet(drag.t1-drag.t0,drag.t1+dt);}return;}
    const t=tAt(e,true);if(t!==CURSOR.hover){CURSOR.hover=t;hoverChanged();renderValues();}});
  c.addEventListener('pointerup',e=>{const d=drag;drag=null;if(d&&!d.moved){const t=tAt(e,true);if(t!=null&&REC.frames.length>1)seekTime(t);}});
  c.addEventListener('pointercancel',()=>{drag=null;});
  c.addEventListener('pointerleave',()=>{if(!drag&&CURSOR.hover!=null){CURSOR.hover=null;hoverChanged();renderValues();}});
  c.addEventListener('wheel',e=>{const G=geom(),R=twRange();if(!G||!R)return;e.preventDefault();const ta=tAt(e,false),f=e.deltaY<0?1/1.25:1.25,span=clamp((G.t1-G.t0)*f,2,Math.max(2,R[1]-R[0]));
    const u=(ta-G.t0)/Math.max(1e-6,G.t1-G.t0),t0=ta-u*span;twSet(span,t0+span);},{passive:false});
  c.addEventListener('dblclick',twReset);
  c.title='Hover: that time on the map · click: show that moment · drag: pan · wheel: zoom · double-click: follow the last 30 s';
}
wirePlotCanvas(pv);

/* ---------- dock buttons: + Plot, Whole run, CSV, PNG ---------- */
{const tl=document.createElement('div');tl.className='tele-tools';
 tl.innerHTML=`<button type="button" class="ibtn" id="pl-add" title="Add a plot of any recorded signals (up to 3)">+ Plot</button><button type="button" class="ibtn" id="pl-all" aria-pressed="false" title="Show the whole recorded run in every plot">Whole run</button><button type="button" class="ibtn" id="pl-csv" title="Save every signal of this run as CSV (10 Hz)">CSV</button><button type="button" class="ibtn" id="pl-png" title="Save the plots as a PNG image">PNG</button>`;
 $('.tele-title').appendChild(tl);
 $('#pl-add').onclick=e=>{const i=addPane([]);if(i!=null)openSigBrowser(i,$('#plotcol').querySelector(`.ppane[data-p="${i}"] [data-add]`)||e.currentTarget);};
 $('#pl-all').onclick=()=>{TW.all=!TW.all;TW.end=null;syncTW();drawPlot();};
 $('#pl-csv').onclick=()=>{const c=runCSV();if(!c){logE('Nothing recorded yet','warn');return;}download(`nav-lab-${LV.id}-run-${Date.now()}.csv`,c,'text/csv');};
 $('#pl-png').onclick=()=>{const c=plotsImage();c.toBlob(b=>{if(b)download(`nav-lab-${LV.id}-plots-${Date.now()}.png`,b,'image/png');},'image/png');};}
// every signal over the recorded run, one row per replay frame (10 Hz)
function runCSV(){
  const F=REC.frames;if(F.length<2)return null;const ids=SIGNALS.map(s=>s[0]);
  const head=['t',...ids.map(id=>{const u=sigUnit(SIG[id]);return id+(u?` [${u}]`:'');})];
  const rows=[head.join(',')];for(const f of F){if(REPLAY.loop&&(f.t<REPLAY.loop[0]-1e-6||f.t>REPLAY.loop[1]+1e-6))continue;rows.push([f.t.toFixed(2),...ids.map(id=>{const v=sigAt(id,f.t);return v==null?'':+v.toFixed(5);})].join(','));}
  return rows.join('\n');
}
// the preset plot and the added panes stacked into one image, on the page background
function plotsImage(){
  const cs=[pv,...$('#plotcol').querySelectorAll('.ppane canvas')],W=Math.max(...cs.map(c=>c.width)),Hs=cs.map(c=>c.height),gap=8;
  const o=document.createElement('canvas');o.width=W;o.height=Hs.reduce((a,b)=>a+b,0)+gap*(cs.length-1);const g=o.getContext('2d');g.fillStyle=TOK.bg;g.fillRect(0,0,o.width,o.height);
  let y=0;cs.forEach((c,i)=>{g.drawImage(c,0,y);y+=Hs[i]+gap;});return o;
}
