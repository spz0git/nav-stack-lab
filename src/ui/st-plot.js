
/* ---------- ST graph (telemetry) ---------- */
function drawST(){
  const dpr=sizeCanvas(pv),w=pv.width,h=pv.height,A=S.agents,c=pctx;
  c.setTransform(1,0,0,1,0,0);c.fillStyle=TOK['map-bg'];c.fillRect(0,0,w,h);
  c.font=`${Math.round(10*dpr)}px ${getComputedStyle(document.body).getPropertyValue('--f-mono')||'monospace'}`;
  const msg=t=>{c.fillStyle=TOK.muted;c.textAlign='center';c.textBaseline='middle';c.fillText(t,w/2,h/2);};
  if(!agOn())return msg('Agent tracking is off (Perceive tab)');
  const st=A&&A.st;if(!st)return msg(S.track?'No speed plan yet':'No active path');
  const padL=44*dpr,padR=8*dpr,padT=10*dpr,padB=18*dpr,Tm=st.nt*st.dt,sTop=Math.max(1,Math.min(st.sMax,(st.free[st.nt][1]||1)*1.25+0.5));
  const X=t=>padL+t/Tm*(w-padL-padR),Y=s=>h-padB-s/sTop*(h-padT-padB);
  c.strokeStyle=TOK.line;c.lineWidth=1;c.strokeRect(padL+.5,padT+.5,w-padL-padR,h-padT-padB);
  const cw=X(st.dt)-X(0),chh=Y(0)-Y(st.ds);
  for(let k=1;k<=st.nt;k++)for(let j=0;j<st.ns;j++){const i=k*st.ns+j,s=j*st.ds;if(s>sTop)break;
    if(st.occ[i]){c.fillStyle=rgba(TOK.warn,0.6);c.fillRect(X((k-0.5)*st.dt),Y(s+st.ds/2),cw+1,chh+1);}
    else if(st.prox[i]>0){c.fillStyle=rgba(TOK.warn,0.22*st.prox[i]);c.fillRect(X((k-0.5)*st.dt),Y(s+st.ds/2),cw+0.5,chh+0.5);}}
  c.fillStyle=TOK.muted;c.textAlign='right';c.textBaseline='middle';
  for(const s of[0,sTop/2,sTop])c.fillText(s.toFixed(1),padL-6*dpr,Y(s));
  c.strokeStyle=TOK.muted;c.beginPath();for(let t=1;t<Tm-1e-6;t+=1){c.moveTo(X(t),h-padB);c.lineTo(X(t),h-padB-4*dpr);}c.stroke();
  const line=(pts,col,dash,lw)=>{c.strokeStyle=col;c.lineWidth=lw*dpr;c.setLineDash(dash.map(v=>v*dpr));c.beginPath();pts.forEach((p,i)=>{const x=X(p[0]),y=Y(Math.min(p[1],sTop*1.02));i?c.lineTo(x,y):c.moveTo(x,y);});c.stroke();c.setLineDash([]);};
  line(st.free,rgba(TOK.muted,0.9),[4,3],1.2);
  let lbl='speed plan',col=TOK.accent;
  if(A.egoPath&&S.track){const{pts,dt}=A.egoPath,T=S.track,s0=project(S.est.x,S.est.y,true).s,q=[];
    for(let i=0;i<pts.length;i++){const p=project(pts[i][0],pts[i][1],true);q.push([i*dt,Math.max(0,p.s-s0)]);}
    line(q.filter(p=>p[0]<=Tm+1e-6),TOK.ok,[],2);lbl=A.egoPath.src;col=TOK.ok;}
  else if(st.prof)line(st.prof,stActive()?TOK.accent:rgba(TOK.accent,0.5),stActive()?[]:[3,3],2);
  c.textAlign='left';c.textBaseline='bottom';c.fillStyle=TOK.muted;c.fillText(`ST graph · s [m] ahead on the path vs t, 0–${Tm.toFixed(0)} s (ticks 1 s)`,padL+4*dpr,h-2*dpr);
  c.textBaseline='top';const lx=padL+6*dpr;
  c.fillStyle=col;c.fillText(stActive()||A.egoPath?lbl:'speed plan (not applied: tracker set to '+({none:'Ignore',stop:'Reactive stop'}[P.spd]||'—')+')',lx,padT+3*dpr);
  c.fillStyle=TOK.muted;c.fillText('- - without agents',lx,padT+15*dpr);c.fillStyle=TOK.warn;c.fillText('■ predicted agents (+ clearance)',lx,padT+27*dpr);
  if(st.conflict&&stActive()){c.fillStyle=TOK.bad;c.fillText(`conflict at ${st.conflict.toFixed(1)} s: no profile avoids the agents`,lx,padT+39*dpr);}
}
