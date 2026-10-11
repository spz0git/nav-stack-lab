rep("if(!F.queue.length)S.track=null;S.plan=null;}","if(!F.queue.length){S.track=null;S.plan=null;}}")

# ---------- controllers ----------
rep("""function ctlPP(){
  const e=S.est,T=S.track,pr=project(e.x,e.y,true);T.idx=Math.max(T.idx,pr.i);
  const Ld=Math.max(0.1,P.ppL0+P.ppK*Math.abs(S.odo.v));
  const c=pointAt(pr.s+Ld),dx=c[0]-e.x,dy=c[1]-e.y,L=Math.max(hyp(dx,dy),1e-3),alpha=wrap(Math.atan2(dy,dx)-e.th);
  S.ctlViz={carrot:c};
  if(Math.abs(alpha)>Math.PI/2)return{v:0,w:Math.sign(alpha)*P.wmax*0.7};""",
"""// Shared preamble. On a reverse leg the controller works in a virtual frame: heading θ+π, forward speed,
// and the steering sign flipped. For the rear-axle reference point this is exact for the bicycle model.
function trackPre(){const e=S.est,T=S.track,pr=project(e.x,e.y,true);T.idx=Math.max(T.idx,pr.i);const dir=T.dir||1;return{e,T,pr,dir,thv:dir>0?e.th:wrap(e.th+Math.PI)};}
function ctlPP(){
  const{e,pr,dir,thv}=trackPre();
  const Ld=Math.max(0.1,P.ppL0+P.ppK*Math.abs(S.odo.v));
  const c=pointAt(pr.s+Ld,isCar()),dx=c[0]-e.x,dy=c[1]-e.y,L=Math.max(hyp(dx,dy),1e-3),alpha=wrap(Math.atan2(dy,dx)-thv);
  S.ctlViz={carrot:c};
  if(isCar()){
    const dm=steerMax(),big=Math.abs(alpha)>Math.PI/2;
    const dv=big?Math.sign(alpha)*dm:clamp(Math.atan(P.wheelbase*2*Math.sin(alpha)/L),-dm,dm);
    const k=Math.abs(Math.tan(dv))/P.wheelbase;
    let v=Math.min(P.vcruise,dir>0?P.vmax:0.5*P.vmax);
    if(k>1e-6)v=Math.min(v,Math.sqrt(P.alat/k));
    v=Math.min(v,decelCap(goalDist(pr)));if(big)v=Math.min(v,0.2);
    return{v:dir*v,steer:dir*dv};
  }
  if(Math.abs(alpha)>Math.PI/2)return{v:0,w:Math.sign(alpha)*P.wmax*0.7};""")
rep("""function ctlPID(){
  const e=S.est,T=S.track,pr=project(e.x,e.y,true);T.idx=Math.max(T.idx,pr.i);
  const Ld=Math.max(0.1,P.ppL0+P.ppK*Math.abs(S.odo.v));
  const c=pointAt(pr.s+Ld),err=wrap(Math.atan2(c[1]-e.y,c[0]-e.x)-e.th),C=S.ctlState;""",
"""function ctlPID(){
  const{e,pr,dir,thv}=trackPre();
  const Ld=Math.max(0.1,P.ppL0+P.ppK*Math.abs(S.odo.v));
  const c=pointAt(pr.s+Ld,isCar()),err=wrap(Math.atan2(c[1]-e.y,c[0]-e.x)-thv),C=S.ctlState;""")
rep("""  const w=clamp(P.kp*err+P.ki*C.I+P.kd*D,-P.wmax,P.wmax);
  let v=Math.min(P.vcruise,P.vmax)*Math.max(0,Math.cos(err))**2;
  v=Math.min(v,decelCap(goalDist(pr)));
  return{v,w};""",
"""  if(isCar()){
    const st=clamp(P.kp*err+P.ki*C.I+P.kd*D,-steerMax(),steerMax());
    let v=Math.min(P.vcruise,dir>0?P.vmax:0.5*P.vmax)*Math.max(0.3,Math.cos(err)**2);
    v=Math.min(v,decelCap(goalDist(pr)));
    return{v:dir*v,steer:dir*st};
  }
  const w=clamp(P.kp*err+P.ki*C.I+P.kd*D,-P.wmax,P.wmax);
  let v=Math.min(P.vcruise,P.vmax)*Math.max(0,Math.cos(err))**2;
  v=Math.min(v,decelCap(goalDist(pr)));
  return{v,w};""")
# Stanley
rep("function ctlDWA(){",
"""// Stanley (Hoffmann et al. 2007): front-axle cross-track + heading error. Forward legs only.
function ctlStanley(){
  if(!isCar()||(S.track.dir||1)<0)return ctlPP();
  const{e,T,pr}=trackPre(),L=P.wheelbase,fx=e.x+L*Math.cos(e.th),fy=e.y+L*Math.sin(e.th),p=T.pts;
  let best=Infinity,bx=fx,by=fy,bth=e.th;
  for(let i=T.idx;i<=Math.min(p.length-2,T.idx+80);i++){const a=p[i],b=p[i+1],vx=b[0]-a[0],vy=b[1]-a[1],l2=vx*vx+vy*vy;if(l2<1e-12)continue;
    let t=((fx-a[0])*vx+(fy-a[1])*vy)/l2;t=i===p.length-2?Math.max(0,t):clamp(t,0,1);
    const qx=a[0]+vx*t,qy=a[1]+vy*t,d=(fx-qx)**2+(fy-qy)**2;if(d<best){best=d;bx=qx;by=qy;bth=Math.atan2(vy,vx);}}
  const eLeft=Math.cos(bth)*(fy-by)-Math.sin(bth)*(fx-bx),dm=steerMax();
  const d=clamp(wrap(bth-e.th)-Math.atan2(P.stanK*eLeft,0.5+Math.abs(S.odo.v)),-dm,dm);
  S.ctlViz={carrot:[bx,by],from:[fx,fy]};
  const k=Math.abs(Math.tan(d))/L;let v=Math.min(P.vcruise,P.vmax);
  if(k>1e-6)v=Math.min(v,Math.sqrt(P.alat/k));
  return{v:Math.min(v,decelCap(goalDist(pr))),steer:d};
}
function ctlDWA(){""")
# DWA: car-aware
rep("""  const e=S.est,T=S.track,pr=project(e.x,e.y,true);T.idx=Math.max(T.idx,pr.i);
  const carrot=pointAt(pr.s+1.6),dg=goalDist(pr);
  const A=P.accel?P.amax:3,AL=P.accel?P.alpha:8,win=0.25,v0=S.odo.v,w0=S.odo.w;
  const vtop=Math.min(P.vcruise,P.vmax,decelCap(dg)+0.05);
  const vlo=Math.max(0,v0-A*win),vhi=Math.max(vlo,Math.min(vtop,v0+A*win));
  const wlo=Math.max(-P.wmax,w0-AL*win),whi=Math.min(P.wmax,w0+AL*win);""",
"""  const{e,pr,dir}=trackPre(),car=isCar();
  const carrot=pointAt(pr.s+1.6,car),dg=goalDist(pr);
  const A=P.accel?P.amax:3,AL=P.accel?P.alpha:8,win=0.25,v0=dir*S.odo.v,w0=S.odo.w;
  const vtop=Math.min(P.vcruise,dir>0?P.vmax:0.5*P.vmax,decelCap(dg)+0.05);
  const vlo=Math.max(0,v0-A*win),vhi=Math.max(vlo,Math.min(vtop,v0+A*win));
  // second sampled input: ω for diff-drive, steering angle δ for the car
  let wlo,whi;if(car){const dm=steerMax(),d0=S.robot.d;wlo=Math.max(-dm,d0-P.steerRate*win);whi=Math.min(dm,d0+P.steerRate*win);}
  else{wlo=Math.max(-P.wmax,w0-AL*win);whi=Math.min(P.wmax,w0+AL*win);}""")
rep("""  for(let a=0;a<NV;a++){const v=vlo+(vhi-vlo)*a/(NV-1);
    for(let b=0;b<NW;b++){const w=wlo+(whi-wlo)*b/(NW-1);
      let x=e.x,y=e.y,th=e.th,clear=Infinity;const tp=[x,y];
      for(let k=0;k<ns;k++){const n=integ(x,y,th,v,w,sdt);x=n.x;y=n.y;th=n.th;if(k%2===1)tp.push(x,y);
        for(const p of pts){const d=hyp(p[0]-x,p[1]-y)-RR;if(d<clear)clear=d;}if(clear<0.05)break;}
      const ok=clear>=0.05&&v<=Math.sqrt(2*A*Math.max(0,clear))+1e-3;
      let cost=Infinity;
      if(ok){const dgoal=hyp(carrot[0]-x,carrot[1]-y),head=Math.abs(wrap(Math.atan2(carrot[1]-y,carrot[0]-x)-th));
        cost=P.dwaG*(dgoal+0.3*head)+P.dwaO*(1/Math.min(Math.max(clear,0.05),3))+P.dwaV*(vtop-v);
        if(!best||cost<best.cost)best={v,w,cost,i:trajs.length};}
      trajs.push({pts:tp,ok});}}
  S.ctlViz={carrot,trajs,best:best?best.i:-1};
  if(!best){const a=wrap(Math.atan2(carrot[1]-e.y,carrot[0]-e.x)-e.th);return{v:0,w:Math.sign(a||1)*Math.min(0.6,P.wmax)};}
  return{v:best.v,w:best.w};""",
"""  for(let a=0;a<NV;a++){const vm=vlo+(vhi-vlo)*a/(NV-1),v=dir*vm;
    for(let b=0;b<NW;b++){const u=wlo+(whi-wlo)*b/(NW-1),w=car?v*Math.tan(u)/P.wheelbase:u;
      let x=e.x,y=e.y,th=e.th,clear=Infinity;const tp=[x,y];
      for(let k=0;k<ns;k++){const n=integ(x,y,th,v,w,sdt);x=n.x;y=n.y;th=n.th;if(k%2===1)tp.push(x,y);
        for(const[cx,cy,cr]of fpCircles(x,y,th))for(const p of pts){const d=hyp(p[0]-cx,p[1]-cy)-cr;if(d<clear)clear=d;}if(clear<0.05)break;}
      const ok=clear>=0.05&&vm<=Math.sqrt(2*A*Math.max(0,clear))+1e-3;
      let cost=Infinity;
      if(ok){const thv=dir>0?th:th+Math.PI,dgoal=hyp(carrot[0]-x,carrot[1]-y),head=Math.abs(wrap(Math.atan2(carrot[1]-y,carrot[0]-x)-thv));
        cost=P.dwaG*(dgoal+0.3*head)+P.dwaO*(1/Math.min(Math.max(clear,0.05),3))+P.dwaV*(vtop-vm);
        if(!best||cost<best.cost)best={v,u,cost,i:trajs.length};}
      trajs.push({pts:tp,ok});}}
  S.ctlViz={carrot,trajs,best:best?best.i:-1};
  if(!best){if(car)return{v:0,steer:S.robot.d};const a=wrap(Math.atan2(carrot[1]-e.y,carrot[0]-e.x)-e.th);return{v:0,w:Math.sign(a||1)*Math.min(0.6,P.wmax)};}
  return car?{v:best.v,steer:best.u}:{v:best.v,w:best.u};""")
rep("if(P.ctl==='pp')return ctlPP(); if(P.ctl==='pid')return ctlPID(); if(P.ctl==='dwa')return ctlDWA();",
    "if(P.ctl==='pp')return ctlPP(); if(P.ctl==='pid')return ctlPID(); if(P.ctl==='dwa')return ctlDWA(); if(P.ctl==='stanley')return ctlStanley();")
rep("""async function advance(n){""","""// Controllers return {v, w} or {v, steer}; convert to what the active vehicle model takes
function normCmd(c){
  const v=isFinite(c.v)?c.v:0;
  if(!isCar())return{v,w:isFinite(c.w)?c.w:0,steer:0};
  let st=c.steer;
  if(st==null||!isFinite(st)){const w=isFinite(c.w)?c.w:0;st=Math.abs(v)<0.05?Math.sign(w)*steerMax():Math.atan(P.wheelbase*w/v);}
  st=clamp(st,-steerMax(),steerMax());
  return{v,steer:st,w:v*Math.tan(st)/P.wheelbase};
}
async function advance(n){""")
rep("      S.cmd=cmd;","      S.cmd=normCmd(cmd);")

# ---------- custom controller ----------
rep("""// Return { v, w } in m/s and rad/s. Add mark: [x, y] to draw a point on the map.
//""","""// Return { v, w } in m/s and rad/s, or { v, steer } (rad) for the car-like model.
// Add mark: [x, y] to draw a point on the map.
//""")
rep("""// obs.pathId                 changes whenever the planner replans""","""// obs.dir                    +1 on a forward leg, -1 on a reverse leg (car paths have cusps)
// obs.vehicle {model, wheelbase, steerMax, steer}   model is 'diff' or 'car'
// obs.pathId                 changes whenever the planner replans or a new leg starts""")
rep("""  // 3. proportional heading control, slow down when misaligned or near the goal
  const a = Math.atan2(c[1] - pose.y, c[0] - pose.x) - pose.th;
  const err = Math.atan2(Math.sin(a), Math.cos(a));
  const dGoal = Math.hypot(goal.x - pose.x, goal.y - pose.y);
  const v = Math.min(0.7, 0.8 * dGoal) * Math.max(0, Math.cos(err));
  const w = 2.0 * err;
  return { v, w, mark: c };""","""  // 3. heading error measured against the direction of travel
  const dir = obs.dir;
  const th = dir > 0 ? pose.th : pose.th + Math.PI;
  const a = Math.atan2(c[1] - pose.y, c[0] - pose.x) - th;
  const err = Math.atan2(Math.sin(a), Math.cos(a));

  // 4. slow down when misaligned or near the end of this leg
  const end = path[path.length - 1];
  const dEnd = Math.hypot(end[0] - pose.x, end[1] - pose.y);
  if (obs.vehicle.model === 'car') {
    const speed = Math.min(0.6, 0.8 * dEnd) * Math.max(0.3, Math.cos(err));
    const Lc = Math.max(0.1, Math.hypot(c[0] - pose.x, c[1] - pose.y));
    const steer = Math.atan(obs.vehicle.wheelbase * 2 * Math.sin(err) / Lc);
    return { v: dir * speed, steer: dir * steer, mark: c };
  }
  const v = Math.min(0.7, 0.8 * dEnd) * Math.max(0, Math.cos(err));
  return { v, w: 2.0 * err, mark: c };""")
rep("self.postMessage({ok:true,v:+r.v||0,w:+r.w||0,mark:","self.postMessage({ok:true,v:+r.v||0,w:+r.w||0,steer:(r.steer==null?null:+r.steer),mark:")
rep("""    limits:{vmax:P.vmax,wmax:P.wmax,accel:P.accel,amax:P.amax,alpha:P.alpha},pathId:S.pathId};""",
"""    limits:{vmax:P.vmax,wmax:P.wmax,accel:P.accel,amax:P.amax,alpha:P.alpha},pathId:S.pathId,dir:S.track.dir||1,
    vehicle:{model:P.model,wheelbase:P.wheelbase,steerMax:steerMax(),steer:S.robot.d}};""")
rep("""  return{v:isFinite(r.v)?r.v:0,w:isFinite(r.w)?r.w:0};
}""","""  return{v:isFinite(r.v)?r.v:0,w:isFinite(r.w)?r.w:0,steer:r.steer};
}""")

# ---------- telemetry recording ----------
rep(",cte,vc:S.cmd.v,va:r.v});",",cte,vc:S.cmd.v,va:r.v,tc:isCar()?deg(S.cmd.steer||0):S.cmd.w,ta:isCar()?deg(r.d):r.w});")

# ---------- rendering ----------
rep("""  // global path
  if(S.track){ctx.strokeStyle=TOK.accent;ctx.lineWidth=px(2.2);polyline(S.track.pts);ctx.stroke();}""",
"""  // global path: forward legs solid, reverse legs dashed, finished legs faded
  if(S.plan){S.plan.segs.forEach((g,i)=>{ctx.globalAlpha=i<S.segIdx?0.3:1;ctx.strokeStyle=g.dir>0?TOK.accent:TOK.warn;ctx.lineWidth=px(i===S.segIdx?2.4:1.6);
    if(g.dir<0)ctx.setLineDash([px(5),px(3)]);polyline(g.pts);ctx.stroke();ctx.setLineDash([]);ctx.globalAlpha=1;});}""")
rep("""    else{const{X,Y,Pa}=S.search;""","""    else if(S.search.type==='hybrid'){const q=S.search.pts,s=px(1.6);ctx.fillStyle=rgba(TOK.accent,0.35);for(let i=0;i<q.length;i+=2)ctx.fillRect(q[i]-s/2,q[i+1]-s/2,s,s);}
    else{const{X,Y,Pa}=S.search;""")
rep("if(S.ctlViz&&S.ctlViz.carrot){const c=S.ctlViz.carrot;ctx.strokeStyle=TOK.accent;ctx.lineWidth=px(1.5);ctx.beginPath();ctx.moveTo(S.est.x,S.est.y);",
    "if(S.ctlViz&&S.ctlViz.carrot){const c=S.ctlViz.carrot,f=S.ctlViz.from||[S.est.x,S.est.y];ctx.strokeStyle=TOK.accent;ctx.lineWidth=px(1.5);ctx.beginPath();ctx.moveTo(f[0],f[1]);")
rep("""    if(w.done&&!w.skipped){ctx.beginPath();ctx.moveTo(w.x-0.15,w.y);ctx.lineTo(w.x-0.03,w.y-0.12);ctx.lineTo(w.x+0.17,w.y+0.13);ctx.stroke();}
  });""","""    if(w.done&&!w.skipped){ctx.beginPath();ctx.moveTo(w.x-0.15,w.y);ctx.lineTo(w.x-0.03,w.y-0.12);ctx.lineTo(w.x+0.17,w.y+0.13);ctx.stroke();}
    if(w.th!=null&&isCar()&&!w.done){ // target pose: ghost body + heading tick
      ctx.save();ctx.setLineDash([px(3),px(3)]);ctx.strokeStyle=active?TOK.ok:rgba(TOK.ink,0.6);ctx.lineWidth=px(1.3);carPath(w.x,w.y,w.th);ctx.stroke();ctx.restore();
      ctx.beginPath();ctx.moveTo(w.x+rw*Math.cos(w.th),w.y+rw*Math.sin(w.th));ctx.lineTo(w.x+(rw+0.35)*Math.cos(w.th),w.y+(rw+0.35)*Math.sin(w.th));ctx.stroke();}
  });
  if(poseDrag){ctx.strokeStyle=TOK.ok;ctx.lineWidth=px(2);ctx.beginPath();ctx.moveTo(poseDrag.x,poseDrag.y);ctx.lineTo(poseDrag.x2,poseDrag.y2);ctx.stroke();
    if(isCar()&&hyp(poseDrag.x2-poseDrag.x,poseDrag.y2-poseDrag.y)>0.3){ctx.setLineDash([px(3),px(3)]);carPath(poseDrag.x,poseDrag.y,Math.atan2(poseDrag.y2-poseDrag.y,poseDrag.x2-poseDrag.x));ctx.stroke();ctx.setLineDash([]);}}""")
rep("""function robotShape(x,y,th,truth,px){
  ctx.beginPath();ctx.arc(x,y,RR,0,TAU);""","""function carPath(x,y,th){const c=Math.cos(th),s=Math.sin(th),a=-CAR.rear,b=P.wheelbase+CAR.front,h=CAR.width/2;ctx.beginPath();
  for(const[u,v]of[[a,-h],[b,-h],[b,h],[a,h]])ctx.lineTo(x+u*c-v*s,y+u*s+v*c);ctx.closePath();}
function carShape(x,y,th,truth,px){
  const c=Math.cos(th),s=Math.sin(th),P2=(u,v)=>[x+u*c-v*s,y+u*s+v*c],h=CAR.width/2;
  carPath(x,y,th);
  if(!truth){ctx.strokeStyle=TOK.accent;ctx.lineWidth=px(2);ctx.setLineDash([px(4),px(2.5)]);ctx.stroke();ctx.setLineDash([]);
    const f=P2(P.wheelbase+CAR.front+0.2,0);ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(f[0],f[1]);ctx.stroke();return;}
  ctx.fillStyle=rgba(TOK.ink,0.88);ctx.fill();
  // wheels: rear fixed, front turned by the actual steering angle
  ctx.strokeStyle=TOK['map-bg'];ctx.lineWidth=px(3);const wl=0.09,wy=h-0.07;
  for(const sg of[-1,1]){const r=P2(0,sg*wy);ctx.beginPath();ctx.moveTo(r[0]-wl*c,r[1]-wl*s);ctx.lineTo(r[0]+wl*c,r[1]+wl*s);ctx.stroke();
    const f=P2(P.wheelbase,sg*wy),cd=Math.cos(th+S.robot.d),sd=Math.sin(th+S.robot.d);ctx.beginPath();ctx.moveTo(f[0]-wl*cd,f[1]-wl*sd);ctx.lineTo(f[0]+wl*cd,f[1]+wl*sd);ctx.stroke();}
  ctx.fillStyle=TOK['map-bg'];ctx.beginPath();ctx.arc(x,y,px(2.5),0,TAU);ctx.fill();
}
function robotShape(x,y,th,truth,px){
  if(isCar())return carShape(x,y,th,truth,px);
  ctx.beginPath();ctx.arc(x,y,RR,0,TAU);""")
rep("""        <span><i style="border-color:var(--accent)"></i>global path</span>""","""        <span><i style="border-color:var(--accent)"></i>global path</span>
        <span><i class="dash" style="border-color:var(--warn)"></i>reverse leg</span>""")

# ---------- plot ----------
rep("const PLOTS={ex:{label:'x error',unit:'m'},eth:{label:'θ error',unit:'°'},cte:{label:'Cross-track',unit:'m'},v:{label:'Speed',unit:'m/s'}};",
    "const PLOTS={ex:{label:'x error',unit:'m'},eth:{label:'θ error',unit:'°'},cte:{label:'Cross-track',unit:'m'},v:{label:'Speed',unit:'m/s'},turn:{label:'Turn rate',unit:'rad/s'}};")
rep("""  else{series=[{k:d=>d.vc,c:TOK.accent,name:'command'},{k:d=>d.va,c:TOK.ink,name:'actual'}];sym=false;}""",
"""  else if(plotCh==='turn'){series=[{k:d=>d.tc,c:TOK.accent},{k:d=>d.ta,c:TOK.ink}];PLOTS.turn=isCar()?{label:'Steering angle',unit:'°'}:{label:'Turn rate',unit:'rad/s'};}
  else{series=[{k:d=>d.vc,c:TOK.accent,name:'command'},{k:d=>d.va,c:TOK.ink,name:'actual'}];sym=false;}""")
rep("if(sym){const m=Math.max(Math.abs(lo),Math.abs(hi),plotCh==='eth'?1:0.05)*1.1;",
    "if(sym){const m=Math.max(Math.abs(lo),Math.abs(hi),plotCh==='eth'?1:plotCh==='turn'?(isCar()?5:0.2):0.05)*1.1;")
rep("if(plotCh==='v'){pctx.textAlign='right';","if(plotCh==='v'||plotCh==='turn'){pctx.textAlign='right';")
rep("seg($('#plotsel'),[['ex','x error'],['eth','θ error'],['cte','Cross-track'],['v','Speed']],",
    "seg($('#plotsel'),[['ex','x error'],['eth','θ error'],['cte','Cross-track'],['v','Speed'],['turn','Steering']],")

# ---------- status & metrics ----------
rep("""   <span class="kv">collisions <b class="${S.coll+S.collPed?'bad':''}">${S.coll+S.collPed}</b></span>`;""",
"""   <span class="kv">collisions <b class="${S.coll+S.collPed?'bad':''}">${S.coll+S.collPed}</b></span>${isCar()?`
   <span class="kv">gear <b>${r.v<-0.01?'R':r.v>0.01?'D':'–'}</b> · steer <b>${deg(r.d).toFixed(0)}°</b></span>`:''}`;""")
rep("['Last plan',ps?`${ps.name} · ${ps.len.toFixed(1)} m · ${ps.ms.toFixed(0)} ms`:'—'],",
    "['Last plan',ps?`${ps.name} · ${ps.len.toFixed(1)} m${ps.extra?' · '+ps.extra:''} · ${ps.ms.toFixed(0)} ms`:'—'],")
