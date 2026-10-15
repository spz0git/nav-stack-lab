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
  if(R.loop!=='spd')return drawResp(R);
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
function drawLocus(R){
  const G=anCanvas('cv-loc');if(!G)return;const{c,dpr,w,h}=G;
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
/* ---------- the lateral response in physical units: sideways offset [cm] against distance driven [m] ---------- */
function drawResp(R){
  const G=anCanvas('cv-step');if(!G)return;const{c,dpr,w,h}=G,M=R.M,v0=M.v0,kind=AN.stepKind,bu=biasUnit(),wi=AN.wi;
  const sc=kind==='offset'?AN.stepAmp*100:bu.toModel(bu.val)*100;   // model curves are per unit offset or per unit bias
  const tr=(pts,k)=>pts.map(p=>[p[0]*v0,p[1]*k]);
  const pred=tr(kind==='offset'?R.step:R.bias,sc),ms0=AN.meas.step&&AN.meas.step.kind===kind?AN.meas.step:null;
  const ms=ms0?tr(ms0.data,kind==='offset'?ms0.amp*100:sc):null,wiP=wi?tr(kind==='offset'?wi.step:wi.bias,sc):null;
  const all=pred.concat(ms||[],wiP||[]).map(p=>p[1]).filter(isFinite);let lo=Math.min(0,...all),hi=Math.max(0,...all);
  const m=Math.max(Math.abs(lo),Math.abs(hi),1e-3);lo=Math.max(lo-0.08*m,-3*sc-1);hi=Math.min(hi+0.12*m,3*Math.abs(sc)+1);
  const L=48*dpr,Rr=10*dpr,top=20*dpr,bot=h-30*dpr,xEnd=R.tEnd*v0;
  const A=anFrame(G,[L,top,w-Rr,bot],[0,xEnd],[lo,hi]);
  // time on the top axis
  {const st=niceStep(R.tEnd);anFont(G,10);c.fillStyle=TOK.muted;c.textAlign='center';c.textBaseline='bottom';
    for(let t=0;t<=R.tEnd+1e-9;t+=st){const x=A.X(t*v0);c.strokeStyle=TOK.muted;c.beginPath();c.moveTo(x,top);c.lineTo(x,top-3*dpr);c.stroke();c.fillText(`${fmtTick(t,st)} s`,x,top-4*dpr);}}
  // the path, and where the robot starts
  c.strokeStyle=rgba(TOK.accent,0.45);c.lineWidth=5*dpr;c.beginPath();c.moveTo(A.X(0),A.Y(0));c.lineTo(A.X(xEnd),A.Y(0));c.stroke();
  label(G,'path',A.X(xEnd)-4*dpr,A.Y(0)-5*dpr,TOK.accent,'right','bottom');
  const sm=kind==='offset'?R.smOff:R.smBias;
  if(kind==='offset'){const band=0.02*sc;c.fillStyle=rgba(TOK.ok,0.1);c.fillRect(A.X(0),A.Y(band),A.X(xEnd)-A.X(0),A.Y(-band)-A.Y(band));}
  if(R.stable&&sm.settle&&sm.settle<R.tEnd*0.98){const x=A.X(sm.settle*v0);c.strokeStyle=TOK.ok;c.lineWidth=1*dpr;c.setLineDash([3*dpr,3*dpr]);c.beginPath();c.moveTo(x,top);c.lineTo(x,bot);c.stroke();c.setLineDash([]);
    label(G,`settled after ${fmt(sm.settle*v0,1)} m`,x+(x>w*0.7?-3:3)*dpr,bot-3*dpr,TOK.ok,x>w*0.7?'right':'left','bottom');}
  c.save();c.beginPath();c.rect(L,top,w-Rr-L,bot-top);c.clip();
  c.lineWidth=2.2*dpr;c.strokeStyle=R.stable?TOK.ink:TOK.bad;polyline2(c,pred,A.X,A.Y);
  if(wiP){c.lineWidth=2*dpr;c.strokeStyle=TOK.accent;c.setLineDash([7*dpr,4*dpr]);polyline2(c,wiP,A.X,A.Y);c.setLineDash([]);}
  if(ms){c.lineWidth=2*dpr;c.strokeStyle=TOK.amber;c.setLineDash([3*dpr,3*dpr]);polyline2(c,ms,A.X,A.Y);c.setLineDash([]);}
  if(kind==='offset'){c.fillStyle=TOK.ink;c.beginPath();c.arc(A.X(0),A.Y(sc),4*dpr,0,TAU);c.fill();}
  c.restore();
  label(G,kind==='offset'?'sideways offset [cm]':`offset from a ${bu.val} ${bu.unit} ${isCar()?'steering misalignment':'turn-rate bias'} [cm]`,L+4*dpr,top+3*dpr,TOK.muted,'left','top');
  label(G,'distance driven along the path [m]',w-Rr,h-2*dpr,TOK.muted,'right','bottom');
  // legend
  anFont(G,10);let ly=top+8*dpr;const lx=w-Rr-80*dpr,leg=(col,dash,t)=>{c.strokeStyle=col;c.lineWidth=2*dpr;c.setLineDash(dash);c.beginPath();c.moveTo(lx,ly);c.lineTo(lx+16*dpr,ly);c.stroke();c.setLineDash([]);
    c.fillStyle=TOK.muted;c.textAlign='left';c.textBaseline='middle';c.fillText(t,lx+20*dpr,ly);ly+=13*dpr;};
  leg(R.stable?TOK.ink:TOK.bad,[],'model');if(wiP)leg(TOK.accent,[7*dpr,4*dpr],'what-if');if(ms)leg(TOK.amber,[3*dpr,3*dpr],'simulator');
}

/* ---------- poles you can drag ---------- */
const PZ={view:null,map:null,drag:false,raf:0};
function drawPoles(R){
  const G=anCanvas('cv-pz');if(!G)return;const{c,dpr,w,h}=G,wi=AN.wi,kn=R.knob;
  const L=44*dpr,Rr=8*dpr,top=8*dpr,bot=h-34*dpr;
  if(!PZ.drag||!PZ.view){   // a stable view while dragging, so the pole stays under the finger; equal scales so ζ angles are true
    const pts=[R.dom,wi&&wi.dom,wi&&wi.tg].filter(Boolean);if(kn){const q=kn.pts.reduce((a,q)=>q.dom&&Math.abs(q.x-kn.cur)<Math.abs(a.x-kn.cur)?q:a,kn.pts[0]);if(q.dom)pts.push(q.dom);}
    let X=1,Y=0.6;for(const s of pts){X=Math.max(X,1.3*Math.abs(s[0]));Y=Math.max(Y,1.3*Math.abs(s[1]));}X=Math.min(X,60);Y=Math.min(Y,60);
    const Wp=(w-L-Rr)/dpr,Hp=(bot-top)/dpr,k=Math.max(X/(0.82*Wp),Y/(0.9*Hp));
    PZ.view={xr:[-0.82*Wp*k,0.18*Wp*k],yr:[-0.1*Hp*k,0.9*Hp*k]};}
  const{xr,yr}=PZ.view,A=anFrame(G,[L,top,w-Rr,bot],xr,yr);PZ.map={x0:L/dpr,x1:(w-Rr)/dpr,y0:top/dpr,y1:bot/dpr,xr,yr};
  c.fillStyle=rgba(TOK.bad,0.07);c.fillRect(A.X(0),top,A.X(xr[1])-A.X(0),bot-top);label(G,'unstable',A.X(xr[1])-3*dpr,top+3*dpr,TOK.bad,'right','top');
  c.strokeStyle=TOK.muted;c.lineWidth=1;c.beginPath();c.moveTo(A.X(0),top);c.lineTo(A.X(0),bot);c.moveTo(L,A.Y(0));c.lineTo(w-Rr,A.Y(0));c.stroke();
  c.setLineDash([2*dpr,3*dpr]);const Rs=Math.hypot(xr[0],yr[1]);for(const z of[0.3,0.7,1]){const th=Math.acos(z);c.beginPath();c.moveTo(A.X(0),A.Y(0));c.lineTo(A.X(-Rs*Math.cos(th)),A.Y(Rs*Math.sin(th)));c.stroke();
    const rr=0.93*Math.min(-xr[0]/Math.max(Math.cos(th),1e-6),yr[1]/Math.max(Math.sin(th),1e-6));label(G,`ζ ${z}`,A.X(-rr*Math.cos(th))+(z===1?2*dpr:0),A.Y(rr*Math.sin(th))+(z===1?-3*dpr:0),TOK.muted,'left',z===1?'bottom':'top');}c.setLineDash([]);
  const inV=s=>s[0]>=xr[0]&&s[0]<=xr[1]&&Math.abs(s[1])<=yr[1];
  // the knob's curve: where a one-knob tracker can put its poles
  if(kn){c.strokeStyle=rgba(TOK.accent,0.55);c.lineWidth=2*dpr;c.beginPath();let up=true;for(const q of kn.pts){if(!q.dom||!inV(q.dom)){up=true;continue;}const x=A.X(q.dom[0]),y=A.Y(q.dom[1]);if(up){c.moveTo(x,y);up=false;}else c.lineTo(x,y);}c.stroke();
    let last=null;kn.pts.forEach((q,i)=>{if(i%6||!q.dom||!inV(q.dom))return;const x=A.X(q.dom[0]),y=A.Y(q.dom[1]);if(last&&Math.hypot(x-last[0],y-last[1])<46*dpr)return;last=[x,y];
      c.fillStyle=TOK.accent;c.beginPath();c.arc(x,y,2.5*dpr,0,TAU);c.fill();label(G,`${kn.sym} ${q.x.toFixed(q.x<1?2:1)}${kn.unit?' '+kn.unit:''}`,x+5*dpr,y-3*dpr,TOK.accent,'left','bottom');});}
  let off=0;const dot=(s,col,r,ring)=>{if(!inV(s)){off++;return;}c.beginPath();c.arc(A.X(s[0]),A.Y(s[1]),r,0,TAU);if(ring){c.strokeStyle=col;c.lineWidth=2*dpr;c.stroke();}else{c.fillStyle=col;c.fill();c.strokeStyle=TOK['map-bg'];c.lineWidth=1.5*dpr;c.stroke();}};
  for(const s of R.poles)dot(s,s[0]>0?TOK.bad:TOK.ink,5.5*dpr);
  if(wi){c.setLineDash([3*dpr,2*dpr]);dot(wi.tg,TOK.accent,9*dpr,true);c.setLineDash([]);for(const s of wi.ps)if(inV(s))dot(s,TOK.accent,4.5*dpr);}
  label(G,`● now${wi?'  ● what-if  ◌ dragged':''}${kn?'  — this tracker\'s knob':''}${off?`  · ${off} fast pole${off>1?'s':''} off the plot`:''}`,L,h-2*dpr,TOK.muted,'left','bottom');
  label(G,'← dies out faster',L+4*dpr,A.Y(0)+3*dpr,TOK.muted,'left','top');label(G,'swings faster ↑',A.X(0)-4*dpr,top+3*dpr,TOK.muted,'right','top');
}
function pzEvent(e){const m=PZ.map,cv=$('#cv-pz');if(!m||!cv)return null;const r=cv.getBoundingClientRect(),px=e.clientX-r.left,py=e.clientY-r.top;
  const sx=m.xr[0]+(px-m.x0)/(m.x1-m.x0)*(m.xr[1]-m.xr[0]),sy=m.yr[1]-(py-m.y0)/(m.y1-m.y0)*(m.yr[1]-m.yr[0]);return[Math.min(sx,-1e-3),Math.abs(sy)];}
function anWhatIfAt(tg){const R=AN.res;if(!R||R.loop==='spd'||R.M.kind==='none')return;if(R.knob===undefined)R.knob=anKnobCurve(R);
  const r=anWhatIf(R,tg);if(r){AN.wi=r;renderAnalysis();}}
{const cv=$('#cv-pz');if(cv){cv.tabIndex=0;
  cv.addEventListener('pointerdown',e=>{const t=pzEvent(e);if(!t)return;e.preventDefault();PZ.drag=true;cv.setPointerCapture(e.pointerId);anWhatIfAt(t);});
  cv.addEventListener('pointermove',e=>{if(!PZ.drag)return;const t=pzEvent(e);if(!t)return;cancelAnimationFrame(PZ.raf);PZ.raf=requestAnimationFrame(()=>anWhatIfAt(t));});
  const end=()=>{if(!PZ.drag)return;PZ.drag=false;renderAnalysis();};cv.addEventListener('pointerup',end);cv.addEventListener('pointercancel',end);
  cv.addEventListener('keydown',e=>{const R=AN.res;if(!R||!R.dom)return;const k={ArrowLeft:[1.1,1],ArrowRight:[1/1.1,1],ArrowUp:[1,1.1],ArrowDown:[1,1/1.1]}[e.key];if(!k)return;e.preventDefault();
    const b=AN.wi?AN.wi.tg:R.dom;anWhatIfAt([b[0]*k[0],Math.max(0.05,b[1])*k[1]]);});}}
$('#an-wi-x').onclick=()=>{AN.wi=null;renderAnalysis();};

/* ---------- the loop in plain words, with the gains in physical units ---------- */
const d10=10*Math.PI/180;
function gainWords(M,Ke,Kth){   // what the controller does for a 10 cm offset and a 10° heading error
  const car=M.car,u=car?'steers':'turns';const f=v=>`${fmt(Math.abs(v)*180/Math.PI,1)}°${car?'':'/s'}`;
  return`<b>${u} ${f(Ke*0.1)}</b> back toward the path for every <b>10 cm</b> of sideways offset, and <b>${f(Kth*d10)}</b> for every <b>10°</b> the heading points away from the path`;
}
function anStory(R){
  const M=R.M,v=M.v0,ctlN=CTL_NAMES[anCtl()]||P.ctl,car=M.car,cm=Math.round(AN.stepAmp*100);
  const where=anR()?`a left turn of radius <b>${anR()} m</b>`:'a <b>straight path</b>';
  let h=`<p><b>The situation.</b> The ${car?'car':'robot'} drives ${where} at <b>${fmt(v)} m/s</b> (the cruise speed). Something pushes it <b>${cm} cm</b> to the side. How does <b>${ctlN}</b> steer it back, and how robust is that? Everything below comes from a linear model of this situation (small errors), and <i>Run step test</i> checks it against the full simulator.</p>`;
  let ctl;
  if(M.kind==='static'){ctl=`it ${gainWords(M,M.Ke,M.Kth)}.`;
    if(M.ctl==='pp'){const Ld=Math.max(0.1,P.ppL0+P.ppK*v);ctl+=` Both numbers come from one knob, the lookahead L<sub>d</sub> = ${fmt(Ld)} m (L₀ + k·v): the offset gain is 2v/L<sub>d</sub>², the heading gain 2v/L<sub>d</sub>. So pure pursuit's damping is fixed (ζ ≈ 0.71) and L<sub>d</sub> only sets how fast.`;}
    else if(M.ctl==='rwf')ctl+=` The two settings act separately: k<sub>e</sub> = ${fmt(P.rwKe,1)} is the spring (offset), k<sub>θ</sub> = ${fmt(P.rwKth,1)} the damper (heading).`;
    else if(M.ctl==='stanley')ctl+=` It steers the front wheels to the path heading plus atan(k·e/v), k = ${fmt(P.stanK,1)}.`;}
  else if(M.kind==='pid'){const Ld=M.Ld;ctl=`it aims at a point L<sub>d</sub> = ${fmt(Ld)} m ahead on the path: the angle to it is α ≈ −e/L<sub>d</sub> − θₑ, and the command is K<sub>p</sub>α + K<sub>i</sub>∫α + K<sub>d</sub>α̇ with K<sub>p</sub> ${fmt(P.kp,1)}, K<sub>i</sub> ${fmt(P.ki,2)}, K<sub>d</sub> ${fmt(P.kd,2)}. The proportional part alone ${gainWords(M,P.kp/Ld,P.kp)}.`;}
  else{const K=M.K,f=x=>fmt(Math.abs(x)*180/Math.PI,0);ctl=`MPC replans every tick, but near this situation it acts like a feedback on the <i>rate</i> of ${car?'steering':'turning'}: it changes the ${car?'steering angle':'turn rate'} by about <b>${f(K.e*0.1)}°/s${car?'':'²'}</b> for every 10 cm of offset and <b>${f(K.th*d10)}°/s${car?'':'²'}</b> for every 10° of heading error, and backs off in proportion to the ${car?'steering':'turning'} it already has (gains read from the MPC by finite differences).`;}
  const sw=v*Math.sin(d10)*100,Td=M.Td*1000;
  h+=`<p><b>The controller</b> (${ctlN}): ${ctl}</p>`;
  h+=`<p><b>The vehicle.</b> ${car?`The heading turns at v·tan δ / L = ${fmt(v/P.wheelbase,2)} rad/s per radian of steering (wheelbase ${fmt(P.wheelbase,2)} m)`:'The heading turns at the commanded rate'}; pointing 10° away from the path at ${fmt(v)} m/s drifts it sideways at <b>${fmt(sw,0)} cm/s</b>. So offset builds up from heading error, and heading from steering: two integrations, which is why the loop can overshoot.</p>`;
  h+=`<p><b>Delays.</b> The ${car?'wheels':'motors'} act on a measurement about <b>${fmt(Td,0)} ms</b> old (half of the 50 ms control tick${M.nL?` plus ${fmt(M.nL*DT*1000,0)} ms of latency`:''})${M.tau>0?`, and the actuator follows its command with a lag τ = ${fmt(M.tau,2)} s`:''}. Delay is what eventually makes a fast controller oscillate.</p>`;
  return h;
}
function anKeyChips(R){
  const M=R.M,so=R.smOff,sb=R.smBias,bu=biasUnit(),ms=AN.meas.step,F=R.F,cm=AN.stepAmp*100,v=M.v0;
  const sim=ms&&ms.kind==='offset'?stepMetrics(ms.data,'offset'):null;
  if(!R.stable)return chip('Comes back to the path?','no: the swing grows','badc','The linear loop is unstable; in the simulator the steering limits usually turn this into a sustained weave')+
    chip('Unstable modes',String(R.unstableZ),'badc','Closed-loop poles in the right half plane (red region of the pole plot)');
  return chip('Comes back to the path?','yes','good','All closed-loop poles are in the stable (left) half')+
    chip('Back within 2 %',`${fmt(so.settle,1)} s · ${fmt(so.settle*v,1)} m driven${sim?` (sim ${fmt(sim.settle,1)} s)`:''}`,'','Time, and distance along the path, until the offset stays within 2 % of where it started')+
    chip('Overshoot',so.overshoot<0.5?'none':`${fmt(so.overshoot,0)} % · crosses the path by ${fmt(so.overshoot/100*cm,1)} cm${sim?` (sim ${fmt(sim.overshoot,0)} %)`:''}`,so.overshoot>25?'warnc':'','How far it swings past the path, for this starting offset')+
    chip('Extra delay it tolerates',F.dm!=null?fmt(F.dm*1000,0)+' ms':'—',F.dm!=null?(F.dm>0.1?'good':F.dm>0.03?'warnc':'badc'):'','Add this much more latency between sensing and steering and the loop starts to oscillate forever (delay margin = phase margin / crossover)')+
    chip(`Left over from a ${bu.val} ${bu.unit} ${isCar()?'misalignment':'turn bias'}`,`${fmt(Math.abs(sb.final*bu.toModel(bu.val))*100,1)} cm`,Math.abs(sb.final*bu.toModel(bu.val))<0.005?'good':'','A constant actuator error leaves a steady sideways offset unless the controller has integral action')+
    (anR()?chip('Offset on the curve',fmt((M.ess||0)*100,1)+' cm',Math.abs(M.ess||0)<0.03?'good':'warnc','Steady offset in the turn: positive = inside (cutting)'):'');
}
function anPzCaption(R){
  const wi=AN.wi,v=R.M.v0;
  const modeTxt=s=>{if(!s)return'—';const sig=-s[0],om=Math.abs(s[1]);return`dies out with time constant <b>${sig>1e-6?fmt(1/sig,2)+' s':'∞'}</b>${om>0.02?`, swings once every <b>${fmt(2*Math.PI/om,1)} s</b> (${fmt(2*Math.PI/om*v,1)} m)`:', no swing'}`;};
  let h=`<p>Each pole is one way the error can move, <i>e</i><sup>st</sup>. Further <b>left</b> = it dies out faster; further from the axis (<b>up</b>) = it swings faster; a pole in the red half grows. Now the slowest pair ${modeTxt(R.dom)}${R.zeta!=null?` (damping ζ ${fmt(R.zeta,2)})`:''}.</p>`;
  if(!wi)h+=`<p class="an-hint">${R.knob?`${CTL_NAMES[R.M.ctl]} has one knob, so its poles can only move along the blue curve. Drag a pole along it`:R.M.kind==='static'?'Drag a pole anywhere: the two gains that put it there are computed for you':'Drag a pole to try a design: the what-if is a state-feedback tracker (rear-wheel feedback) with the gains that put the pole there'}; the response on the left updates. Keyboard: focus the plot and use the arrow keys.</p>`;
  else{const ap=wi.set;h+=`<p><b>What-if:</b> ${wi.unstable?'<b class="bad">unstable</b>':modeTxt(wi.dom)}${wi.unstable?'':`, overshoot ${fmt(wi.sm.overshoot,0)} %, back within 2 % after ${fmt(wi.sm.settle*v,1)} m`}. ${wi.knob?'':`The controller would ${gainWords(R.M,wi.Ke,wi.Kth)}.`}${wi.err!=null&&wi.err>0.05*Math.hypot(wi.tg[0],wi.tg[1])?' The delay keeps the pole from landing exactly where you dragged it.':''}</p>
    <p><button type="button" class="btn small" id="an-wi-apply">${ap.ctl&&ap.ctl!==P.ctl?'Switch to rear-wheel feedback with ':'Apply '}${wi.setTxt.replace('k_e','k<sub>e</sub>').replace('k_θ','k<sub>θ</sub>')}</button>${wi.clamped?' <span class="note">(clamped to the slider range)</span>':''}</p>`;}
  return h;
}
function anApplyWhatIf(){const wi=AN.wi;if(!wi)return;const set=wi.set;AN.wi=null;
  if(set.ctl&&set.ctl!==P.ctl)setParam('ctl',set.ctl,false);for(const[k,v]of Object.entries(set))if(k!=='ctl')setParam(k,v,false);
  logE(`Analyze: applied ${wi.setTxt}${set.ctl&&set.ctl!=='rwf'?'':''}`);renderAllPanes();anInvalidate();renderAnalysis();}
function anTF(R){
  const M=R.M,g=M.g,v=M.v0,lag=M.tau>0?` · 1/(${fmt(M.tau,2)}s + 1)`:'',dl=`e<sup>−${fmt(M.Td,3)}s</sup>`;
  let h='<p><b>Transfer function.</b> ';
  if(M.kind==='static'){const a=g*M.Kth,b=g*v*M.Ke,wn=Math.sqrt(Math.max(0,b)),z=wn>0?a/(2*wn):0;
    h+=`Open loop from the ${M.car?'steering':'turn-rate'} command around to itself: L(s) = (g K<sub>θ</sub> s + g v₀ K<sub>e</sub>) / s² · e<sup>−sT<sub>d</sub></sup>${M.tau>0?' · 1/(τs+1)':''}, with g = ${M.car?`v₀/L = ${fmt(g,2)} 1/s`:'1'}, K<sub>e</sub> = ${fmt(M.Ke,2)}, K<sub>θ</sub> = ${fmt(M.Kth,2)}:</p><div class="eq">L(s) = (${fmt(a,2)} s + ${fmt(b,2)}) / s² · ${dl}${lag}</div>
      <p>Without the delay the closed loop is s² + ${fmt(a,2)} s + ${fmt(b,2)} = 0, so ω<sub>n</sub> = √(g v₀ K<sub>e</sub>) = ${fmt(wn,2)} rad/s and ζ = g K<sub>θ</sub> / (2ω<sub>n</sub>) = ${fmt(z,2)}; the exact 20 Hz loop with the delay gives ω<sub>n</sub> ${fmt(R.wn,2)}, ζ ${fmt(R.zeta,2)}. Units: s in 1/s, K<sub>e</sub> in ${M.car?'rad':'rad/s'} per m, K<sub>θ</sub> in ${M.car?'rad':'rad/s'} per rad.</p>`;}
  else if(M.kind==='pid')h+=`L(s) = C(z) · (g v₀/L<sub>d</sub> + g s) / s² · ${dl}${lag}, with the 20 Hz PID C(z) = K<sub>p</sub> + K<sub>i</sub>T/(1 − z⁻¹) + K<sub>d</sub>(1 − z⁻¹)/T, z = e<sup>sT</sup>, L<sub>d</sub> = ${fmt(M.Ld,2)} m.</p>`;
  else h+=`L(s) = T/(1 − z⁻¹) · 1/(1 − K<sub>u</sub>z⁻¹) · [K<sub>c</sub>z⁻¹ + (K<sub>s</sub>z⁻¹ + (K<sub>e</sub> g v₀ + K<sub>θ</sub> g s)/s² · ${dl})${lag}], with K<sub>e</sub> ${fmt(M.K.e,2)}, K<sub>θ</sub> ${fmt(M.K.th,2)}, K<sub>s</sub> ${fmt(M.K.s,2)}, K<sub>c</sub> ${fmt(M.K.c||0,2)}, K<sub>u</sub> ${fmt(M.K.u,2)} read from the MPC.</p>`;
  return h;
}
function anAdvChips(R){
  const F=R.F,pmC=F.pm==null?'':F.pm>45?'good':F.pm>25?'warnc':'badc',gmC=F.gm==null?'good':F.gm>6?'good':F.gm>0?'warnc':'badc';
  return chip('Closed loop',R.stable?'stable':`unstable (${R.unstableZ} pole${R.unstableZ>1?'s':''})`,R.stable?'good':'badc','From the eigenvalues of the exact 20 Hz loop; the Nyquist count must agree')+
    chip('Phase margin',F.pm==null?'—':fmt(F.pm,0)+'°',pmC,'180° + ∠L at the gain crossover')+
    chip('Gain margin',F.gm==null?'∞':fmt(F.gm,1)+' dB'+(F.gm!=null?` (×${fmt(Math.pow(10,F.gm/20),1)})`:''),gmC,'How much the loop gain can grow before instability')+
    chip('Crossover ω<sub>c</sub>',F.wc?fmt(F.wc)+' rad/s':'—','','|L(jω_c)| = 1; roughly the closed-loop bandwidth')+
    chip('Delay margin',F.dm!=null?fmt(F.dm*1000,0)+' ms':'—',F.dm!=null?(F.dm>0.1?'good':F.dm>0.03?'warnc':'badc'):'','Extra latency the loop tolerates: PM / ω_c')+
    chip('M<sub>s</sub>',fmt(F.ms,2),F.ms<1.6?'good':F.ms<2.2?'warnc':'badc','Peak sensitivity = 1 / closest distance from L to −1')+
    chip('Dominant poles',R.zeta!=null?`ζ ${fmt(R.zeta,2)} · ω<sub>n</sub> ${fmt(R.wn,2)}`:'—','','Slowest closed-loop pole pair');
}
function renderAnalysis(){
  const view=$('#anview');if(!view||AN.mode!=='an')return;readTokens();
  const estL=$('#an-est-l');if(estL)estL.hidden=P.loc==='truth'||P.loc==='custom';
  if(AN.loop==='spd')return renderSpeed();
  if(AN.dirty||!AN.res){anCompute();AN.dirty=false;AN.wi=null;}
  const R=AN.res,M=R.M,ctlN=CTL_NAMES[anCtl()]||P.ctl;
  $('#an-op').innerHTML=`<b>${isCar()?'Car-like':'Diff-drive'} · ${ctlN}</b> · ${anR()?`left turn R ${anR()} m`:'straight path'} at ${fmt(M.v0)} m/s · settings come from the Control and Vehicle tabs`;
  if(M.kind==='none'){$('#an-body').hidden=true;$('#an-none').hidden=false;
    $('#an-none').innerHTML=`<p><b>${ctlN}</b> has no linear model to analyze. ${P.ctl==='dwa'?'DWA picks the best of a grid of sampled commands, so its output is piecewise constant in the state and has no meaningful derivative.':'Your code runs as a black box in a worker.'} Pick pure pursuit, rear-wheel feedback, Stanley (car), PID or MPC in the Control tab.</p>`;return;}
  $('#an-body').hidden=false;$('#an-none').hidden=true;
  if(R.knob===undefined)R.knob=anKnobCurve(R);
  $('#an-story').innerHTML=anStory(R);
  $('#an-key').innerHTML=anKeyChips(R);
  $('#cap-step-t').textContent=AN.stepKind==='offset'?'Response: back to the path':'Response: a constant actuator error';
  $('#cap-step').innerHTML=AN.stepKind==='offset'?`Seen from above: the ${isCar()?'car':'robot'} starts ${fmt(AN.stepAmp*100,0)} cm to the side of the path (the blue line) and drives right; the curve is its sideways offset, the green band ±2 %. Time is on the top axis.`
    :`A ${biasUnit().val} ${biasUnit().unit} ${isCar()?'steering misalignment':'turn-rate bias'} appears at the start; without integral action the ${isCar()?'car':'robot'} settles to the side of the path.`;
  $('#fig-pz').hidden=false;$('#cap-pz').innerHTML=anPzCaption(R);$('#an-wi-x').hidden=!AN.wi;
  const ap=$('#an-wi-apply');if(ap)ap.onclick=anApplyWhatIf;
  const ms=AN.meas.step;
  $('#an-msg').textContent=AN.msg+(ms&&ms.satT>0?` The steering-rate limit was active for ${fmt(ms.satT,2)} s of the test${ms.satT>0.3?', so the response departs from the linear prediction':''}.`:'')+(ms&&ms.coll?' The robot collided during the test.':'');
  $('#an-step').disabled=AN.busy;$('#an-inj').disabled=AN.busy;$('#an-inj').hidden=false;$('#an-inja').hidden=false;$('#an-amp').hidden=false;$('#an-kind').hidden=false;$('#an-cl').hidden=false;
  drawStep(R);drawPoles(R);
  const adv=$('#an-adv');if(adv&&adv.open!==!!AN.adv)adv.open=!!AN.adv;
  if(AN.adv){$('#an-diagram').innerHTML=blockDiagram(R);$('#an-tf').innerHTML=anTF(R);$('#an-chips').innerHTML=anAdvChips(R);
    for(const id of['cv-nyq','cv-loc'])$('#'+id).parentNode.hidden=false;drawBode(R);drawNyq(R);drawLocus(R);}
}
function renderSpeed(){
  if(AN.dirty||!AN.resSpd){spdCompute();AN.dirty=false;}
  const R=AN.resSpd,M=R.M,ctlN=CTL_NAMES[anCtl()]||P.ctl,ms=AN.meas.spd;
  $('#an-op').innerHTML=`<b>${isCar()?'Car-like':'Diff-drive'} · ${ctlN}</b> · speed loop at ${fmt(M.v0)} m/s`;
  if(M.kind==='none'){$('#an-body').hidden=true;$('#an-none').hidden=false;$('#an-none').innerHTML=`<p><b>${ctlN}</b> runs as a black box. Pick a built-in tracker.</p>`;return;}
  $('#an-body').hidden=false;$('#an-none').hidden=true;
  const mpc=M.kind==='mpc',sm=R.smOff,msm=ms?spdMetrics(ms.data):null,amp=AN.spdAmp||0.2;
  $('#an-story').innerHTML=`<p><b>The situation.</b> The ${isCar()?'car':'robot'} cruises at <b>${fmt(M.v0)} m/s</b> and the reference speed steps up by <b>${fmt(amp)} m/s</b>. How quickly does the real speed follow?</p>
    <p>${mpc?`<b>MPC closes a speed loop</b>: it changes the acceleration by about ${fmt(M.K.v,2)} m/s² for every m/s of speed error, so the speed is fed back.`:`<b>${ctlN} does not feed speed back</b>: it commands the speed from the profile and nothing corrects the actual speed. The response is just the actuator.`} ${M.tau>0?`The actuator follows with a lag τ = ${fmt(M.tau,2)} s (63 % of a step after τ)`:'There is no actuator lag'}${M.nL?`, after ${fmt(M.nL*DT*1000,0)} ms of latency`:''}${P.accel?`; the acceleration limit of ${fmt(P.amax)} m/s² is not in the linear model (a ${fmt(amp)} m/s step takes at least ${fmt(amp/P.amax,2)} s)`:''}.</p>`;
  $('#an-key').innerHTML=chip('Rise 10–90 %',sm.rise!=null?fmt(sm.rise,2)+' s'+(msm&&msm.rise!=null?` (sim ${fmt(msm.rise,2)} s)`:''):'—','','Time from 10 % to 90 % of the step')+
    chip('Settled within 2 %',fmt(sm.settle,2)+' s'+(msm?` (sim ${fmt(msm.settle,2)} s)`:''),'','')+chip('Overshoot',fmt(sm.overshoot,0)+' %'+(msm?` (sim ${fmt(msm.overshoot,0)} %)`:''),'','')+
    (mpc?chip('Speed loop',R.stable?'stable':`unstable (${R.unstableZ})`,R.stable?'good':'badc',''):chip('Speed feedback','none (feedforward)','',''));
  $('#cap-step-t').textContent='Response: speed after a step in the reference';
  $('#cap-step').innerHTML='Speed change as a fraction of the step (1 = the new reference). Dashed amber: measured in the simulator with Run step test.';
  $('#fig-pz').hidden=true;$('#an-wi-x').hidden=true;
  $('#an-msg').textContent=AN.msg+(ms&&ms.satT>0.1?` The acceleration limit was active for ${fmt(ms.satT,2)} s of the test, which the linear model does not include.`:'');
  $('#an-step').disabled=AN.busy;$('#an-inj').hidden=true;$('#an-inja').hidden=true;$('#an-amp').hidden=true;$('#an-kind').hidden=true;$('#an-cl').hidden=true;
  drawStep(R);
  const adv=$('#an-adv');if(adv&&adv.open!==!!AN.adv)adv.open=!!AN.adv;
  if(AN.adv){$('#an-diagram').innerHTML=speedDiagram(R);$('#an-tf').innerHTML='';
    $('#an-chips').innerHTML=mpc?(()=>{const F=R.F,pmC=F.pm==null?'':F.pm>45?'good':F.pm>25?'warnc':'badc';return chip('Phase margin',F.pm==null?'—':fmt(F.pm,0)+'°',pmC,'')+chip('Gain margin',F.gm==null?'∞':fmt(F.gm,1)+' dB','','')+chip('Crossover ω<sub>c</sub>',F.wc?fmt(F.wc)+' rad/s':'—','','')+chip('Delay margin',F.dm!=null?fmt(F.dm*1000,0)+' ms':'—','','')+chip('M<sub>s</sub>',fmt(F.ms,2),F.ms<1.6?'good':F.ms<2.2?'warnc':'badc','')+chip('Gains',`K<sub>v</sub> ${fmt(M.K.v,2)}${M.lagModel?` · K<sub>vc</sub> ${fmt(M.K.vc,2)}`:''} · K<sub>u</sub> ${fmt(M.K.u,2)}`,'','Read from the MPC by finite differences');})()
      :chip('Bandwidth of G',R.bw?fmt(R.bw,2)+' rad/s':'—','','Where the command-to-speed gain drops 3 dB')+chip('Time constant',M.tau>0?fmt(M.tau,2)+' s':'0 s','','First-order actuator lag τ')+chip('Latency',fmt(M.nL*DT*1000,0)+' ms','','Whole ticks between command and actuator');
    $('#cv-nyq').parentNode.hidden=!mpc;$('#cv-loc').parentNode.hidden=!mpc;drawBode(R);if(mpc){drawNyq(R);drawLocus(R);}}
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
function anInvalidate(keepMeas){AN.dirty=true;AN.wi=null;AN.resSpd=null;if(!keepMeas){AN.meas={step:null,freq:null,spd:null};AN.msg='';}chapterLiveSoon();
  if(AN.mode==='an'){clearTimeout(anTimer);anTimer=setTimeout(renderAnalysis,90);}}
function setMode(m){AN.mode=m;$('#simview').hidden=m!=='sim';$('#anview').hidden=m!=='an';
  if(uiMode!=='learn')uiMode=m;syncModeUI();
  if(m==='an'){running=false;AN.dirty=true;renderAnalysis();}else{draw();drawPlot();refreshAll();}}
