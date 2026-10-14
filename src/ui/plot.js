
/* ---------- plot ---------- */
const pv=$('#plot'),pctx=pv.getContext('2d');
const PLOTS={pos:{label:'Position error',unit:'m'},eth:{label:'θ error',unit:'°'},cte:{label:'Cross-track',unit:'m'},v:{label:'Speed',unit:'m/s'},turn:{label:'Turn rate',unit:'rad/s'}};
// one channel → its series, band and symmetry
function chanDef(ch){
  if(ch==='pos')return{series:[{k:d=>d.ep,c:TOK.ink}],band:d=>d.sp!=null?2*d.sp:null,sym:false,floor:0.05,label:PLOTS.pos};
  if(ch==='eth')return{series:[{k:d=>deg(d.eth),c:TOK.ink}],band:d=>d.sth!=null?2*deg(d.sth):null,sym:true,floor:1,label:PLOTS.eth};
  if(ch==='cte')return{series:[{k:d=>d.cte,c:TOK.ink}],band:null,sym:false,floor:0.1,label:PLOTS.cte};
  if(ch==='turn')return{series:[{k:d=>d.tc,c:TOK.accent,name:'command'},{k:d=>d.ta,c:TOK.ink,name:'actual'}],band:null,sym:true,floor:isCar()?5:0.2,label:isCar()?{label:'Steering angle',unit:'°'}:{label:'Turn rate',unit:'rad/s'}};
  return{series:[{k:d=>d.vc,c:TOK.accent,name:'command'},{k:d=>d.va,c:TOK.ink,name:'actual'}],band:null,sym:false,floor:0.2,label:PLOTS.v};
}
// Pane 1 (the preset channel) and the added panes (plots.js) share one time window
function drawPlot(){
  if(plotCh==='st')drawST();else drawPlotMain();
  drawPanes();
}
function drawPlotMain(){
  const dpr=sizeCanvas(pv),w=pv.width,h=pv.height;
  pctx.setTransform(1,0,0,1,0,0);pctx.fillStyle=TOK['map-bg'];pctx.fillRect(0,0,w,h);
  const D=S.plot;const padL=44*dpr,padT=10*dpr,padB=18*dpr;let padR=8*dpr;
  pctx.font=`${Math.round(10*dpr)}px ${getComputedStyle(document.body).getPropertyValue('--f-mono')||'monospace'}`;
  if(D.length<2){pctx.fillStyle=TOK.muted;pctx.textAlign='center';pctx.textBaseline='middle';pctx.fillText('Press Run to record telemetry',w/2,h/2);return;}
  // the shared window: the last 30 s (or what the wheel, a drag or Whole run set), following the live time or the replayed moment
  const tc=shownT(),[t0,t1]=timeWindow(D[0].t,D[D.length-1].t);
  const C1=chanDef(plotCh),{series,band,sym}=C1;PLOTS.turn=chanDef('turn').label;
  const C2=plotCh2!=='none'&&plotCh2!==plotCh&&plotCh2!=='st'?chanDef(plotCh2):null;
  const range=(C)=>{let lo=Infinity,hi=-Infinity;for(const d of D){if(d.t<t0||d.t>t1)continue;for(const s of C.series){const v=s.k(d);if(v==null)continue;lo=Math.min(lo,v);hi=Math.max(hi,v);}if(C.band){const b=C.band(d);if(b!=null){lo=Math.min(lo,C.sym?-b:0);hi=Math.max(hi,b);}}}
    if(!isFinite(lo)){lo=-1;hi=1;}
    if(C.sym){const m=Math.max(Math.abs(lo),Math.abs(hi),C.floor)*1.1;lo=-m;hi=m;}else{lo=Math.min(0,lo);hi=Math.max(hi*1.1,C.floor);}return[lo,hi];};
  let[lo,hi]=range(C1);const R2=C2?range(C2):null;
  if(C2)padR=46*dpr;
  const X=t=>padL+(t-t0)/Math.max(1e-6,t1-t0)*(w-padL-padR),Y=v=>padT+(hi-v)/(hi-lo)*(h-padT-padB),Y2=C2?v=>padT+(R2[1]-v)/(R2[1]-R2[0])*(h-padT-padB):null;
  // axes
  pctx.strokeStyle=TOK.line;pctx.lineWidth=1;pctx.beginPath();pctx.moveTo(padL,Y(0));pctx.lineTo(w-padR,Y(0));pctx.stroke();
  pctx.fillStyle=TOK.muted;pctx.textAlign='right';pctx.textBaseline='middle';
  const fmt=v=>Math.abs(hi-lo)<0.5?v.toFixed(2):Math.abs(hi-lo)<5?v.toFixed(1):v.toFixed(0);
  pctx.fillText(fmt(hi),padL-6*dpr,Y(hi));pctx.fillText(fmt(lo),padL-6*dpr,Y(lo));pctx.fillText('0',padL-6*dpr,Y(0));
  pctx.textAlign='left';pctx.textBaseline='bottom';pctx.fillText(`${C1.label.label} [${C1.label.unit}]${C2?`  ·  ${C2.label.label} [${C2.label.unit}] on the right axis`:''} · ${twLabel(t0,t1)}`,padL+4*dpr,h-2*dpr);
  if(C2){pctx.fillStyle=TOK.rose;pctx.textAlign='left';pctx.textBaseline='middle';pctx.fillText(fmt(R2[1]),w-padR+6*dpr,Y2(R2[1]));pctx.fillText(fmt(R2[0]),w-padR+6*dpr,Y2(R2[0]));
    for(const s of C2.series){pctx.strokeStyle=TOK.rose;pctx.lineWidth=1.4*dpr;pctx.setLineDash(s.name==='command'?[4*dpr,3*dpr]:[]);pctx.beginPath();let up=true;for(const d of D){if(d.t<t0||d.t>t1)continue;const v=s.k(d);if(v==null){up=true;continue;}if(up){pctx.moveTo(X(d.t),Y2(v));up=false;}else pctx.lineTo(X(d.t),Y2(v));}pctx.stroke();pctx.setLineDash([]);}}
  // band
  if(band){pctx.fillStyle=rgba(TOK.rose,0.16);pctx.beginPath();let st=false;const up=[],dn=[];for(const d of D){if(d.t<t0||d.t>t1)continue;const b=band(d);if(b==null)continue;up.push([X(d.t),Y(b)]);dn.push([X(d.t),Y(-b)]);}
    if(up.length>1){pctx.moveTo(up[0][0],up[0][1]);for(const p of up)pctx.lineTo(p[0],p[1]);for(let i=dn.length-1;i>=0;i--)pctx.lineTo(dn[i][0],dn[i][1]);pctx.closePath();pctx.fill();
      pctx.fillStyle=TOK.rose;pctx.textAlign='right';pctx.textBaseline='top';pctx.fillText(C1.sym?'±2σ filter':'2σ filter',w-padR-2*dpr,padT);st=true;}}
  if(LAYERS.ghostrun&&GHOST&&GHOST.level===LV.id&&GHOST.plot.length>1){const GD=GHOST.plot;pctx.strokeStyle=rgba(TOK.rose,0.6);pctx.lineWidth=1.2*dpr;pctx.setLineDash([3*dpr,3*dpr]);
    for(const s of series){pctx.beginPath();let up=true;for(const d of GD){if(d.t<t0||d.t>t1)continue;const v=s.k(d);if(v==null){up=true;continue;}if(up){pctx.moveTo(X(d.t),Y(v));up=false;}else pctx.lineTo(X(d.t),Y(v));}pctx.stroke();}
    pctx.setLineDash([]);pctx.fillStyle=TOK.rose;pctx.textAlign='right';pctx.textBaseline='bottom';pctx.fillText('ghost: '+GHOST.label.slice(0,48),w-padR-2*dpr,h-2*dpr);}
  if(cmpOn()&&RUNS.cmp.plot.length>1){const CD=RUNS.cmp.plot;pctx.strokeStyle=rgba(TOK.amber,0.9);pctx.lineWidth=1.4*dpr;pctx.setLineDash([5*dpr,3*dpr]);   // the compared run (runs.js)
    for(const s of series){pctx.beginPath();let up=true;for(const d of CD){if(d.t<t0||d.t>t1)continue;const v=s.k(d);if(v==null){up=true;continue;}if(up){pctx.moveTo(X(d.t),Y(v));up=false;}else pctx.lineTo(X(d.t),Y(v));}pctx.stroke();}
    pctx.setLineDash([]);pctx.fillStyle=TOK.amber;pctx.textAlign='right';pctx.textBaseline='top';pctx.fillText('- - compared: '+runName(RUNS.cmp).slice(0,40),w-padR-2*dpr,padT+(band?13*dpr:0));}
  for(const s of series){pctx.strokeStyle=s.c;pctx.lineWidth=1.6*dpr;pctx.beginPath();let up=true;for(const d of D){if(d.t<t0||d.t>t1)continue;const v=s.k(d);if(v==null){up=true;continue;}if(up){pctx.moveTo(X(d.t),Y(v));up=false;}else pctx.lineTo(X(d.t),Y(v));}pctx.stroke();}
  if(plotCh==='v'||plotCh==='turn'){pctx.textAlign='right';pctx.textBaseline='top';pctx.fillStyle=TOK.accent;pctx.fillText('command',w-padR-60*dpr,padT);pctx.fillStyle=TOK.ink;pctx.fillText('actual',w-padR-2*dpr,padT);}
  plotGeom={t0,t1,padL,padR,w,dpr};
  // time cursors: the replayed moment (solid) and a hover (dashed) from the timeline or this plot, with the values there
  const cur=(t,dash)=>{if(t==null||t<t0-1e-6||t>t1+1e-6)return false;pctx.strokeStyle=dash?TOK.muted:TOK.ink;pctx.lineWidth=1*dpr;pctx.setLineDash(dash?[3*dpr,3*dpr]:[]);pctx.beginPath();pctx.moveTo(X(t),padT);pctx.lineTo(X(t),h-padB);pctx.stroke();pctx.setLineDash([]);return true;};
  if(REPLAY.active)cur(tc,false);
  const th=CURSOR.hover!=null?CURSOR.hover:REPLAY.active?tc:null;
  if(CURSOR.hover!=null)cur(CURSOR.hover,true);
  if(th!=null&&th>=t0&&th<=t1){const best=D[nearestIdx(D,th)];
    if(best){const val=series.map(s=>{const v=s.k(best);return v==null?'—':fmt(v)+(s.name?' '+s.name:'');}).join(' · ');
      pctx.font=`${Math.round(10*dpr)}px ${getComputedStyle(document.body).getPropertyValue('--f-mono')||'monospace'}`;pctx.fillStyle=TOK.ink;pctx.textAlign='left';pctx.textBaseline='top';
      const x=Math.min(X(th)+5*dpr,w-padR-pctx.measureText(`${best.t.toFixed(1)} s: ${val}`).width-4*dpr);pctx.fillText(`${best.t.toFixed(1)} s: ${val}`,Math.max(padL+4*dpr,x),padT+(band?14*dpr:2*dpr));}}
}
let plotGeom=null;
