# ---- patch 28: Phase 1 mechanics — map view (zoom, pan, follow, hover), transport, telemetry, layout, analysis polish ----

# ---------- map view transform ----------
rep("""function draw(){
  readTokens();
  const dpr=sizeCanvas(cv),k=cv.width/W,px=n=>n*dpr/k;
  ctx.setTransform(1,0,0,1,0,0);ctx.fillStyle=TOK['map-bg'];ctx.fillRect(0,0,cv.width,cv.height);
  ctx.setTransform(k,0,0,-k,0,cv.height);ctx.imageSmoothingEnabled=false;ctx.lineJoin='round';ctx.lineCap='round';""",
"""const VIEW={z:1,cx:W/2,cy:H/2,follow:false};
function viewClamp(){const z=VIEW.z,hw=W/(2*z),hh=H/(2*z);VIEW.cx=clamp(VIEW.cx,hw,W-hw);VIEW.cy=clamp(VIEW.cy,hh,H-hh);}
function viewXform(){const k0=cv.width/W,kz=k0*VIEW.z;return{kz,tx:cv.width/2-VIEW.cx*kz,ty:cv.height/2+VIEW.cy*kz};}
function zoomAt(f,sx,sy){   // sx, sy in canvas pixels
  const{kz,tx,ty}=viewXform(),wx=(sx-tx)/kz,wy=(ty-sy)/kz,z2=clamp(VIEW.z*f,1,8);
  if(z2===VIEW.z)return;VIEW.z=z2;if(z2===1){VIEW.cx=W/2;VIEW.cy=H/2;VIEW.follow=false;}
  else{const kn=cv.width/W*z2;VIEW.cx=wx-(sx-cv.width/2)/kn;VIEW.cy=wy+(sy-cv.height/2)/kn;}
  viewClamp();syncViewUI();draw();
}
function syncViewUI(){const f=$('#mv-follow');if(f)f.setAttribute('aria-pressed',String(VIEW.follow));const t=$('#mv-fit');if(t)t.disabled=VIEW.z===1;}
function draw(){
  readTokens();
  if(VIEW.follow&&VIEW.z>1&&S){VIEW.cx=S.robot.x;VIEW.cy=S.robot.y;viewClamp();}
  const dpr=sizeCanvas(cv),{kz,tx,ty}=viewXform(),k=kz,px=n=>n*dpr/k;
  ctx.setTransform(1,0,0,1,0,0);ctx.fillStyle=TOK['map-bg'];ctx.fillRect(0,0,cv.width,cv.height);
  ctx.setTransform(k,0,0,-k,tx,ty);ctx.imageSmoothingEnabled=false;ctx.lineJoin='round';ctx.lineCap='round';""")
rep("""  // text overlays in screen space
  ctx.setTransform(1,0,0,1,0,0);
  const toS=(x,y)=>[x*k,cv.height-y*k];""",
"""  // text overlays in screen space
  ctx.setTransform(1,0,0,1,0,0);
  const toS=(x,y)=>[x*k+tx,ty-y*k];""")
rep("""  const sb=2*k;ctx.strokeStyle=TOK.muted;""","""  const sb=2*k;if(VIEW.z>1){ctx.fillStyle=TOK.muted;ctx.textAlign='right';ctx.fillText(`${VIEW.z.toFixed(1)}×`,cv.width-10*dpr,cv.height-12*dpr);}ctx.strokeStyle=TOK.muted;""")
rep("""const toWorld=e=>{const r=cv.getBoundingClientRect();return[(e.clientX-r.left)/r.width*W,H-(e.clientY-r.top)/r.height*H];};""",
"""const toCanvas=e=>{const r=cv.getBoundingClientRect();return[(e.clientX-r.left)/r.width*cv.width,(e.clientY-r.top)/r.height*cv.height];};
const toWorld=e=>{const[sx,sy]=toCanvas(e),{kz,tx,ty}=viewXform();return[(sx-tx)/kz,(ty-sy)/kz];};
const toScreen=(x,y)=>{const{kz,tx,ty}=viewXform(),r=cv.getBoundingClientRect();return[(x*kz+tx)*r.width/cv.width,(ty-y*kz)*r.height/cv.height];};""")
# wheel zoom, drag pan (any mode except a heading drag), view buttons, hover cards
rep("""cv.addEventListener('pointermove',e=>{if(!poseDrag)return;const[x,y]=toWorld(e);poseDrag.x2=x;poseDrag.y2=y;draw();});
cv.addEventListener('pointerup',()=>{if(!poseDrag)return;const d=poseDrag;poseDrag=null;const dx=d.x2-d.x,dy=d.y2-d.y;addPosed(d.x,d.y,hyp(dx,dy)>0.3?Math.atan2(dy,dx):null);});
cv.addEventListener('pointercancel',()=>{poseDrag=null;draw();});
cv.addEventListener('pointerdown',e=>{
  const[x,y]=toWorld(e);""",
"""cv.addEventListener('wheel',e=>{e.preventDefault();const[sx,sy]=toCanvas(e);zoomAt(e.deltaY<0?1.2:1/1.2,sx,sy);},{passive:false});
let panDrag=null;
cv.addEventListener('pointermove',e=>{
  if(panDrag){const[sx,sy]=toCanvas(e);const d=hyp(sx-panDrag.sx,sy-panDrag.sy);if(d>6*(window.devicePixelRatio||1))panDrag.moved=true;
    if(panDrag.moved){const{kz}=viewXform();VIEW.cx=panDrag.cx-(sx-panDrag.sx)/kz;VIEW.cy=panDrag.cy+(sy-panDrag.sy)/kz;VIEW.follow=false;viewClamp();syncViewUI();draw();}return;}
  if(poseDrag){const[x,y]=toWorld(e);poseDrag.x2=x;poseDrag.y2=y;draw();return;}
  hoverAt(e);
});
cv.addEventListener('pointerleave',()=>hideTip());
cv.addEventListener('pointerup',e=>{
  if(panDrag){const d=panDrag;panDrag=null;if(!d.moved)tapAt(d.wx,d.wy);return;}
  if(!poseDrag)return;const d=poseDrag;poseDrag=null;const dx=d.x2-d.x,dy=d.y2-d.y;addPosed(d.x,d.y,hyp(dx,dy)>0.3?Math.atan2(dy,dx):null);});
cv.addEventListener('pointercancel',()=>{poseDrag=null;panDrag=null;draw();});
cv.addEventListener('pointerdown',e=>{
  hideTip();const[x,y]=toWorld(e);
  if(tapMode!=='pose'||e.button===1||e.shiftKey){const[sx,sy]=toCanvas(e);panDrag={sx,sy,cx:VIEW.cx,cy:VIEW.cy,wx:x,wy:y,moved:false};try{cv.setPointerCapture(e.pointerId);}catch(_){}return;}
  tapAt(x,y,e);
});
function tapAt(x,y,e){""")
rep("""  if(tapMode==='pose'){poseDrag={x,y,x2:x,y2:y};try{cv.setPointerCapture(e.pointerId);}catch(_){}draw();return;}""",
    """  if(tapMode==='pose'){poseDrag={x,y,x2:x,y2:y};try{if(e)cv.setPointerCapture(e.pointerId);}catch(_){}draw();return;}""")
rep("""  startMission();doPlan('initial');draw();refreshAll();
});

/* ---------- main loop ---------- */""",
"""  startMission();doPlan('initial');draw();refreshAll();
}
// view buttons on the map
{const mw=$('.mapwrap');const bar=document.createElement('div');bar.className='mapview';bar.innerHTML=`<button id="mv-in" title="Zoom in (scroll on the map also zooms)">+</button><button id="mv-out" title="Zoom out">−</button><button id="mv-fit" title="Fit the whole world (0)">⤢</button><button id="mv-follow" title="Follow the robot (F)" aria-pressed="false">◎</button>`;mw.appendChild(bar);
  const tip=document.createElement('div');tip.className='maptip';tip.id='maptip';tip.hidden=true;mw.appendChild(tip);
  $('#mv-in').onclick=()=>zoomAt(1.5,cv.width/2,cv.height/2);$('#mv-out').onclick=()=>zoomAt(1/1.5,cv.width/2,cv.height/2);
  $('#mv-fit').onclick=()=>{VIEW.z=1;VIEW.cx=W/2;VIEW.cy=H/2;VIEW.follow=false;syncViewUI();draw();};
  $('#mv-follow').onclick=()=>{VIEW.follow=!VIEW.follow;if(VIEW.follow&&VIEW.z===1)VIEW.z=2.5;syncViewUI();draw();};syncViewUI();}
function hideTip(){const t=$('#maptip');if(t&&!t.hidden)t.hidden=true;}
// hover cards: nearest of robot, estimate, goals, people, tracks, beacons within 14 px
function hoverAt(e){
  if(!S)return;const[x,y]=toWorld(e),{kz}=viewXform(),r=cv.getBoundingClientRect(),tol=14*(cv.width/r.width)/kz;const C=[];
  const rb=S.robot,es=S.est;
  C.push([hyp(x-rb.x,y-rb.y),()=>`<b>True pose</b><br>${rb.x.toFixed(2)}, ${rb.y.toFixed(2)} m · ${deg(rb.th).toFixed(0)}°<br>v ${rb.v.toFixed(2)} m/s · ${isCar()?`δ ${deg(rb.d).toFixed(0)}°`:`ω ${rb.w.toFixed(2)} rad/s`}`]);
  if(P.loc!=='truth')C.push([hyp(x-es.x,y-es.y),()=>`<b>Estimate</b> (${({dr:'dead reckoning',ekf:'EKF',pf:'particle filter'})[P.loc]})<br>${es.x.toFixed(2)}, ${es.y.toFixed(2)} m · ${deg(es.th).toFixed(0)}°<br>error ${hyp(rb.x-es.x,rb.y-es.y).toFixed(2)} m${S.Pc?` · σ<sub>pos</sub> ${posSigma().toFixed(2)} m`:''}`]);
  WPS.forEach((w,i)=>{const q=S.fsm.queue.indexOf(i);C.push([hyp(x-w.x,y-w.y),()=>`<b>Goal ${q>=0?q+1:i+1}</b> · ${w.done?(w.skipped?'skipped':'reached'):q===0?'active':'queued'}<br>${w.x.toFixed(2)}, ${w.y.toFixed(2)} m${w.th!=null?` · heading ${deg(w.th).toFixed(0)}°`:''}`]);});
  S.peds.forEach((p,i)=>C.push([hyp(x-p.x,y-p.y)-0.1,()=>`<b>Person ${i+1}</b> (ground truth)<br>${hyp(p.vx||0,p.vy||0).toFixed(2)} m/s${p.wait>0?' · paused':''}`]));
  if(S.agents&&agOn())for(const t of S.agents.tracks)C.push([hyp(x-t.x,y-t.y)-0.1,()=>`<b>Agent #${t.id}</b> · ${t.conf?'confirmed':'tentative'}<br>v ${hyp(t.vx,t.vy).toFixed(2)} m/s · heading ${deg(Math.atan2(t.vy,t.vx)).toFixed(0)}°<br>r ${t.r.toFixed(2)} m · ${t.hits} hits · σ<sub>pos</sub> ${Math.sqrt(Math.max(0,t.pxx)).toFixed(2)} m`]);
  for(const b of S.beacons)C.push([hyp(x-b.x,y-b.y),()=>`<b>Beacon ${b.id}</b><br>${b.x.toFixed(2)}, ${b.y.toFixed(2)} m`]);
  let best=null;for(const c of C)if(c[0]<tol&&(!best||c[0]<best[0]))best=c;
  const t=$('#maptip');if(!best){hideTip();return;}
  t.innerHTML=best[1]();t.hidden=false;
  const px=e.clientX-r.left,py=e.clientY-r.top;t.style.left=Math.min(px+14,r.width-t.offsetWidth-6)+'px';t.style.top=Math.max(4,py-t.offsetHeight-10)+'px';
}

/* ---------- main loop ---------- */""")
rep(".mapwrap{position:relative;",
    ".mapview{position:absolute;top:8px;right:8px;display:flex;flex-direction:column;gap:4px;z-index:3}\n.mapview button{width:28px;height:28px;border:1px solid var(--line);background:var(--panel);color:var(--ink);border-radius:5px;font-size:1rem;line-height:1;cursor:pointer;opacity:.85}\n.mapview button[aria-pressed=\"true\"]{background:var(--ink);color:var(--panel)}\n.mapview button:disabled{opacity:.4;cursor:default}\n.maptip{position:absolute;z-index:4;pointer-events:none;background:var(--panel);border:1px solid var(--line);border-radius:5px;padding:5px 8px;font-size:.78rem;line-height:1.4;box-shadow:0 2px 8px rgba(0,0,0,.15);max-width:240px}\n.mapwrap{position:relative;")

# ---------- transport: slow motion, pause on contact, shortcuts ----------
rep("seg($('#speed'),[[1,'1×'],[2,'2×'],[4,'4×'],[8,'8×']],()=>speed,v=>speed=+v);",
"""seg($('#speed'),[[0.25,'¼×'],[0.5,'½×'],[1,'1×'],[2,'2×'],[4,'4×'],[8,'8×']],()=>speed,v=>speed=+v);
const SPEEDS=[0.25,0.5,1,2,4,8];function setSpeed(v){speed=v;seg($('#speed'),[[0.25,'¼×'],[0.5,'½×'],[1,'1×'],[2,'2×'],[4,'4×'],[8,'8×']],()=>speed,v=>speed=+v);}
document.addEventListener('keydown',e=>{
  const t=e.target,tag=t&&t.tagName;if(tag==='INPUT'||tag==='TEXTAREA'||tag==='SELECT'||e.metaKey||e.ctrlKey||e.altKey)return;
  if(e.key===' '){e.preventDefault();$('#run').click();}
  else if(e.key==='n'||e.key==='N')$('#stepb').click();
  else if(e.key==='r'||e.key==='R')$('#resetb').click();
  else if(e.key==='['){setSpeed(SPEEDS[Math.max(0,SPEEDS.indexOf(speed)-1)]);}
  else if(e.key===']'){setSpeed(SPEEDS[Math.min(SPEEDS.length-1,SPEEDS.indexOf(speed)+1)]);}
  else if(e.key==='f'||e.key==='F'){$('#mv-follow').click();}
  else if(e.key==='0'){$('#mv-fit').click();}
  else if(e.key==='a'||e.key==='A'){setMode(AN.mode==='sim'?'an':'sim');}
});""")
rep("""        <div class="seg" id="speed" aria-label="Simulation speed"></div>""",
"""        <div class="seg" id="speed" aria-label="Simulation speed" title="[ and ] change speed"></div>
        <label class="check sm" title="Pause the simulation when the robot touches an obstacle or a person"><input type="checkbox" id="pausec"><span>Pause on contact</span></label>""")
rep("""<button class="btn primary" id="run">Run</button>""","""<button class="btn primary" id="run" title="Space">Run</button>""")
rep("""<button class="btn" id="stepb" title="Advance 0.5 s">Step</button>""","""<button class="btn" id="stepb" title="Advance 0.5 s (N)">Step</button>""")
rep("""<button class="btn" id="resetb">Reset</button>""","""<button class="btn" id="resetb" title="R">Reset</button>""")
rep("""    if(!r.contact&&Math.abs(vt)>0.01){S.coll++;logE('Collision with static obstacle','bad');}""",
    """    if(!r.contact&&Math.abs(vt)>0.01){S.coll++;logE('Collision with static obstacle','bad');S.halt=true;}""")
rep("""logE(still?'A person walked into the stopped robot':'Contact with a person','bad');}""",
    """logE(still?'A person walked into the stopped robot':'Contact with a person','bad');S.halt=true;}""")
rep("""      applyCmd(normCmd(cmd));
      agPost();
""","""      applyCmd(normCmd(cmd));
      agPost();
      if(S.halt){S.halt=false;if(pauseOnContact&&running){running=false;logE('Paused on contact (uncheck Pause on contact to keep going)','warn');break;}}
""")
rep("let running=false, speed=1, tapMode='wp', plotCh='ex', poseDrag=null;","let running=false, speed=1, tapMode='wp', plotCh='pos', plotCh2='none', poseDrag=null, pauseOnContact=false;")
rep("$('#kidnapb').onclick=","$('#pausec').onchange=e=>{pauseOnContact=e.target.checked;};\n$('#kidnapb').onclick=")
rep(".check{display:flex;gap:8px;align-items:flex-start;font-size:.9rem}",".check{display:flex;gap:8px;align-items:flex-start;font-size:.9rem}\n.check.sm{font-size:.8rem;align-items:center;color:var(--muted)}")

# ---------- telemetry: position-error norm, second channel, taller plot, resizable log ----------
rep("""  if(S.tick%2===0){S.plot.push({t:S.t,ex,eth,sx:S.Pc?Math.sqrt(Math.max(0,S.Pc[0])):null,""",
    """  if(S.tick%2===0){S.plot.push({t:S.t,ex,ey,ep,eth,sp:S.Pc?Math.sqrt(Math.max(0,S.Pc[0]+S.Pc[4])):null,sx:S.Pc?Math.sqrt(Math.max(0,S.Pc[0])):null,""")
rep("""const PLOTS={ex:{label:'x error',unit:'m'},eth:{label:'θ error',unit:'°'},cte:{label:'Cross-track',unit:'m'},v:{label:'Speed',unit:'m/s'},turn:{label:'Turn rate',unit:'rad/s'}};""",
    """const PLOTS={pos:{label:'Position error',unit:'m'},eth:{label:'θ error',unit:'°'},cte:{label:'Cross-track',unit:'m'},v:{label:'Speed',unit:'m/s'},turn:{label:'Turn rate',unit:'rad/s'}};
// one channel → its series, band and symmetry
function chanDef(ch){
  if(ch==='pos')return{series:[{k:d=>d.ep,c:TOK.ink}],band:d=>d.sp!=null?2*d.sp:null,sym:false,floor:0.05,label:PLOTS.pos};
  if(ch==='eth')return{series:[{k:d=>deg(d.eth),c:TOK.ink}],band:d=>d.sth!=null?2*deg(d.sth):null,sym:true,floor:1,label:PLOTS.eth};
  if(ch==='cte')return{series:[{k:d=>d.cte,c:TOK.ink}],band:null,sym:false,floor:0.1,label:PLOTS.cte};
  if(ch==='turn')return{series:[{k:d=>d.tc,c:TOK.accent,name:'command'},{k:d=>d.ta,c:TOK.ink,name:'actual'}],band:null,sym:true,floor:isCar()?5:0.2,label:isCar()?{label:'Steering angle',unit:'°'}:{label:'Turn rate',unit:'rad/s'}};
  return{series:[{k:d=>d.vc,c:TOK.accent,name:'command'},{k:d=>d.va,c:TOK.ink,name:'actual'}],band:null,sym:false,floor:0.2,label:PLOTS.v};
}""")
rep("""  const t1=D[D.length-1].t,t0=Math.max(D[0].t,t1-30);
  let series=[],band=null,sym=true;
  if(plotCh==='ex'){series=[{k:d=>d.ex,c:TOK.ink}];band=d=>d.sx!=null?2*d.sx:null;}
  else if(plotCh==='eth'){series=[{k:d=>deg(d.eth),c:TOK.ink}];band=d=>d.sth!=null?2*deg(d.sth):null;}
  else if(plotCh==='cte'){series=[{k:d=>d.cte,c:TOK.ink}];sym=false;}
  else if(plotCh==='turn'){series=[{k:d=>d.tc,c:TOK.accent},{k:d=>d.ta,c:TOK.ink}];PLOTS.turn=isCar()?{label:'Steering angle',unit:'°'}:{label:'Turn rate',unit:'rad/s'};}
  else{series=[{k:d=>d.vc,c:TOK.accent,name:'command'},{k:d=>d.va,c:TOK.ink,name:'actual'}];sym=false;}
  let lo=Infinity,hi=-Infinity;
  for(const d of D){if(d.t<t0)continue;for(const s of series){const v=s.k(d);if(v==null)continue;lo=Math.min(lo,v);hi=Math.max(hi,v);}if(band){const b=band(d);if(b!=null){lo=Math.min(lo,-b);hi=Math.max(hi,b);}}}
  if(!isFinite(lo)){lo=-1;hi=1;}
  if(sym){const m=Math.max(Math.abs(lo),Math.abs(hi),plotCh==='eth'?1:plotCh==='turn'?(isCar()?5:0.2):0.05)*1.1;lo=-m;hi=m;}else{lo=Math.min(0,lo);hi=Math.max(hi*1.1,plotCh==='cte'?0.1:0.2);}
  const X=t=>padL+(t-t0)/Math.max(1e-6,t1-t0)*(w-padL-padR),Y=v=>padT+(hi-v)/(hi-lo)*(h-padT-padB);""",
"""  const t1=D[D.length-1].t,t0=Math.max(D[0].t,t1-30);
  const C1=chanDef(plotCh),{series,band,sym}=C1;PLOTS.turn=chanDef('turn').label;
  const C2=plotCh2!=='none'&&plotCh2!==plotCh&&plotCh2!=='st'?chanDef(plotCh2):null;
  const range=(C)=>{let lo=Infinity,hi=-Infinity;for(const d of D){if(d.t<t0)continue;for(const s of C.series){const v=s.k(d);if(v==null)continue;lo=Math.min(lo,v);hi=Math.max(hi,v);}if(C.band){const b=C.band(d);if(b!=null){lo=Math.min(lo,C.sym?-b:0);hi=Math.max(hi,b);}}}
    if(!isFinite(lo)){lo=-1;hi=1;}
    if(C.sym){const m=Math.max(Math.abs(lo),Math.abs(hi),C.floor)*1.1;lo=-m;hi=m;}else{lo=Math.min(0,lo);hi=Math.max(hi*1.1,C.floor);}return[lo,hi];};
  let[lo,hi]=range(C1);const R2=C2?range(C2):null;
  if(C2)padR=46*dpr;
  const X=t=>padL+(t-t0)/Math.max(1e-6,t1-t0)*(w-padL-padR),Y=v=>padT+(hi-v)/(hi-lo)*(h-padT-padB),Y2=C2?v=>padT+(R2[1]-v)/(R2[1]-R2[0])*(h-padT-padB):null;""")
rep("""  const D=S.plot;const padL=44*dpr,padR=8*dpr,padT=10*dpr,padB=18*dpr;""","""  const D=S.plot;const padL=44*dpr,padT=10*dpr,padB=18*dpr;let padR=8*dpr;""")
rep("""  pctx.textAlign='left';pctx.textBaseline='bottom';pctx.fillText(`${PLOTS[plotCh].label} [${PLOTS[plotCh].unit}] · last ${Math.round(t1-t0)} s`,padL+4*dpr,h-2*dpr);""",
"""  pctx.textAlign='left';pctx.textBaseline='bottom';pctx.fillText(`${C1.label.label} [${C1.label.unit}]${C2?`  ·  ${C2.label.label} [${C2.label.unit}] on the right axis`:''} · last ${Math.round(t1-t0)} s`,padL+4*dpr,h-2*dpr);
  if(C2){pctx.fillStyle=TOK.rose;pctx.textAlign='left';pctx.textBaseline='middle';pctx.fillText(fmt(R2[1]),w-padR+6*dpr,Y2(R2[1]));pctx.fillText(fmt(R2[0]),w-padR+6*dpr,Y2(R2[0]));
    for(const s of C2.series){pctx.strokeStyle=TOK.rose;pctx.lineWidth=1.4*dpr;pctx.setLineDash(s.name==='command'?[4*dpr,3*dpr]:[]);pctx.beginPath();let up=true;for(const d of D){if(d.t<t0)continue;const v=s.k(d);if(v==null){up=true;continue;}if(up){pctx.moveTo(X(d.t),Y2(v));up=false;}else pctx.lineTo(X(d.t),Y2(v));}pctx.stroke();pctx.setLineDash([]);}}""")
rep("""      pctx.fillStyle=TOK.rose;pctx.textAlign='right';pctx.textBaseline='top';pctx.fillText('±2σ filter',w-padR-2*dpr,padT);st=true;}}""",
    """      pctx.fillStyle=TOK.rose;pctx.textAlign='right';pctx.textBaseline='top';pctx.fillText(C1.sym?'±2σ filter':'2σ filter',w-padR-2*dpr,padT);st=true;}}""")
rep("""        <div class="tele-head"><h2>Telemetry</h2><div class="seg" id="plotsel" aria-label="Plot channel"></div></div>""",
"""        <div class="tele-head"><h2>Telemetry</h2><div class="plotpick"><div class="seg" id="plotsel" aria-label="Plot channel"></div><select class="sel sm" id="plotsel2" aria-label="Second channel, right axis" title="Second channel on the right axis"><option value="none">+ compare…</option><option value="pos">Position error</option><option value="eth">θ error</option><option value="cte">Cross-track</option><option value="v">Speed</option><option value="turn">Steering</option></select></div></div>""")
rep("""const PLOT_OPTS=[['pos','Position error'],['eth','θ error'],['cte','Cross-track'],['v','Speed'],['turn','Steering'],['st','ST graph']];
seg($('#plotsel'),PLOT_OPTS,()=>plotCh,v=>{plotCh=v;drawPlot();});""","""const PLOT_OPTS=[['pos','Position error'],['eth','θ error'],['cte','Cross-track'],['v','Speed'],['turn','Steering'],['st','ST graph']];
seg($('#plotsel'),PLOT_OPTS,()=>plotCh,v=>{plotCh=v;drawPlot();});
$('#plotsel2').onchange=e=>{plotCh2=e.target.value;drawPlot();};""")
rep("#plot{width:100%;height:124px;","#plot{width:100%;height:170px;")
rep(".log{list-style:none;margin:0;padding:0;font-family:var(--f-mono);font-size:.72rem;height:100px;overflow-y:auto;",".log{list-style:none;margin:0;padding:0;font-family:var(--f-mono);font-size:.74rem;height:146px;min-height:60px;max-height:60vh;resize:vertical;overflow-y:auto;")
rep("if(S.log.length>60)S.log.pop();","if(S.log.length>200)S.log.pop();")
rep(".tele-head{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:8px}",".tele-head{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:8px}\n.plotpick{display:flex;flex-wrap:wrap;gap:6px;align-items:center}\n.sel.sm{font-size:.8rem;padding:3px 6px}")

# ---------- layout: one scrolling right column; compact level strip ----------
rep("""  .layout{display:grid;height:calc(100vh - 24px);grid-template-columns:minmax(0,1.5fr) minmax(360px,1fr);grid-template-rows:auto minmax(0,1fr);grid-template-areas:"stage ctx" "stage console";gap:12px 16px}
  .ctx{grid-area:ctx;max-height:46vh;overflow-y:auto;overscroll-behavior:contain}
  .stage{grid-area:stage;min-height:0;overflow-y:auto;overscroll-behavior:contain}
  .console{grid-area:console;min-height:0;overflow-y:auto;overscroll-behavior:contain;border-radius:6px}
  .console .tabs{position:sticky;top:0;z-index:2;background:var(--panel);border-radius:6px 6px 0 0}
  .mapwrap{width:min(100%,max(420px,calc((100vh - 470px)*1.5)));margin-inline:auto}
  .levels{flex-wrap:wrap;overflow:visible}
  .lvl{min-width:0;flex:1 1 104px;padding:5px 10px 6px}
  .lvl span{font-size:.95rem}""",
"""  .layout{display:grid;height:calc(100vh - 24px);grid-template-columns:minmax(0,1.5fr) minmax(360px,1fr);grid-template-rows:minmax(0,1fr);grid-template-areas:"stage right";gap:12px 16px}
  .right{grid-area:right;min-height:0;overflow-y:auto;overscroll-behavior:contain;display:flex;flex-direction:column;gap:10px;scrollbar-width:thin}
  .stage{grid-area:stage;min-height:0;overflow-y:auto;overscroll-behavior:contain}
  .console{border-radius:6px}
  .console .tabs{position:sticky;top:0;z-index:2;background:var(--panel);border-radius:6px 6px 0 0}
  .mapwrap{width:min(100%,max(420px,calc((100vh - 520px)*1.5)));margin-inline:auto}
  .levels{flex-wrap:nowrap;overflow-x:auto}
  .lvl{flex-direction:row;align-items:baseline;gap:6px;min-width:0;padding:4px 10px;white-space:nowrap}
  .lvl span{font-size:.92rem}""")
rep("""const mo=new MutationObserver(""","""{const right=document.createElement('div');right.className='right';const ctxEl=$('.ctx'),con=$('.console');ctxEl.parentNode.insertBefore(right,ctxEl);right.appendChild(ctxEl);right.appendChild(con);}
const mo=new MutationObserver(""")
# the Symbols scroll helper looked for .console; the right column scrolls now
rep("""  const el=document.getElementById('sym-'+id),c=document.querySelector('.console');if(!el)return;""","""  const el=document.getElementById('sym-'+id),c=document.querySelector('.right')||document.querySelector('.console');if(!el)return;""")

# ---------- analysis: experiments above the plots ----------
rep("""{const right=document.createElement('div');""","""{const ex=$('.an-exp'),grid=$('.an-grid');if(ex&&grid)grid.parentNode.insertBefore(ex,grid);}
{const right=document.createElement('div');""")
rep(".bd{display:block;width:100%;min-width:560px;height:auto}",".bd{display:block;width:100%;min-width:520px;height:auto}")
rep("get WPS(){return WPS;}};","get WPS(){return WPS;},toScreen:(x,y)=>toScreen(x,y),get VIEW(){return VIEW;}};")
rep(".mapwrap{width:min(100%,max(420px,calc((100vh - 520px)*1.5)));margin-inline:auto}",".mapwrap{width:min(100%,max(480px,calc((100vh - 440px)*1.5)));margin-inline:auto}")
rep("  .levels{flex-wrap:nowrap;overflow-x:auto}","  .levels{flex-wrap:wrap;overflow:visible}")
rep(".hint b{color:var(--ink)}",".hint b{color:var(--ink)}\n.hint .linkbtn{white-space:nowrap;flex:0 0 auto}")
rep(".hint .linkbtn{white-space:nowrap;flex:0 0 auto}",".hint .linkbtn{white-space:nowrap;flex:0 0 auto}\n.hint[hidden]{display:none}")
