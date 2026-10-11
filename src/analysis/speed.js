/* ---------- the speed (longitudinal) loop ----------
   Path trackers command speed from a profile: there is no speed feedback, so the loop is open and the
   interesting object is the plant G(z) from commanded to actual speed (latency, actuator lag). The MPC
   closes a loop on speed error through its rate input a: that loop gets margins like the lateral one. */
function spdGains(v0){
  const car=isCar(),h=1e-3,B=makeBench(v0,0,0);
  return inBench(B,()=>{
    const out=(dv,dvc,up)=>{B.robot.y=0;B.robot.th=0;B.robot.v=v0+dv;B.robot.d=0;B.robot.w=0;B.est={x:0,y:0,th:0};B.odo={v:v0+dv,w:0};B.cmd={v:v0+dvc,w:0,steer:0};
      const it=P.mpcIt;P.mpcIt=25;const last=()=>{B.mpcCmd={v:v0+dvc,steer:0,w:0,tick:B.tick-1};};
      try{B.mpc=null;last();ctlMPC();if(up){B.mpc.uPrev=[up,0];last();ctlMPC();}}finally{P.mpcIt=it;}return B.mpc.uPrev[0];};
    const d=f=>(f(h)-f(-h))/(2*h);
    return{v:-d(x=>out(x,0,0)),vc:-d(x=>out(0,x,0)),u:d(x=>out(0,0,x))};});
}
function spdBuild(){
  const T=DT,v0=anV0(),tau=P.lag,nL=latN(),ctl=anCtl();
  const M={loop:'spd',ctl,car:isCar(),T,v0,tau,aL:tau>0?1-Math.exp(-T/tau):1,nL,Td:nL*T,kind:'open',g:1};
  if(ctl==='mpc'){M.kind='mpc';M.K=spdGains(v0);M.lagModel=P.mpcLag&&tau>0;if(!M.lagModel)M.K.vc=0;}
  else if(!anSupported()&&ctl!=='dwa')M.kind='none';
  return M;
}
// G: commanded speed → speed (open). L: the MPC's loop, broken at the rate input.
function spdParts(M,s){
  const zi=Cx.exp(Cx.scale(s,-M.T)),one=[1,0],lat=Cx.exp(Cx.scale(s,-M.nL*M.T));
  const lag=M.tau>0?Cx.div([M.aL,0],Cx.sub(one,Cx.scale(zi,1-M.aL))):one,G=Cx.mul(lag,lat);
  if(M.kind!=='mpc')return{L:G,Le:G};
  const K=M.K,integ=Cx.div([M.T,0],Cx.sub(one,zi)),mem=Cx.div(one,Cx.sub(one,Cx.scale(zi,K.u))),pre=Cx.mul(integ,mem);
  const L=Cx.mul(pre,Cx.add(Cx.scale(zi,K.vc),Cx.scale(Cx.mul(G,zi),K.v)));   // the controller sees v and its own command one tick later
  return{L,Le:Cx.mul(pre,Cx.scale(Cx.mul(G,zi),K.v))};
}
// exact discrete loop: states [v, vc, up, q0..q_nL]
function spdLayout(M){const L={v:0,vc:1,up:2};L.q0=3;L.n=3+M.nL+1;return L;}
function spdStep(M,L,X,k,ref){
  const x=X.slice(),T=M.T;
  x[L.v]=x[L.v]+(x[L.q0]-x[L.v])*M.aL;
  for(let j=0;j<M.nL;j++)x[L.q0+j]=x[L.q0+j+1];
  let c;
  if(M.kind==='mpc'){const K=M.K,a=k*(-(K.v*(x[L.v]-ref)+K.vc*(x[L.vc]-ref))+K.u*x[L.up]);x[L.up]=a;c=x[L.vc]+a*T;x[L.vc]=c;}
  else{c=ref;x[L.vc]=c;}
  x[L.q0+M.nL]=c;return x;
}
function spdCompute(){
  const M=spdBuild(),R={M,loop:'spd',noCL:true};if(M.kind==='none'){AN.resSpd=R;return R;}
  const L=spdLayout(M);
  // frequency response of G (open) or L (MPC), with the same bookkeeping as the lateral loop
  const wN=Math.PI/M.T,ws=[];for(let i=0;i<=700;i++)ws.push(Math.pow(10,-2+i*(Math.log10(wN)+2)/700));
  const pts=ws.map(w=>{const Lw=spdParts(M,[0,w]).L;return{w,L:Lw,mag:Cx.abs(Lw),ph:Cx.arg(Lw)};});
  for(let i=0;i<pts.length;i++){if(i){let d=pts[i].ph-pts[i-1].ph;while(d>Math.PI)d-=2*Math.PI;while(d<-Math.PI)d+=2*Math.PI;pts[i].phu=pts[i-1].phu+d;}else pts[i].phu=pts[i].ph;}
  const F={pts,wN,wc:null,pm:null,gm:null,w180:null,ms:0,dm:null,Ncw:0};
  if(M.kind==='mpc'){
    const k0=Math.round((-(Math.PI/2)-pts[0].phu)/(2*Math.PI));pts.forEach(p=>p.phu+=2*Math.PI*k0);
    for(let i=1;i<pts.length;i++){const a=pts[i-1],b=pts[i];
      if((a.mag-1)*(b.mag-1)<=0&&a.mag!==b.mag){const f=Math.log(a.mag)/(Math.log(a.mag)-Math.log(b.mag)),w=a.w*Math.pow(b.w/a.w,f),ph=a.phu+(b.phu-a.phu)*f;const m=((ph*180/Math.PI+180)%360+540)%360-180;if(F.pm==null||m<F.pm){F.pm=m;F.wc=w;}}
      for(let q=-41;q<=1;q+=2){const lv=q*Math.PI;if((a.phu-lv)*(b.phu-lv)<0&&a.w>0.02){const f=(a.phu-lv)/(a.phu-b.phu),w=a.w*Math.pow(b.w/a.w,f),mg=Math.exp(Math.log(a.mag)+(Math.log(b.mag)-Math.log(a.mag))*f),g=-20*Math.log10(mg);if(mg<1&&(F.gm==null||g<F.gm)){F.gm=g;F.w180=w;}}}}
    for(const p of pts){const s=1/Cx.abs(Cx.add([1,0],p.L));if(s>F.ms)F.ms=s;}
    F.dm=(F.pm!=null&&F.wc)?(F.pm*Math.PI/180)/F.wc:null;
    const argAlong=list=>{let tot=0,prev=null;for(const s of list){const a=Cx.arg(Cx.add([1,0],spdParts(M,s).L));if(prev!=null){let d=a-prev;while(d>Math.PI)d-=2*Math.PI;while(d<-Math.PI)d+=2*Math.PI;tot+=d;}prev=a;}return tot;};
    const eps=1e-3,up=[];for(let i=0;i<=3000;i++)up.push([0,Math.pow(10,Math.log10(eps)+i*(5-Math.log10(eps))/3000)]);
    const arc=[];for(let i=0;i<=400;i++){const ph=-Math.PI/2+Math.PI*i/400;arc.push([eps*Math.cos(ph),eps*Math.sin(ph)]);}
    F.Ncw=Math.round(-(2*argAlong(up)+argAlong(arc))/(2*Math.PI));
    const A=[];for(let i=0;i<L.n;i++)A.push(new Array(L.n).fill(0));
    for(let j=0;j<L.n;j++){const X=new Array(L.n).fill(0);X[j]=1;const Y=spdStep(M,L,X,1,0);for(let i=0;i<L.n;i++)A[i][j]=Y[i];}
    const ev=eig(A);R.zs=ev;R.unstableZ=ev.filter(z=>Cx.abs(z)>1+1e-7).length;R.poles=ev.map(z=>zToS(z,M.T)).filter(Boolean);
    let dom=null;for(const s of R.poles){if(s[1]<-1e-9||Math.hypot(s[0],s[1])<1e-6)continue;if(!dom||s[0]>dom[0])dom=s;}R.dom=dom;if(dom){const wn=Math.hypot(dom[0],dom[1]);R.wn=wn;R.zeta=wn>0?-dom[0]/wn:1;}
    R.locus=[];for(let i=0;i<=48;i++){const k=Math.pow(10,-1.2+2.4*i/48);const Ak=[];for(let a=0;a<L.n;a++)Ak.push(new Array(L.n).fill(0));for(let j=0;j<L.n;j++){const X=new Array(L.n).fill(0);X[j]=1;const Y=spdStep(M,L,X,k,0);for(let a=0;a<L.n;a++)Ak[a][j]=Y[a];}for(const z of eig(Ak)){const s=zToS(z,M.T);if(s)R.locus.push([s[0],s[1],k]);}}
    R.olp=M.tau>0?[[-1/M.tau,0],[0,0]]:[[0,0]];R.olz=[];
    R.stable=R.unstableZ===0;
  }else{
    // open: bandwidth of G, time constant, latency
    let wb=null;for(let i=1;i<pts.length;i++)if(pts[i].mag<=Math.SQRT1_2&&wb==null)wb=pts[i].w;
    R.bw=wb;R.stable=true;R.poles=M.tau>0?[[-1/M.tau,0]]:[];R.olp=R.poles;R.olz=[];R.locus=[];R.zeta=null;R.wn=null;
  }
  R.F=F;
  // response of v to a unit reference step
  const tEnd=Math.min(12,Math.max(2,M.kind==='mpc'&&R.zeta!=null&&R.wn?6/Math.max(0.2,R.zeta*R.wn):5*Math.max(M.tau,0.2)+M.nL*M.T+1));
  let X=new Array(L.n).fill(0);const resp=[[0,0]],N=Math.round(tEnd/M.T);
  for(let k=1;k<=N;k++){X=spdStep(M,L,X,1,1);resp.push([k*M.T,X[L.v]]);}
  R.tEnd=tEnd;R.step=resp;R.bias=resp;R.smOff=spdMetrics(resp);R.smBias=R.smOff;
  AN.resSpd=R;return R;
}
function spdMetrics(resp){let t10=null,t90=null,pk=0,ts=0;for(const[t,v]of resp){if(t10==null&&v>=0.1)t10=t;if(t90==null&&v>=0.9)t90=t;if(v>pk)pk=v;if(Math.abs(v-1)>0.02)ts=t;}
  return{overshoot:Math.max(0,pk-1)*100,rise:(t10!=null&&t90!=null)?t90-t10:null,settle:ts,final:resp[resp.length-1][1],peak:pk};}
// measured: a 0.2 m/s step of the cruise speed in the full simulator
function runSpeedStepTest(){
  const R=AN.resSpd,v0=anV0(),dv=AN.spdAmp||0.2,tEnd=R?R.tEnd:5;
  const B=makeBench(v0,0,0);benchPrime(B);
  const vc=P.vcruise,vm=P.vmax;
  const out=[[0,0]];let satT=0;
  try{inBench(B,()=>{benchSettle(B);P.vcruise=vc+dv;P.vmax=Math.max(vm,vc+dv);const N=Math.round(tEnd/DT);let vPrev=B.robot.v;
      for(let i=0;i<N;i++){benchTick(B,null);const v=B.robot.v;if(P.accel&&Math.abs(v-vPrev)/DT>=P.amax*0.98)satT+=DT;vPrev=v;out.push([B.t,(v-v0)/dv]);}});}
  finally{P.vcruise=vc;P.vmax=vm;}
  AN.meas.spd={data:out,satT,amp:dv};
}
