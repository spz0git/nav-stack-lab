/* ---------- analysis view: rendering ---------- */
function anCanvas(id){const cv=document.getElementById(id);if(!cv)return null;const dpr=sizeCanvas(cv);const c=cv.getContext('2d');c.setTransform(1,0,0,1,0,0);
  c.fillStyle=TOK['map-bg'];c.fillRect(0,0,cv.width,cv.height);return{cv,c,dpr,w:cv.width,h:cv.height};}
const fmt=(v,d=2)=>v==null||!isFinite(v)?'—':(+v).toFixed(d);
function anFont(G,sz){G.c.font=`${Math.round(sz*G.dpr)}px ${getComputedStyle(document.body).getPropertyValue('--f-mono')||'monospace'}`;}
function anFrame(G,box,xr,yr,opt){ // returns mappers; xr may be log
  const{c,dpr}=G,[x0,y0,x1,y1]=box,lx=opt&&opt.logx;
  const X=v=>x0+((lx?Math.log10(v):v)-(lx?Math.log10(xr[0]):xr[0]))/((lx?Math.log10(xr[1]):xr[1])-(lx?Math.log10(xr[0]):xr[0]))*(x1-x0);
  const Y=v=>y1-(v-yr[0])/(yr[1]-yr[0])*(y1-y0);
  c.strokeStyle=TOK.line;c.lineWidth=1;c.strokeRect(x0+.5,y0+.5,x1-x0,y1-y0);
  anFont(G,10);c.fillStyle=TOK.muted;c.textBaseline='top';c.textAlign='center';
  if(lx){for(let e=Math.floor(Math.log10(xr[0]));e<=Math.ceil(Math.log10(xr[1]));e++){for(const m of[1,2,5]){const v=m*Math.pow(10,e);if(v<xr[0]||v>xr[1])continue;const x=X(v);
      c.strokeStyle=m===1?TOK.line:TOK.grid;c.beginPath();c.moveTo(x,y0);c.lineTo(x,y1);c.stroke();if(m===1&&!(opt&&opt.noxlab))c.fillText(v>=1?String(v):v.toString(),x,y1+3*dpr);}}}
  else if(!(opt&&opt.noxgrid)){const st=niceStep(xr[1]-xr[0]);for(let v=Math.ceil(xr[0]/st)*st;v<=xr[1]+1e-9;v+=st){const x=X(v);c.strokeStyle=TOK.grid;c.beginPath();c.moveTo(x,y0);c.lineTo(x,y1);c.stroke();if(!(opt&&opt.noxlab))c.fillText(fmtTick(v,st),x,y1+3*dpr);}}
  const ys=opt&&opt.ystep||niceStep(yr[1]-yr[0]);c.textAlign='right';c.textBaseline='middle';
  for(let v=Math.ceil(yr[0]/ys)*ys;v<=yr[1]+1e-9;v+=ys){const y=Y(v);c.strokeStyle=TOK.grid;c.beginPath();c.moveTo(x0,y);c.lineTo(x1,y);c.stroke();c.fillStyle=TOK.muted;c.fillText(fmtTick(v,ys),x0-4*dpr,y);}
  return{X,Y};
}
function niceStep(r){const raw=r/5,p=Math.pow(10,Math.floor(Math.log10(raw))),m=raw/p;return(m<1.5?1:m<3.5?2:m<7.5?5:10)*p;}
function fmtTick(v,st){const d=st>=1?0:st>=0.1?1:2;return(Math.abs(v)<1e-9?0:v).toFixed(d);}
function polyline2(c,pts,X,Y,clip){c.beginPath();let up=true;for(const p of pts){if(p==null||!isFinite(p[1])){up=true;continue;}const x=X(p[0]),y=Y(p[1]);if(clip&&(y<clip[0]-50||y>clip[1]+50)){up=true;continue;}if(up){c.moveTo(x,y);up=false;}else c.lineTo(x,y);}c.stroke();}
function label(G,t,x,y,col,al='left',bl='bottom'){anFont(G,10);G.c.fillStyle=col;G.c.textAlign=al;G.c.textBaseline=bl;G.c.fillText(t,x,y);}

function drawBode(R){
  const G=anCanvas('cv-bode');if(!G)return;const{c,dpr,w,h}=G,F=R.F,M=R.M;
  const wmin=Math.max(0.01,(F.wc||1)/80),wmax=F.wN,pts=F.pts.filter(p=>p.w>=wmin);
  const L=40*dpr,Rm=10*dpr,top=8*dpr,mid=Math.round(h*0.56),bot=h-18*dpr;
  const dB=pts.map(p=>20*Math.log10(p.mag));let mx=Math.min(60,Math.max(20,...dB)),mn=Math.max(-60,Math.min(-20,...dB));
  let cl=[];if(AN.showCL&&!R.noCL)cl=pts.map(p=>{const S1=Cx.div([1,0],Cx.add([1,0],p.L)),Tn=Lparts(M,[0,p.w]).Le;
    return{w:p.w,S:20*Math.log10(Cx.abs(S1)),T:20*Math.log10(Cx.abs(Cx.mul(Tn,S1)))};});
  const A=anFrame(G,[L,top,w-Rm,mid-4*dpr],[wmin,wmax],[mn,mx],{logx:true,noxlab:true,ystep:20});
  c.strokeStyle=TOK.muted;c.setLineDash([3*dpr,3*dpr]);c.beginPath();c.moveTo(L,A.Y(0));c.lineTo(w-Rm,A.Y(0));c.stroke();c.setLineDash([]);
  if(AN.showCL){c.lineWidth=1.4*dpr;c.strokeStyle=TOK.rose;polyline2(c,cl.map(p=>[p.w,Math.max(mn,Math.min(mx,p.S))]),A.X,A.Y);c.strokeStyle=TOK.ok;polyline2(c,cl.map(p=>[p.w,Math.max(mn,Math.min(mx,p.T))]),A.X,A.Y);}
  c.lineWidth=2*dpr;c.strokeStyle=TOK.ink;polyline2(c,pts.map((p,i)=>[p.w,Math.max(mn-5,Math.min(mx+5,dB[i]))]),A.X,A.Y,[top,mid]);
  const phs=pts.map(p=>p.phu*180/Math.PI),pmx=Math.min(90,Math.ceil(Math.max(...phs)/90)*90),pmn=Math.max(-540,Math.floor(Math.min(...phs.filter(v=>v>-560))/90)*90);
  const B=anFrame(G,[L,mid+4*dpr,w-Rm,bot],[wmin,wmax],[Math.min(pmn,-180-10),Math.max(pmx,-90)],{logx:true,ystep:90});
  c.strokeStyle=TOK.bad;c.setLineDash([3*dpr,3*dpr]);c.beginPath();c.moveTo(L,B.Y(-180));c.lineTo(w-Rm,B.Y(-180));c.stroke();c.setLineDash([]);
  c.lineWidth=2*dpr;c.strokeStyle=TOK.ink;polyline2(c,pts.map((p,i)=>[p.w,phs[i]]),B.X,B.Y,[mid,bot]);
  // Nyquist frequency of the sampling
  c.strokeStyle=TOK.muted;c.setLineDash([2*dpr,4*dpr]);const xn=A.X(F.wN)-1;c.beginPath();c.moveTo(xn,top);c.lineTo(xn,bot);c.stroke();c.setLineDash([]);
  label(G,'π/T',xn-3*dpr,top+12*dpr,TOK.muted,'right','top');
  if(F.wc){const x=A.X(F.wc);c.strokeStyle=TOK.accent;c.lineWidth=1*dpr;c.beginPath();c.moveTo(x,top);c.lineTo(x,bot);c.stroke();
    const p=F.pts.reduce((a,q)=>Math.abs(Math.log(q.w/F.wc))<Math.abs(Math.log(a.w/F.wc))?q:a);const ph=p.phu*180/Math.PI,ref=ph-F.pm;
    c.strokeStyle=F.pm>30?TOK.ok:F.pm>0?TOK.warn:TOK.bad;c.lineWidth=3*dpr;c.beginPath();c.moveTo(x,B.Y(ref));c.lineTo(x,B.Y(ph));c.stroke();
    {const rt=x>w*0.7,xo=rt?x-5*dpr:x+4*dpr,al=rt?'right':'left';label(G,`ωc ${fmt(F.wc)} rad/s`,xo,top+2*dpr,TOK.accent,al,'top');label(G,`PM ${fmt(F.pm,0)}°`,xo,B.Y((ref+ph)/2),c.strokeStyle,al,'middle');}}
  if(F.w180&&F.w180<wmax){const x=A.X(F.w180),m=-F.gm;c.strokeStyle=F.gm>6?TOK.ok:F.gm>0?TOK.warn:TOK.bad;c.lineWidth=3*dpr;c.beginPath();c.moveTo(x,A.Y(0));c.lineTo(x,A.Y(Math.max(mn,m)));c.stroke();
    {const rt=x>w*0.72;label(G,`GM ${fmt(F.gm,1)} dB`,rt?x-5*dpr:x+4*dpr,A.Y(Math.max(mn,m/2)),c.strokeStyle,rt?'right':'left','middle');}}
  if(AN.meas.freq&&AN.meas.freq.length){c.fillStyle=TOK.amber;for(const q of AN.meas.freq){let ph=q.ph*180/Math.PI;const ref=F.pts.reduce((a,p)=>Math.abs(Math.log(p.w/q.w))<Math.abs(Math.log(a.w/q.w))?p:a).phu*180/Math.PI;ph+=360*Math.round((ref-ph)/360);
    c.beginPath();c.arc(A.X(q.w),A.Y(20*Math.log10(q.mag)),3.2*dpr,0,TAU);c.fill();c.beginPath();c.arc(B.X(q.w),B.Y(ph),3.2*dpr,0,TAU);c.fill();}}
  const nm=R.loop==='spd'&&R.M.kind!=='mpc'?'G':'L';label(G,`|${nm}| dB`,L+4*dpr,mid-6*dpr,TOK.muted);label(G,`∠${nm} °`,L+4*dpr,bot-4*dpr,TOK.muted);label(G,'ω [rad/s]',w-Rm,h-2*dpr,TOK.muted,'right','bottom');
}
function drawNyq(R){
  const G=anCanvas('cv-nyq');if(!G)return;const{c,dpr,w,h}=G,F=R.F,lg=AN.nyqScale==='log';
  const map=L=>{if(!lg)return L;const r=Cx.abs(L),k=r>0?Math.log2(1+r)/r:1;return[L[0]*k,L[1]*k];};
  const span=lg?3.4:2.4,ar=w/h,cx=lg?-0.7:-0.6,yr=span,xr=span*ar;
  const X=v=>w/2+(v-cx)/xr*(w/2),Y=v=>h/2-v/yr*(h/2);
  c.strokeStyle=TOK.grid;c.lineWidth=1;c.beginPath();c.moveTo(0,Y(0));c.lineTo(w,Y(0));c.moveTo(X(0),0);c.lineTo(X(0),h);c.stroke();
  c.strokeStyle=TOK.muted;c.setLineDash([3*dpr,3*dpr]);c.beginPath();c.arc(X(0),Y(0),X(1)-X(0),0,TAU);c.stroke();c.setLineDash([]);
  const pos=F.pts.map(p=>map(p.L)),neg=pos.map(p=>[p[0],-p[1]]);
  c.lineWidth=1.3*dpr;c.strokeStyle=TOK.muted;c.setLineDash([4*dpr,3*dpr]);c.beginPath();neg.forEach((p,i)=>i?c.lineTo(X(p[0]),Y(p[1])):c.moveTo(X(p[0]),Y(p[1])));c.stroke();c.setLineDash([]);
  c.lineWidth=2*dpr;c.strokeStyle=TOK.ink;c.beginPath();pos.forEach((p,i)=>i?c.lineTo(X(p[0]),Y(p[1])):c.moveTo(X(p[0]),Y(p[1])));c.stroke();
  // direction arrow near crossover
  const ia=F.pts.findIndex(p=>p.w>=(F.wc||1)*0.6);if(ia>0){const a=pos[ia-1],b=pos[ia],ang=Math.atan2(Y(b[1])-Y(a[1]),X(b[0])-X(a[0]));c.fillStyle=TOK.ink;c.beginPath();const tx=X(b[0]),ty=Y(b[1]);
    c.moveTo(tx,ty);c.lineTo(tx-9*dpr*Math.cos(ang-0.4),ty-9*dpr*Math.sin(ang-0.4));c.lineTo(tx-9*dpr*Math.cos(ang+0.4),ty-9*dpr*Math.sin(ang+0.4));c.closePath();c.fill();}
  // closest approach to −1 (1/Ms)
  let best=null;F.pts.forEach((p,i)=>{const d=Cx.abs(Cx.add([1,0],p.L));if(!best||d<best.d)best={d,i};});
  if(best){const q=pos[best.i];c.strokeStyle=TOK.rose;c.lineWidth=1.5*dpr;c.beginPath();c.moveTo(X(-1),Y(0));c.lineTo(X(q[0]),Y(q[1]));c.stroke();}
  if(F.wc){const p=F.pts.reduce((a,q)=>Math.abs(Math.log(q.w/F.wc))<Math.abs(Math.log(a.w/F.wc))?q:a),u=map(p.L);c.fillStyle=TOK.accent;c.beginPath();c.arc(X(u[0]),Y(u[1]),4*dpr,0,TAU);c.fill();}
  c.strokeStyle=TOK.bad;c.lineWidth=2.5*dpr;const s=6*dpr;c.beginPath();c.moveTo(X(-1)-s,Y(0)-s);c.lineTo(X(-1)+s,Y(0)+s);c.moveTo(X(-1)-s,Y(0)+s);c.lineTo(X(-1)+s,Y(0)-s);c.stroke();
  label(G,'−1',X(-1)-8*dpr,Y(0)-6*dpr,TOK.bad,'right','bottom');
  if(AN.meas.freq){c.fillStyle=TOK.amber;for(const q of AN.meas.freq){const u=map(q.L);c.beginPath();c.arc(X(u[0]),Y(u[1]),3.2*dpr,0,TAU);c.fill();}}
  const ok=F.Ncw===0;label(G,`N = ${F.Ncw} encirclement${Math.abs(F.Ncw)===1?'':'s'} of −1 · Z = N + P = ${F.Ncw}  →  ${ok?'stable':'unstable'}`,6*dpr,h-4*dpr,ok?TOK.ok:TOK.bad,'left','bottom');
  label(G,lg?'radius log₂(1+|L|): −1 and the unit circle stay in place':'linear scale',6*dpr,4*dpr,TOK.muted,'left','top');
}
function drawStep(R){
  const G=anCanvas('cv-step');if(!G)return;const{c,dpr,w,h}=G,spd=R.loop==='spd',kind=spd?'offset':AN.stepKind,bu=biasUnit();
  const sc=kind==='offset'?1:bu.toModel(bu.val),pred=(kind==='offset'?R.step:R.bias).map(p=>[p[0],p[1]*sc]);
  const ms=spd?(AN.meas.spd?AN.meas.spd.data:null):(AN.meas.step&&AN.meas.step.kind===kind?AN.meas.step.data.map(p=>[p[0],p[1]*sc]):null);
  const all=pred.concat(ms||[]).map(p=>p[1]).filter(isFinite);let lo=Math.min(...all),hi=Math.max(...all);
  if(kind==='offset'){lo=Math.min(lo,-0.1);hi=Math.max(hi,1.05);}else{const m=Math.max(Math.abs(lo),Math.abs(hi),1e-3);lo=Math.min(lo,-0.1*m);hi=Math.max(hi,0.1*m);}
  lo=Math.max(lo,kind==='offset'?-1.5:-10);hi=Math.min(hi,kind==='offset'?2:10);
  const A=anFrame(G,[44*dpr,8*dpr,w-10*dpr,h-18*dpr],[0,R.tEnd],[lo,hi]);
  c.strokeStyle=TOK.muted;c.beginPath();c.moveTo(A.X(0),A.Y(0));c.lineTo(A.X(R.tEnd),A.Y(0));c.stroke();
  const m=kind==='offset'?R.smOff:R.smBias,fin=spd?1:kind==='offset'?0:m.final*sc,band=kind==='offset'?0.02:0.02*Math.abs(m.peak*sc);
  c.fillStyle=rgba(TOK.ok,0.12);c.fillRect(A.X(0),A.Y(fin+band),A.X(R.tEnd)-A.X(0),A.Y(fin-band)-A.Y(fin+band));
  if(R.stable&&m.settle&&m.settle<R.tEnd){c.strokeStyle=TOK.ok;c.setLineDash([3*dpr,3*dpr]);c.beginPath();c.moveTo(A.X(m.settle),A.Y(lo));c.lineTo(A.X(m.settle),A.Y(hi));c.stroke();c.setLineDash([]);
    label(G,`settles ${fmt(m.settle,1)} s`,A.X(m.settle)+3*dpr,8*dpr+2*dpr,TOK.ok,'left','top');}
  c.save();c.beginPath();c.rect(44*dpr,8*dpr,w-54*dpr,h-26*dpr);c.clip();
  c.lineWidth=2*dpr;c.strokeStyle=TOK.ink;polyline2(c,pred,A.X,A.Y);
  if(ms){c.lineWidth=2*dpr;c.strokeStyle=TOK.amber;c.setLineDash([5*dpr,3*dpr]);polyline2(c,ms,A.X,A.Y);c.setLineDash([]);}c.restore();
  label(G,spd?`(v − v₀) / Δv for a reference step of ${fmt(AN.spdAmp||0.2)} m/s`:kind==='offset'?'e(t) / e₀  (path offset step)':`e(t) [m] for a ${bu.val}${bu.unit} actuator bias`,48*dpr,h-20*dpr,TOK.muted,'left','bottom');
  label(G,'t [s]',w-14*dpr,h-21*dpr,TOK.muted,'right','bottom');
}
function drawPZ(R){
  const G=anCanvas('cv-pz');if(!G)return;const{c,dpr,w,h}=G;
  const near=R.poles.map(s=>Math.hypot(s[0],s[1])).filter(r=>r<200).sort((a,b)=>a-b);
  const Rv=Math.max(1,Math.min(80,1.6*(near[Math.min(near.length-1,3)]||5)));
  let xr=[-Rv,0.35*Rv];const ar=(w-48*dpr)/(h-24*dpr);let half=(xr[1]-xr[0])/ar/2;
  const needY=1.12*Math.max(0,...R.poles.filter(s=>s[0]>=xr[0]&&s[0]<=xr[1]).map(s=>Math.abs(s[1])));
  let Rs=Rv;if(needY>half){const k=Math.min(4,needY/half);Rs=Rv*k;xr=[-Rs,0.35*Rs];half*=k;}const yr=[-half,half];
  const A=anFrame(G,[40*dpr,6*dpr,w-8*dpr,h-18*dpr],xr,yr);
  c.fillStyle=rgba(TOK.bad,0.07);c.fillRect(A.X(0),6*dpr,A.X(xr[1])-A.X(0),A.Y(yr[0])-6*dpr);
  c.strokeStyle=TOK.muted;c.beginPath();c.moveTo(A.X(0),A.Y(yr[0]));c.lineTo(A.X(0),A.Y(yr[1]));c.moveTo(A.X(xr[0]),A.Y(0));c.lineTo(A.X(xr[1]),A.Y(0));c.stroke();
  // constant damping rays
  c.setLineDash([2*dpr,3*dpr]);for(const z of[0.3,0.5,0.7]){const th=Math.acos(z);for(const sg of[1,-1]){c.beginPath();c.moveTo(A.X(0),A.Y(0));c.lineTo(A.X(-Rs*Math.cos(th)),A.Y(sg*Rs*Math.sin(th)));c.stroke();}
    label(G,`ζ ${z}`,A.X(-0.9*Rs*Math.cos(th)),A.Y(0.9*Rs*Math.sin(th)),TOK.muted,'center','bottom');}c.setLineDash([]);
  c.fillStyle=rgba(TOK.accent,0.5);for(const p of R.locus){if(p[0]<xr[0]||p[0]>xr[1]||Math.abs(p[1])>yr[1])continue;c.fillRect(A.X(p[0])-1.2*dpr,A.Y(p[1])-1.2*dpr,2.4*dpr,2.4*dpr);}
  c.strokeStyle=TOK.muted;c.lineWidth=1.5*dpr;const s=4*dpr;
  for(const p of R.olp){if(p[0]<xr[0]||p[0]>xr[1])continue;const x=A.X(p[0]),y=A.Y(p[1]);c.beginPath();c.moveTo(x-s,y-s);c.lineTo(x+s,y+s);c.moveTo(x-s,y+s);c.lineTo(x+s,y-s);c.stroke();}
  for(const p of R.olz){if(p[0]<xr[0]||p[0]>xr[1])continue;c.beginPath();c.arc(A.X(p[0]),A.Y(p[1]),s,0,TAU);c.stroke();}
  let off=0;for(const p of R.poles){if(p[0]<xr[0]||p[0]>xr[1]||Math.abs(p[1])>yr[1]){off++;continue;}c.fillStyle=p[0]>0?TOK.bad:TOK.ok;c.beginPath();c.arc(A.X(p[0]),A.Y(p[1]),5*dpr,0,TAU);c.fill();}
  label(G,`● closed loop  × ○ open loop  · locus ×0.06–16${off?`  ·  ${off} off-scale`:''}`,44*dpr,h-21*dpr,TOK.muted,'left','bottom');
  label(G,'Re s',w-12*dpr,A.Y(0)-3*dpr,TOK.muted,'right','bottom');
}
function blockDiagram(R){
  const M=R.M,car=M.car,u=car?'δ':'ω';let C;
  if(M.kind==='static')C=`${u} = −(${fmt(M.Ke)}·e + ${fmt(M.Kth)}·θₑ)`;
  else if(M.kind==='pid')C=`${u} = PID(α),  α ≈ −e/${fmt(M.Ld)} − θₑ`;
  else C=`${u}̇ = −(${fmt(M.K.e)}e + ${fmt(M.K.th)}θₑ + ${fmt(M.K.s)}${u}${M.lagModel?` + ${fmt(M.K.c)}${u}cmd`:''}) + ${fmt(M.K.u)}${u}̇prev`;
  const box=(x,wd,t,sub)=>`<g><rect x="${x}" y="22" width="${wd}" height="40" rx="5" class="bd-box"/><text x="${x+wd/2}" y="${sub?39:46}" class="bd-t">${t}</text>${sub?`<text x="${x+wd/2}" y="54" class="bd-s">${sub}</text>`:''}</g>`;
  const ar=(x1,x2,y=42)=>`<line x1="${x1}" y1="${y}" x2="${x2-6}" y2="${y}" class="bd-l"/><path d="M${x2} ${y} l-7 -4 v8 z" class="bd-a"/>`;
  const act=M.kind==='mpc'?(M.tau>0?`∫ then 1/(${fmt(M.tau)}s+1)`:'∫ (rate input)'):(M.tau>0?`1/(${fmt(M.tau)}s+1)`:'1');
  return`<svg viewBox="0 0 860 104" class="bd" role="img" aria-label="Block diagram of the lateral loop">
  <text x="6" y="46" class="bd-s" text-anchor="start">e₀ step</text>${ar(52,76)}
  <circle cx="86" cy="42" r="10" class="bd-box"/><text x="86" y="46" class="bd-t">Σ</text>${ar(96,118)}
  ${box(118,190,'Controller',C.length>34?C.slice(0,34)+'…':C)}${ar(308,330)}
  ${box(330,92,'e^(−sT_d)',`T_d ${fmt(M.Td*1000,0)} ms`)}${ar(422,442)}
  ${box(442,116,'Actuator',act)}${ar(558,578)}
  ${box(578,92,'Heading',car?`v/L · 1/s`:'1/s')}${ar(670,690)}
  ${box(690,92,'Lateral',`v/s, v ${fmt(M.v0)}`)}${ar(782,830)}<text x="836" y="46" class="bd-s" text-anchor="start">e</text>
  <polyline points="806,42 806,92 86,92 86,52" class="bd-l" fill="none"/><path d="M86 52 l-4 7 h8 z" class="bd-a"/>
  <polyline points="680,42 680,80 213,80 213,62" class="bd-l bd-dash" fill="none"/><text x="446" y="76" class="bd-s">θₑ</text><text x="446" y="88" class="bd-s">e</text></svg>`;
}
function chip(lbl,val,cls,tip){return`<div class="chip ${cls||''}" title="${tip||''}"><span>${lbl}</span><b>${val}</b></div>`;}
function renderAnalysis(){
  const view=$('#anview');if(!view||AN.mode!=='an')return;readTokens();
  const estL=$('#an-est-l');if(estL)estL.hidden=P.loc==='truth'||P.loc==='custom';
  if(AN.loop==='spd')return renderSpeed();
  if(AN.dirty||!AN.res){anCompute();AN.dirty=false;}
  const R=AN.res,M=R.M,ctlN=CTL_NAMES[anCtl()]||P.ctl;
  const opLabel=anR()?`a left turn of radius ${anR()} m at v₀ = ${fmt(M.v0)} m/s`:`straight path at v₀ = ${fmt(M.v0)} m/s (cruise speed)`;
  $('#an-op').innerHTML=`<b>${isCar()?'Car-like':'Diff-drive'} · ${ctlN}</b> · ${opLabel} · sample T = ${DT*1000} ms · delay T<sub>d</sub> = T/2${M.nL?` + ${fmt(M.nL*DT,2)} s latency`:''} = ${fmt(M.Td*1000,0)} ms${M.tau>0?` · actuator lag τ = ${fmt(M.tau)} s`:''}`;
  if(M.kind==='none'){$('#an-body').hidden=true;$('#an-none').hidden=false;
    $('#an-none').innerHTML=`<p><b>${ctlN}</b> has no linear model to analyze. ${P.ctl==='dwa'?'DWA picks the best of a grid of sampled commands, so its output is piecewise constant in the state and has no meaningful derivative.':'Your code runs as a black box in a worker.'} Pick pure pursuit, rear-wheel feedback, Stanley (car), PID or MPC in the Control tab.</p>`;return;}
  $('#an-body').hidden=false;$('#an-none').hidden=true;
  $('#an-diagram').innerHTML=blockDiagram(R);
  const F=R.F,so=R.smOff,sb=R.smBias,bu=biasUnit(),ms=AN.meas.step;
  const pmC=F.pm==null?'':F.pm>45?'good':F.pm>25?'warnc':'badc',gmC=F.gm==null?'good':F.gm>6?'good':F.gm>0?'warnc':'badc';
  let html=chip('Closed loop',R.stable?'stable':`unstable (${R.unstableZ} pole${R.unstableZ>1?'s':''})`,R.stable?'good':'badc','From the eigenvalues of the exact 20 Hz loop; the Nyquist count must agree')+
    chip('Phase margin',F.pm==null?'—':fmt(F.pm,0)+'°',pmC,'180° + ∠L at the gain crossover')+
    chip('Gain margin',F.gm==null?'∞':fmt(F.gm,1)+' dB',gmC,'How much the loop gain can grow before instability')+
    chip('Crossover ω<sub>c</sub>',F.wc?fmt(F.wc)+' rad/s':'—','','|L(jω_c)| = 1; roughly the closed-loop bandwidth')+
    chip('Delay margin',F.dm!=null?fmt(F.dm*1000,0)+' ms':'—',F.dm!=null?(F.dm>0.1?'good':F.dm>0.03?'warnc':'badc'):'','Extra latency the loop tolerates: PM / ω_c')+
    chip('M<sub>s</sub>',fmt(F.ms,2),F.ms<1.6?'good':F.ms<2.2?'warnc':'badc','Peak sensitivity = 1 / closest distance from L to −1')+
    chip('Dominant poles',R.zeta!=null?`ζ ${fmt(R.zeta,2)} · ω<sub>n</sub> ${fmt(R.wn,2)}`:'—','','Slowest closed-loop pole pair')+
    (anR()?chip('Offset on the curve',fmt((M.ess||0)*100,1)+' cm',Math.abs(M.ess||0)<0.03?'good':'warnc','Steady lateral offset at the operating point: positive = inside the turn (cutting), the gains are read about it'):'')+
    (R.stable?chip('Overshoot',fmt(so.overshoot,0)+'%'+(ms&&ms.kind==='offset'?` · sim ${fmt(stepMetrics(ms.data,'offset').overshoot,0)}%`:''),'','Predicted for a path-offset step; sim = measured in the simulator')+
    chip('Settling 2%',fmt(so.settle,1)+' s'+(ms&&ms.kind==='offset'?` · sim ${fmt(stepMetrics(ms.data,'offset').settle,1)} s`:''),'')+
    chip(`Steady error, ${bu.val}${bu.unit} bias`,fmt(sb.final*bu.toModel(bu.val)*100,1)+' cm',Math.abs(sb.final*bu.toModel(bu.val))<0.005?'good':'','Lateral offset left by a constant actuator bias (no integral action → nonzero)')
    :chip('Step response','grows without bound','badc','The linear loop is unstable; in the simulator, actuator limits usually turn this into a sustained oscillation'));
  $('#an-chips').innerHTML=html;
  $('#an-msg').textContent=AN.msg+(ms&&ms.satT>0?` The steering-rate limit was active for ${fmt(ms.satT,2)} s of the test${ms.satT>0.3?', so the response departs from the linear prediction':''}.`:'')+(ms&&ms.coll?' The robot collided during the test.':'');
  $('#an-step').disabled=AN.busy;$('#an-inj').disabled=AN.busy;$('#an-inj').hidden=false;$('#an-inja').hidden=false;$('#an-amp').hidden=false;$('#an-kind').hidden=false;$('#an-cl').hidden=false;
  for(const id of['cv-nyq','cv-pz'])$('#'+id).parentNode.hidden=false;
  drawBode(R);drawNyq(R);drawStep(R);drawPZ(R);
}
function renderSpeed(){
  if(AN.dirty||!AN.resSpd){spdCompute();AN.dirty=false;}
  const R=AN.resSpd,M=R.M,ctlN=CTL_NAMES[anCtl()]||P.ctl,ms=AN.meas.spd;
  $('#an-op').innerHTML=`<b>${isCar()?'Car-like':'Diff-drive'} · ${ctlN}</b> · speed loop at v₀ = ${fmt(M.v0)} m/s · sample T = ${DT*1000} ms${M.nL?` · latency ${fmt(M.nL*DT,2)} s`:''}${M.tau>0?` · actuator lag τ = ${fmt(M.tau)} s`:' · no actuator lag'}${P.accel?` · acceleration limit ${fmt(P.amax)} m/s² (nonlinear, not in the model)`:''}`;
  if(M.kind==='none'){$('#an-body').hidden=true;$('#an-none').hidden=false;$('#an-none').innerHTML=`<p><b>${ctlN}</b> runs as a black box. Pick a built-in tracker.</p>`;return;}
  $('#an-body').hidden=false;$('#an-none').hidden=true;
  const mpc=M.kind==='mpc',sm=R.smOff,msm=ms?spdMetrics(ms.data):null;
  $('#an-diagram').innerHTML=speedDiagram(R);
  let html='';
  if(mpc){const F=R.F,pmC=F.pm==null?'':F.pm>45?'good':F.pm>25?'warnc':'badc';
    html+=chip('Speed loop',R.stable?'stable':`unstable (${R.unstableZ})`,R.stable?'good':'badc','Eigenvalues of the exact 20 Hz speed loop')+chip('Phase margin',F.pm==null?'—':fmt(F.pm,0)+'°',pmC,'')+chip('Gain margin',F.gm==null?'∞':fmt(F.gm,1)+' dB','','')+chip('Crossover ω<sub>c</sub>',F.wc?fmt(F.wc)+' rad/s':'—','','')+chip('Delay margin',F.dm!=null?fmt(F.dm*1000,0)+' ms':'—','','')+chip('M<sub>s</sub>',fmt(F.ms,2),F.ms<1.6?'good':F.ms<2.2?'warnc':'badc','')+chip('Gains',`K<sub>v</sub> ${fmt(M.K.v,2)}${M.lagModel?` · K<sub>vc</sub> ${fmt(M.K.vc,2)}`:''} · K<sub>u</sub> ${fmt(M.K.u,2)}`,'','Read from the MPC by finite differences: acceleration per m/s of speed error, per m/s of commanded speed, and memory of the last move');}
  else html+=chip('Speed feedback','none (feedforward profile)','','The tracker commands speed from the profile; nothing corrects the actual speed, so this is an open loop')+chip('Bandwidth of G',R.bw?fmt(R.bw,2)+' rad/s':'—','','Where the command-to-speed gain drops 3 dB')+chip('Time constant',M.tau>0?fmt(M.tau,2)+' s':'0 s','','First-order actuator lag τ')+chip('Latency',fmt(M.nL*DT*1000,0)+' ms','','Whole ticks between command and actuator');
  html+=chip('Rise 10–90 %',sm.rise!=null?fmt(sm.rise,2)+' s'+(msm&&msm.rise!=null?` · sim ${fmt(msm.rise,2)} s`:''):'—','','Predicted for a reference step; sim = measured')+chip('Settling 2%',fmt(sm.settle,2)+' s'+(msm?` · sim ${fmt(msm.settle,2)} s`:''),'','')+chip('Overshoot',fmt(sm.overshoot,0)+'%'+(msm?` · sim ${fmt(msm.overshoot,0)}%`:''),'','');
  $('#an-chips').innerHTML=html;
  $('#an-msg').textContent=AN.msg+(ms&&ms.satT>0.1?` The acceleration limit was active for ${fmt(ms.satT,2)} s of the test, which the linear model does not include.`:'');
  $('#an-step').disabled=AN.busy;$('#an-inj').hidden=true;$('#an-inja').hidden=true;$('#an-amp').hidden=true;$('#an-kind').hidden=true;$('#an-cl').hidden=true;
  $('#cv-nyq').parentNode.hidden=!mpc;$('#cv-pz').parentNode.hidden=!mpc;
  drawBode(R);if(mpc){drawNyq(R);drawPZ(R);}drawStep(R);
}
function speedDiagram(R){
  const M=R.M,mpc=M.kind==='mpc';
  const box=(x,wd,t,sub)=>`<g><rect x="${x}" y="22" width="${wd}" height="40" rx="5" class="bd-box"/><text x="${x+wd/2}" y="${sub?39:46}" class="bd-t">${t}</text>${sub?`<text x="${x+wd/2}" y="54" class="bd-s">${sub}</text>`:''}</g>`;
  const ar=(x1,x2,y=42)=>`<line x1="${x1}" y1="${y}" x2="${x2-6}" y2="${y}" class="bd-l"/><path d="M${x2} ${y} l-7 -4 v8 z" class="bd-a"/>`;
  const lag=M.tau>0?`1/(${fmt(M.tau)}s+1)`:'1';
  if(!mpc)return`<svg viewBox="0 0 860 104" class="bd" role="img" aria-label="Open speed chain"><text x="6" y="46" class="bd-s" text-anchor="start">v<tspan baseline-shift="sub" font-size="8">ref</tspan></text>${ar(52,118)}${box(118,170,'Speed profile','cruise, curvature, stopping')}${ar(288,330)}${box(330,120,'Latency',`${fmt(M.nL*DT*1000,0)} ms`)}${ar(450,492)}${box(492,150,'Actuator',lag)}${ar(642,684)}${box(684,120,'Accel limit',P.accel?`±${fmt(P.amax)} m/s²`:'off')}${ar(804,840)}<text x="846" y="46" class="bd-s" text-anchor="start">v</text></svg>`;
  return`<svg viewBox="0 0 860 104" class="bd" role="img" aria-label="MPC speed loop"><text x="6" y="46" class="bd-s" text-anchor="start">v<tspan baseline-shift="sub" font-size="8">ref</tspan></text>${ar(52,76)}<circle cx="86" cy="42" r="10" class="bd-box"/><text x="86" y="46" class="bd-t">Σ</text>${ar(96,118)}${box(118,210,'MPC (rate input a)',`a = −K_v Δv${M.lagModel?' − K_vc Δv_cmd':''} + K_u a_prev`)}${ar(328,370)}${box(370,100,'∫ a dt','v_cmd')}${ar(470,512)}${box(512,120,'Latency',`${fmt(M.nL*DT*1000,0)} ms`)}${ar(632,674)}${box(674,140,'Actuator',lag)}${ar(814,840)}<text x="846" y="46" class="bd-s" text-anchor="start">v</text><polyline points="826,42 826,92 86,92 86,52" class="bd-l" fill="none"/><path d="M86 52 l-4 7 h8 z" class="bd-a"/></svg>`;
}
let anTimer=null;
function anInvalidate(keepMeas){AN.dirty=true;AN.resSpd=null;if(!keepMeas){AN.meas={step:null,freq:null,spd:null};AN.msg='';}
  if(AN.mode==='an'){clearTimeout(anTimer);anTimer=setTimeout(renderAnalysis,90);}}
function setMode(m){AN.mode=m;$('#simview').hidden=m!=='sim';$('#anview').hidden=m!=='an';
  $('#modesel').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.v===m)));
  if(m==='an'){running=false;AN.dirty=true;renderAnalysis();}else{draw();drawPlot();refreshAll();}}
