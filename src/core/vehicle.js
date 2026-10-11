
/* ============================================================
   Vehicle: actuator + unicycle integration
   ============================================================ */
function actuate(){
  const r=S.robot,c=S.cmd;
  let vt=clamp(c.v,-0.5*P.vmax,P.vmax),wt;
  if(isCar()){
    // bicycle: command (v, δ) → lag → accel limit → steering-rate limit → ω = v tanδ / L
    const dm=steerMax();let st=clamp(c.steer||0,-dm,dm);
    if(P.lag>0){const a=1-Math.exp(-DT/P.lag);vt=r.v+(vt-r.v)*a;st=r.d+(st-r.d)*a;}
    if(P.accel)vt=clamp(vt,r.v-P.amax*DT,r.v+P.amax*DT);
    r.d=clamp(st,r.d-P.steerRate*DT,r.d+P.steerRate*DT);
    wt=vt*Math.tan(r.d+(P.biasDeg||0)*Math.PI/180)/P.wheelbase;   // misalignment: the wheels sit biasDeg off what the encoder reads
  }else{
    const wa=r.wa??r.w;   // actuator state (turn rate the motors are trying to produce)
    wt=clamp(c.w,-P.wmax,P.wmax);
    if(P.lag>0){const a=1-Math.exp(-DT/P.lag);vt=r.v+(vt-r.v)*a;wt=wa+(wt-wa)*a;}
    if(P.accel){vt=clamp(vt,r.v-P.amax*DT,r.v+P.amax*DT);wt=clamp(wt,wa-P.alpha*DT,wa+P.alpha*DT);}
    r.wa=wt;wt+=P.biasW||0;   // bias: e.g. one weaker motor
  }
  const n=integ(r.x,r.y,r.th,vt,wt,DT);
  if(bodyHits(n.x,n.y,n.th,S.shapes)){
    if(!isCar())r.th=wrap(r.th+wt*DT); r.v=0; r.w=isCar()?0:wt;
    if(!r.contact&&Math.abs(vt)>0.01){S.coll++;logE('Collision with static obstacle','bad');S.halt=true;}
    r.contact=true;
  }else{
    S.dist+=hyp(n.x-r.x,n.y-r.y); r.x=n.x;r.y=n.y;r.th=n.th;r.v=vt;r.w=wt;
    if(r.contact&&!bodyHits(r.x,r.y,r.th,S.shapes,0.05))r.contact=false;
  }
  let pc=false;if(isCar())pc=S.peds.length>0&&carHits(r.x,r.y,r.th,pedShapes());else for(const c of pedShapes())if(hyp(c.x-r.x,c.y-r.y)<RR+c.r)pc=true;
  if(S.peds.length){let g=Infinity;for(const p of S.peds)g=Math.min(g,bodyGap(r,p));if(g<S.minPed)S.minPed=g;}
  if(pc&&!r.pedContact){S.collPed++;const still=Math.abs(r.v)<0.05;if(still)S.collPedStill=(S.collPedStill||0)+1;logE(still?'A person walked into the stopped robot':'Contact with a person','bad');S.halt=true;}
  r.pedContact=pc;
}

/* ---------- odometry model ---------- */
const sigV=(v,w,k)=>k*(0.1*Math.abs(v)+0.02);
const sigW=(v,w,k)=>k*(0.2*Math.abs(w)+0.1*Math.abs(v)+0.02);
function odometry(){
  const r=S.robot,g=S.rngW,k=P.odoK;
  const vb=r.v*(1+0.02*P.odoB), wb=r.w+0.01*P.odoB*r.v;
  S.odo={v:vb+sigV(r.v,r.w,k)*g.n(), w:wb+sigW(r.v,r.w,k)*g.n()};
}
const assumedK=()=>P.filtK*Math.max(P.odoK,0.25);
const sigR=()=>0.08*Math.max(P.lmK,0.25), sigB=()=>0.03*Math.max(P.lmK,0.25);
