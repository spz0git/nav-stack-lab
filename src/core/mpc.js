function mpcModel(){
  const car=isCar(),L=P.wheelbase,lag=P.mpcLag&&P.lag>0,tau=P.lag,sMax=car?steerMax():P.wmax;
  const sat=s=>clamp(s,-sMax,sMax);   // the actuator saturates; the model does too
  const f=(x,u,dt)=>{
    const v=x[3],s=x[4],w=car?v*Math.tan(s)/L:s,thm=x[2]+0.5*w*dt;
    const o=[x[0]+v*Math.cos(thm)*dt,x[1]+v*Math.sin(thm)*dt,x[2]+w*dt,0,0];
    if(lag){const a=1-Math.exp(-dt/tau);o[3]=v+(x[5]-v)*a;o[4]=sat(s+(x[6]-s)*a);o.push(x[5]+u[0]*dt,sat(x[6]+u[1]*dt));}
    else{o[3]=v+u[0]*dt;o[4]=sat(s+u[1]*dt);}
    return o;
  };
  return{n:lag?7:5,f,car,lag};
}
function mpcJac(M,x,u,dt){   // forward-difference Jacobians A = ∂f/∂x, B = ∂f/∂u
  const n=M.n,f0=M.f(x,u,dt),A=new Float64Array(n*n),B=new Float64Array(n*2),h=1e-6;
  for(let j=0;j<n;j++){const xp=x.slice();xp[j]+=h;const fp=M.f(xp,u,dt);for(let i=0;i<n;i++)A[i*n+j]=(fp[i]-f0[i])/h;}
  for(let j=0;j<2;j++){const up=u.slice();up[j]+=h;const fp=M.f(x,up,dt);for(let i=0;i<n;i++)B[i*2+j]=(fp[i]-f0[i])/h;}
  return{f0,A,B};
}
function cholSolve(A,b,n){
  const L=new Float64Array(n*n);
  for(let i=0;i<n;i++)for(let j=0;j<=i;j++){let s=A[i*n+j];for(let k=0;k<j;k++)s-=L[i*n+k]*L[j*n+k];
    if(i===j)L[i*n+i]=Math.sqrt(Math.max(s,1e-12));else L[i*n+j]=s/L[j*n+j];}
  const y=new Float64Array(n);for(let i=0;i<n;i++){let s=b[i];for(let k=0;k<i;k++)s-=L[i*n+k]*y[k];y[i]=s/L[i*n+i];}
  const x=new Float64Array(n);for(let i=n-1;i>=0;i--){let s=y[i];for(let k=i+1;k<n;k++)s-=L[k*n+i]*x[k];x[i]=s/L[i*n+i];}
  return x;
}
// min ½zᵀHz + gᵀz  s.t. lo ≤ z ≤ hi   (projected Newton, Bertsekas 1982)
function boxQP(H,g,lo,hi,n){
  const z=new Float64Array(n);for(let i=0;i<n;i++)z[i]=clamp(0,lo[i],hi[i]);
  const q=w=>{let v=0;for(let i=0;i<n;i++){let hz=0;for(let j=0;j<n;j++)hz+=H[i*n+j]*w[j];v+=w[i]*(0.5*hz+g[i]);}return v;};
  let fz=q(z);
  for(let it=0;it<40;it++){
    const gr=new Float64Array(n);for(let i=0;i<n;i++){let s=g[i];for(let j=0;j<n;j++)s+=H[i*n+j]*z[j];gr[i]=s;}
    const fr=[];for(let i=0;i<n;i++){if(!((z[i]<=lo[i]+1e-9&&gr[i]>0)||(z[i]>=hi[i]-1e-9&&gr[i]<0)))fr.push(i);}
    if(!fr.length)break;
    const m=fr.length,Hf=new Float64Array(m*m),bf=new Float64Array(m);
    for(let a=0;a<m;a++){bf[a]=-gr[fr[a]];for(let b=0;b<m;b++)Hf[a*m+b]=H[fr[a]*n+fr[b]];}
    const d=cholSolve(Hf,bf,m);let dm=0;for(let a=0;a<m;a++)dm=Math.max(dm,Math.abs(d[a]));if(dm<1e-9)break;
    let al=1,ok=false;
    while(al>1e-4){const zn=z.slice();for(let a=0;a<m;a++){const i=fr[a];zn[i]=clamp(z[i]+al*d[a],lo[i],hi[i]);}const fn=q(zn);if(fn<fz-1e-12){z.set(zn);fz=fn;ok=true;break;}al*=0.5;}
    if(!ok)break;
  }
  return z;
}
function segAt(sArc){const T=S.track;sArc=clamp(sArc,0,T.total);let i=Math.min(T.idx,T.pts.length-2);while(i>0&&T.s[i]>sArc)i--;while(i<T.pts.length-2&&T.s[i+1]<sArc)i++;return i;}
// Time-parametrized reference along the current leg, using the same speed profile as the other trackers
function mpcReference(Np,dt){
  const{T,pr,dir}=trackPre(),ref=[];   // also advances the path-progress index
  const vAt=s=>{let v=Math.min(P.vcruise,vCap(dir)),kp=0;for(let d=0;d<=0.6;d+=0.2)kp=Math.max(kp,Math.abs(kapAt(s+d)));if(kp>1e-6)v=Math.min(v,Math.sqrt(P.alat/kp));return Math.min(v,decelCap(T.total-s));};
  let s=pr.s;
  for(let k=0;k<=Np;k++){const p=pointAt(s),hd=T.hd[segAt(s)],v=vAt(s);
    ref.push({x:p[0],y:p[1],hd,th:dir>0?hd:wrap(hd+Math.PI),v:dir*v,kap:kapAt(s)});s=Math.min(T.total,s+v*dt);}
  return{ref,dir};
}
function ctlMPC(){
  const t0=performance.now(),M=mpcModel(),n=M.n,car=M.car,ltv=P.mpcMode==='ltv';
  const Np=Math.round(P.mpcNp),Nc=Math.max(1,Math.min(Math.round(P.mpcNc),Np)),dt=P.mpcDt,nU=2*Nc;
  const{ref,dir}=mpcReference(Np,dt),e=S.est;
  const x0=[e.x,e.y,e.th,S.odo.v,car?S.robot.d:S.odo.w];
  // Δu form: build on this controller's own last command when it ran on the previous tick;
  // after any interruption (replan tick, controller switch) start again from the measured actuator state
  const LC=(S.mpcCmd&&S.mpcCmd.tick===S.tick-1)?S.mpcCmd:{v:S.odo.v,steer:S.robot.d,w:S.odo.w};
  if(M.lag)x0.push(LC.v||0,car?(LC.steer||0):(LC.w||0));
  // reference states (θ unwrapped next to the robot) and the inputs that would produce them
  const Xr=[],Ur=[];let thp=x0[2];
  for(let k=0;k<=Np;k++){const th=thp+wrap(ref[k].th-thp);thp=th;
    const sr=car?dir*Math.atan(P.wheelbase*ref[k].kap):ref[k].v*ref[k].kap;
    const xr=[ref[k].x,ref[k].y,th,ref[k].v,sr];if(M.lag)xr.push(xr[3],xr[4]);Xr.push(xr);}
  for(let k=0;k<Np;k++)Ur.push([(Xr[k+1][3]-Xr[k][3])/dt,(Xr[k+1][4]-Xr[k][4])/dt]);
  // bounds and constraints
  const aMax=P.accel?P.amax:3,rMax=car?P.steerRate:(P.accel?P.alpha:8);
  const vMax=car?vCap(dir):P.vmax,sMax=car?steerMax():P.wmax,rho=P.mpcRho;
  const obs=P.mpcObs&&!ltv,offs=car?[0,1,2].map(i=>-CAR.rear+carLen()/3*(i+0.5)):[0],rc=car?Math.hypot(carLen()/6,CAR.width/2):RR;
  const agM=obs&&agOn(),nc=4+(obs?offs.length*(agM?2:1):0),ags=agM?agList(Np*dt*Math.max(vMax,0.3)+4):[];
  const pts=obs?((S.agents&&S.agents.staticPts)||S.scanPts).filter(p=>hyp(p[0]-e.x,p[1]-e.y)<Np*dt*Math.max(vMax,0.3)+1.5):[];
  // warm start: shift the previous solution by one sim tick
  const sig=`${P.mpcMode}|${Np}|${Nc}|${dt}|${n}|${nc}|${P.model}|${S.pathId}`;
  let W=S.mpc;
  if(!W||W.sig!==sig){W=S.mpc={sig,U:new Float64Array(nU),lam:new Float64Array(Np*nc),uPrev:[0,0]};
    for(let j=0;j<Nc;j++){W.U[2*j]=Ur[j][0];W.U[2*j+1]=Ur[j][1];}}
  else{const sh=DT/dt,U=W.U,Un=new Float64Array(nU),ln=new Float64Array(Np*nc);
    for(let j=0;j<Nc;j++){const p=Math.min(j+sh,Nc-1),j0=Math.floor(p),j1=Math.min(j0+1,Nc-1),f=p-j0;for(let c=0;c<2;c++)Un[2*j+c]=U[2*j0+c]*(1-f)+U[2*j1+c]*f;}
    for(let k=0;k<Np;k++){const kk=Math.min(Np-1,Math.round(k+sh));for(let c=0;c<nc;c++)ln[k*nc+c]=W.lam[kk*nc+c];}
    W.U=Un;W.lam=ln;}
  const ulo=j=>j%2?-rMax:-aMax,uhi=j=>j%2?rMax:aMax;
  let U=W.U.map((u,j)=>clamp(u,ulo(j),uhi(j)));
  const uk=(U,k)=>{const j=Math.min(k,Nc-1);return[U[2*j],U[2*j+1]];};
  // LTV: Jacobians and defects along the reference, computed once
  let ABr=null;
  if(ltv){ABr=[];for(let k=0;k<Np;k++){const J=mpcJac(M,Xr[k],Ur[k],dt);ABr.push({A:J.A,B:J.B,d:J.f0.map((v,i)=>v-Xr[k+1][i])});}}
  const rollout=U=>{const X=[x0.slice()];
    if(!ltv){for(let k=0;k<Np;k++)X.push(M.f(X[k],uk(U,k),dt));return X;}
    let dx=x0.map((v,i)=>v-Xr[0][i]);
    for(let k=0;k<Np;k++){const{A,B,d}=ABr[k],u=uk(U,k),du=[u[0]-Ur[k][0],u[1]-Ur[k][1]],nx=new Array(n);
      for(let i=0;i<n;i++){let s=d[i]+B[i*2]*du[0]+B[i*2+1]*du[1];for(let m=0;m<n;m++)s+=A[i*n+m]*dx[m];nx[i]=s;}
      dx=nx;X.push(dx.map((v,i)=>v+Xr[k+1][i]));}
    return X;};
  // constraint values c ≤ 0 and gradients (w.r.t. state) at step k
  const cons=(k,x)=>{const v=x[3],s=x[4],out=[];
    out.push(dir>0?[-v,[0,0,0,-1,0]]:[v,[0,0,0,1,0]]);
    out.push(dir>0?[v-vMax,[0,0,0,1,0]]:[-v-vMax,[0,0,0,-1,0]]);
    out.push([s-sMax,[0,0,0,0,1]],[-s-sMax,[0,0,0,0,-1]]);
    if(obs){const c=Math.cos(x[2]),sn=Math.sin(x[2]);
      for(const o of offs){const cx=x[0]+o*c,cy=x[1]+o*sn;let bd=Infinity,bp=null;
        for(const p of pts){const d=(p[0]-cx)**2+(p[1]-cy)**2;if(d<bd){bd=d;bp=p;}}
        if(!bp){out.push([-1,[0,0,0,0,0]]);continue;}
        const d=Math.max(Math.sqrt(bd),1e-6),ux=(cx-bp[0])/d,uy=(cy-bp[1])/d;
        out.push([rc+P.mpcMarg-d,[-ux,-uy,-(ux*(-o*sn)+uy*(o*c)),0,0]]);}
      if(agM){const Q=ags.map(a=>agPred(a,k*dt));   // predicted agents at this step's time
        for(const o of offs){const cx=x[0]+o*c,cy=x[1]+o*sn;let bd=Infinity,bq=null;
          for(const q of Q){const d=hyp(q[0]-cx,q[1]-cy)-q[2];if(d<bd){bd=d;bq=q;}}
          if(!bq){out.push([-1,[0,0,0,0,0]]);continue;}
          const d=Math.max(hyp(cx-bq[0],cy-bq[1]),1e-6),ux=(cx-bq[0])/d,uy=(cy-bq[1])/d;
          out.push([rc+bq[2]+P.mpcMarg-d,[-ux,-uy,-(ux*(-o*sn)+uy*(o*c)),0,0]]);}}}
    return out;};
  // residuals of step k (1..Np) as [r, grad over state]; inputs handled separately
  const sq=Math.sqrt,lamOf=(k,c)=>W.lam[(k-1)*nc+c];
  const stateRes=(k,x)=>{const R=ref[k],w=k===Np?P.mpcQf:1,c=Math.cos(R.hd),s=Math.sin(R.hd),ex=x[0]-R.x,ey=x[1]-R.y,out=[];
    const a=sq(w*P.mpcQlon),b=sq(w*P.mpcQlat),t=sq(w*P.mpcQth),q=sq(w*P.mpcQv);
    out.push([a*(c*ex+s*ey),[a*c,a*s,0,0,0]],[b*(-s*ex+c*ey),[-b*s,b*c,0,0,0]],[t*wrap(x[2]-Xr[k][2]),[0,0,t,0,0]],[q*(x[3]-R.v),[0,0,0,q,0]]);
    cons(k,x).forEach(([cv,g],ci)=>{const z=cv+lamOf(k,ci)/rho;if(z>0){const f=sq(rho/2);out.push([f*z,g.map(v=>v*f)]);}});
    return out;};
  const inRes=(U,k)=>{const u=uk(U,k),out=[[sq(P.mpcRa)*u[0]],[sq(P.mpcRs)*u[1]]];
    if(k<Nc){const p=k===0?W.uPrev:uk(U,k-1);out.push([sq(P.mpcRd)*(u[0]-p[0])],[sq(P.mpcRd)*(u[1]-p[1])]);}return out;};
  const cost=(X,U)=>{let J=0;for(let k=1;k<=Np;k++)for(const[r]of stateRes(k,X[k]))J+=r*r;for(let k=0;k<Np;k++)for(const[r]of inRes(U,k))J+=r*r;return J;};
  let X=rollout(U),J=cost(X,U),it=0;
  const iters=ltv?2:Math.round(P.mpcIt);
  for(;it<iters;it++){
    if(performance.now()-t0>15)break;   // real-time budget
    const AB=ltv?ABr:X.slice(0,Np).map((x,k)=>mpcJac(M,x,uk(U,k),dt));
    // Gauss–Newton: H = JᵀJ, g = Jᵀr, with sensitivities S_k = ∂x_k/∂U (move blocking after Nc)
    const H=new Float64Array(nU*nU),g=new Float64Array(nU);
    const addRow=(row,r)=>{for(let a=0;a<nU;a++){const ra=row[a];if(ra===0)continue;g[a]+=ra*r;for(let b=0;b<nU;b++)H[a*nU+b]+=ra*row[b];}};
    let Sk=new Float64Array(n*nU);
    for(let k=0;k<Np;k++){const{A,B}=AB[k],j=Math.min(k,Nc-1),Sn=new Float64Array(n*nU);
      for(let i=0;i<n;i++){for(let c=0;c<nU;c++){let s=0;for(let m=0;m<n;m++)s+=A[i*n+m]*Sk[m*nU+c];Sn[i*nU+c]=s;}Sn[i*nU+2*j]+=B[i*2];Sn[i*nU+2*j+1]+=B[i*2+1];}
      Sk=Sn;
      for(const[r,gr]of stateRes(k+1,X[k+1])){const row=new Float64Array(nU);for(let m=0;m<5;m++){if(gr[m]===0)continue;for(let c=0;c<nU;c++)row[c]+=gr[m]*Sk[m*nU+c];}addRow(row,r);}
      const ir=inRes(U,k);for(let q=0;q<ir.length;q++){const row=new Float64Array(nU),ch=q%2,f=q<2?(q?sq(P.mpcRs):sq(P.mpcRa)):sq(P.mpcRd);
        row[2*j+ch]=f;if(q>=2&&k>0)row[2*(k-1)+ch]=-f;addRow(row,ir[q][0]);}
    }
    for(let i=0;i<nU;i++)H[i*nU+i]+=1e-6+1e-4*H[i*nU+i];
    const lo=new Float64Array(nU),hi=new Float64Array(nU);for(let i=0;i<nU;i++){lo[i]=ulo(i)-U[i];hi[i]=uhi(i)-U[i];}
    const dU=boxQP(H,g,lo,hi,nU);
    let al=1,acc=false;
    while(al>=0.1){const Un=U.map((u,i)=>u+al*dU[i]),Xn=rollout(Un),Jn=cost(Xn,Un);if(Jn<J){U=Un;X=Xn;J=Jn;acc=true;break;}al*=0.5;}
    // augmented-Lagrangian multiplier update
    for(let k=1;k<=Np;k++)cons(k,X[k]).forEach(([cv],ci)=>{const i=(k-1)*nc+ci;W.lam[i]=Math.max(0,W.lam[i]+rho*cv);});
    J=cost(X,U);
    if(!acc)break;
  }
  W.U=U;const u0=uk(U,0);W.uPrev=u0;
  let viol=0;for(let k=1;k<=Np;k++)for(const[cv]of cons(k,X[k]))viol=Math.max(viol,cv);
  // what the chosen inputs really do (nonlinear), drawn next to the LTV prediction
  let Xtrue=X;if(ltv){Xtrue=[x0.slice()];for(let k=0;k<Np;k++)Xtrue.push(M.f(Xtrue[k],uk(U,k),dt));}
  S.ctlViz={pred:Xtrue.map(x=>[x[0],x[1]]),lin:ltv?X.map(x=>[x[0],x[1]]):null,ref:ref.map(r=>[r.x,r.y])};
  S.mpcStats={ms:performance.now()-t0,it,J,viol,mode:ltv?'LTV':'NMPC',Np,Nc};
  const bv=LC.v||0,bs=car?(LC.steer||0):(LC.w||0),vc=bv+u0[0]*DT,sc=bs+u0[1]*DT;   // u = u_prev + u̇·T
  S.mpcCmd={v:vc,steer:car?clamp(sc,-steerMax(),steerMax()):0,w:car?0:clamp(sc,-P.wmax,P.wmax),tick:S.tick};
  return car?{v:vc,steer:sc}:{v:vc,w:sc};
}
