import re
s=open('nav-stack-lab.html').read()
rs=open('car/rs.js').read()
rs=rs[rs.index('/* RS_BEGIN */'):rs.index('/* RS_END */')]
def rep(a,b,cnt=1):
    global s
    n=s.count(a)
    assert n==cnt,(a[:80],n)
    s=s.replace(a,b)

# ---------- constants, car geometry, collision helpers ----------
rep("const ARRIVE=0.25;",
"""const ARRIVE=0.25;
const CAR={rear:0.15,front:0.15,width:0.5};   // overhangs and width [m]; pose = rear-axle centre""")
rep("class Heap{",
"""const isCar=()=>P.model==='car';
const steerMax=()=>P.steerMaxDeg*Math.PI/180;
const minTurnR=()=>P.wheelbase/Math.tan(steerMax());
const carLen=()=>CAR.rear+P.wheelbase+CAR.front;
// Footprint as covering circles (used by planners and DWA). Diff-drive: one circle.
function fpCircles(x,y,th){
  if(!isCar())return[[x,y,RR]];
  const part=carLen()/3,r=Math.hypot(part/2,CAR.width/2),c=Math.cos(th),s=Math.sin(th),out=[];
  for(let i=0;i<3;i++){const o=-CAR.rear+part*(i+0.5);out.push([x+o*c,y+o*s,r]);}
  return out;
}
// Exact oriented-rectangle test for the car body (used by physics)
function carHits(x,y,th,shapes,m){
  m=m||0;const c=Math.cos(th),s=Math.sin(th),hl=carLen()/2+m,hw=CAR.width/2+m,off=carLen()/2-CAR.rear,cx=x+off*c,cy=y+off*s,ac=Math.abs(c),as=Math.abs(s);
  for(const sh of shapes){
    if(sh.t==='c'){const dx=sh.x-cx,dy=sh.y-cy,lx=dx*c+dy*s,ly=-dx*s+dy*c,qx=clamp(lx,-hl,hl),qy=clamp(ly,-hw,hw);if(Math.hypot(lx-qx,ly-qy)<sh.r)return true;continue;}
    const ex=sh.w/2,ey=sh.h/2,dx=sh.x+ex-cx,dy=sh.y+ey-cy;
    if(Math.abs(dx)>ex+hl*ac+hw*as)continue;
    if(Math.abs(dy)>ey+hl*as+hw*ac)continue;
    if(Math.abs(dx*c+dy*s)>hl+ex*ac+ey*as)continue;
    if(Math.abs(-dx*s+dy*c)>hw+ex*as+ey*ac)continue;
    return true;
  }
  return false;
}
const bodyHits=(x,y,th,shapes,m)=>isCar()?carHits(x,y,th,shapes,m):circleHits(x,y,RR+(m||0),shapes);
// Smallest footprint clearance against a distance field
function fpClear(x,y,th,dist){let m=Infinity;for(const[cx,cy,r]of fpCircles(x,y,th)){const k=cellIdx(cx,cy);if(k<0)return -1;const d=dist[k]-r;if(d<m)m=d;}return m;}
class Heap{""")

# ---------- defaults ----------
rep("mis:'sequential',replan:0,lostGuard:false,",
    "mis:'sequential',replan:0,lostGuard:false,model:'diff',wheelbase:0.6,steerMaxDeg:32,steerRate:1.5,revOK:true,revPen:2.0,gearPen:2.0,hybH:'both',stanK:2.0,")

# ---------- robot state ----------
rep("robot:{x:st[0],y:st[1],th:st[2],v:0,w:0,contact:false,pedContact:false},",
    "robot:{x:st[0],y:st[1],th:st[2],v:0,w:0,d:0,contact:false,pedContact:false},")
rep("cmd:{v:0,w:0},odo:{v:0,w:0},","cmd:{v:0,w:0,steer:0},odo:{v:0,w:0},plan:null,segIdx:0,")
rep("for(const w of WPS)w.done=false;","for(const w of WPS){w.done=false;w.skipped=false;}")

# ---------- actuation ----------
rep("""  let vt=clamp(c.v,-0.5*P.vmax,P.vmax), wt=clamp(c.w,-P.wmax,P.wmax);
  if(P.lag>0){const a=1-Math.exp(-DT/P.lag);vt=r.v+(vt-r.v)*a;wt=r.w+(wt-r.w)*a;}
  if(P.accel){vt=clamp(vt,r.v-P.amax*DT,r.v+P.amax*DT);wt=clamp(wt,r.w-P.alpha*DT,r.w+P.alpha*DT);}
  const n=integ(r.x,r.y,r.th,vt,wt,DT);
  if(circleHits(n.x,n.y,RR,S.shapes)){
    r.th=wrap(r.th+wt*DT); r.v=0; r.w=wt;""",
"""  let vt=clamp(c.v,-0.5*P.vmax,P.vmax),wt;
  if(isCar()){
    // bicycle: command (v, δ) → lag → accel limit → steering-rate limit → ω = v tanδ / L
    const dm=steerMax();let st=clamp(c.steer||0,-dm,dm);
    if(P.lag>0){const a=1-Math.exp(-DT/P.lag);vt=r.v+(vt-r.v)*a;st=r.d+(st-r.d)*a;}
    if(P.accel)vt=clamp(vt,r.v-P.amax*DT,r.v+P.amax*DT);
    r.d=clamp(st,r.d-P.steerRate*DT,r.d+P.steerRate*DT);
    wt=vt*Math.tan(r.d)/P.wheelbase;
  }else{
    wt=clamp(c.w,-P.wmax,P.wmax);
    if(P.lag>0){const a=1-Math.exp(-DT/P.lag);vt=r.v+(vt-r.v)*a;wt=r.w+(wt-r.w)*a;}
    if(P.accel){vt=clamp(vt,r.v-P.amax*DT,r.v+P.amax*DT);wt=clamp(wt,r.w-P.alpha*DT,r.w+P.alpha*DT);}
  }
  const n=integ(r.x,r.y,r.th,vt,wt,DT);
  if(bodyHits(n.x,n.y,n.th,S.shapes)){
    if(!isCar())r.th=wrap(r.th+wt*DT); r.v=0; r.w=isCar()?0:wt;""")
rep("if(r.contact&&!circleHits(r.x,r.y,RR+0.05,S.shapes))r.contact=false;","if(r.contact&&!bodyHits(r.x,r.y,r.th,S.shapes,0.05))r.contact=false;")
rep("let pc=false;for(const p of S.peds)if(hyp(p.x-r.x,p.y-r.y)<RR+p.r)pc=true;",
    "let pc=false;if(isCar())pc=S.peds.length>0&&carHits(r.x,r.y,r.th,S.peds.map(p=>({t:'c',x:p.x,y:p.y,r:p.r})));else for(const p of S.peds)if(hyp(p.x-r.x,p.y-r.y)<RR+p.r)pc=true;")

# ---------- Reeds-Shepp + Hybrid A* (insert before path tracking helpers) ----------
rep("/* ---------- path tracking helpers ---------- */",
rs+r"""
/* ---------- Reeds–Shepp only (ignores obstacles) ---------- */
function rsPlan(e,wp){
  const R=minTurnR(),th=wp.th!=null?wp.th:Math.atan2(wp.y-e.y,wp.x-e.x);
  const c=RS.solve([e.x,e.y,e.th],[wp.x,wp.y,th],R)[0];
  S.search=null;
  if(!c)return{ok:false,reason:'no Reeds–Shepp solution'};
  const segs=RS.sample([e.x,e.y,e.th],c,R,0.1);
  return{ok:true,segs,len:c.len*R,exp:0,extra:`${c.T} · ${segs.length-1} cusp${segs.length===2?'':'s'}`};
}

/* ---------- Hybrid A* (Dolgov et al. 2008) ---------- */
const HY={XY:0.2,NT:72};HY.NX=Math.ceil(W/HY.XY);HY.NY=Math.ceil(H/HY.XY);HY.N=HY.NX*HY.NY*HY.NT;
let HYB=null;
function hyBuf(){if(!HYB)HYB={g:new Float32Array(HY.N),closed:new Uint8Array(HY.N),par:new Int32Array(HY.N),x:new Float32Array(HY.N),y:new Float32Array(HY.N),th:new Float32Array(HY.N),dir:new Int8Array(HY.N),st:new Float32Array(HY.N)};
  HYB.g.fill(Infinity);HYB.closed.fill(0);return HYB;}
// obstacle-aware, non-holonomic-free heuristic: 8-connected Dijkstra from the goal on the 0.1 m grid
function holoField(gx,gy,dist,thr){
  const h=new Float32Array(NC).fill(Infinity),done=new Uint8Array(NC),heap=new Heap(),g=cellIdx(gx,gy);
  if(g<0)return h;h[g]=0;heap.push(g,0);
  while(heap.size){const u=heap.pop();if(done[u])continue;done[u]=1;const ui=u%GW,uj=(u/GW)|0;
    for(const[di,dj,c]of NB){const vi=ui+di,vj=uj+dj;if(vi<0||vj<0||vi>=GW||vj>=GH)continue;const v=vj*GW+vi;if(done[v]||dist[v]<thr)continue;
      const ng=h[u]+c*RES;if(ng<h[v]){h[v]=ng;heap.push(v,ng);}}}
  return h;
}
function hybridAstar(e,wp){
  const dist=S.cm.dist,L=P.wheelbase,dm=steerMax(),R=minTurnR(),MARG=0.08,STEP=0.4,SUB=0.1,BUDGET=60000;
  const goalTh=wp.th!=null?wp.th:null,q1=[wp.x,wp.y,goalTh];
  const part=carLen()/3,rc=Math.hypot(part/2,CAR.width/2),offs=[0,1,2].map(i=>-CAR.rear+part*(i+0.5));
  const clearAt=(x,y,th)=>{const c=Math.cos(th),s=Math.sin(th);let m=Infinity;for(const o of offs){const k=cellIdx(x+o*c,y+o*s);if(k<0)return -1;const d=dist[k]-rc;if(d<m)m=d;}return m;};
  if(goalTh!=null&&clearAt(wp.x,wp.y,goalTh)<MARG)return{ok:false,reason:'the goal pose overlaps an obstacle'};
  if(goalTh==null&&cellIdx(wp.x,wp.y)>=0&&dist[cellIdx(wp.x,wp.y)]<CAR.width/2+MARG)return{ok:false,reason:'goal is too close to an obstacle for the car'};
  const startClear=clearAt(e.x,e.y,e.th),lenient=startClear<MARG;
  const h2=holoField(wp.x,wp.y,dist,CAR.width/2+0.02);
  const h2At=(x,y)=>{const k=cellIdx(x,y);if(k<0)return Infinity;const v=h2[k];return isFinite(v)?v:hyp(x-wp.x,y-wp.y)+20;};
  const useRS=goalTh!=null&&P.hybH==='both';
  const hAt=(x,y,th)=>{let h=h2At(x,y);if(useRS&&h<5){const r=RS.length([x,y,th],q1,R);if(r>h)h=r;}return h;};
  const B=hyBuf(),NT=HY.NT,XY=HY.XY,NX=HY.NX;
  const key=(x,y,th)=>{const i=Math.floor(x/XY),j=Math.floor(y/XY);if(i<0||j<0||i>=NX||j>=HY.NY)return -1;return (j*NX+i)*NT+(((Math.round(th/(TAU/NT))%NT)+NT)%NT);};
  const steers=[-dm,-dm/2,0,dm/2,dm],dirs=P.revOK?[1,-1]:[1];
  const s0=key(e.x,e.y,e.th);if(s0<0)return{ok:false,reason:'start is outside the map'};
  B.g[s0]=0;B.par[s0]=-1;B.x[s0]=e.x;B.y[s0]=e.y;B.th[s0]=e.th;B.dir[s0]=0;B.st[s0]=S.robot.d||0;
  const heap=new Heap();heap.push(s0,P.eps*hAt(e.x,e.y,e.th));
  const viz=[];let exp=0,fin=-1,tail=null,shots=0;
  while(heap.size&&exp<BUDGET){
    const u=heap.pop();if(B.closed[u])continue;B.closed[u]=1;exp++;
    const x=B.x[u],y=B.y[u],th=B.th[u];if(viz.length<40000)viz.push(x,y);
    const dg=hyp(x-wp.x,y-wp.y);
    if(dg<0.25&&(goalTh==null||Math.abs(wrap(th-goalTh))<0.15)){fin=u;break;}
    // analytic expansion: try a Reeds–Shepp shot to the goal
    if(goalTh!=null&&(dg<2.5||exp%10===0)){
      shots++;const cs=RS.solve([x,y,th],q1,R);
      for(let ci=0;ci<Math.min(4,cs.length)&&!tail;ci++){
        const segs=RS.sample([x,y,th],cs[ci],R,SUB);let ok=true;
        for(const sg of segs){for(const p of sg.pts){if(clearAt(p[0],p[1],p[2])<MARG){ok=false;break;}}if(!ok)break;}
        if(ok)tail=segs;
      }
      if(tail){fin=u;break;}
    }
    for(const d of dirs)for(const st of steers){
      let nx=x,ny=y,nt=th,minC=Infinity,ok=true;const w=d*Math.tan(st)/L;
      for(let k=0;k<Math.round(STEP/SUB);k++){const n=integ(nx,ny,nt,d,w,SUB);nx=n.x;ny=n.y;nt=n.th;
        const c=clearAt(nx,ny,nt),need=(lenient&&B.g[u]<0.8)?Math.min(MARG,startClear-0.02):MARG;
        if(c<need){ok=false;break;}if(c<minC)minC=c;}
      if(!ok)continue;
      const v=key(nx,ny,nt);if(v<0||B.closed[v])continue;
      const prox=Math.max(0,(0.4-minC)/0.4);
      const cost=STEP*(d>0?1:P.revPen)+0.05*Math.abs(st)/dm+0.1*Math.abs(st-B.st[u])/dm+((B.dir[u]!==0&&B.dir[u]!==d)?P.gearPen:0)+STEP*2*prox*prox;
      const ng=B.g[u]+cost;
      if(ng<B.g[v]){B.g[v]=ng;B.par[v]=u;B.x[v]=nx;B.y[v]=ny;B.th[v]=nt;B.dir[v]=d;B.st[v]=st;heap.push(v,ng+P.eps*hAt(nx,ny,nt));}
    }
  }
  S.search={type:'hybrid',pts:viz};
  if(fin<0)return{ok:false,reason:exp>=BUDGET?`search budget of ${BUDGET} expansions used up`:'no kinematically feasible route',exp};
  // rebuild: re-simulate each primitive from its parent pose
  const chain=[];for(let k=fin;k!==s0&&k>=0;k=B.par[k])chain.push(k);chain.reverse();
  const segs=[];let cur=null;
  const add=(dir,pt)=>{if(!cur||cur.dir!==dir){const st=cur?cur.pts[cur.pts.length-1]:[e.x,e.y,e.th];cur={dir,pts:[st]};segs.push(cur);}cur.pts.push(pt);};
  for(const k of chain){const p=B.par[k],d=B.dir[k],w=d*Math.tan(B.st[k])/L;let nx=B.x[p],ny=B.y[p],nt=B.th[p];
    for(let i=0;i<Math.round(STEP/SUB);i++){const n=integ(nx,ny,nt,d,w,SUB);nx=n.x;ny=n.y;nt=n.th;add(d,[nx,ny,nt]);}}
  if(tail)for(const g of tail)for(let i=1;i<g.pts.length;i++)add(g.dir,g.pts[i]);
  if(!segs.length)segs.push({dir:1,pts:[[e.x,e.y,e.th],[e.x+1e-3*Math.cos(e.th),e.y+1e-3*Math.sin(e.th),e.th]]});
  let len=0;for(const g of segs)len+=pathLen(g.pts);
  return{ok:true,segs,len,exp,extra:`${segs.length-1} cusp${segs.length===2?'':'s'}${tail?' · RS shot':''}`};
}

/* ---------- path tracking helpers ---------- */""")

# ---------- track / plan ----------
rep("""function setTrack(pts){
  if(pts.length<2)pts=[pts[0],[pts[0][0]+1e-3,pts[0][1]]];
  const s=[0];for(let i=1;i<pts.length;i++)s.push(s[i-1]+hyp(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]));
  S.track={pts,s,total:s[s.length-1],idx:0};S.pathId++;""",
"""function setPlan(segs){S.plan={segs};S.segIdx=0;loadSeg(0);}
function loadSeg(i){const g=S.plan.segs[i];setTrack(g.pts);S.track.dir=g.dir;S.ctlState={I:0,prev:null};}
function setTrack(pts){
  pts=pts.filter((p,i)=>i===0||hyp(p[0]-pts[i-1][0],p[1]-pts[i-1][1])>1e-4);
  if(pts.length<2)pts=[pts[0],[pts[0][0]+1e-3,pts[0][1]]];
  const s=[0];for(let i=1;i<pts.length;i++)s.push(s[i-1]+hyp(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]));
  S.track={pts,s,total:s[s.length-1],idx:0,dir:1};S.pathId++;""")
rep("function pointAt(sArc){const T=S.track,p=T.pts;if(sArc>=T.total)return p[p.length-1];",
    "function pointAt(sArc,ext){const T=S.track,p=T.pts;if(sArc>=T.total){const b=p[p.length-1];if(!ext)return b;const a=p[p.length-2],l=hyp(b[0]-a[0],b[1]-a[1])||1,x=sArc-T.total;return[b[0]+(b[0]-a[0])/l*x,b[1]+(b[1]-a[1])/l*x];}")
s=s.replace("S.track=null","S.track=null;S.plan=null")

# ---------- doPlan ----------
rep("""  else if(P.plan==='astar')res=astar(e.x,e.y,wp.x,wp.y);
  else res=rrtstar(e.x,e.y,wp.x,wp.y);""","""  else if(P.plan==='astar')res=astar(e.x,e.y,wp.x,wp.y);
  else if(P.plan==='rs')res=rsPlan(e,wp);
  else if(P.plan==='hybrid')res=hybridAstar(e,wp);
  else res=rrtstar(e.x,e.y,wp.x,wp.y);""")
rep("const name={straight:'Straight',astar:'A*',rrtstar:'RRT*'}[P.plan];","const name=PLAN_NAMES[P.plan];")
rep("function doPlan(reason){","const PLAN_NAMES={straight:'Straight',astar:'A*',rrtstar:'RRT*',rs:'Reeds–Shepp',hybrid:'Hybrid A*'};\nfunction doPlan(reason){")
rep("""    setTrack(res.pts);F.state='DRIVE';""","""    setPlan(res.segs||[{pts:res.pts,dir:1}]);F.state='DRIVE';""")
rep("""    S.planStats={name,len:pathLen(res.pts),exp:res.exp,ms};
    if(reason!=='periodic')logE(`${reason==='initial'?'Plan':'Replan ('+reason+')'} · ${name} ${S.planStats.len.toFixed(1)} m${P.plan==='astar'?` · ${res.exp} expansions`:P.plan==='rrtstar'?` · ${res.exp} nodes`:''} · ${ms.toFixed(0)} ms`, reason==='initial'?'':'warn');""",
"""    S.planStats={name,len:res.len!=null?res.len:pathLen(res.pts),exp:res.exp,ms,extra:res.extra||''};
    if(reason!=='periodic')logE(`${reason==='initial'?'Plan':'Replan ('+reason+')'} · ${name} ${S.planStats.len.toFixed(1)} m${(P.plan==='astar'||P.plan==='hybrid')?` · ${res.exp} expansions`:P.plan==='rrtstar'?` · ${res.exp} nodes`:''}${res.extra?' · '+res.extra:''} · ${ms.toFixed(0)} ms`, reason==='initial'?'':'warn');""")

# ---------- mission: cusps, posed arrival, footprint blocked check ----------
rep("""  const wp=WPS[F.queue[0]],e=S.est;
  if(hyp(e.x-wp.x,e.y-wp.y)<ARRIVE){
    const te=hyp(S.robot.x-wp.x,S.robot.y-wp.y);
    logE(`Reached WP ${wpLabel(F.queue[0])} by estimate · true distance ${te.toFixed(2)} m`,te>0.5?'warn':'ok');""",
"""  const wp=WPS[F.queue[0]],e=S.est;
  let lastSeg=!S.plan||S.segIdx>=S.plan.segs.length-1;
  if(!lastSeg){
    const pr=project(e.x,e.y,true),T=S.track,end=T.pts[T.pts.length-1];
    if(T.total-pr.s<0.12||hyp(end[0]-e.x,end[1]-e.y)<0.1){
      S.segIdx++;loadSeg(S.segIdx);F.prog={t:S.t,x:e.x,y:e.y};
      logE(`Cusp → ${S.track.dir>0?'forward':'reverse'} (leg ${S.segIdx+1}/${S.plan.segs.length})`);
      lastSeg=S.segIdx>=S.plan.segs.length-1;
    }
  }
  const posed=isCar()&&wp.th!=null,headOK=!posed||Math.abs(wrap(e.th-wp.th))<0.35;
  if(lastSeg&&headOK&&hyp(e.x-wp.x,e.y-wp.y)<ARRIVE){
    const te=hyp(S.robot.x-wp.x,S.robot.y-wp.y),he=posed?Math.abs(deg(wrap(S.robot.th-wp.th))):0;
    logE(`Reached WP ${wpLabel(F.queue[0])} by estimate · true error ${te.toFixed(2)} m${posed?` · ${he.toFixed(0)}°`:''}`,(te>0.5||he>20)?'warn':'ok');""")
rep("""  if(P.plan!=='straight'&&S.t-F.lastBlockT>0.5){
    F.lastBlockT=S.t;const pr=project(e.x,e.y,true);""",
"""  if(P.plan==='hybrid'&&isCar()&&S.t-F.lastBlockT>0.5){
    // footprint check of the remaining legs (poses carry heading)
    F.lastBlockT=S.t;const pr=project(e.x,e.y,true);let trav=0,first=true;
    for(let gi=S.segIdx;gi<S.plan.segs.length&&trav<6;gi++){const pts=S.plan.segs[gi].pts;
      for(let i=(gi===S.segIdx?pr.i+2:1);i<pts.length&&trav<6;i++){trav+=hyp(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]);
        const c=fpClear(pts[i][0],pts[i][1],pts[i][2],S.cm.dist);if(c<0&&first)continue;first=false;
        if(c<0){F.state='PLAN';F.pendingReason='path blocked';return;}}}
  }
  else if(P.plan!=='straight'&&P.plan!=='rs'&&S.t-F.lastBlockT>0.5){
    F.lastBlockT=S.t;const pr=project(e.x,e.y,true);""")
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
# ---------- level L6 ----------
rep("""  cfg:{loc:'pf',per:'oracle',mis:'sequential',plan:'astar',ctl:'pp',odoK:1,odoB:0.5,accel:true,lag:0.15,assoc:'unknown',clutter:0.5,replan:2,lostGuard:true},layers:{cost:false}},
];""","""  cfg:{loc:'pf',per:'oracle',mis:'sequential',plan:'astar',ctl:'pp',odoK:1,odoB:0.5,accel:true,lag:0.15,assoc:'unknown',clutter:0.5,replan:2,lostGuard:true},layers:{cost:false}},
 {id:'L6',name:'Parking lot',
  adds:'The robot becomes a car: kinematic bicycle model, 32° steering limit, a turning radius near 1 m, and a body that cannot turn in place. Goals now carry a heading: reverse into a bay, nose into another, then parallel park.',
  tries:['<b>Plan:</b> watch Hybrid A* insert reverse legs (dashed orange). Then switch to A*: the path ignores heading and turning radius, so the car swings wide and misses the bay.',
         '<b>Plan:</b> pick Reeds–Shepp. It finds the shortest maneuver but ignores obstacles, so it drives through parked cars.',
         '<b>Plan:</b> untick Allow reversing. The reverse-in bay and the parallel slot become unreachable or far longer.',
         '<b>Plan:</b> set the heuristic to 2D only and compare expansions in the log.',
         '<b>Control:</b> Stanley versus pure pursuit on forward legs. Use the Steering plot, and lower the steering rate limit in Vehicle.',
         '<b>Localize:</b> switch to EKF and raise odometry noise. The log reports the true final pose error at every bay.'],
  shapes:PARKING,beacons:[[0.45,4],[0.45,12],[12,0.45],[12,15.55],[23.55,4],[23.55,12],[3.85,9.6],[20.15,9.6],[3.8,15.55],[20.2,15.55],[9,4.98],[17,4.98]],peds:[],
  start:[2,4,Math.PI/2],wps:[[10.5,15.35,-Math.PI/2],[15.5,8.4,Math.PI/2],[5.6,0.62,0],[2,13]],
  cfg:{model:'car',loc:'truth',per:'oracle',mis:'sequential',plan:'hybrid',ctl:'pp',odoK:0,odoB:0,accel:false,lag:0,assoc:'known',clutter:0,replan:0,vcruise:0.6,ppL0:0.4,ppK:0.3},layers:{cost:false}},
];""")
rep("const LEVELS=[","""// Parking lot: parked cars are obstacles (0.56 × 1.0 m); bays are 1 m wide
const PARKING=(()=>{const s=[...BORDER,Rc(4,9.45,16,0.3)];
  for(let bx=4;bx<20;bx++){if(bx!==10&&bx!==16)s.push(Rc(bx+0.22,14.65,0.56,1.0));
    if(bx!==7&&bx!==13)s.push(Rc(bx+0.22,9.85,0.56,1.0));
    if(bx!==15&&bx!==9)s.push(Rc(bx+0.22,8.35,0.56,1.0));}
  for(const x of[4,6.8,9.5,12.5,15.5])s.push(Rc(x,0.3,1.0,0.56));
  s.push(Ci(9,4.6,0.35),Ci(13,4.6,0.35),Ci(17,4.6,0.35),Rc(20.6,2.4,1.2,1.2));
  return s;})();
const LEVELS=[""")
rep("WPS=LV.wps.map(w=>({x:w[0],y:w[1],done:false}));","WPS=LV.wps.map(w=>({x:w[0],y:w[1],th:w.length>2?w[2]:null,done:false}));")

# ---------- schema ----------
rep(" plan:[{k:'plan',type:'seg',label:'Global planner',opts:[['straight','Straight line'],['astar','A*'],['rrtstar','RRT*']]},\n       {k:'eps',label:'Heuristic weight ε',min:1,max:5,step:0.25,show:()=>P.plan==='astar'},",
""" plan:[{k:'plan',type:'seg',label:'Global planner',opts:()=>[['straight','Straight line'],['astar','A*'],['rrtstar','RRT*'],...(isCar()?[['rs','Reeds–Shepp'],['hybrid','Hybrid A*']]:[])]},
       {type:'info',text:()=>'A* and RRT* plan for a point with clearance. They ignore the car\\'s heading, body and turning radius.',show:()=>isCar()&&(P.plan==='astar'||P.plan==='rrtstar')},
       {type:'info',text:()=>'Reeds–Shepp ignores obstacles entirely.',show:()=>P.plan==='rs'},
       {k:'eps',label:'Heuristic weight ε',min:1,max:5,step:0.25,show:()=>P.plan==='astar'||P.plan==='hybrid'},
       {k:'hybH',type:'seg',label:'Hybrid A* heuristic',opts:[['both','max(2D, Reeds–Shepp)'],['2d','2D Dijkstra only']],show:()=>P.plan==='hybrid'},
       {k:'revOK',type:'bool',label:'Allow reversing',show:()=>P.plan==='hybrid'},
       {k:'revPen',label:'Reverse cost multiplier',min:1,max:5,step:0.1,unit:'×',show:()=>P.plan==='hybrid'&&P.revOK},
       {k:'gearPen',label:'Gear-change penalty',min:0,max:10,step:0.5,unit:'m',show:()=>P.plan==='hybrid'&&P.revOK},""")
rep("{k:'smooth',type:'bool',label:'Line-of-sight shortcut smoothing',show:()=>P.plan!=='straight'},",
    "{k:'smooth',type:'bool',label:'Line-of-sight shortcut smoothing',show:()=>P.plan==='astar'||P.plan==='rrtstar'},")
rep(" ctl:[{k:'ctl',type:'seg',label:'Path tracker',opts:[['pp','Pure pursuit'],['pid','PID heading'],['dwa','DWA'],['custom','Your code']]},",
    " ctl:[{k:'ctl',type:'seg',label:'Path tracker',opts:()=>[['pp','Pure pursuit'],...(isCar()?[['stanley','Stanley']]:[]),['pid',isCar()?'PID steering':'PID heading'],['dwa','DWA'],['custom','Your code']]},")
rep("      {k:'alat',label:'Lateral accel limit',min:0.1,max:2,step:0.05,unit:'m/s²',show:()=>P.ctl==='pp'},",
    "      {k:'alat',label:'Lateral accel limit',min:0.1,max:2,step:0.05,unit:'m/s²',show:()=>P.ctl==='pp'||P.ctl==='stanley'},\n      {k:'stanK',label:'Stanley gain k',min:0.1,max:8,step:0.1,show:()=>P.ctl==='stanley'},\n      {type:'info',text:()=>'Reverse legs use pure pursuit.',show:()=>P.ctl==='stanley'},")
rep(""" veh:[{k:'vmax',label:'Max speed v_max',min:0.3,max:2,step:0.05,unit:'m/s'},
      {k:'wmax',label:'Max turn rate ω_max',min:0.3,max:4,step:0.1,unit:'rad/s'},
      {k:'accel',type:'bool',label:'Acceleration limits'},
      {k:'amax',label:'Linear accel',min:0.1,max:3,step:0.05,unit:'m/s²',show:()=>P.accel},
      {k:'alpha',label:'Angular accel',min:0.2,max:8,step:0.1,unit:'rad/s²',show:()=>P.accel},""",
""" veh:[{k:'model',type:'seg',label:'Kinematic model',opts:[['diff','Unicycle (diff-drive)'],['car','Car-like (bicycle)']]},
      {k:'wheelbase',label:'Wheelbase L',min:0.3,max:1.2,step:0.05,unit:'m',show:isCar},
      {k:'steerMaxDeg',label:'Max steering angle δ_max',min:15,max:45,step:1,unit:'°',show:isCar},
      {type:'info',text:()=>`Minimum turning radius L / tan δ_max = ${minTurnR().toFixed(2)} m · body ${carLen().toFixed(2)} × ${CAR.width.toFixed(2)} m`,show:isCar},
      {k:'steerRate',label:'Steering rate limit',min:0.2,max:4,step:0.1,unit:'rad/s',show:isCar},
      {k:'vmax',label:'Max speed v_max (reverse: half)',min:0.3,max:2,step:0.05,unit:'m/s'},
      {k:'wmax',label:'Max turn rate ω_max',min:0.3,max:4,step:0.1,unit:'rad/s',show:()=>!isCar()},
      {k:'accel',type:'bool',label:'Acceleration limits'},
      {k:'amax',label:'Linear accel',min:0.1,max:3,step:0.05,unit:'m/s²',show:()=>P.accel},
      {k:'alpha',label:'Angular accel',min:0.2,max:8,step:0.1,unit:'rad/s²',show:()=>P.accel&&!isCar()},""")
rep("{k:'lostGuard',type:'bool',label:'Stop and turn in place when position σ exceeds 1 m'}],",
    "{k:'lostGuard',type:'bool',label:'Stop when position σ exceeds 1 m (diff-drive also turns in place)'}],")
rep("""  if(f.type==='seg')return`<div class="field"><span class="lbl">${f.label}</span><div class="seg" data-k="${f.k}">${f.opts.map(""",
"""  if(f.type==='info'){infoFns.push(f.text);return`<p class="note" data-info="${infoFns.length-1}">${f.text()}</p>`;}
  if(f.type==='seg')return`<div class="field"><span class="lbl">${f.label}</span><div class="seg" data-k="${f.k}">${(typeof f.opts==='function'?f.opts():f.opts).map(""")
rep("let btnActs=[];","let btnActs=[],infoFns=[];")
rep("rg.oninput=()=>{$('#o-'+f.k).textContent=fmtVal(f,rg.value);setParam(f.k,+rg.value,true);};",
    "rg.oninput=()=>{$('#o-'+f.k).textContent=fmtVal(f,rg.value);setParam(f.k,+rg.value,true);pane.querySelectorAll('[data-info]').forEach(el=>{el.textContent=infoFns[+el.dataset.info]();});};")
rep("  btnActs=btnActs.slice(-20);","  btnActs=btnActs.slice(-20);infoFns=infoFns.slice(-20);")

# ---------- notes ----------
rep("""keeping 0.5 m clearance.</p>`,""","""keeping 0.5 m clearance.</p>
<p><b>Reeds–Shepp</b> (car only) is the shortest path for a car that drives forward and backward with a minimum turning radius, ignoring obstacles. It has a closed-form solution over 48 path words such as L⁺S⁺R⁻ (left forward, straight forward, right reverse).</p>
<p><b>Hybrid A*</b> (car only) searches cells of 0.2 m × 5°, but each node keeps its continuous pose, so every edge is a drivable arc: 5 steering angles × forward/reverse, 0.4 m each.</p>
<div class="eq">g += length·(1 or reverse ×) + gear-change penalty + steering terms + proximity
h  = ε · max(2D Dijkstra with obstacles, Reeds–Shepp without obstacles)
analytic expansion: a Reeds–Shepp shot to the goal every 10 expansions,
                    every expansion within 2.5 m; accepted if collision-free</div>
<p>The two heuristics cover each other's blind spots. The 2D term sees walls but not turning; the Reeds–Shepp term sees turning but not walls. Collision checks use the car footprint (three covering circles) on the costmap distance field.</p>
<p>To give a goal a heading, use <b>Tap map to → Add posed goal</b> and drag in the direction the car should face. Goals without a heading are accepted at any heading.</p>`,""")
rep("""Predicting their motion is the next level up (velocity obstacles, MPC).</p>`,""","""Predicting their motion is the next level up (velocity obstacles, MPC).</p>
<p><b>Car-like model.</b> Pure pursuit outputs steering directly. Stanley uses the front axle as its reference point.</p>
<div class="eq">pure pursuit:  δ = atan(2 L_wb sin α / L_d)
Stanley:       δ = (θ_path − θ) − atan2(k · e_left, 0.5 + |v|)    e_left: front-axle offset, + = left of path</div>
<p>On reverse legs, pure pursuit and PID work in a virtual frame (heading θ + π, steering sign flipped). That is exact for the rear-axle point. Stanley's reference point would trail on a reverse leg, so reverse legs fall back to pure pursuit. A leg ends within 0.12 m of its cusp, and the next leg starts from rest.</p>`,""")
rep("""<p><b>Beacons:</b> range σ = 0.08 m, bearing σ = 0.03 rad (× noise scale), line-of-sight required. <b>Collisions</b> stop translation but allow turning in place.</p>`,""",
"""<p><b>Beacons:</b> range σ = 0.08 m, bearing σ = 0.03 rad (× noise scale), line-of-sight required. <b>Collisions</b> stop translation. The diff-drive robot can still turn in place.</p>
<p><b>Car-like (kinematic bicycle)</b>, pose at the rear-axle centre.</p>
<div class="eq">ẋ = v cos θ,  ẏ = v sin θ,  θ̇ = v tan δ / L
|δ| ≤ δ_max  →  R_min = L / tan δ_max;   |δ̇| ≤ steering rate
command (v, δ) → lag τ → accel limit → steering-rate limit → integrate</div>
<p>The car cannot turn in place: heading changes only while it moves. Physics uses the exact body rectangle. Planners and DWA use three covering circles, which overestimates the bumpers by about 0.14 m. Odometry still reports (v, ω), so localization works unchanged.</p>`,""")

# ---------- setParam ----------
rep("const old=P[k];P[k]=v;if(old===v&&!['infl','eps','rrtIt'].includes(k))return;",
    "const old=P[k];P[k]=v;if(old===v&&!['infl','eps','rrtIt','wheelbase','steerMaxDeg','revPen','gearPen'].includes(k))return;")
rep("  if(k==='seed'&&!live)logE(`Seed ${v} takes effect on Reset`);",
"""  if(k==='seed'&&!live)logE(`Seed ${v} takes effect on Reset`);
  if(k==='model'){S.robot.d=0;S.robot.w=0;S.cmd={v:0,w:0,steer:0};
    if(v==='diff'){if(P.plan==='rs'||P.plan==='hybrid')P.plan='astar';if(P.ctl==='stanley')P.ctl='pp';}
    else if(P.plan!=='rs')P.plan='hybrid';
    logE(v==='car'?'Vehicle → car-like (bicycle) · planner → Hybrid A*':'Vehicle → unicycle (diff-drive)');requestReplan('vehicle model changed');}
  if(['wheelbase','steerMaxDeg','revOK','revPen','gearPen','hybH'].includes(k)&&!live&&(P.plan==='hybrid'||P.plan==='rs'))requestReplan('vehicle or planner changed');""")
rep("{pp:'pure pursuit',pid:'PID heading',dwa:'DWA',custom:'your code'})[v]","{pp:'pure pursuit',pid:'PID',dwa:'DWA',stanley:'Stanley',custom:'your code'})[v]")

# ---------- tap handling ----------
rep("let running=false, speed=1, tapMode='wp', plotCh='ex';","let running=false, speed=1, tapMode='wp', plotCh='ex', poseDrag=null;")
rep("seg($('#tapmode'),[['wp','Add waypoint'],['goal','Set single goal'],['kidnap','Kidnap robot']],()=>tapMode,v=>tapMode=v);",
    "seg($('#tapmode'),[['wp','Add waypoint'],['pose','Add posed goal (drag)'],['goal','Set single goal'],['kidnap','Kidnap robot']],()=>tapMode,v=>{tapMode=v;cv.style.touchAction=v==='pose'?'none':'manipulation';});")
rep("""cv.addEventListener('pointerdown',e=>{
  const r=cv.getBoundingClientRect(),x=(e.clientX-r.left)/r.width*W,y=H-(e.clientY-r.top)/r.height*H;
  const k=cellIdx(x,y);if(k<0)return;
  const free=LV.truthDist[k]>RR+0.02;
  if(tapMode==='kidnap'){
    if(!free){logE('Cannot place the robot inside an obstacle','warn');return;}
    S.robot.x=x;S.robot.y=y;S.robot.v=0;S.robot.w=0;S.robot.contact=false;S.trailT.push(null);""",
"""const toWorld=e=>{const r=cv.getBoundingClientRect();return[(e.clientX-r.left)/r.width*W,H-(e.clientY-r.top)/r.height*H];};
function addPosed(x,y,th){
  const k=cellIdx(x,y);if(k<0)return;
  const ok=isCar()&&th!=null?!carHits(x,y,th,S.shapes,0.05):LV.truthDist[k]>(isCar()?CAR.width/2+0.05:RR+0.02);
  if(!ok){logE('That pose overlaps an obstacle','warn');draw();return;}
  if(remaining().length>=8){logE('Up to 8 open waypoints','warn');return;}
  WPS.push({x,y,th,done:false});if(th!=null&&!isCar())logE('Goal heading is only used by the car-like model','warn');
  startMission();doPlan('initial');draw();refreshAll();
}
cv.addEventListener('pointermove',e=>{if(!poseDrag)return;const[x,y]=toWorld(e);poseDrag.x2=x;poseDrag.y2=y;draw();});
cv.addEventListener('pointerup',()=>{if(!poseDrag)return;const d=poseDrag;poseDrag=null;const dx=d.x2-d.x,dy=d.y2-d.y;addPosed(d.x,d.y,hyp(dx,dy)>0.3?Math.atan2(dy,dx):null);});
cv.addEventListener('pointercancel',()=>{poseDrag=null;draw();});
cv.addEventListener('pointerdown',e=>{
  const[x,y]=toWorld(e);
  const k=cellIdx(x,y);if(k<0)return;
  if(tapMode==='pose'){poseDrag={x,y,x2:x,y2:y};try{cv.setPointerCapture(e.pointerId);}catch(_){}draw();return;}
  const free=LV.truthDist[k]>(isCar()?CAR.width/2+0.05:RR+0.02);
  if(tapMode==='kidnap'){
    if(isCar()?carHits(x,y,S.robot.th,S.shapes,0.02):!free){logE('Cannot place the robot inside an obstacle','warn');return;}
    S.robot.x=x;S.robot.y=y;S.robot.v=0;S.robot.w=0;S.robot.d=0;S.robot.contact=false;S.trailT.push(null);""")
rep("  if(tapMode==='goal'){WPS.forEach(w=>w.done=true);WPS=[{x,y,done:false}];}\n  else{if(remaining().length>=8){logE('Up to 8 open waypoints','warn');return;}WPS.push({x,y,done:false});}",
    "  if(tapMode==='goal'){WPS.forEach(w=>w.done=true);WPS=[{x,y,th:null,done:false}];}\n  else{if(remaining().length>=8){logE('Up to 8 open waypoints','warn');return;}WPS.push({x,y,th:null,done:false});}")
# reverse speed cap helper
rep("function trackPre(){","const vCap=dir=>dir>0?P.vmax:Math.min(0.35,0.5*P.vmax);   // reverse legs: manoeuvring speed\nfunction trackPre(){")
s=s.replace("Math.min(P.vcruise,dir>0?P.vmax:0.5*P.vmax)","Math.min(P.vcruise,vCap(dir))")
s=s.replace("Math.min(P.vcruise,dir>0?P.vmax:0.5*P.vmax,decelCap(dg)+0.05)","Math.min(P.vcruise,vCap(dir),decelCap(dg)+0.05)")
# dry steering for built-in car controllers
rep("""function builtinCmd(){""","""function builtinCmd(){const c=builtinRaw();
  // car: hold speed until the wheels have turned close to the commanded angle (dry steering at cusps)
  if(isCar()&&c.steer!=null){const de=Math.abs(c.steer-S.robot.d);if(de>0.1)c.v*=clamp(1-(de-0.1)/0.25,0,1);}
  return c;}
function builtinRaw(){""")
rep("const dist=S.cm.dist,L=P.wheelbase,dm=steerMax(),R=minTurnR(),MARG=0.08,","const dist=S.cm.dist,L=P.wheelbase,dm=steerMax(),R=minTurnR(),MARG=0.15,")
# posed arrival tighter
rep("const posed=isCar()&&wp.th!=null,headOK=!posed||Math.abs(wrap(e.th-wp.th))<0.35;\n  if(lastSeg&&headOK&&hyp(e.x-wp.x,e.y-wp.y)<ARRIVE){",
    "const posed=isCar()&&wp.th!=null,headOK=!posed||Math.abs(wrap(e.th-wp.th))<0.2;\n  if(lastSeg&&headOK&&hyp(e.x-wp.x,e.y-wp.y)<(posed?0.2:ARRIVE)){")
rep("start:[2,4,Math.PI/2],wps:[[10.5,15.35,-Math.PI/2],[15.5,8.4,Math.PI/2],[5.6,0.62,0],[2,13]],",
    "start:[2,4,Math.PI/2],wps:[[10.5,15.3,-Math.PI/2],[15.5,8.35,Math.PI/2],[5.6,0.68,0],[2,13]],")
rep("analytic expansion: a Reeds–Shepp shot","margin 0.15 m · analytic expansion: a Reeds–Shepp shot")
rep("A leg ends within 0.12 m of its cusp, and the next leg starts from rest.</p>",
    "A leg ends within 0.12 m of its cusp. The built-in car controllers hold speed until the wheels reach the commanded angle (dry steering), and reverse legs are capped at 0.35 m/s.</p>")
# path curvature per vertex (travel direction), for feedforward
rep("""  S.track={pts,s,total:s[s.length-1],idx:0,dir:1};S.pathId++;""",
"""  S.track={pts,s,total:s[s.length-1],idx:0,dir:1};S.pathId++;
  const n=pts.length,hd=[],kv=new Float64Array(n);for(let i=0;i<n-1;i++)hd.push(Math.atan2(pts[i+1][1]-pts[i][1],pts[i+1][0]-pts[i][0]));
  for(let i=1;i<n-1;i++){const l=(s[i+1]-s[i-1])/2;kv[i]=l>1e-6?wrap(hd[i]-hd[i-1])/l:0;}if(n>2)kv[0]=kv[1];
  S.track.hd=hd;S.track.kv=kv;""")
rep("const vCap=dir=>","""function kapAt(sArc){const T=S.track;if(sArc>=T.total||sArc<0)return 0;let i=T.idx;while(i>0&&T.s[i]>sArc)i--;while(i<T.pts.length-2&&T.s[i+1]<sArc)i++;
  const t=(sArc-T.s[i])/((T.s[i+1]-T.s[i])||1);return T.kv[i]+(T.kv[i+1]-T.kv[i])*t;}
// Rear-wheel feedback (Samson; Paden et al. 2016 §V-A): curvature feedforward + heading and lateral feedback
function ctlRWF(){
  const{e,T,pr,dir,thv}=trackPre(),q=pointAt(pr.s),i=Math.min(pr.i,T.hd.length-1),thp=T.hd[i];
  const el=Math.cos(thp)*(e.y-q[1])-Math.sin(thp)*(e.x-q[0]),the=wrap(thv-thp);  // el > 0: left of path
  const vprev=Math.abs(S.odo.v),kmax=isCar()?Math.tan(steerMax())/P.wheelbase:3;
  const k=clamp(kapAt(pr.s+0.1+0.3*vprev),-kmax,kmax);
  let kpk=0;for(let ds=0;ds<=0.8;ds+=0.2)kpk=Math.max(kpk,Math.abs(kapAt(pr.s+ds)));
  let v=Math.min(P.vcruise,vCap(dir));if(kpk>1e-6)v=Math.min(v,Math.sqrt(P.alat/kpk));
  v=Math.min(v,decelCap(goalDist(pr)));
  const sinc=Math.abs(the)<1e-4?1:Math.sin(the)/the;
  const kc=k*Math.cos(the)/Math.max(0.3,1-k*el)-P.rwKth*the-P.rwKe*sinc*el;
  S.ctlViz={carrot:q};
  if(isCar()){const dv=clamp(Math.atan(P.wheelbase*kc),-steerMax(),steerMax());return{v:dir*v,steer:dir*dv};}
  if(Math.abs(the)>Math.PI/2)return{v:0,w:-Math.sign(the)*P.wmax*0.7};
  return{v,w:clamp(v*kc,-P.wmax,P.wmax)};
}
const vCap=dir=>""")
rep("if(P.ctl==='stanley')return ctlStanley();","if(P.ctl==='stanley')return ctlStanley(); if(P.ctl==='rwf')return ctlRWF();")
rep("mis:'sequential',replan:0,lostGuard:false,","mis:'sequential',replan:0,lostGuard:false,rwKth:2.0,rwKe:3.0,")
rep("opts:()=>[['pp','Pure pursuit'],...(isCar()?[['stanley','Stanley']]:[]),","opts:()=>[['pp','Pure pursuit'],['rwf','Rear-wheel feedback'],...(isCar()?[['stanley','Stanley']]:[]),")
rep("      {k:'stanK',label:'Stanley gain k',","      {k:'rwKth',label:'Heading gain k_θ',min:0,max:6,step:0.1,unit:'1/m',show:()=>P.ctl==='rwf'},\n      {k:'rwKe',label:'Lateral gain k_e',min:0,max:12,step:0.1,unit:'1/m²',show:()=>P.ctl==='rwf'},\n      {k:'stanK',label:'Stanley gain k',")
rep("show:()=>P.ctl==='pp'||P.ctl==='stanley'},","show:()=>P.ctl==='pp'||P.ctl==='stanley'||P.ctl==='rwf'},")
rep("{pp:'pure pursuit',pid:'PID',dwa:'DWA',stanley:'Stanley',custom:'your code'}","{pp:'pure pursuit',rwf:'rear-wheel feedback',pid:'PID',dwa:'DWA',stanley:'Stanley',custom:'your code'}")
rep("plan:'hybrid',ctl:'pp',odoK:0,odoB:0,accel:false,lag:0,assoc:'known',clutter:0,replan:0,vcruise:0.6,ppL0:0.4,ppK:0.3}",
    "plan:'hybrid',ctl:'rwf',odoK:0,odoB:0,accel:false,lag:0,assoc:'known',clutter:0,replan:0,vcruise:0.6,ppL0:0.4,ppK:0.3}")
rep("""<p><b>Car-like model.</b> Pure pursuit outputs steering directly. Stanley uses the front axle as its reference point.</p>""",
"""<p><b>Rear-wheel feedback</b> (Samson; Paden et al. 2016) projects the rear axle onto the path and commands a curvature: the path's own curvature as feedforward, plus heading and lateral feedback. It works for both models (ω = v·κ for diff-drive, δ = atan(L·κ) for the car).</p>
<div class="eq">κ_cmd = κ(s)·cos θe / (1 − κ(s)·e) − k_θ·θe − k_e·(sin θe / θe)·e
e: lateral offset (+ left),  θe: heading error,  κ(s) previewed 0.1 m + 0.3 s ahead</div>
<p>Pure pursuit has no feedforward. On full-lock arcs it cuts the inside of the turn, which is why it struggles in the parking lot.</p>
<p><b>Car-like model.</b> Pure pursuit outputs steering directly. Stanley uses the front axle as its reference point.</p>""")
rep("'<b>Control:</b> Stanley versus pure pursuit on forward legs. Use the Steering plot, and lower the steering rate limit in Vehicle.',",
    "'<b>Control:</b> the default is rear-wheel feedback (curvature feedforward). Switch to pure pursuit and watch it cut the inside of full-lock arcs. Then try Stanley and lower the steering rate limit in Vehicle.',")
# planner leniency when the start overlaps an obstacle: based on distance from the start, not cost
rep("const c=clearAt(nx,ny,nt),need=(lenient&&B.g[u]<0.8)?Math.min(MARG,startClear-0.02):MARG;",
    "const c=clearAt(nx,ny,nt),need=(lenient&&hyp(nx-e.x,ny-e.y)<1.0)?Math.min(MARG,startClear-0.02):MARG;")
rep("const minTurnR=()=>P.wheelbase/Math.tan(steerMax());",
    "const minTurnR=()=>P.wheelbase/Math.tan(steerMax());\nconst planSteer=()=>steerMax()*P.planPct/100, planR=()=>P.wheelbase/Math.tan(planSteer());   // planners keep steering margin for feedback")
rep("rwKth:2.0,rwKe:3.0,","rwKth:2.0,rwKe:3.0,planPct:85,")
rep("const dist=S.cm.dist,L=P.wheelbase,dm=steerMax(),R=minTurnR(),MARG=0.15,","const dist=S.cm.dist,L=P.wheelbase,dm=planSteer(),R=planR(),MARG=0.15,")
rep("  const R=minTurnR(),th=wp.th!=null?wp.th:Math.atan2(wp.y-e.y,wp.x-e.x);","  const R=planR(),th=wp.th!=null?wp.th:Math.atan2(wp.y-e.y,wp.x-e.x);")
rep("function kapAt(sArc){const T=S.track;if(sArc>=T.total||sArc<0)return 0;",
    "function kapAt(sArc){const T=S.track;if(sArc<0)return 0;sArc=Math.min(sArc,T.total-1e-3);   // hold the final curvature up to the cusp\n")
rep("       {k:'eps',label:'Heuristic weight ε',","       {k:'planPct',label:'Steering used by the planner',min:50,max:100,step:5,unit:'% of δ_max',show:()=>isCar()&&(P.plan==='hybrid'||P.plan==='rs')},\n       {type:'info',text:()=>`Planning radius ${planR().toFixed(2)} m (vehicle minimum ${minTurnR().toFixed(2)} m)`,show:()=>isCar()&&(P.plan==='hybrid'||P.plan==='rs')},\n       {k:'eps',label:'Heuristic weight ε',")
rep("const old=P[k];P[k]=v;if(old===v&&!['infl','eps','rrtIt','wheelbase','steerMaxDeg','revPen','gearPen'].includes(k))return;",
    "const old=P[k];P[k]=v;if(old===v&&!['infl','eps','rrtIt','wheelbase','steerMaxDeg','revPen','gearPen','planPct'].includes(k))return;")
rep("if(['wheelbase','steerMaxDeg','revOK','revPen','gearPen','hybH'].includes(k)","if(['wheelbase','steerMaxDeg','revOK','revPen','gearPen','hybH','planPct'].includes(k)")
rep("<p>The two heuristics cover each other's blind spots.","<p><b>Steering margin.</b> Planning at 100% of δ_max produces full-lock arcs. A tracker that starts such an arc slightly off has no steering left to correct with. By default the planners use 85%. Push it to 100% and watch the parking legs fail.</p>\n<p>The two heuristics cover each other's blind spots.")
rep("if(dg<0.25&&(goalTh==null||Math.abs(wrap(th-goalTh))<0.15)){fin=u;break;}",
    "if(dg<0.15&&(goalTh==null||Math.abs(wrap(th-goalTh))<0.12)){fin=u;break;}   // inside the arrival tolerance")
rep("""      for(let ci=0;ci<Math.min(4,cs.length)&&!tail;ci++){
        const segs=RS.sample([x,y,th],cs[ci],R,SUB);let ok=true;""",
"""      for(let ci=0,tried=0;ci<cs.length&&tried<4&&!tail;ci++){
        // reject shots with gear legs too short to execute (< 0.25 m)
        let short=false,acc=0,sg0=0;for(const d of cs[ci].L){const sg=Math.sign(d);if(Math.abs(d)<1e-9)continue;if(sg!==sg0&&sg0!==0){if(acc<0.25)short=true;acc=0;}sg0=sg;acc+=Math.abs(d)*R;}if(acc<0.25&&cs[ci].len*R>0.25)short=true;
        if(short)continue;tried++;
        const segs=RS.sample([x,y,th],cs[ci],R,SUB);let ok=true;""")
rep("""  const posed=isCar()&&wp.th!=null,headOK=!posed||Math.abs(wrap(e.th-wp.th))<0.2;
  if(lastSeg&&headOK&&hyp(e.x-wp.x,e.y-wp.y)<(posed?0.2:ARRIVE)){""",
"""  const posed=isCar()&&wp.th!=null,headOK=!posed||Math.abs(wrap(e.th-wp.th))<0.2;
  const legDone=!isCar()||!S.track||(S.track.total-project(e.x,e.y,true).s<0.15);
  if(lastSeg&&headOK&&legDone&&hyp(e.x-wp.x,e.y-wp.y)<(posed?0.2:ARRIVE)){""")
rep("for(const x of[4,6.8,9.5,12.5,15.5])s.push(Rc(x,0.3,1.0,0.56));","for(const x of[4,7.2,9.7,12.5,15.5])s.push(Rc(x,0.3,1.0,0.56));   // 2.2 m parallel slot at x 5.0–7.2")
rep("[15.5,8.35,Math.PI/2],[5.6,0.68,0],[2,13]],","[15.5,8.35,Math.PI/2],[5.8,0.68,0],[2,13]],")
rep("const decelCap=d=>Math.sqrt(2*(P.accel?P.amax:0.8)*Math.max(0,d-0.08));",
    "const decelCap=d=>Math.sqrt(2*(P.accel?P.amax:0.8)*Math.max(0,d-(isCar()?0.02:0.08)))+(isCar()&&d>0.03?0.05:0);   // car creeps to the leg end")
rep("const legDone=!isCar()||!S.track||(S.track.total-project(e.x,e.y,true).s<0.15);","const legDone=!isCar()||!S.track||(S.track.total-project(e.x,e.y,true).s<0.08);")
rep("for(let i=1;i<n-1;i++){const l=(s[i+1]-s[i-1])/2;kv[i]=l>1e-6?wrap(hd[i]-hd[i-1])/l:0;}if(n>2)kv[0]=kv[1];",
    "for(let i=1;i<n-1;i++){const l=(s[i+1]-s[i-1])/2;kv[i]=l>1e-6?wrap(hd[i]-hd[i-1])/l:0;}if(n>2){kv[0]=kv[1];kv[n-1]=kv[n-2];}")
rep("const k=clamp(kapAt(pr.s+0.1+0.3*vprev),-kmax,kmax);","const k=clamp(kapAt(pr.s+0.2),-kmax,kmax);   // fixed preview covers steering-rate lag")
rep("const decelCap=d=>Math.sqrt(2*(P.accel?P.amax:0.8)*Math.max(0,d-(isCar()?0.02:0.08)))+(isCar()&&d>0.03?0.05:0);   // car creeps to the leg end",
    "const decelCap=d=>isCar()?Math.min(Math.sqrt(2*(P.accel?P.amax:0.8)*Math.max(0,d-0.02)),0.1+0.6*d)+(d>0.03?0.04:0)   // car: linear ramp into each leg end\n  :Math.sqrt(2*(P.accel?P.amax:0.8)*Math.max(0,d-0.08));")
rep("rwKth:2.0,rwKe:3.0,","rwKth:3.0,rwKe:6.0,")
rep("e: lateral offset (+ left),  θe: heading error,  κ(s) previewed 0.1 m + 0.3 s ahead</div>","e: lateral offset (+ left),  θe: heading error,  κ(s) previewed 0.2 m ahead</div>")
rep("const c=clearAt(nx,ny,nt),need=(lenient&&hyp(nx-e.x,ny-e.y)<1.0)?Math.min(MARG,startClear-0.02):MARG;",
    "const c=clearAt(nx,ny,nt),need=(lenient&&hyp(nx-e.x,ny-e.y)<1.0)?Math.min(MARG,startClear-0.1):MARG;   // let a car that is touching something back out")
rep("         '<b>Control:</b> the default is rear-wheel feedback (curvature feedforward).",
    "         '<b>Control:</b> DWA follows the plan into a bay but stops short. It scores distance to a carrot, not the final pose, so it is a local avoider rather than a parking controller.',\n         '<b>Control:</b> the default is rear-wheel feedback (curvature feedforward).")
rep("'<b>Plan:</b> set the heuristic to 2D only and compare expansions in the log.',",
    "'<b>Plan:</b> set the heuristic to 2D only and compare expansions in the log. Then raise Steering used by the planner to 100%: full-lock arcs leave the tracker no room to correct.',")
rep('<p class="sub">differential-drive robot · 24 × 16 m world · 20 Hz fixed step</p>','<p class="sub">diff-drive or car-like robot · 24 × 16 m world · 20 Hz fixed step</p>')
rep(".tabs{display:flex;overflow-x:auto;border-bottom:1px solid var(--line);scrollbar-width:thin}",".tabs{display:flex;flex-wrap:wrap;border-bottom:1px solid var(--line)}")
rep("{k:'vmax',label:'Max speed v_max (reverse: half)',","{k:'vmax',label:'Max speed v_max (reverse: half; car reverse ≤ 0.35)',")
# ================= MPC =================
rep("function builtinCmd(){const c=builtinRaw();",
r"""/* ============================================================
   Model predictive control
   Gauss–Newton SQP on the condensed (single-shooting) problem.
   NMPC: relinearize about the latest nonlinear rollout every iteration.
   LTV:  linearize once about the reference and predict with that linear model.
   Inputs are actuator rates, so input bounds are exact (box QP);
   state constraints use augmented-Lagrangian penalties.
   ============================================================ */
// State x = [x, y, θ, v, s, (v_cmd, s_cmd)], s = δ (car) or ω (diff); input u = [a, ṡ]
function mpcModel(){
  const car=isCar(),L=P.wheelbase,lag=P.mpcLag&&P.lag>0,tau=P.lag;
  const f=(x,u,dt)=>{
    const v=x[3],s=x[4],w=car?v*Math.tan(s)/L:s,thm=x[2]+0.5*w*dt;
    const o=[x[0]+v*Math.cos(thm)*dt,x[1]+v*Math.sin(thm)*dt,x[2]+w*dt,0,0];
    if(lag){const a=1-Math.exp(-dt/tau);o[3]=v+(x[5]-v)*a;o[4]=s+(x[6]-s)*a;o.push(x[5]+u[0]*dt,x[6]+u[1]*dt);}
    else{o[3]=v+u[0]*dt;o[4]=s+u[1]*dt;}
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
  const e=S.est,T=S.track,pr=project(e.x,e.y,true),dir=T.dir||1,ref=[];
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
  if(M.lag)x0.push(S.cmd.v||0,car?(S.cmd.steer||0):(S.cmd.w||0));
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
  const nc=4+(obs?offs.length:0);
  const pts=obs?S.scanPts.filter(p=>hyp(p[0]-e.x,p[1]-e.y)<Np*dt*Math.max(vMax,0.3)+1.5):[];
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
        out.push([rc+P.mpcMarg-d,[-ux,-uy,-(ux*(-o*sn)+uy*(o*c)),0,0]]);}}
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
  const bv=M.lag?x0[5]:x0[3],bs=M.lag?x0[6]:x0[4],vc=bv+u0[0]*DT,sc=bs+u0[1]*DT;
  return car?{v:vc,steer:sc}:{v:vc,w:sc};
}

function builtinCmd(){const c=builtinRaw();""")
rep("  if(isCar()&&c.steer!=null){const de=","  if(isCar()&&c.steer!=null&&P.ctl!=='mpc'){const de=")
rep("if(P.ctl==='stanley')return ctlStanley(); if(P.ctl==='rwf')return ctlRWF();","if(P.ctl==='stanley')return ctlStanley(); if(P.ctl==='rwf')return ctlRWF(); if(P.ctl==='mpc')return ctlMPC();")
rep("rwKth:3.0,rwKe:6.0,","rwKth:3.0,rwKe:6.0,mpcMode:'nmpc',mpcNp:20,mpcNc:10,mpcDt:0.1,mpcIt:3,mpcQlat:20,mpcQlon:4,mpcQth:6,mpcQv:2,mpcQf:5,mpcRa:0.3,mpcRs:0.3,mpcRd:1.0,mpcRho:200,mpcObs:false,mpcMarg:0.1,mpcLag:false,")
# state reset
rep("cmd:{v:0,w:0,steer:0},odo:{v:0,w:0},plan:null,segIdx:0,","cmd:{v:0,w:0,steer:0},odo:{v:0,w:0},plan:null,segIdx:0,mpc:null,mpcStats:null,")
# ---------- UI ----------
rep("opts:()=>[['pp','Pure pursuit'],['rwf','Rear-wheel feedback'],...(isCar()?[['stanley','Stanley']]:[]),['pid',isCar()?'PID steering':'PID heading'],['dwa','DWA'],['custom','Your code']]},",
    "opts:()=>[['pp','Pure pursuit'],['rwf','Rear-wheel feedback'],...(isCar()?[['stanley','Stanley']]:[]),['pid',isCar()?'PID steering':'PID heading'],['dwa','DWA'],['mpc','MPC'],['custom','Your code']]},")
rep("      {k:'dwaT',label:'Rollout horizon',min:0.5,max:3,step:0.1,unit:'s',show:()=>P.ctl==='dwa'}],",
"""      {k:'dwaT',label:'Rollout horizon',min:0.5,max:3,step:0.1,unit:'s',show:()=>P.ctl==='dwa'},
      {k:'mpcMode',type:'seg',label:'MPC formulation',opts:[['nmpc','Nonlinear (NMPC)'],['ltv','Linearized about reference (LTV)']],show:mpc_},
      {k:'mpcNp',label:'Prediction horizon Np',min:3,max:40,step:1,unit:'steps',show:mpc_},
      {k:'mpcNc',label:'Control horizon Nc (free moves, then held)',min:1,max:40,step:1,unit:'steps',show:mpc_},
      {k:'mpcDt',label:'Prediction step Δt',min:0.05,max:0.3,step:0.05,unit:'s',show:mpc_},
      {type:'info',text:()=>{const np=Math.round(P.mpcNp),nc=Math.min(Math.round(P.mpcNc),np);return`Looks ${(np*P.mpcDt).toFixed(1)} s ahead with ${nc} free input move${nc>1?'s':''} (${(nc*P.mpcDt).toFixed(1)} s); ${2*nc} decision variables.${P.mpcNc>P.mpcNp?' Nc is capped at Np.':''}`;},show:mpc_},
      {k:'mpcIt',label:'SQP iterations per tick',min:1,max:10,step:1,show:()=>mpc_()&&P.mpcMode==='nmpc'},
      {k:'mpcQlat',label:'Weight: lateral error',min:0,max:100,step:1,show:mpc_},
      {k:'mpcQlon',label:'Weight: along-track error',min:0,max:50,step:0.5,show:mpc_},
      {k:'mpcQth',label:'Weight: heading error',min:0,max:50,step:0.5,show:mpc_},
      {k:'mpcQv',label:'Weight: speed error',min:0,max:20,step:0.5,show:mpc_},
      {k:'mpcQf',label:'Terminal weight multiplier',min:1,max:30,step:1,unit:'×',show:mpc_},
      {k:'mpcRa',label:'Input weight: acceleration',min:0,max:5,step:0.05,show:mpc_},
      {k:'mpcRs',label:'Input weight: steering rate (car) / angular accel',min:0,max:5,step:0.05,show:mpc_},
      {k:'mpcRd',label:'Input change weight (Δu between moves)',min:0,max:10,step:0.1,show:mpc_},
      {k:'mpcRho',label:'Constraint penalty ρ (augmented Lagrangian)',min:10,max:1000,step:10,show:mpc_},
      {k:'mpcObs',type:'bool',label:'Obstacle constraints from lidar (nonconvex, NMPC only)',show:()=>mpc_()&&P.mpcMode==='nmpc'},
      {k:'mpcMarg',label:'Obstacle margin',min:0,max:0.5,step:0.01,unit:'m',show:()=>mpc_()&&P.mpcMode==='nmpc'&&P.mpcObs},
      {k:'mpcLag',type:'bool',label:'Include actuator lag τ in the prediction model (adds 2 states)',show:mpc_},
      {type:'info',text:()=>`Input bounds come from Vehicle: |a| ≤ ${(P.accel?P.amax:3).toFixed(2)} m/s², ${isCar()?`|δ̇| ≤ ${P.steerRate.toFixed(1)} rad/s`:`|α| ≤ ${(P.accel?P.alpha:8).toFixed(1)} rad/s²`}. ${P.accel?'':'Acceleration limits are off, so the model assumes 3 m/s². '}${P.mpcLag&&!(P.lag>0)?'Lag τ is 0 in Vehicle, so the lag model is inactive.':''}`,show:mpc_}],""")
rep("const pf_=()=>P.loc==='pf',","const mpc_=()=>P.ctl==='mpc',pf_=()=>P.loc==='pf',")
rep("{k:'vcruise',label:'Cruise speed',min:0.2,max:2,step:0.05,unit:'m/s',show:()=>P.ctl!=='custom'},","{k:'vcruise',label:'Cruise speed (reference profile)',min:0.2,max:2,step:0.05,unit:'m/s',show:()=>P.ctl!=='custom'},")
rep("show:()=>P.ctl==='pp'||P.ctl==='stanley'||P.ctl==='rwf'},","show:()=>P.ctl==='pp'||P.ctl==='stanley'||P.ctl==='rwf'||P.ctl==='mpc'},")
rep("{pp:'pure pursuit',rwf:'rear-wheel feedback',pid:'PID',dwa:'DWA',stanley:'Stanley',custom:'your code'}","{pp:'pure pursuit',rwf:'rear-wheel feedback',pid:'PID',dwa:'DWA',stanley:'Stanley',mpc:'MPC',custom:'your code'}")
rep("['dwa','DWA rollouts']];","['dwa','Local planner: DWA rollouts, MPC prediction and reference']];")
# metrics
rep("  if(S.pf)items.push(['Particles',","  if(P.ctl==='mpc'&&S.mpcStats){const m=S.mpcStats;items.push(['MPC solve',`${m.mode} · ${m.ms.toFixed(1)} ms · ${m.it} it · J ${m.J.toFixed(1)}`],['MPC max violation',m.viol>0.005?`${m.viol.toFixed(3)}`:'none']);}\n  if(S.pf)items.push(['Particles',")
# draw prediction
rep("  if(LAYERS.dwa&&S.ctlViz&&S.ctlViz.trajs){",
"""  if(LAYERS.dwa&&S.ctlViz&&S.ctlViz.pred){const V=S.ctlViz;
    ctx.fillStyle=TOK.accent;for(const p of V.ref){ctx.beginPath();ctx.arc(p[0],p[1],px(2.2),0,TAU);ctx.fill();}
    if(V.lin){ctx.strokeStyle=TOK.rose;ctx.lineWidth=px(2);ctx.setLineDash([px(4),px(3)]);polyline(V.lin);ctx.stroke();ctx.setLineDash([]);}
    ctx.strokeStyle=TOK.ok;ctx.lineWidth=px(2.5);polyline(V.pred);ctx.stroke();
    ctx.fillStyle=TOK.ok;for(let i=0;i<V.pred.length;i++){const p=V.pred[i];ctx.beginPath();ctx.arc(p[0],p[1],px(1.8),0,TAU);ctx.fill();}}
  if(LAYERS.dwa&&S.ctlViz&&S.ctlViz.trajs){""")
rep("""        <span><i class="disc" style="background:var(--warn)"></i>people</span>""","""        <span><i class="disc" style="background:var(--warn)"></i>people</span>
        <span><i style="border-color:var(--ok)"></i>MPC prediction (LTV: dashed = linear model)</span>""")
# notes
rep("""<p><b>Car-like model.</b> Pure pursuit outputs steering directly.""","""<p><b>MPC</b> solves a finite-horizon optimal control problem every 50 ms and applies only the first move.</p>
<div class="eq">state  x = [x, y, θ, v, s]   s = ω (diff-drive) or δ (car)   (+ [v_cmd, s_cmd] if lag is modelled)
input  u = [a, ṡ]           so |a| ≤ a_max and |ṡ| ≤ rate limit are exact box constraints
model  θ_mid = θ + ½ω Δt,  x⁺ = x + v cos θ_mid Δt, …,  ω = v tan δ / L for the car

min  Σ_{k=1..Np} w_k (Q_lon e_lon² + Q_lat e_lat² + Q_θ e_θ² + Q_v e_v²)        w_Np = terminal ×
   + Σ_{k=0..Np−1} (R_a a_k² + R_s ṡ_k²) + R_Δ Σ_{k<Nc} ‖u_k − u_{k−1}‖²
s.t. u_k = u_{Nc−1} for k ≥ Nc (control horizon)
     |s| ≤ s_max, speed sign and limit per leg, footprint clearance ≥ margin  (augmented Lagrangian)</div>
<p><b>Solver.</b> Single-shooting Gauss–Newton SQP. Each iteration rolls the model out, computes sensitivities ∂x_k/∂U from the Jacobians A_k and B_k, builds H = JᵀJ and g = Jᵀr over the 2·Nc decision variables, and solves the box-constrained QP by projected Newton. A backtracking line search on the true cost follows, then a multiplier update. It is warm-started from the previous solution shifted by one tick, which is the real-time-iteration idea.</p>
<p><b>NMPC</b> relinearizes about its own rollout every iteration, so it stays valid far from the path and can take nonconvex obstacle constraints. <b>LTV</b> linearizes once about the reference trajectory and predicts with that linear model, which makes it one convex QP. On the map, LTV's linear prediction is dashed and what those inputs really do is solid. The two separate when heading error is large.</p>
<p><b>Horizons.</b> Np is how far the model looks ahead. Nc is how many independent moves it may choose. Small Nc means fewer variables and smoother, less agile control. Nc = 1 is a single held command.</p>
<p><b>Car-like model.</b> Pure pursuit outputs steering directly.""")
# tries
rep("""         '<b>Vehicle:</b> turn on acceleration limits and set lag τ to 0.3 s. The speed plot shows command and response diverge.'],""",
"""         '<b>Vehicle:</b> turn on acceleration limits and set lag τ to 0.3 s. The speed plot shows command and response diverge.',
         '<b>Control:</b> MPC. Compare cross-track RMS with pure pursuit. Shrink Np to 3 (myopic) and Nc to 1 (one held move). With lag τ = 0.3 s, tick Include actuator lag and compare.'],""")
rep("""         '<b>Control:</b> tune DWA clearance weight. Too low clips people, too high stalls in narrow aisles.',""",
"""         '<b>Control:</b> tune DWA clearance weight. Too low clips people, too high stalls in narrow aisles.',
         '<b>Control:</b> MPC with obstacle constraints versus DWA. The MPC respects the acceleration limits exactly. Tick Include actuator lag, since τ = 0.15 s here.',""")
rep("""         '<b>Localize:</b> switch to EKF and raise odometry noise. The log reports the true final pose error at every bay.'],""",
"""         '<b>Localize:</b> switch to EKF and raise odometry noise. The log reports the true final pose error at every bay.',
         '<b>Control:</b> MPC knows the steering-rate limit, so it needs no dry-steering rule at cusps. Switch it to LTV and watch the dashed linear prediction drift from the true one at the start of each leg.'],""")
rep("const old=P[k];P[k]=v;if(old===v&&!['infl',","const old=P[k];P[k]=v;if(k.startsWith('mpc')&&S)S.mpc=null;if(old===v&&!['infl',")
rep("""function mpcReference(Np,dt){
  const e=S.est,T=S.track,pr=project(e.x,e.y,true),dir=T.dir||1,ref=[];""","""function mpcReference(Np,dt){
  const{T,pr,dir}=trackPre(),ref=[];   // also advances the path-progress index""")
rep("""  const car=isCar(),L=P.wheelbase,lag=P.mpcLag&&P.lag>0,tau=P.lag;
  const f=(x,u,dt)=>{""","""  const car=isCar(),L=P.wheelbase,lag=P.mpcLag&&P.lag>0,tau=P.lag,sMax=car?steerMax():P.wmax;
  const sat=s=>clamp(s,-sMax,sMax);   // the actuator saturates; the model does too
  const f=(x,u,dt)=>{""")
rep("""    if(lag){const a=1-Math.exp(-dt/tau);o[3]=v+(x[5]-v)*a;o[4]=s+(x[6]-s)*a;o.push(x[5]+u[0]*dt,x[6]+u[1]*dt);}
    else{o[3]=v+u[0]*dt;o[4]=s+u[1]*dt;}""","""    if(lag){const a=1-Math.exp(-dt/tau);o[3]=v+(x[5]-v)*a;o[4]=sat(s+(x[6]-s)*a);o.push(x[5]+u[0]*dt,sat(x[6]+u[1]*dt));}
    else{o[3]=v+u[0]*dt;o[4]=sat(s+u[1]*dt);}""")
rep("     |s| ≤ s_max, speed sign and limit per leg, footprint clearance ≥ margin  (augmented Lagrangian)</div>",
    "     speed sign and limit per leg, footprint clearance ≥ margin, |s| ≤ s_max  (augmented Lagrangian;\n     s is also saturated inside the model, as the real actuator is)</div>")
rep("mpcRho:200,mpcObs:false,","mpcRho:200,mpcObs:true,")
rep("'<b>Control:</b> MPC. Compare cross-track RMS with pure pursuit. Shrink Np to 3 (myopic) and Nc to 1 (one held move). With lag τ = 0.3 s, tick Include actuator lag and compare.'],",
    "'<b>Control:</b> MPC. Compare cross-track RMS with pure pursuit. Shrink Np to 3 (myopic) and Nc to 1 (one held move). With lag τ = 0.3 s, tick Include actuator lag and compare.'],")
# separate colour for beacons (teal), lidar hits stay amber
rep("--accent:#2058c9; --accent-ink:#ffffff; --amber:#9c6a00;","--accent:#2058c9; --accent-ink:#ffffff; --amber:#9c6a00; --beacon:#008a87;")
s=s.replace("--accent:#729dff; --accent-ink:#0a1020; --amber:#dfae48;","--accent:#729dff; --accent-ink:#0a1020; --amber:#dfae48; --beacon:#3fd0c6;")
assert s.count("--beacon:#3fd0c6;")==2
rep("const names=['bg','panel','ink','muted','line','accent','amber',","const names=['bg','panel','ink','muted','line','accent','amber','beacon',")
rep("for(const b of S.beacons){ctx.fillStyle=TOK.amber;ctx.beginPath();const s=0.16;ctx.moveTo(b.x,b.y+s);ctx.lineTo(b.x+s,b.y);ctx.lineTo(b.x,b.y-s);ctx.lineTo(b.x-s,b.y);ctx.closePath();ctx.fill();}",
    "for(const b of S.beacons){ctx.fillStyle=TOK.beacon;ctx.strokeStyle=TOK['map-bg'];ctx.lineWidth=px(1);ctx.beginPath();const s=Math.max(0.18,px(6));ctx.moveTo(b.x,b.y+s);ctx.lineTo(b.x+s,b.y);ctx.lineTo(b.x,b.y-s);ctx.lineTo(b.x-s,b.y);ctx.closePath();ctx.fill();ctx.stroke();}")
rep("ctx.strokeStyle=m.fake?rgba(TOK.bad,0.6):rgba(TOK.amber,0.55);","ctx.strokeStyle=m.fake?rgba(TOK.bad,0.6):rgba(TOK.beacon,0.6);")
rep("ctx.fillStyle=m.fake?TOK.bad:TOK.amber;ctx.beginPath();ctx.arc(x,y,px(2.5),0,TAU);ctx.fill();}","ctx.fillStyle=m.fake?TOK.bad:TOK.beacon;ctx.beginPath();ctx.arc(x,y,px(2.5),0,TAU);ctx.fill();}")
rep("""<span><i class="dot" style="background:var(--amber)"></i>lidar hits · beacons</span>""",
    """<span><i class="dot" style="background:var(--amber)"></i>lidar hits</span>
        <span><i class="dot" style="background:var(--beacon);border-radius:1px;transform:rotate(45deg)"></i>beacons & readings (red = false)</span>""")
# ---------- fonts: STIX Two for symbols ----------
rep("family=Barlow+Semi+Condensed:wght@500;600;700&family=Barlow:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap",
    "family=Barlow+Semi+Condensed:wght@500;600;700&family=Barlow:wght@400;500;600&family=JetBrains+Mono:wght@400;500&family=STIX+Two+Text:ital,wght@0,400;1,400&display=swap")
rep('  --f-mono:"JetBrains Mono",ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;',
    '  --f-mono:"JetBrains Mono",ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;\n  --f-math:"STIX Two Text","Cambria Math","Times New Roman",serif;')

# ---------- layout: observe (left) vs configure (right) ----------
rep("@media (min-width:961px){.stage{position:sticky;top:calc(env(safe-area-inset-top,0px) + 10px)}}",
"""/* wide screens: the parameter console scrolls on its own; the map + telemetry column is sized to fit one screen */
@media (min-width:961px){
  .console{position:sticky;top:calc(env(safe-area-inset-top,0px) + 10px);max-height:calc(100vh - 20px);overflow-y:auto;overscroll-behavior:contain;border-radius:6px}
  .console .tabs{position:sticky;top:0;z-index:2;background:var(--panel);border-radius:6px 6px 0 0}
  .mapwrap{width:min(100%,max(440px,calc((100vh - 460px)*1.5)));margin-inline:auto}
}""")
rep(".tele{padding:14px;display:flex;flex-direction:column;gap:10px}",
""".tele{padding:12px 14px;display:flex;flex-direction:column;gap:10px}
.tele-grid{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(0,1fr);gap:12px;align-items:start}
.tele-log{display:flex;flex-direction:column;gap:6px;min-width:0}
@media (max-width:700px){.tele-grid{grid-template-columns:minmax(0,1fr)}}""")
rep("#plot{width:100%;height:150px;","#plot{width:100%;height:130px;")
rep(".log{list-style:none;margin:0;padding:0;font-family:var(--f-mono);font-size:.76rem;max-height:200px;",".log{list-style:none;margin:0;padding:0;font-family:var(--f-mono);font-size:.74rem;height:110px;")
rep(".metrics{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:8px 14px;margin:0}",".metrics{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:6px 14px;margin:0}")
rep(".metrics dd{margin:0;font-family:var(--f-mono);font-size:.9rem;",".metrics dd{margin:0;font-family:var(--f-mono);font-size:.82rem;")
rep(".legend{display:flex;flex-wrap:wrap;gap:4px 14px;font-size:.78rem;color:var(--muted)}",".legend{display:flex;flex-wrap:wrap;gap:3px 12px;font-size:.74rem;color:var(--muted)}")
# nomenclature styles
rep(".codestat{font-family:var(--f-mono);font-size:.78rem}",""".codestat{font-family:var(--f-mono);font-size:.78rem}
.nom{display:flex;flex-direction:column;gap:6px;scroll-margin-top:52px}
.nom h3{border-bottom:1px solid var(--line);padding-bottom:4px}
.nom dl{display:grid;grid-template-columns:minmax(72px,max-content) minmax(0,1fr);gap:5px 14px;margin:0}
.nom dt{font-family:var(--f-math);font-size:1.02rem;line-height:1.35;white-space:nowrap}
.nom dt i{font-style:italic}
.nom dd{margin:0;font-size:.86rem;line-height:1.4;min-width:0}
.nom .unit{color:var(--muted);font-family:var(--f-mono);font-size:.74rem;white-space:nowrap}
.linkbtn{border:0;background:none;padding:0;color:var(--accent);font:inherit;font-size:.86rem;text-decoration:underline;text-underline-offset:2px;cursor:pointer;align-self:flex-start}""")

# ---------- markup: telemetry moves under the map ----------
rep("""      <div class="controls">
        <span class="lbl">Tap map to</span>
        <div class="seg" id="tapmode" aria-label="Map tap action"></div>
        <button class="btn" id="clearwp">Clear waypoints</button>
      </div>
    </section>""","""      <div class="controls">
        <span class="lbl">Tap map to</span>
        <div class="seg" id="tapmode" aria-label="Map tap action"></div>
        <button class="btn" id="clearwp">Clear waypoints</button>
      </div>
      <section class="box tele">
        <div class="tele-head"><h2>Telemetry</h2><div class="seg" id="plotsel" aria-label="Plot channel"></div></div>
        <div class="tele-grid">
          <canvas id="plot" aria-label="Time series plot"></canvas>
          <div class="tele-log"><h3>Event log</h3><ol class="log" id="log"></ol></div>
        </div>
        <dl class="metrics" id="metrics"></dl>
      </section>
    </section>""")
rep("""      <section class="box tele">
        <div class="tele-head"><h2>Telemetry</h2><div class="seg" id="plotsel" aria-label="Plot channel"></div></div>
        <canvas id="plot" aria-label="Time series plot"></canvas>
        <dl class="metrics" id="metrics"></dl>
        <h3>Event log</h3>
        <ol class="log" id="log"></ol>
      </section>
    </aside>""","""    </aside>""")
rep("let tryOpen=window.innerWidth>760;","let tryOpen=false;   // the Try list starts collapsed so the map and telemetry fit on screen")

# ---------- Symbols tab ----------
rep(" {id:'veh',n:'',name:'Vehicle'},{id:'code',n:'',name:'Code'},{id:'view',n:'',name:'Layers'}];",
    " {id:'veh',n:'',name:'Vehicle'},{id:'code',n:'',name:'Code'},{id:'view',n:'',name:'Layers'},{id:'sym',n:'',name:'Symbols'}];")
rep("""  if(t==='code')html=codePane();
  else if(t==='view')html=layersPane();""","""  if(t==='code')html=codePane();
  else if(t==='view')html=layersPane();
  else if(t==='sym')html=symPane();""")
rep("""    if(NOTES[t])html+=`<details class="how" ${t==='loc'||t==='ctl'?'':''}><summary>How it works</summary><div class="how-body">${NOTES[t]}</div></details>`;""",
"""    if(NOTES[t])html+=`<details class="how" ${howOpen[t]?'open':''} data-how="${t}"><summary>How it works</summary><div class="how-body">${NOTES[t]}<button class="linkbtn" data-sym="${t}">Symbol definitions for this section</button>${t==='ctl'?'<button class="linkbtn" data-sym="mpc">MPC symbols</button>':''}</div></details>`;""")
rep("  if(t==='code')wireCode();","""  pane.querySelectorAll('details[data-how]').forEach(d=>d.ontoggle=()=>{howOpen[d.dataset.how]=d.open;});
  pane.querySelectorAll('[data-sym]').forEach(b=>b.onclick=()=>{activeTab='sym';buildTabs();renderAllPanes();const el=document.getElementById('sym-'+b.dataset.sym);if(el)el.scrollIntoView({block:'start'});});
  if(t==='code')wireCode();""")
rep("let activeTab='loc';","let activeTab='loc';const howOpen={};")
rep("function layersPane(){",r"""// Nomenclature, IEEE style: symbol — definition [unit], grouped by subsystem
const I=s=>`<i>${s}</i>`;
const NOMEN=[
 {id:'veh',title:'Vehicle and motion',rows:[
  [`${I('x')}, ${I('y')}`,'Position of the robot reference point in the world frame (rear-axle centre for the car)','m'],
  ['θ','Heading (yaw), counter-clockwise from +x','rad'],
  [I('v'),'Longitudinal speed, negative when reversing','m/s'],
  ['ω','Yaw rate, θ̇','rad/s'],
  [I('a'),'Longitudinal acceleration','m/s²'],
  ['α','Angular acceleration (diff-drive)','rad/s²'],
  [`${I('v')}<sub>max</sub>, ω<sub>max</sub>`,'Speed and yaw-rate limits','m/s, rad/s'],
  [`${I('a')}<sub>max</sub>, α<sub>max</sub>`,'Acceleration limits','m/s², rad/s²'],
  ['τ','Time constant of the first-order actuator lag','s'],
  [`Δ${I('t')}`,'Time step: 0.05 s for the simulation, tunable for the MPC prediction','s'],
  [I('L'),'Wheelbase (written L<sub>wb</sub> where L could be confused)','m'],
  ['δ','Front-wheel steering angle','rad'],
  ['δ<sub>max</sub>','Steering-angle limit','rad'],
  ['δ̇','Steering rate','rad/s'],
  [`${I('R')}<sub>min</sub>`,`Minimum turning radius, ${I('L')} / tan δ<sub>max</sub>`,'m'],
  ['κ','Path curvature, positive to the left','1/m'],
  [I('r'),'Robot radius (diff-drive, 0.3 m) or covering-circle radius (car)','m']]},
 {id:'loc',title:'Localization',rows:[
  ['μ',`Pose estimate (mean), [${I('x̂')}, ${I('ŷ')}, θ̂]`,'m, rad'],
  ['Σ','Pose-estimate covariance, 3 × 3',''],
  [I('u'),`Odometry input, (${I('v')}, ω)`,'m/s, rad/s'],
  [`${I('g')}(μ, ${I('u')})`,'Discrete motion model',''],
  [`${I('G')}, ${I('V')}`,`Jacobians of ${I('g')} with respect to the state and the input`,''],
  [I('M'),'Odometry noise covariance, diag(σ<sub>v</sub>², σ<sub>ω</sub>²)',''],
  ['σ<sub>v</sub>, σ<sub>ω</sub>','Odometry noise standard deviations','m/s, rad/s'],
  [I('k'),'Odometry noise scale (Vehicle slider); the filter assumes its own multiple of it',''],
  [I('b'),'Odometry calibration bias, not modelled by the filters',''],
  [`${I('z')} = [${I('r')}, φ]`,'Beacon measurement: range and bearing','m, rad'],
  [I('ẑ'),'Predicted measurement','m, rad'],
  [I('q'),'Squared distance to the beacon, Δx² + Δy²','m²'],
  ['ν',`Innovation, ${I('z')} − ${I('ẑ')}`,'m, rad'],
  [I('H'),`Measurement Jacobian, ∂${I('ẑ')}/∂μ`,''],
  [I('Q'),'Measurement noise covariance, diag(σ<sub>r</sub>², σ<sub>φ</sub>²)',''],
  [I('S'),`Innovation covariance, ${I('H')}Σ${I('H')}ᵀ + ${I('Q')}`,''],
  [I('K'),`Kalman gain, Σ${I('H')}ᵀ${I('S')}⁻¹`,''],
  [`${I('d')}²`,`Squared Mahalanobis distance, νᵀ${I('S')}⁻¹ν; readings with ${I('d')}² > 9.21 (χ²₂, 99 %) are rejected`,''],
  [I('N'),'Number of particles',''],
  [`${I('w')}<sub>i</sub>`,`Normalized weight of particle ${I('i')}`,''],
  [`${I('N')}<sub>eff</sub>`,`Effective sample size, 1 / Σ ${I('w')}<sub>i</sub>²; resample when below ${I('N')}/2`,''],
  ['α<sub>fast</sub>, α<sub>slow</sub>','Smoothing rates of the short- and long-term likelihood averages (augmented MCL)',''],
  [I('e'),'Pose error, truth − estimate','m, rad'],
  ['NEES',`Normalized estimation error squared, ${I('e')}ᵀΣ⁻¹${I('e')}; about 3 when the filter is consistent`,'']]},
 {id:'per',title:'Perception',rows:[
  [I('l'),'Log-odds of a grid cell being occupied; 0 = unknown',''],
  [`${I('l')}<sub>free</sub>, ${I('l')}<sub>hit</sub>`,'Log-odds increments for a cell a beam passes through / ends in',''],
  [`${I('d')}(${I('c')})`,`Distance from cell ${I('c')} to the nearest occupied cell (distance transform)`,'m'],
  [`${I('r')}<sub>lethal</sub>`,'Cells closer than this to an obstacle are forbidden (0.4 m)','m'],
  ['σ<sub>lidar</sub>','Lidar range noise standard deviation','m']]},
 {id:'mis',title:'Mission',rows:[
  [`${I('C')}<sub>ij</sub>`,`Path cost from waypoint ${I('i')} to ${I('j')} (Dijkstra on the costmap), used to order waypoints`,'m'],
  ['σ<sub>pos</sub>','Position uncertainty, √(Σ<sub>xx</sub> + Σ<sub>yy</sub>), checked by the lost guard','m']]},
 {id:'plan',title:'Planning',rows:[
  [`${I('g')}(${I('n')})`,`Cost-to-come of search node ${I('n')}`,'m'],
  [`${I('h')}(${I('n')})`,'Heuristic estimate of the cost-to-go','m'],
  [`${I('f')}(${I('n')})`,`Search priority, ${I('g')} + ε${I('h')}`,'m'],
  ['ε','Heuristic weight; ε > 1 gives weighted A*, with cost ≤ ε × optimal',''],
  [I('n'),'Number of nodes in the RRT* tree',''],
  [`${I('r')}<sub>n</sub>`,'RRT* rewiring radius, min(8√(log n / n), 1.5 m)','m'],
  ['L, R, S','Reeds–Shepp segments: left arc, right arc, straight',''],
  ['⁺, ⁻','Segment driven forward / in reverse',''],
  [I('p'),'Fraction of δ<sub>max</sub> the car planners may use',''],
  [`${I('R')}<sub>plan</sub>`,`Planning turning radius, ${I('L')} / tan(${I('p')} δ<sub>max</sub>)`,'m']]},
 {id:'ctl',title:'Path tracking',rows:[
  [I('s'),'Arc length along the path','m'],
  [`${I('e')}, ${I('e')}<sub>lat</sub>`,'Lateral (cross-track) error, positive to the left of the path','m'],
  [`${I('e')}<sub>lon</sub>`,'Along-track error','m'],
  ['θ<sub>e</sub>','Heading error relative to the path tangent','rad'],
  [`${I('L')}<sub>d</sub>`,`Pure-pursuit lookahead, ${I('L')}<sub>0</sub> + ${I('k')}·${I('v')}`,'m'],
  [`${I('L')}<sub>0</sub>, ${I('k')}`,'Lookahead offset and speed gain','m, s'],
  ['α','In pure pursuit: bearing from the heading to the carrot point','rad'],
  [`${I('a')}<sub>lat</sub>`,`Lateral-acceleration limit of the speed profile, ${I('v')} ≤ √(${I('a')}<sub>lat</sub>/|κ|)`,'m/s²'],
  [`${I('k')}<sub>θ</sub>, ${I('k')}<sub>e</sub>`,'Rear-wheel feedback heading and lateral gains','1/m, 1/m²'],
  [I('k'),'In Stanley: cross-track gain',''],
  [`${I('e')}<sub>front</sub>`,'Stanley cross-track error of the front axle','m'],
  [`${I('K')}<sub>p</sub>, ${I('K')}<sub>i</sub>, ${I('K')}<sub>d</sub>`,'PID gains on the heading error',''],
  [`${I('w')}<sub>g</sub>, ${I('w')}<sub>o</sub>, ${I('w')}<sub>v</sub>`,'DWA weights on goal progress, clearance and speed',''],
  [I('J'),'Cost being minimized (DWA score, MPC objective)','']]},
 {id:'mpc',title:'Model predictive control',rows:[
  [`${I('N')}<sub>p</sub>`,'Prediction horizon: steps the model looks ahead',''],
  [`${I('N')}<sub>c</sub>`,`Control horizon: free input moves; <b>u</b><sub>k</sub> = <b>u</b><sub>N<sub>c</sub>−1</sub> for ${I('k')} ≥ ${I('N')}<sub>c</sub>`,''],
  ['<b>x</b>',`MPC state [${I('x')}, ${I('y')}, θ, ${I('v')}, ${I('s')}], plus [${I('v')}<sub>cmd</sub>, ${I('s')}<sub>cmd</sub>] with the lag model`,''],
  [I('s'),'In the MPC: turn state, ω for diff-drive or δ for the car','rad/s or rad'],
  ['<b>u</b>',`MPC input [${I('a')}, ${I('ṡ')}]`,'m/s², rad/s² or rad/s'],
  ['<b>U</b>',`Decision vector: the ${I('N')}<sub>c</sub> input moves (2${I('N')}<sub>c</sub> variables)`,''],
  [`${I('Q')}<sub>lon</sub>, ${I('Q')}<sub>lat</sub>, ${I('Q')}<sub>θ</sub>, ${I('Q')}<sub>v</sub>`,'Weights on along-track, lateral, heading and speed error',''],
  [`${I('w')}<sub>N<sub>p</sub></sub>`,'Terminal weight multiplier on the last step',''],
  [`${I('R')}<sub>a</sub>, ${I('R')}<sub>s</sub>`,`Input weights on ${I('a')} and ${I('ṡ')}`,''],
  [`${I('R')}<sub>Δ</sub>`,'Weight on the change between consecutive input moves',''],
  [`${I('c')}(<b>x</b>) ≤ 0`,`Inequality constraints: speed sign and limit, |${I('s')}| ≤ ${I('s')}<sub>max</sub>, obstacle clearance`,''],
  ['ρ','Augmented-Lagrangian penalty parameter',''],
  ['λ',`Lagrange-multiplier estimates, updated λ ← max(0, λ + ρ${I('c')})`,''],
  [`${I('A')}<sub>k</sub>, ${I('B')}<sub>k</sub>`,`Model Jacobians ∂${I('f')}/∂<b>x</b> and ∂${I('f')}/∂<b>u</b> at step ${I('k')}`,''],
  [`${I('S')}<sub>k</sub>`,`Sensitivity of the predicted state to the decision vector, ∂<b>x</b><sub>k</sub>/∂<b>U</b>`,''],
  [`<b>r</b>, ${I('J')}`,`In Gauss–Newton: residual vector and its Jacobian ∂<b>r</b>/∂<b>U</b>`,''],
  [`${I('H')}, ${I('g')}`,`In Gauss–Newton: Hessian approximation ${I('J')}ᵀ${I('J')} and gradient ${I('J')}ᵀ<b>r</b>`,'']]},
 {id:'tele',title:'Telemetry',rows:[
  ['RMS','Root mean square over the run',''],
  ['true error','Distance between the true pose and the goal when the robot declares arrival','m, °']]},
];
function symPane(){
  return`<p class="note">Notation follows the usual IEEE style. Some letters are reused between subsystems, as in the literature (for example ${I('g')}, ${I('H')}, ${I('S')}, ${I('J')}, ${I('k')}, α and ${I('s')}). The group heading tells you which meaning applies. SI units; angles in radians unless a panel shows degrees.</p>`+
    NOMEN.map(g=>`<section class="nom" id="sym-${g.id}"><h3>${g.title}</h3><dl>${g.rows.map(([sy,d,u])=>`<dt>${sy}</dt><dd>${d}${u?` <span class="unit">[${u}]</span>`:''}</dd>`).join('')}</dl></section>`).join('');
}
function layersPane(){""")
# ---------- one-screen desktop layout ----------
rep("""<div class="wrap">
  <header class="top">
    <h1>Nav Stack Lab</h1>
    <p class="sub">diff-drive or car-like robot · 24 × 16 m world · 20 Hz fixed step</p>
  </header>
  <nav class="levels" id="levels" aria-label="Scenario level"></nav>
  <section class="brief" id="brief" aria-live="polite"></section>

  <main class="layout">
    <section class="stage">
      <div class="status" id="status"></div>""","""<div class="wrap">
  <main class="layout">
    <section class="ctx">
      <header class="top">
        <h1>Nav Stack Lab</h1>
        <p class="sub">diff-drive or car-like robot · 24 × 16 m · 20 Hz</p>
      </header>
      <nav class="levels" id="levels" aria-label="Scenario level"></nav>
      <section class="brief" id="brief" aria-live="polite"></section>
    </section>
    <section class="stage">
      <div class="status" id="status"></div>
      <div class="controls">
        <button class="btn primary" id="run">Run</button>
        <button class="btn" id="stepb">Step 0.5 s</button>
        <button class="btn" id="resetb">Reset</button>
        <div class="seg" id="speed" aria-label="Simulation speed"></div>
        <span class="ctl-sep"></span>
        <label class="lbl" for="tapsel">Tap map</label>
        <select class="sel" id="tapsel">
          <option value="wp">Add waypoint</option>
          <option value="pose">Add posed goal (drag)</option>
          <option value="goal">Set single goal</option>
          <option value="kidnap">Kidnap robot</option>
        </select>
        <button class="btn" id="clearwp">Clear waypoints</button>
      </div>""")
rep("""      <div class="controls">
        <button class="btn primary" id="run">Run</button>
        <button class="btn" id="stepb">Step 0.5 s</button>
        <button class="btn" id="resetb">Reset</button>
        <div class="seg" id="speed" aria-label="Simulation speed"></div>
      </div>
      <div class="controls">
        <span class="lbl">Tap map to</span>
        <div class="seg" id="tapmode" aria-label="Map tap action"></div>
        <button class="btn" id="clearwp">Clear waypoints</button>
      </div>
""","")
rep("""        <span><i class="disc" style="background:var(--ink)"></i>true pose</span>
        <span><i class="ring" style="border-color:var(--accent)"></i>estimate</span>
        <span><i style="border-color:var(--accent)"></i>global path</span>
        <span><i class="dash" style="border-color:var(--warn)"></i>reverse leg</span>
        <span><i class="dot" style="background:var(--rose)"></i>belief (particles / 95% ellipse)</span>
        <span><i class="dot" style="background:var(--amber)"></i>lidar hits</span>
        <span><i class="dot" style="background:var(--beacon);border-radius:1px;transform:rotate(45deg)"></i>beacons & readings (red = false)</span>
        <span><i class="disc" style="background:var(--warn)"></i>people</span>
        <span><i style="border-color:var(--ok)"></i>MPC prediction (LTV: dashed = linear model)</span>""",
"""        <span><i class="disc" style="background:var(--ink)"></i>true pose</span>
        <span><i class="ring" style="border-color:var(--accent)"></i>estimate</span>
        <span><i style="border-color:var(--accent)"></i>path</span>
        <span><i class="dash" style="border-color:var(--warn)"></i>reverse</span>
        <span><i class="dot" style="background:var(--rose)"></i>belief</span>
        <span><i class="dot" style="background:var(--amber)"></i>lidar</span>
        <span><i class="dot" style="background:var(--beacon);border-radius:1px;transform:rotate(45deg)"></i>beacon</span>
        <span><i class="disc" style="background:var(--warn)"></i>people</span>
        <span><i style="border-color:var(--ok)"></i>MPC</span>
        <button class="linkbtn" id="legendmore" type="button">All map symbols</button>""")
# CSS
rep("body{color:var(--ink);font-family:var(--f-body);font-size:15px;line-height:1.45;padding-inline:16px;padding-block:14px 40px}",
    "body{color:var(--ink);font-family:var(--f-body);font-size:15px;line-height:1.45;padding-inline:16px;padding-block:14px 40px}\n.ctx{display:flex;flex-direction:column;gap:10px;min-width:0}")
rep(".wrap{max-width:1320px;margin:0 auto;display:flex;flex-direction:column;gap:14px}",".wrap{max-width:1600px;margin:0 auto}")
rep(".layout{display:grid;grid-template-columns:minmax(0,1.4fr) minmax(330px,1fr);gap:16px;align-items:start}\n@media (max-width:960px){.layout{grid-template-columns:minmax(0,1fr)}}",
    ".layout{display:flex;flex-direction:column;gap:14px}")
rep("""@media (min-width:961px){
  .console{position:sticky;top:calc(env(safe-area-inset-top,0px) + 10px);max-height:calc(100vh - 20px);overflow-y:auto;overscroll-behavior:contain;border-radius:6px}
  .console .tabs{position:sticky;top:0;z-index:2;background:var(--panel);border-radius:6px 6px 0 0}
  .mapwrap{width:min(100%,max(440px,calc((100vh - 460px)*1.5)));margin-inline:auto}
}""","""/* Desktop: the whole lab is one screen. Left: map + telemetry (what you watch).
   Right: level, brief and parameter tabs (what you change), each scrolling on its own. */
@media (min-width:961px) and (min-height:600px){
  body{padding-block:12px}
  .layout{display:grid;height:calc(100vh - 24px);grid-template-columns:minmax(0,1.5fr) minmax(360px,1fr);grid-template-rows:auto minmax(0,1fr);grid-template-areas:"stage ctx" "stage console";gap:12px 16px}
  .ctx{grid-area:ctx;max-height:46vh;overflow-y:auto;overscroll-behavior:contain}
  .stage{grid-area:stage;min-height:0;overflow-y:auto;overscroll-behavior:contain}
  .console{grid-area:console;min-height:0;overflow-y:auto;overscroll-behavior:contain;border-radius:6px}
  .console .tabs{position:sticky;top:0;z-index:2;background:var(--panel);border-radius:6px 6px 0 0}
  .mapwrap{width:min(100%,max(420px,calc((100vh - 400px)*1.5)));margin-inline:auto}
  .levels{flex-wrap:wrap;overflow:visible}
  .lvl{min-width:0;flex:1 1 104px;padding:5px 10px 6px}
  .lvl span{font-size:.95rem}
}""")
rep(".brief{background:var(--panel);border:1px solid var(--line);border-radius:6px;padding:12px 14px;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.3fr);gap:6px 24px}",
    ".brief{background:var(--panel);border:1px solid var(--line);border-radius:6px;padding:10px 14px;display:grid;grid-template-columns:minmax(0,1fr);gap:6px}")
rep("@media (max-width:760px){.brief{grid-template-columns:minmax(0,1fr)}}","")
rep(".controls{display:flex;flex-wrap:wrap;gap:8px;align-items:center}",
    ".controls{display:flex;flex-wrap:wrap;gap:8px;align-items:center}\n.ctl-sep{width:1px;align-self:stretch;background:var(--line);margin-inline:4px}\n.sel{font:inherit;font-size:.9rem;color:var(--ink);background:var(--raise);border:1px solid var(--line);border-radius:5px;padding:6px 8px}")
rep(".brief .adds{font-size:.95rem}",".brief .adds{font-size:.92rem}")
# compact metrics: label and value on one line
rep(".metrics{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:6px 14px;margin:0}\n.metrics div{min-width:0}",
    ".metrics{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:3px 16px;margin:0}\n.metrics div{min-width:0;display:flex;gap:8px;align-items:baseline}")
rep(".metrics dt{font-size:.72rem;text-transform:uppercase;letter-spacing:.07em;color:var(--muted)}",".metrics dt{font-size:.66rem;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);white-space:nowrap}")
rep("#plot{width:100%;height:130px;","#plot{width:100%;height:124px;")
rep("font-size:.74rem;height:110px;","font-size:.72rem;height:100px;")
# metric labels shorter
rep("['Distance driven',","['Distance',")
rep("['NEES (mean, 3 is consistent)',nees==null?'— (no covariance)'","['NEES (≈3 = consistent)',nees==null?'— (no covariance)'")
rep("['MPC max violation',","['MPC violation',")
# tap select wiring
rep("seg($('#tapmode'),[['wp','Add waypoint'],['pose','Add posed goal (drag)'],['goal','Set single goal'],['kidnap','Kidnap robot']],()=>tapMode,v=>{tapMode=v;cv.style.touchAction=v==='pose'?'none':'manipulation';});",
    "$('#tapsel').onchange=e=>{tapMode=e.target.value;cv.style.touchAction=tapMode==='pose'?'none':'manipulation';};\n$('#legendmore').onclick=()=>{activeTab='sym';buildTabs();renderAllPanes();const el=document.getElementById('sym-map');if(el)el.scrollIntoView({block:'start'});};")
# Map symbols group in the nomenclature
rep(" {id:'tele',title:'Telemetry',rows:[",""" {id:'map',title:'Map symbols',rows:[
  ['<i class="swatch" style="background:var(--ink)"></i>','True pose (ground truth); the car is drawn with its wheels at the actual steering angle',''],
  ['<i class="swatch ring" style="border-color:var(--accent)"></i>','Estimated pose, dashed outline with a heading line',''],
  ['<i class="swatch line" style="border-color:var(--accent)"></i>','Global path, forward leg; finished legs fade',''],
  ['<i class="swatch line dash" style="border-color:var(--warn)"></i>','Global path, reverse leg (car)',''],
  ['<i class="swatch" style="background:var(--rose)"></i>','Belief: particles (particle filter) or 95 % covariance ellipse (EKF, dead reckoning)',''],
  ['<i class="swatch sq" style="background:var(--amber)"></i>','Lidar hits, placed using the estimated pose',''],
  ['<i class="swatch dia" style="background:var(--beacon)"></i>','Beacons (known positions) and the current range–bearing readings drawn from the estimate; red readings are false detections',''],
  ['<i class="swatch" style="background:var(--warn)"></i>','People, with a velocity tick',''],
  ['<i class="swatch ring" style="border-color:var(--ok)"></i>','Active waypoint; numbers give the visiting order; a dashed body and tick show a goal heading',''],
  ['<i class="swatch line" style="border-color:var(--ok)"></i>','MPC predicted trajectory; dots are the reference points. In LTV mode the dashed pink line is the linear model\\'s prediction',''],
  ['<i class="swatch sq" style="background:var(--accent);opacity:.4"></i>','Planner search: A* closed set, RRT* tree or Hybrid A* expansions',''],
  ['<i class="swatch" style="background:var(--muted);opacity:.5"></i>','DWA rollouts; the chosen one is green, rejected ones red',''],
  ['<i class="swatch line" style="border-color:var(--accent)"></i>','Thin line from the robot: carrot point of pure pursuit, PID or DWA, or the projection point of rear-wheel feedback and Stanley','']]},
 {id:'tele',title:'Telemetry',rows:[""")
rep(".nom dd{margin:0;font-size:.86rem;line-height:1.4;min-width:0}",""".nom dd{margin:0;font-size:.86rem;line-height:1.4;min-width:0}
.swatch{display:inline-block;width:12px;height:12px;border-radius:50%;vertical-align:middle;font-style:normal}
.swatch.ring{background:transparent;border:2px solid}
.swatch.sq{border-radius:2px;width:9px;height:9px}
.swatch.dia{border-radius:1px;width:10px;height:10px;transform:rotate(45deg)}
.swatch.line{width:22px;height:0;border-radius:0;border-top:3px solid}
.swatch.line.dash{border-top-style:dashed}""")
rep(".stage{display:flex;flex-direction:column;gap:10px;min-width:0}",".stage{display:flex;flex-direction:column;gap:10px;min-width:0}\n.stage>*{flex-shrink:0}")
rep("  .mapwrap{width:min(100%,max(420px,calc((100vh - 400px)*1.5)));margin-inline:auto}","  .mapwrap{width:min(100%,max(420px,calc((100vh - 455px)*1.5)));margin-inline:auto}")
rep('<button class="btn" id="stepb">Step 0.5 s</button>','<button class="btn" id="stepb" title="Advance 0.5 s">Step</button>')
rep('<button class="btn" id="clearwp">Clear waypoints</button>','<button class="btn" id="clearwp" title="Clear all waypoints">Clear</button>')
rep("['Collisions',`${S.coll} static · ${S.collPed} people`],","['Collisions',`${S.coll} static, ${S.collPed} people`],")
rep("if(S.pf)items.push(['Particles',`N_eff ${S.pf.neff.toFixed(0)}/${S.pf.N} · inject ${(S.pf.inj*100).toFixed(0)}%`]);","if(S.pf)items.push(['Particles',`N_eff ${S.pf.neff.toFixed(0)}/${S.pf.N}, inj ${(S.pf.inj*100).toFixed(0)}%`]);")
rep("""          <option value="wp">Add waypoint</option>
          <option value="pose">Add posed goal (drag)</option>
          <option value="goal">Set single goal</option>
          <option value="kidnap">Kidnap robot</option>""","""          <option value="wp">Add waypoint</option>
          <option value="pose">Posed goal (drag)</option>
          <option value="goal">Single goal</option>
          <option value="kidnap">Kidnap robot</option>""")
rep("  .mapwrap{width:min(100%,max(420px,calc((100vh - 455px)*1.5)));margin-inline:auto}","  .mapwrap{width:min(100%,max(420px,calc((100vh - 470px)*1.5)));margin-inline:auto}")
rep("let activeTab='loc';const howOpen={};",r"""let activeTab='loc';const howOpen={};
// Show a Symbols group: scroll only the console on desktop (below its sticky tabs), the page on phones
function showSym(id){activeTab='sym';buildTabs();renderAllPanes();
  const el=document.getElementById('sym-'+id),c=document.querySelector('.console');if(!el)return;
  if(c.scrollHeight>c.clientHeight+1&&getComputedStyle(c).overflowY!=='visible'){const tb=c.querySelector('.tabs').offsetHeight;
    c.scrollTop+=el.getBoundingClientRect().top-c.getBoundingClientRect().top-tb-8;}
  else el.scrollIntoView({block:'start'});}""")
rep("pane.querySelectorAll('[data-sym]').forEach(b=>b.onclick=()=>{activeTab='sym';buildTabs();renderAllPanes();const el=document.getElementById('sym-'+b.dataset.sym);if(el)el.scrollIntoView({block:'start'});});",
    "pane.querySelectorAll('[data-sym]').forEach(b=>b.onclick=()=>showSym(b.dataset.sym));")
rep("$('#legendmore').onclick=()=>{activeTab='sym';buildTabs();renderAllPanes();const el=document.getElementById('sym-map');if(el)el.scrollIntoView({block:'start'});};",
    "$('#legendmore').onclick=()=>showSym('map');")
rep(".nom{display:flex;flex-direction:column;gap:6px;scroll-margin-top:52px}",".nom{display:flex;flex-direction:column;gap:6px;scroll-margin-top:12px}")
rep(".ctl-sep{width:1px;align-self:stretch;background:var(--line);margin-inline:4px}",".ctl-sep{width:1px;align-self:stretch;background:var(--line);margin-inline:4px}\n@media (max-width:960px){.ctl-sep{display:none}}")
BUNDLE=open('an/bundle.js').read()
# ---------- sim: latency, actuator bias ----------
rep("rwKth:3.0,rwKe:6.0,","rwKth:3.0,rwKe:6.0,latency:0,biasDeg:0,biasW:0,")
rep("""    wt=vt*Math.tan(r.d)/P.wheelbase;
  }else{
    wt=clamp(c.w,-P.wmax,P.wmax);
    if(P.lag>0){const a=1-Math.exp(-DT/P.lag);vt=r.v+(vt-r.v)*a;wt=r.w+(wt-r.w)*a;}
    if(P.accel){vt=clamp(vt,r.v-P.amax*DT,r.v+P.amax*DT);wt=clamp(wt,r.w-P.alpha*DT,r.w+P.alpha*DT);}
  }""","""    wt=vt*Math.tan(r.d+(P.biasDeg||0)*Math.PI/180)/P.wheelbase;   // misalignment: the wheels sit biasDeg off what the encoder reads
  }else{
    const wa=r.wa??r.w;   // actuator state (turn rate the motors are trying to produce)
    wt=clamp(c.w,-P.wmax,P.wmax);
    if(P.lag>0){const a=1-Math.exp(-DT/P.lag);vt=r.v+(vt-r.v)*a;wt=wa+(wt-wa)*a;}
    if(P.accel){vt=clamp(vt,r.v-P.amax*DT,r.v+P.amax*DT);wt=clamp(wt,wa-P.alpha*DT,wa+P.alpha*DT);}
    r.wa=wt;wt+=P.biasW||0;   // bias: e.g. one weaker motor
  }""")
rep("      S.cmd=normCmd(cmd);","      applyCmd(normCmd(cmd));")
rep("async function advance(n){","""// Control latency: commands wait latency/DT ticks before reaching the actuators
function applyCmd(c){const n=Math.round(P.latency/DT);if(!n){S.cmd=c;S.cmdQ=[];return;}if(!S.cmdQ)S.cmdQ=[];S.cmdQ.push(c);while(S.cmdQ.length>n)S.cmd=S.cmdQ.shift();}
async function advance(n){""")
rep("cmd:{v:0,w:0,steer:0},odo:{v:0,w:0},plan:null,segIdx:0,","cmd:{v:0,w:0,steer:0},cmdQ:[],odo:{v:0,w:0},plan:null,segIdx:0,")
rep("      {k:'lag',label:'Actuator lag τ',min:0,max:0.6,step:0.01,unit:'s'},",
"""      {k:'lag',label:'Actuator lag τ',min:0,max:0.6,step:0.01,unit:'s'},
      {k:'latency',label:'Control latency (whole ticks)',min:0,max:0.5,step:0.05,unit:'s'},
      {k:'biasDeg',label:'Steering misalignment (bias)',min:-5,max:5,step:0.25,unit:'°',show:isCar},
      {k:'biasW',label:'Turn-rate bias (e.g. weak motor)',min:-0.3,max:0.3,step:0.01,unit:'rad/s',show:()=>!isCar()},""")
# ---------- analysis code ----------
rep("/* ---------- transport & tap ---------- */",BUNDLE+"\n/* ---------- transport & tap ---------- */")
# ---------- markup ----------
rep("""    <section class="stage">
      <div class="status" id="status"></div>""","""    <section class="stage">
      <div class="modebar"><div class="seg" id="modesel" aria-label="View"></div><span class="lbl" id="modehint">Linear analysis of the tracking loop, with guided lessons in the Learn tab</span></div>
      <div id="simview" class="view">
      <div class="status" id="status"></div>""")
rep("""        <dl class="metrics" id="metrics"></dl>
      </section>
    </section>""","""        <dl class="metrics" id="metrics"></dl>
      </section>
      </div>
      <div id="anview" class="view" hidden>
        <p class="an-op" id="an-op"></p>
        <div id="an-none" class="box an-none" hidden></div>
        <div id="an-body">
          <div class="an-diagram" id="an-diagram"></div>
          <div class="an-chips" id="an-chips"></div>
          <div class="an-grid">
            <figure class="an-fig"><figcaption><span>Bode · open loop L(jω)</span><span class="seg sm" id="an-cl"></span></figcaption><canvas id="cv-bode" aria-label="Bode plot"></canvas></figure>
            <figure class="an-fig"><figcaption><span>Nyquist</span><span class="seg sm" id="an-nyq"></span></figcaption><canvas id="cv-nyq" aria-label="Nyquist plot"></canvas></figure>
            <figure class="an-fig"><figcaption><span>Time response</span><span class="seg sm" id="an-kind"></span></figcaption><canvas id="cv-step" aria-label="Step response"></canvas></figure>
            <figure class="an-fig"><figcaption><span>Poles · root locus</span><span class="lbl">s-plane [1/s]</span></figcaption><canvas id="cv-pz" aria-label="Pole-zero map"></canvas></figure>
          </div>
          <div class="an-exp">
            <span class="lbl">Check in the simulator</span>
            <button class="btn" id="an-step">Run step test</button>
            <select class="sel" id="an-amp" aria-label="Step size"><option value="0.05">0.05 m offset</option><option value="0.2" selected>0.2 m offset</option><option value="0.5">0.5 m offset</option><option value="1">1.0 m offset</option></select>
            <button class="btn" id="an-inj">Measure L(jω)</button>
            <select class="sel" id="an-inja" aria-label="Injection amplitude"><option value="small">small sine</option><option value="large">large sine</option></select>
            <span class="an-msg" id="an-msg"></span>
          </div>
          <p class="note an-foot">Bode and Nyquist: continuous vehicle behind a zero-order hold (delay T/2 plus latency), with the 20 Hz controller and actuator elements evaluated exactly at z = e^(sT). Poles and the predicted response: the exact 20 Hz discrete loop. Amber points and dashed curves: measured in the full nonlinear simulator.</p>
        </div>
      </div>
    </section>""")
# ---------- CSS ----------
rep(".codestat{font-family:var(--f-mono);font-size:.78rem}",""".codestat{font-family:var(--f-mono);font-size:.78rem}
.modebar{display:flex;flex-wrap:wrap;align-items:center;gap:6px 12px}
.view{display:flex;flex-direction:column;gap:10px;min-width:0}
.view>*{flex-shrink:0}
.view[hidden]{display:none}
.an-op{margin:0;font-size:.84rem;color:var(--muted)}
.an-op b{color:var(--ink)}
.an-none{padding:14px;font-size:.92rem}
#an-body{display:flex;flex-direction:column;gap:10px}
.an-diagram{background:var(--panel);border:1px solid var(--line);border-radius:6px;padding:4px 6px;overflow-x:auto}
.bd{display:block;width:100%;min-width:560px;height:auto}
.bd-box{fill:var(--raise);stroke:var(--ink);stroke-width:1.2}
.bd-t{fill:var(--ink);font-family:var(--f-display);font-weight:600;font-size:14px;text-anchor:middle}
.bd-s{fill:var(--muted);font-family:var(--f-mono);font-size:10.5px;text-anchor:middle}
.bd-l{stroke:var(--ink);stroke-width:1.2}
.bd-a{fill:var(--ink)}
.bd-dash{stroke-dasharray:4 3;stroke:var(--muted)}
.an-chips{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:6px}
.chip{background:var(--panel);border:1px solid var(--line);border-left:3px solid var(--line);border-radius:5px;padding:4px 8px;display:flex;flex-direction:column;min-width:0}
.chip span{font-size:.66rem;text-transform:uppercase;letter-spacing:.06em;color:var(--muted)}
.chip b{font-family:var(--f-mono);font-weight:500;font-size:.84rem;overflow-wrap:anywhere}
.chip.good{border-left-color:var(--ok)} .chip.warnc{border-left-color:var(--warn)} .chip.badc{border-left-color:var(--bad)}
.an-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
@media (max-width:700px){.an-grid{grid-template-columns:minmax(0,1fr)}}
.an-fig{margin:0;background:var(--panel);border:1px solid var(--line);border-radius:6px;padding:6px 8px 8px;display:flex;flex-direction:column;gap:4px;min-width:0}
.an-fig figcaption{display:flex;justify-content:space-between;align-items:center;gap:6px;flex-wrap:wrap;font-family:var(--f-display);font-weight:600;font-size:.92rem}
.an-fig canvas{width:100%;height:230px;display:block;border-radius:4px}
.seg.sm button{padding:2px 7px;font-size:.74rem}
.an-exp{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.an-msg{font-size:.82rem;color:var(--muted);flex:1 1 220px}
.an-foot{font-size:.78rem}
.btn.small{padding:4px 9px;font-size:.84rem}
.tries{display:flex;flex-wrap:wrap;gap:6px;margin-top:2px}
.lesson{border-top:1px solid var(--line);padding:8px 0 4px}
.lesson summary{cursor:pointer;font-family:var(--f-display);font-weight:600;font-size:1rem;display:flex;gap:8px;align-items:baseline}
.lesson .lnum{font-family:var(--f-mono);font-size:.74rem;color:var(--muted);font-weight:400;min-width:1.4em}""")
# ---------- tabs / panes ----------
rep("{id:'sym',n:'',name:'Symbols'}];","{id:'sym',n:'',name:'Symbols'},{id:'learn',n:'',name:'Learn'}];")
rep("  else if(t==='sym')html=symPane();","  else if(t==='sym')html=symPane();\n  else if(t==='learn')html=learnPane();")
rep("  if(t==='code')wireCode();","  if(t==='code')wireCode();\n  if(t==='learn')wireLearn(pane);")
# ---------- hooks ----------
rep("""  if(['wheelbase','steerMaxDeg','revOK','revPen','gearPen','hybH','planPct'].includes(k)&&!live&&(P.plan==='hybrid'||P.plan==='rs'))requestReplan('vehicle or planner changed');
  draw();refreshAll();
}""","""  if(['wheelbase','steerMaxDeg','revOK','revPen','gearPen','hybH','planPct'].includes(k)&&!live&&(P.plan==='hybrid'||P.plan==='rs'))requestReplan('vehicle or planner changed');
  anInvalidate();
  if(AN.mode==='sim'){draw();refreshAll();}
}""")
rep("  running=false;buildLevels();reset();renderAllPanes();\n}","  running=false;buildLevels();reset();renderAllPanes();anInvalidate();\n}")
rep("""  draw();
  if(frame++%3===0){drawPlot();refreshAll();}
  requestAnimationFrame(loop);""","""  if(AN.mode==='sim'){draw();if(frame++%3===0){drawPlot();refreshAll();}}
  requestAnimationFrame(loop);""")
rep("const mo=new MutationObserver(()=>{tokKey='';});","const mo=new MutationObserver(()=>{tokKey='';if(AN.mode==='an')renderAnalysis();});")
rep("window.addEventListener('resize',()=>{draw();drawPlot();});","window.addEventListener('resize',()=>{if(AN.mode==='an')renderAnalysis();else{draw();drawPlot();}});\nmatchMedia('(prefers-color-scheme: dark)').addEventListener('change',()=>{tokKey='';if(AN.mode==='an')setTimeout(renderAnalysis,30);});")
rep("$('#legendmore').onclick=()=>showSym('map');","""$('#legendmore').onclick=()=>showSym('map');
seg($('#modesel'),[['sim','Simulation'],['an','Analysis']],()=>AN.mode,v=>setMode(v));
function syncAnControls(){
  seg($('#an-cl'),[['0','L only'],['1','+ closed loop']],()=>AN.showCL?'1':'0',v=>{AN.showCL=v==='1';renderAnalysis();});
  seg($('#an-nyq'),[['log','compressed'],['lin','linear']],()=>AN.nyqScale,v=>{AN.nyqScale=v;renderAnalysis();});
  seg($('#an-kind'),[['offset','path offset'],['bias','actuator bias']],()=>AN.stepKind,v=>{AN.stepKind=v;renderAnalysis();});
  $('#an-amp').value=String(AN.stepAmp);$('#an-inja').value=AN.injAmp;
}
syncAnControls();
$('#an-amp').onchange=e=>{AN.stepAmp=+e.target.value;};
$('#an-inja').onchange=e=>{AN.injAmp=e.target.value;};
$('#an-step').onclick=()=>{if(!AN.res)anCompute();runStepTest();AN.msg=`Step test: ${AN.stepKind==='offset'?AN.stepAmp+' m path offset':biasUnit().val+biasUnit().unit+' actuator bias'} in the full simulator (dashed amber).`;renderAnalysis();};
$('#an-inj').onclick=()=>{if(!AN.busy)runInjection();};""")
# nomenclature group
rep(" {id:'tele',title:'Telemetry',rows:[",""" {id:'an',title:'Loop analysis',rows:[
  [`${I('L')}(${I('s')})`,'Open-loop transfer function, broken at the actuator command',''],
  [`${I('S')}(${I('s')})`,`Sensitivity, 1/(1+${I('L')}); its peak is ${I('M')}<sub>s</sub>`,''],
  [`${I('T')}(${I('s')})`,'Closed-loop response of lateral position to a path offset',''],
  [I('g'),`Plant gain from steering command to heading rate: 1 (diff-drive) or ${I('v')}<sub>0</sub>/${I('L')} (car)`,'1/s per unit'],
  [`${I('v')}<sub>0</sub>`,'Operating speed of the analysis (the cruise speed)','m/s'],
  [`${I('K')}<sub>e</sub>, ${I('K')}<sub>θ</sub>`,'Linearized controller gains on lateral and heading error, read from the code','per m, per rad'],
  [`${I('K')}<sub>s</sub>, ${I('K')}<sub>c</sub>, ${I('K')}<sub>u</sub>`,'MPC gains on the actuator state, the commanded state and the previous input move',''],
  [`${I('T')}`,'Sample time of the simulation, 0.05 s','s'],
  [`${I('T')}<sub>d</sub>`,`Loop delay: ${I('T')}/2 for the sample-and-hold, plus latency`,'s'],
  [`${I('a')}`,`Fraction of an MPC rate step that reaches a lagging actuator per tick, 1 − e<sup>−T/τ</sup>`,''],
  [`ω<sub>c</sub>`,`Gain crossover, |${I('L')}(jω<sub>c</sub>)| = 1`,'rad/s'],
  ['PM',`Phase margin, 180° + ∠${I('L')}(jω<sub>c</sub>)`,'°'],
  ['GM',`Gain margin, −20 log<sub>10</sub>|${I('L')}| where the phase is −180°`,'dB'],
  ['DM','Delay margin, PM/ω<sub>c</sub>: extra latency before instability','s'],
  [`${I('M')}<sub>s</sub>`,`Peak sensitivity, 1 / (closest distance from ${I('L')} to −1)`,''],
  [`${I('N')}, ${I('P')}, ${I('Z')}`,`Nyquist: clockwise encirclements of −1, unstable open-loop poles, unstable closed-loop poles; ${I('Z')} = ${I('N')} + ${I('P')}`,''],
  ['ζ, ω<sub>n</sub>','Damping ratio and natural frequency of the dominant closed-loop pole pair','—, rad/s'],
  [`${I('z')}`,`Discrete-time pole; ${I('s')} = ln ${I('z')} / ${I('T')}`,''],
  [`π/${I('T')}`,'Nyquist frequency of the sampled loop (62.8 rad/s)','rad/s'],
  [`${I('e')}<sub>ss</sub>`,'Steady-state lateral error left by a constant actuator bias','m']]},
 {id:'tele',title:'Telemetry',rows:[""")
rep("window.__nav={scatter:","window.__an={AN,anCompute,runStepTest,runInjection,setMode,lessonGo,LESSONS,stepMetrics,Ljw,anBuild};window.__nav={scatter:")
# MPC: new commands build on the last issued command (Δu form), not on the measured actuator state
rep("  if(M.lag)x0.push(S.cmd.v||0,car?(S.cmd.steer||0):(S.cmd.w||0));",
    "  const LC=S.cmdIssued||S.cmd;   // last command this controller issued\n  if(M.lag)x0.push(LC.v||0,car?(LC.steer||0):(LC.w||0));")
rep("  const bv=M.lag?x0[5]:x0[3],bs=M.lag?x0[6]:x0[4],vc=bv+u0[0]*DT,sc=bs+u0[1]*DT;",
    "  const bv=LC.v||0,bs=car?(LC.steer||0):(LC.w||0),vc=bv+u0[0]*DT,sc=bs+u0[1]*DT;   // u = u_prev + u̇·T")
rep("function applyCmd(c){const n=Math.round(P.latency/DT);","function applyCmd(c){S.cmdIssued=c;const n=Math.round(P.latency/DT);")
# Bumpless transfer: build on the MPC's own last command only if it was applied on the previous tick
rep("  const LC=S.cmdIssued||S.cmd;   // last command this controller issued",
    "  // Δu form: build on this controller's own last command when it ran on the previous tick;\n  // after any interruption (replan tick, controller switch) start again from the measured actuator state\n  const LC=(S.mpcCmd&&S.mpcCmd.tick===S.tick-1)?S.mpcCmd:{v:S.odo.v,steer:S.robot.d,w:S.odo.w};")
rep("  const bv=LC.v||0,bs=car?(LC.steer||0):(LC.w||0),vc=bv+u0[0]*DT,sc=bs+u0[1]*DT;   // u = u_prev + u̇·T",
    "  const bv=LC.v||0,bs=car?(LC.steer||0):(LC.w||0),vc=bv+u0[0]*DT,sc=bs+u0[1]*DT;   // u = u_prev + u̇·T\n  S.mpcCmd={v:vc,steer:car?clamp(sc,-steerMax(),steerMax()):0,w:car?0:clamp(sc,-P.wmax,P.wmax),tick:S.tick};")
# ---- patch 26: moving agents — tracking, prediction, ST speed planning, predictive DWA/MPC, people in the parking lot ----
AGJS=open('ag/agents.js').read()
rep("function preControl(){",AGJS+"\nfunction preControl(){")
rep("  metrics();\n  missionTick();\n}","  metrics();\n  missionTick();\n  agentsTick();\n}")
rep("      applyCmd(normCmd(cmd));\n","      applyCmd(normCmd(cmd));\n      agPost();\n")
rep("  return c;}\nfunction builtinRaw(){","  return agSpeedCap(c);}\nfunction builtinRaw(){")
rep("    rejected:0,customMark:null,\n","    rejected:0,customMark:null,agents:agInit(),collPedStill:0,minPed:Infinity,\n")
# people may pause at the ends of their walk (prediction error when they stop and when they set off again)
rep("""    p.s+=p.dir*p.v*dt/L; if(p.s>1){p.s=2-p.s;p.dir=-1;} if(p.s<0){p.s=-p.s;p.dir=1;}
    p.x=p.a[0]+(p.b[0]-p.a[0])*p.s; p.y=p.a[1]+(p.b[1]-p.a[1])*p.s;
    p.vx=p.dir*p.v*(p.b[0]-p.a[0])/L; p.vy=p.dir*p.v*(p.b[1]-p.a[1])/L;""",
"""    if(p.dw){if(p.wait>0)p.wait-=dt;else{p.s+=p.dir*p.v*dt/L;if(p.s>=1){p.s=1;p.dir=-1;p.wait=p.dw;}if(p.s<=0){p.s=0;p.dir=1;p.wait=p.dw;}}}
    else{p.s+=p.dir*p.v*dt/L; if(p.s>1){p.s=2-p.s;p.dir=-1;} if(p.s<0){p.s=-p.s;p.dir=1;}}
    p.x=p.a[0]+(p.b[0]-p.a[0])*p.s; p.y=p.a[1]+(p.b[1]-p.a[1])*p.s;
    const mv=!(p.wait>0);p.vx=mv?p.dir*p.v*(p.b[0]-p.a[0])/L:0; p.vy=mv?p.dir*p.v*(p.b[1]-p.a[1])/L:0;""")
rep("  if(pc&&!r.pedContact){S.collPed++;logE('Contact with a person','bad');}",
    "  if(S.peds.length){let g=Infinity;for(const p of S.peds)g=Math.min(g,bodyGap(r,p));if(g<S.minPed)S.minPed=g;}\n"
    "  if(pc&&!r.pedContact){S.collPed++;const still=Math.abs(r.v)<0.05;if(still)S.collPedStill=(S.collPedStill||0)+1;logE(still?'A person walked into the stopped robot':'Contact with a person','bad');}")
rep("lidarSig:0.02,seed:7};","lidarSig:0.02,seed:7,agents:'off',agPred:'cv',agT:4,agGrow:0.1,agSigA:0.8,spd:'none',stMarg:0.3,agPlan:true};")
# ---- L5 ----
rep("""  adds:'Prior map, but people walk the aisles. Acceleration limits and actuator lag are on, and beacons are unlabeled with false detections.',
  tries:['<b>Control:</b> pure pursuit follows the path into people. Switch to DWA and compare collision counts.',
         '<b>Control:</b> tune DWA clearance weight. Too low clips people, too high stalls in narrow aisles.',""",
"""  adds:'Prior map, but people walk the aisles. A lidar tracker estimates where they are and how fast they move, and a speed planner predicts where they will be. Acceleration limits and actuator lag are on, and beacons are unlabeled with false detections.',
  tries:['<b>Control:</b> pure pursuit runs with Moving agents set to Speed planning: it keeps its path and slows or waits for people predicted to cross it. Open the ST graph in Telemetry. Then set it to Ignore, then Reactive stop, and compare people contacts.',
         '<b>Perceive:</b> set Prediction to Static (frozen). The planner then reacts only to where people are now, and the robot pulls into gaps that are about to close.',
         '<b>Perceive:</b> switch Moving agents from Lidar tracker to Ground truth. The difference is what tracking costs: late confirmation, noisy velocity, coasting through occlusion.',
         '<b>Control:</b> DWA and MPC use the predictions too, as time-indexed obstacles. Compare them with Moving agents set to Not tracked, which treats every lidar hit as a static obstacle at the moment of the scan.',""")
rep("clutter:0.5,replan:2,lostGuard:true},layers:{cost:false}},","clutter:0.5,replan:2,lostGuard:true,agents:'lidar',spd:'st'},layers:{cost:false}},")
# ---- L6: people in the lanes ----
rep("Goals now carry a heading: reverse into a bay, nose into another, then parallel park.',",
    "Goals now carry a heading: reverse into a bay, nose into another, then parallel park. People cross the lanes on their way to and from cars, pausing before they turn back.',")
rep("""         '<b>Control:</b> MPC knows the steering-rate limit, so it needs no dry-steering rule at cusps. Switch it to LTV and watch the dashed linear prediction drift from the true one at the start of each leg.'],""",
"""         '<b>Control:</b> MPC knows the steering-rate limit, so it needs no dry-steering rule at cusps. Switch it to LTV and watch the dashed linear prediction drift from the true one at the start of each leg.',
         '<b>Control:</b> people cross the lanes. With Moving agents set to Speed planning the car keeps its manoeuvre and picks a speed that lets them pass; the ST graph in Telemetry shows why. Set it to Ignore and count contacts, then Reactive stop.',
         '<b>Perceive:</b> set Prediction to Static (frozen), or the horizon to 1 s. The car stops treating crossing people as future obstacles and noses into their way.'],""")
rep("[9,4.98],[17,4.98]],peds:[],","[9,4.98],[17,4.98]],\n  peds:[{a:[0.8,10.2],b:[3.3,10.2],v:0.5,s0:0.15,dw:3},{a:[14.8,11.2],b:[14.8,14.3],v:0.5,s0:0.18,dw:2},{a:[4.5,6.6],b:[19,6.6],v:0.7,s0:0.95,dw:1},{a:[11,1.5],b:[11,7.7],v:0.5,s0:0.48,dw:2}],")
rep("replan:0,vcruise:0.6,ppL0:0.4,ppK:0.3},layers:{cost:false}},","replan:0,vcruise:0.6,ppL0:0.4,ppK:0.3,agents:'lidar',spd:'st'},layers:{cost:false}},")
# ---- MPC: time-indexed agent constraints; agent hits leave the static point set ----
rep("  const nc=4+(obs?offs.length:0);\n  const pts=obs?S.scanPts.filter(",
    "  const agM=obs&&agOn(),nc=4+(obs?offs.length*(agM?2:1):0),ags=agM?agList(Np*dt*Math.max(vMax,0.3)+4):[];\n  const pts=obs?((S.agents&&S.agents.staticPts)||S.scanPts).filter(")
rep("""        out.push([rc+P.mpcMarg-d,[-ux,-uy,-(ux*(-o*sn)+uy*(o*c)),0,0]]);}}
    return out;};""",
"""        out.push([rc+P.mpcMarg-d,[-ux,-uy,-(ux*(-o*sn)+uy*(o*c)),0,0]]);}
      if(agM){const Q=ags.map(a=>agPred(a,k*dt));   // predicted agents at this step's time
        for(const o of offs){const cx=x[0]+o*c,cy=x[1]+o*sn;let bd=Infinity,bq=null;
          for(const q of Q){const d=hyp(q[0]-cx,q[1]-cy)-q[2];if(d<bd){bd=d;bq=q;}}
          if(!bq){out.push([-1,[0,0,0,0,0]]);continue;}
          const d=Math.max(hyp(cx-bq[0],cy-bq[1]),1e-6),ux=(cx-bq[0])/d,uy=(cy-bq[1])/d;
          out.push([rc+bq[2]+P.mpcMarg-d,[-ux,-uy,-(ux*(-o*sn)+uy*(o*c)),0,0]]);}}}
    return out;};""")
# ---- DWA: rollouts checked against agents at the same time step ----
rep("  const pts=S.scanPts.filter(p=>hyp(p[0]-e.x,p[1]-e.y)<4.5);",
    "  const pts=((S.agents&&S.agents.staticPts)||S.scanPts).filter(p=>hyp(p[0]-e.x,p[1]-e.y)<4.5),ags=agOn()?agList(4.5+P.dwaT*2.5):[];")
rep("        for(const[cx,cy,cr]of fpCircles(x,y,th))for(const p of pts){const d=hyp(p[0]-cx,p[1]-cy)-cr;if(d<clear)clear=d;}if(clear<0.05)break;}",
    "        for(const[cx,cy,cr]of fpCircles(x,y,th))for(const p of pts){const d=hyp(p[0]-cx,p[1]-cy)-cr;if(d<clear)clear=d;}\n"
    "        for(const a of ags){const q=agPred(a,(k+1)*sdt);for(const[cx,cy,cr]of fpCircles(x,y,th)){const d=hyp(q[0]-cx,q[1]-cy)-cr-q[2];if(d<clear)clear=d;}}\n"
    "        if(clear<0.05)break;}")
# ---- global planner: agent layer only when the speed planner escalates ----
rep("  const wp=WPS[F.queue[0]],e=S.est,t0=performance.now();let res;",
    "  const agL=reason==='agent blocking'&&agCostLayer();   // predicted agents enter the costmap for this plan only\n  const wp=WPS[F.queue[0]],e=S.est,t0=performance.now();let res;")
rep("  const ms=performance.now()-t0;F.lastPlanT=S.t;","  const ms=performance.now()-t0;F.lastPlanT=S.t;if(agL)buildCostmap();")
# ---- schema ----
rep("""      {type:'btn',label:'Clear built map',act:()=>{S.lo.fill(0);buildCostmap();dirty.occ=true;logE('Occupancy grid cleared','warn');draw();},show:()=>P.per==='mapping'}],""",
"""      {type:'btn',label:'Clear built map',act:()=>{S.lo.fill(0);buildCostmap();dirty.occ=true;logE('Occupancy grid cleared','warn');draw();},show:()=>P.per==='mapping'},
      {k:'agents',type:'seg',label:'Moving agents',opts:[['off','Not tracked'],['truth','Ground truth'],['lidar','Lidar tracker']]},
      {k:'agPred',type:'seg',label:'Prediction',opts:[['cv','Constant velocity'],['static','Static (frozen)']],show:agOn},
      {k:'agT',label:'Prediction horizon T_p',min:1,max:6,step:0.5,unit:'s',show:agOn},
      {k:'agGrow',label:'Prediction uncertainty growth g',min:0,max:0.5,step:0.05,unit:'m/s',show:()=>agOn()&&P.agPred==='cv'},
      {k:'agSigA',label:'Tracker process noise σ_a',min:0.1,max:3,step:0.1,unit:'m/s²',show:()=>P.agents==='lidar'}],""")
rep("""      {k:'vcruise',label:'Cruise speed (reference profile)',min:0.2,max:2,step:0.05,unit:'m/s',show:()=>P.ctl!=='custom'},""",
"""      {k:'vcruise',label:'Cruise speed (reference profile)',min:0.2,max:2,step:0.05,unit:'m/s',show:()=>P.ctl!=='custom'},
      {k:'spd',type:'seg',label:'Moving agents',opts:[['none','Ignore'],['stop','Reactive stop'],['st','Speed planning (ST graph)']],show:()=>AG_PATH_CTL.includes(P.ctl)},
      {type:'info',text:()=>'Speed planning needs agent tracking: Perceive → Moving agents.',show:()=>AG_PATH_CTL.includes(P.ctl)&&P.spd==='st'&&!agOn()},
      {k:'stMarg',label:'Clearance kept from predicted agents',min:0,max:1,step:0.05,unit:'m',show:()=>AG_PATH_CTL.includes(P.ctl)&&P.spd==='st'&&agOn()},
      {type:'info',text:()=>P.ctl==='mpc'?'MPC adds a clearance constraint per footprint circle and step against the nearest predicted agent (NMPC with obstacle constraints).':'DWA checks each rollout against the agents\\' predicted positions at the same time step.',show:()=>(P.ctl==='dwa'||P.ctl==='mpc')&&agOn()},""")
rep("""       {type:'btn',label:'Replan now',act:()=>""","""       {k:'agPlan',type:'bool',label:'When the speed planner reports an agent blocking the path, replan around its predicted positions'},
       {type:'btn',label:'Replan now',act:()=>""")
rep("  if(k==='assoc'||k==='inject'||k==='filtK'){S.nees=[];}",
    "  if(k==='assoc'||k==='inject'||k==='filtK'){S.nees=[];}\n  if(k==='agents'){S.agents=agInit();logE(`Moving agents → ${({off:'not tracked',truth:'ground truth',lidar:'lidar tracker'})[v]}`);}\n  if(k==='spd')logE(`Agents (path trackers) → ${({none:'ignore',stop:'reactive stop',st:'speed planning'})[v]}`);")
# ---- layers + drawing ----
rep("trail:true,dwa:true};","trail:true,dwa:true,agents:true};")
rep("['dwa','Local planner: DWA rollouts, MPC prediction and reference']];","['dwa','Local planner: DWA rollouts, MPC prediction and reference'],['agents','Agent tracks, predictions, and the ego\\'s predicted positions at the same times']];")
rep("  if(S.ctlViz&&S.ctlViz.carrot){const c=S.ctlViz.carrot,",
"""  // tracked agents (estimate frame) with predicted positions, and the ego's predicted positions at the same times
  const egoM=LAYERS.agents&&S.agents&&agOn()?agEgoMarks():[];
  if(LAYERS.agents&&S.agents&&agOn()){
    for(const t of S.agents.tracks){
      if(!t.conf){ctx.strokeStyle=rgba(TOK.muted,0.8);ctx.lineWidth=px(1);ctx.setLineDash([px(2),px(2)]);ctx.beginPath();ctx.arc(t.x,t.y,t.r,0,TAU);ctx.stroke();ctx.setLineDash([]);continue;}
      const f=agPred(t,P.agT);ctx.strokeStyle=rgba(TOK.warn,0.75);ctx.lineWidth=px(1.2);ctx.beginPath();ctx.moveTo(t.x,t.y);ctx.lineTo(f[0],f[1]);ctx.stroke();
      ctx.setLineDash([px(3),px(3)]);for(let k=1;k<=P.agT+1e-6;k++){const q=agPred(t,k);ctx.strokeStyle=rgba(TOK.warn,Math.max(0.15,0.6-0.1*k));ctx.beginPath();ctx.arc(q[0],q[1],q[2],0,TAU);ctx.stroke();}ctx.setLineDash([]);
      ctx.strokeStyle=TOK.warn;ctx.lineWidth=px(2);ctx.beginPath();ctx.arc(t.x,t.y,t.r,0,TAU);ctx.stroke();}
    for(const m of egoM){ctx.strokeStyle=TOK.accent;ctx.lineWidth=px(1.5);ctx.fillStyle=TOK['map-bg'];ctx.beginPath();ctx.arc(m[0],m[1],px(7),0,TAU);ctx.fill();ctx.stroke();}
  }
  if(S.ctlViz&&S.ctlViz.carrot){const c=S.ctlViz.carrot,""")
rep("  WPS.forEach((w,i)=>{if(w.done)return;const q=order.indexOf(i);const[sx,sy]=toS(w.x,w.y);",
"""  if(LAYERS.agents&&S.agents&&agOn()){ctx.font=`600 ${Math.round(9*dpr)}px ${getComputedStyle(document.body).getPropertyValue('--f-mono')||'monospace'}`;
    for(const t of S.agents.tracks){if(!t.conf)continue;const[sx,sy]=toS(t.x+t.r*0.75,t.y+t.r*0.75);ctx.fillStyle=TOK.warn;ctx.textAlign='left';ctx.textBaseline='bottom';ctx.fillText('#'+t.id,sx+2*dpr,sy);
      ctx.textAlign='center';ctx.textBaseline='middle';for(let k=1;k<=P.agT+1e-6;k++){const q=agPred(t,k);if(P.agPred!=='cv')break;const[qx,qy]=toS(q[0],q[1]);ctx.fillStyle=rgba(TOK.warn,0.9);ctx.fillText(String(k),qx,qy);}}
    ctx.textAlign='center';ctx.textBaseline='middle';for(const m of egoM){const[sx,sy]=toS(m[0],m[1]);ctx.fillStyle=TOK.accent;ctx.fillText(String(m[2]),sx,sy+0.5);}
    ctx.font=`600 ${Math.round(10*dpr)}px ${getComputedStyle(document.body).getPropertyValue('--f-mono')||'monospace'}`;}
  WPS.forEach((w,i)=>{if(w.done)return;const q=order.indexOf(i);const[sx,sy]=toS(w.x,w.y);""")
# ---- telemetry ----
rep("function drawPlot(){\n","function drawPlot(){\n  if(plotCh==='st')return drawST();\n")
rep("[['ex','x error'],['eth','θ error'],['cte','Cross-track'],['v','Speed'],['turn','Steering']]","[['ex','x error'],['eth','θ error'],['cte','Cross-track'],['v','Speed'],['turn','Steering'],['st','ST graph']]")
rep("    ['Collisions',`${S.coll} static, ${S.collPed} people`],",
    "    ['Collisions',`${S.coll} static, ${S.collPed} people${S.collPedStill?` (${S.collPedStill} into the stopped robot)`:''}`],")
rep("  if(S.pf)items.push(['Particles',",
    "  if(S.peds.length)items.push(['Closest to a person',isFinite(S.minPed)?`${Math.max(0,S.minPed).toFixed(2)} m`:'—']);\n"
    "  if(S.agents&&agOn()){const tr=S.agents.tracks,cf=tr.filter(t=>t.conf).length;items.push(['Agent tracks',`${cf} confirmed · ${tr.length-cf} tentative`]);}\n"
    "  if(S.pf)items.push(['Particles',")
# ---- notes ----
rep("""occupied if l > 0.5;  unknown if l ≈ 0</div>""","""occupied if l > 0.5;  unknown if l ≈ 0</div>""")
rep("""a quadratic penalty fades out across the inflation band.</p>`,""","""a quadratic penalty fades out across the inflation band.</p>
<p><b>Moving agents.</b> The lidar tracker takes the hits the static map does not explain (prior map: more than 0.25 m from it; built map: cells that are not persistently occupied) and clusters them over consecutive beams. Clusters wider than 1.2 m are dropped as map error. Hits lie on the near side of a person, so the centre is pushed 0.6 r away from the sensor.</p>
<div class="eq">state  x = [p_x, p_y, v_x, v_y],  constant-velocity model
x' = F x,  F = [I  Δt·I; 0  I],  Q from white acceleration noise σ_a
z = p + noise (σ_z = 0.1 m);  gate d² = ‖z − p̂‖² / (P_pp + σ_z²) < 9.21  (χ²₂, 99 %)
greedy nearest-neighbour assignment · confirm after 3 hits · coast up to 1 s unseen
prediction  p(t) = p + v t,   r(t) = r + g t</div>
<p><b>Ground truth</b> hands over true positions and velocities, which separates prediction error from tracking error. Hits that belong to confirmed tracks are taken out of the static obstacle set the local planners see; the predictions replace them. People do not react to the robot, so this is prediction without interaction.</p>`,""")
rep("""<p>It treats people as static at the moment of the scan. Predicting their motion is the next level up (velocity obstacles, MPC).</p>""",
"""<p>Without agent tracking DWA treats people as static at the moment of the scan. With tracking on, each rollout is checked against the agents' predicted positions at the same time step. MPC gets one clearance constraint per footprint circle and prediction step against the nearest predicted agent.</p>""")
rep("""Stanley's reference point would trail on a reverse leg, so reverse legs fall back to pure pursuit. A leg ends within 0.12 m of its cusp. The built-in car controllers hold speed until the wheels reach the commanded angle (dry steering), and reverse legs are capped at 0.35 m/s.</p>`,""",
"""Stanley's reference point would trail on a reverse leg, so reverse legs fall back to pure pursuit. A leg ends within 0.12 m of its cusp. The built-in car controllers hold speed until the wheels reach the commanded angle (dry steering), and reverse legs are capped at 0.35 m/s.</p>
<p><b>Moving agents with a path tracker: speed planning.</b> Pure pursuit, rear-wheel feedback, Stanley and PID only steer. To handle people the stack splits the problem (path–velocity decomposition): keep the path, choose the speed. The ST graph (Telemetry) has distance s ahead on the path against time t. A cell is blocked when the footprint at s overlaps a predicted agent at t, plus the clearance. Dynamic programming over (t, s, v) picks the profile:</p>
<div class="eq">v' = v + a Δt,   a ∈ {−b, −b/2, −b/5, 0, a_c/2, a_c},   Δt = 0.2 s, horizon T_p
J = Σ Δt [ (v_ref(s) − v)² + 0.3 a² + 3 · proximity ],   blocked cells forbidden
the speed at t = 0.2 s caps the tracker's speed; the commanded curvature is kept</div>
<p>a_c and b are the acceleration limit when limits are on, otherwise 0.8 and 1.5 m/s². If no profile avoids the agents the robot brakes. If that lasts about 1 s, or it has waited about 4 s, the behaviour layer asks the global planner for a path around the agents' predicted positions. <b>Reactive stop</b> is the baseline without tracking or prediction: brake for any unexplained lidar hit in the footprint corridor ahead.</p>`,""")
rep("""h  = ε · max(2D Dijkstra with obstacles, Reeds–Shepp without obstacles)""","""h  = ε · max(2D Dijkstra with obstacles, Reeds–Shepp without obstacles)""")
rep("""<p>To give a goal a heading, use <b>Tap map to → Add posed goal</b> and drag in the direction the car should face. Goals without a heading are accepted at any heading.</p>`,""",
"""<p>To give a goal a heading, use <b>Tap map to → Add posed goal</b> and drag in the direction the car should face. Goals without a heading are accepted at any heading.</p>
<p><b>Moving agents.</b> The global plan ignores them on purpose: people move faster than a global plan stays valid, and the speed planner handles them. Only when it reports an agent blocking the path does the replan add that agent's predicted positions over the next 2 s to the costmap, for that one plan.</p>`,""")
rep("DRIVE → PLAN on: path blocked in costmap · stuck (&lt;0.15 m in 5 s,","DRIVE → PLAN on: path blocked in costmap · agent blocking (speed planner) · stuck (&lt;0.15 m in 5 s,")
rep("""${t==='ctl'?'<button class="linkbtn" data-sym="mpc">MPC symbols</button>':''}""","""${t==='ctl'?'<button class="linkbtn" data-sym="mpc">MPC symbols</button>':''}${t==='per'||t==='ctl'?'<button class="linkbtn" data-sym="ag">Moving-agent symbols</button>':''}""")
# ---- nomenclature ----
rep(""" {id:'tele',title:'Telemetry',rows:[""",""" {id:'ag',title:'Moving agents and prediction',rows:[
  [`<b>x</b><sub>a</sub>`,`Agent track state [${I('p')}<sub>x</sub>, ${I('p')}<sub>y</sub>, ${I('v')}<sub>x</sub>, ${I('v')}<sub>y</sub>]`,'m, m/s'],
  [I('F'),'Constant-velocity state transition',''],
  ['σ<sub>a</sub>','Tracker process noise: white acceleration of the constant-velocity model','m/s²'],
  ['σ<sub>z</sub>','Noise of a detected agent position, 0.1 m','m'],
  [`${I('d')}²`,'Mahalanobis distance that gates track–detection pairs (χ²₂ 99 %: 9.21)',''],
  [`${I('T')}<sub>p</sub>`,'Prediction horizon','s'],
  [`${I('r')}(${I('t')})`,`Predicted agent radius ${I('r')} + ${I('g')}·${I('t')}`,'m'],
  [I('g'),'Uncertainty growth of the prediction','m/s'],
  [I('s'),'In the ST graph only: distance ahead along the current path leg','m'],
  [`${I('v')}<sub>ref</sub>(${I('s')})`,'Speed the tracker would use at s: cruise, curvature and stopping limits','m/s'],
  [`${I('a')}<sub>c</sub>, ${I('b')}`,'Acceleration and braking used by the speed planner','m/s²']]},
 {id:'tele',title:'Telemetry',rows:[""")
rep("""  ['<i class="swatch" style="background:var(--warn)"></i>','People, with a velocity tick',''],""",
"""  ['<i class="swatch" style="background:var(--warn)"></i>','People (ground truth), with a velocity tick',''],
  ['<i class="swatch ring" style="border-color:var(--warn)"></i>','Tracked agent with its ID, as estimated; dashed rings are its predicted positions at 1 s, 2 s, … growing with uncertainty. Grey dashed ring: tentative track',''],
  ['<i class="swatch ring" style="border-color:var(--accent)"></i>','Ego predicted positions at 1 s, 2 s, … from the speed plan, MPC or DWA. Matching numbers on the agents\\' rings are the same instants',''],""")
# ---- custom controller sees the tracks ----
rep("goal:{x:wp.x,y:wp.y},scan:S.scanPts,","goal:{x:wp.x,y:wp.y},scan:S.scanPts,agents:agList().map(t=>({id:t.id,x:t.x,y:t.y,vx:t.vx,vy:t.vy,r:t.r})),")
rep("// obs.scan   [[x, y], ...]   lidar hits in the world frame (from the estimate)\n","// obs.scan   [[x, y], ...]   lidar hits in the world frame (from the estimate)\n// obs.agents [{id, x, y, vx, vy, r}]  tracked moving agents (Perceive → Moving agents)\n")
# ---- patch 27: Phase 1 content — Try buttons, nomenclature, tooltips, first-run cue ----
import re

# ---------- Try items become buttons ----------
def tries_block(level_id, items):
    return "  tries:[\n"+",\n".join("   {t:%s,b:[%s]}"%(t, ",".join("[%s,%s]"%(l,c) for l,c in b)) for t,b in items)+"],"

TRY={
'L1':[
 ("'<b>Control:</b> drop pure-pursuit L<sub>0</sub> to 0.1 m, then raise it to 2 m. Watch the cross-track plot: short lookahead oscillates, long lookahead cuts corners.'",
  [("'L<sub>0</sub> = 0.1 m'","{set:{ppL0:0.1},tab:'ctl',plot:'cte'}"),("'L<sub>0</sub> = 2 m'","{set:{ppL0:2},tab:'ctl',plot:'cte'}")]),
 ("'<b>Control:</b> switch to PID and compare the same legs.'",[("'PID'","{set:{ctl:'pid'},tab:'ctl',plot:'cte'}")]),
 ("'<b>Vehicle:</b> turn on acceleration limits and set lag τ to 0.3 s. The speed plot shows command and response diverge.'",
  [("'Limits on, τ = 0.3 s'","{set:{accel:true,lag:0.3},tab:'veh',plot:'v'}")]),
 ("'<b>Control:</b> MPC. Compare cross-track RMS with pure pursuit. Shrink Np to 3 (myopic) and Nc to 1 (one held move). With lag τ = 0.3 s, tick Include actuator lag and compare.'",
  [("'MPC'","{set:{ctl:'mpc'},tab:'ctl',plot:'cte'}"),("'N<sub>p</sub> = 3, N<sub>c</sub> = 1'","{set:{ctl:'mpc',mpcNp:3,mpcNc:1},tab:'ctl',plot:'cte'}"),("'τ = 0.3 s, lag modeled'","{set:{ctl:'mpc',lag:0.3,mpcLag:true},tab:'ctl',plot:'v'}")])],
'L2':[
 ("'<b>Plan:</b> pick Straight line and run. The robot drives into a shelf and the stuck detector fires.'",[("'Straight line'","{set:{plan:'straight'},tab:'plan'}")]),
 ("'<b>Plan:</b> A* with ε = 1 versus ε = 3. Compare expansions and path length in the log (weighted A* is bounded by ε × optimal).'",
  [("'ε = 1'","{set:{plan:'astar',eps:1},tab:'plan'}"),("'ε = 3'","{set:{plan:'astar',eps:3},tab:'plan'}")]),
 ("'<b>Plan:</b> RRT*, then change the seed and reset. Sampling planners give a different path every time.'",
  [("'RRT*'","{set:{plan:'rrtstar'},tab:'plan'}"),("'RRT*, next seed'","{seed:'next',set:{plan:'rrtstar'},tab:'plan'}")]),
 ("'<b>Mission:</b> Optimal versus In order. The log shows total mission cost for each.'",
  [("'In order'","{set:{mis:'sequential'},tab:'mis'}"),("'Optimal'","{set:{mis:'optimal'},tab:'mis'}")])],
'L3':[
 ("'<b>Localize:</b> the level starts on dead reckoning. Watch the truth and the estimate separate, and the ellipse grow.'",[("'Dead reckoning'","{set:{loc:'dr'},tab:'loc',plot:'pos'}")]),
 ("'<b>Localize:</b> switch to EKF. Then raise odometry bias in Vehicle and watch NEES climb past 3: the filter becomes overconfident.'",
  [("'EKF'","{set:{loc:'ekf'},tab:'loc',plot:'pos'}"),("'EKF, bias ×3'","{set:{loc:'ekf',odoB:3},tab:'veh',plot:'pos'}")]),
 ("'<b>Localize:</b> raise the filter\\'s assumed motion noise until NEES settles near 3 again.'",[("'EKF, bias ×3, assumed noise ×4'","{set:{loc:'ekf',odoB:3,filtK:4},tab:'loc',plot:'pos'}")]),
 ("'<b>Localize:</b> kidnap the robot. With known IDs the EKF can pull itself back. With unlabeled beacons the gate rejects every reading. The particle filter recovers either way.'",
  [("'EKF, kidnap at 8 s'","{set:{loc:'ekf'},tab:'loc',plot:'pos',act:'kidnap'}"),("'Unlabeled, kidnap'","{set:{loc:'ekf',assoc:'unknown'},tab:'loc',plot:'pos',act:'kidnap'}"),("'Particle filter, kidnap'","{set:{loc:'pf',assoc:'unknown'},tab:'loc',plot:'pos',act:'kidnap'}")])],
'L4':[
 ("'<b>Mission:</b> follow the replans in the event log as rooms are discovered.'",[("'Run'","{tab:'mis'}")]),
 ("'<b>Perceive:</b> set unknown space to lethal. Goals in unexplored rooms become unreachable, which is the gap frontier-based exploration fills.'",[("'Unknown = lethal'","{set:{unknownAs:'lethal'},tab:'per'}")]),
 ("'<b>Localize:</b> switch to dead reckoning and watch the map smear: mapping inherits pose error.'",[("'Dead reckoning'","{set:{loc:'dr'},tab:'loc'}")]),
 ("'<b>Layers:</b> hide the true-map ghost and judge the map as the robot sees it.'",[("'Hide the ghost'","{layers:{ghost:false},tab:'view',keep:true}")]),
 ("'<b>Control:</b> MPC with obstacle constraints handles the tight rooms. Switch it to LTV, which cannot take nonconvex obstacle constraints, and watch it clip the table.'",
  [("'MPC'","{set:{ctl:'mpc'},tab:'ctl'}"),("'LTV'","{set:{ctl:'mpc',mpcMode:'ltv'},tab:'ctl'}")])],
'L5':[
 ("'<b>Control:</b> pure pursuit runs with the response to agents set to Speed planning: it keeps its path and slows or waits for people predicted to cross it. Open the ST graph in Telemetry. Then set it to Ignore, then Reactive stop, and compare people contacts.'",
  [("'Speed planning'","{tab:'ctl',plot:'st'}"),("'Ignore'","{set:{spd:'none'},tab:'ctl'}"),("'Reactive stop'","{set:{spd:'stop'},tab:'ctl'}")]),
 ("'<b>Perceive:</b> set Prediction to Static (frozen). The planner then reacts only to where people are now, and the robot pulls into gaps that are about to close.'",[("'Static prediction'","{set:{agPred:'static'},tab:'per',plot:'st'}")]),
 ("'<b>Perceive:</b> switch Agent tracking from Lidar to Ground truth. The difference is what tracking costs: late confirmation, noisy velocity, coasting through occlusion.'",[("'Ground truth'","{set:{agents:'truth'},tab:'per'}")]),
 ("'<b>Control:</b> DWA and MPC use the predictions too, as time-indexed obstacles. Compare them with Agent tracking off, which treats every lidar hit as a static obstacle at the moment of the scan. MPC respects the acceleration limits exactly; tick Include actuator lag, since τ = 0.15 s here.'",
  [("'DWA'","{set:{ctl:'dwa'},tab:'ctl'}"),("'DWA, tracking off'","{set:{ctl:'dwa',agents:'off'},tab:'ctl'}"),("'MPC'","{set:{ctl:'mpc',mpcLag:true},tab:'ctl'}"),("'MPC, tracking off'","{set:{ctl:'mpc',mpcLag:true,agents:'off'},tab:'ctl'}")]),
 ("'<b>Localize:</b> scatter the particles. With unlabeled beacons this warehouse is nearly 180° symmetric, so the filter can lock onto the mirror pose. Switch to Known IDs and scatter again.'",
  [("'Scatter at 8 s'","{tab:'loc',act:'scatter'}"),("'Known IDs, scatter'","{set:{assoc:'known'},tab:'loc',act:'scatter'}")]),
 ("'<b>Vehicle:</b> raise false detections and watch gating and robust weights hold.'",[("'2 false detections per scan'","{set:{clutter:2},tab:'veh'}")])],
'L6':[
 ("'<b>Plan:</b> watch Hybrid A* insert reverse legs (dashed orange). Then switch to A*: the path ignores heading and turning radius, so the car swings wide and misses the bay.'",
  [("'Hybrid A*'","{tab:'plan'}"),("'A*'","{set:{plan:'astar'},tab:'plan'}")]),
 ("'<b>Plan:</b> pick Reeds–Shepp. It finds the shortest maneuver but ignores obstacles, so it drives through parked cars.'",[("'Reeds–Shepp'","{set:{plan:'rs'},tab:'plan'}")]),
 ("'<b>Plan:</b> untick Allow reversing. The reverse-in bay and the parallel slot become unreachable or far longer.'",[("'No reversing'","{set:{revOK:false},tab:'plan'}")]),
 ("'<b>Plan:</b> set the heuristic to 2D only and compare expansions in the log. Then raise Steering used by the planner to 100%: full-lock arcs leave the tracker no room to correct.'",
  [("'2D heuristic'","{set:{hybH:'2d'},tab:'plan'}"),("'Planner at 100 %'","{set:{planPct:100},tab:'plan'}")]),
 ("'<b>Control:</b> DWA follows the plan into a bay but stops short. It scores distance to a carrot, not the final pose, so it is a local avoider rather than a parking controller.'",[("'DWA'","{set:{ctl:'dwa'},tab:'ctl'}")]),
 ("'<b>Control:</b> the default is rear-wheel feedback (curvature feedforward). Switch to pure pursuit and watch it cut the inside of full-lock arcs. Then try Stanley and lower the steering rate limit in Vehicle.'",
  [("'Pure pursuit'","{set:{ctl:'pp'},tab:'ctl',plot:'cte'}"),("'Stanley, rate 0.5 rad/s'","{set:{ctl:'stanley',steerRate:0.5},tab:'veh',plot:'turn'}")]),
 ("'<b>Localize:</b> switch to EKF and raise odometry noise. The log reports the true final pose error at every bay.'",[("'EKF, noise ×2'","{set:{loc:'ekf',odoK:2},tab:'loc',plot:'pos'}")]),
 ("'<b>Control:</b> MPC knows the steering-rate limit, so it needs no dry-steering rule at cusps. Switch it to LTV and watch the dashed linear prediction drift from the true one at the start of each leg.'",
  [("'MPC'","{set:{ctl:'mpc'},tab:'ctl'}"),("'LTV'","{set:{ctl:'mpc',mpcMode:'ltv'},tab:'ctl'}")]),
 ("'<b>Control:</b> people cross the lanes. With the response to agents set to Speed planning the car keeps its maneuver and picks a speed that lets them pass; the ST graph in Telemetry shows why. Set it to Ignore and count contacts, then Reactive stop.'",
  [("'Speed planning'","{tab:'ctl',plot:'st'}"),("'Ignore'","{set:{spd:'none'},tab:'ctl'}"),("'Reactive stop'","{set:{spd:'stop'},tab:'ctl'}")]),
 ("'<b>Perceive:</b> set Prediction to Static (frozen), or the horizon to 1 s. The car stops treating crossing people as future obstacles and noses into their way.'",
  [("'Static prediction'","{set:{agPred:'static'},tab:'per',plot:'st'}"),("'Horizon 1 s'","{set:{agT:1},tab:'per',plot:'st'}")])],
}
for lid,items in TRY.items():
    i0=s.index("{id:'%s',"%lid); a=s.index("  tries:[",i0); b=s.index("],\n",a)+3
    s=s[:a]+tries_block(lid,items)+"\n"+s[b:]

# brief: tries rendered with buttons; heading reworded
rep("""  $('#brief').innerHTML=`<div><h3>${LV.id} adds</h3><p class="adds">${LV.adds}</p></div><details class="try" ${tryOpen?'open':''}><summary><h3>Try (${LV.tries.length})</h3></summary><ul>${LV.tries.map(t=>`<li>${t}</li>`).join('')}</ul></details>`;
  $('#brief .try').ontoggle=e=>{tryOpen=e.target.open;};""",
"""  $('#brief').innerHTML=`<div><h3>What ${LV.id} adds</h3><p class="adds">${LV.adds}</p></div><details class="try" ${tryOpen?'open':''}><summary><h3>Try (${LV.tries.length}) · each button sets the lab up and runs</h3></summary><ul>${LV.tries.map((t,i)=>`<li>${t.t}<div class="tries">${t.b.map((x,j)=>`<button class="btn small" data-lt="${i}:${j}">${x[0]}</button>`).join('')}</div></li>`).join('')}</ul></details>`;
  $('#brief .try').ontoggle=e=>{tryOpen=e.target.open;};
  $('#brief').querySelectorAll('[data-lt]').forEach(b=>b.onclick=()=>{const[i,j]=b.dataset.lt.split(':').map(Number);tryGo(LV.tries[i].b[j][1]);});""")
# tryGo: reload the level (fresh), apply, show the right tab and plot, run; optional timed action
rep("function loadLevel(i){",
"""async function tryGo(cfg){
  firstRunDone();
  if(cfg.seed==='next')P.seed=P.seed%99+1;
  if(!cfg.keep)loadLevel(LEVELS.indexOf(LV));
  for(const[k,v]of Object.entries(cfg.set||{}))setParam(k,v,false);
  if(cfg.layers)Object.assign(LAYERS,cfg.layers);
  if(cfg.tab){activeTab=cfg.tab;buildTabs();}renderAllPanes();
  if(cfg.plot){plotCh=cfg.plot;seg($('#plotsel'),PLOT_OPTS,()=>plotCh,v=>{plotCh=v;drawPlot();});}
  if(AN.mode!=='sim')setMode('sim');
  if(cfg.keep){draw();return;}
  if((S.fsm.state==='IDLE'||S.fsm.state==='DONE')&&remaining().length)startMission();
  if(cfg.act){running=false;await advance(160);
    if(cfg.act==='kidnap')kidnapTo(null);else if(cfg.act==='scatter')scatterParticles();}
  running=true;refreshAll();
}
function kidnapTo(p){   // p = [x, y] or null for a free spot far from the robot
  const r=S.robot;let best=null;
  if(!p){for(let i=0;i<400;i++){const x=1+S.rngA.u()*(W-2),y=1+S.rngA.u()*(H-2),k=cellIdx(x,y);if(k<0||LV.truthDist[k]<0.8)continue;const d=hyp(x-r.x,y-r.y);if(d>6&&(!best||d>best[2]))best=[x,y,d];if(best&&best[2]>12)break;}
    if(!best)return;p=best;}
  r.x=p[0];r.y=p[1];r.v=0;r.w=0;r.d=0;r.contact=false;S.trailT.push(null);
  logE(`Robot kidnapped to (${p[0].toFixed(1)}, ${p[1].toFixed(1)}). The estimate was not told.`,'bad');draw();refreshAll();
}
function loadLevel(i){""")

# ---------- nomenclature ----------
rep("<option value=\"wp\">Add waypoint</option>","<option value=\"wp\">Add goal</option>")
rep("<option value=\"pose\">Posed goal (drag)</option>","<option value=\"pose\">Goal with heading (drag)</option>")
rep("<option value=\"goal\">Single goal</option>\n          <option value=\"kidnap\">Kidnap robot</option>","<option value=\"goal\">Replace all goals</option>")
rep("""        <button class="btn" id="clearwp" title="Clear all waypoints">Clear</button>""",
"""        <button class="btn" id="clearwp" title="Remove every goal">Clear goals</button>
        <span class="ctl-sep"></span>
        <button class="btn" id="kidnapb" title="Then tap the map where the robot should be teleported (the estimator is not told)" aria-pressed="false">Kidnap…</button>""")
rep('aria-label="Simulation map. Tap to add waypoints."','aria-label="Simulation map. Tap to add goals; scroll to zoom; drag to pan."')
rep("'IDLE · add waypoints'","'IDLE · tap the map to add goals'")
rep("""   <span class="kv">waypoints <b>${done}/${WPS.length}</b></span>""","""   <span class="kv">goals <b>${done}/${WPS.length}</b></span>""")
rep("logE(`Mission: ${F.queue.length} waypoint${F.queue.length>1?'s':''},","logE(`Mission: ${F.queue.length} goal${F.queue.length>1?'s':''},")
rep("logE(`Skipping WP ${wpLabel(F.queue[0])} after 3 attempts`,'bad')","logE(`Skipping goal ${wpLabel(F.queue[0])} after 3 attempts`,'bad')")
rep("logE(`Reached WP ${wpLabel(F.queue[0])} by estimate","logE(`Reached goal ${wpLabel(F.queue[0])} by estimate")
rep("logE(`Skipping WP ${wpLabel(F.queue[0])}: stuck 3 times`,'bad')","logE(`Skipping goal ${wpLabel(F.queue[0])}: stuck 3 times`,'bad')")
rep("logE(`${name}: no path to WP ${wpLabel(F.queue[0])} (${res.reason})`,'bad');","logE(`${name}: no path to goal ${wpLabel(F.queue[0])} (${res.reason})`,'bad');")
rep("logE('All waypoints done. Tap the map to add more.','warn')","logE('All goals done. Tap the map to add more.','warn')")
rep("logE('Up to 8 open waypoints','warn');return;}\n  WPS.push","logE('Up to 8 open goals','warn');return;}\n  WPS.push")
rep("else{if(remaining().length>=8){logE('Up to 8 open waypoints','warn');return;}","else{if(remaining().length>=8){logE('Up to 8 open goals','warn');return;}")
rep("logE('Waypoints cleared');","logE('Goals cleared');")
rep("so localization error shows up as missed waypoints","so localization error shows up as missed goals")
rep("from the robot and every waypoint. Optimal","from the robot and every goal. Optimal")
rep("replaces the path with the farthest visible waypoint, keeping","replaces the path with the farthest visible path point, keeping")
rep("`Path cost from waypoint ${I('i')} to ${I('j')} (Dijkstra on the costmap), used to order waypoints`","`Path cost from goal ${I('i')} to ${I('j')} (Dijkstra on the costmap), used to order goals`")
rep("'Active waypoint; numbers give the visiting order; a dashed body and tick show a goal heading'","'Active goal; numbers give the visiting order; a dashed body and tick show a goal heading'")
rep("// obs.goal   {x, y}          current waypoint","// obs.goal   {x, y}          current goal")
rep("{k:'agents',type:'seg',label:'Moving agents',opts:[['off','Not tracked'],['truth','Ground truth'],['lidar','Lidar tracker']]},",
    "{k:'agents',type:'seg',label:'Agent tracking',opts:[['off','Off'],['truth','Ground truth'],['lidar','Lidar (clusters + Kalman)']]},")
rep("logE(`Moving agents → ${({off:'not tracked',truth:'ground truth',lidar:'lidar tracker'})[v]}`)","logE(`Agent tracking → ${({off:'off',truth:'ground truth',lidar:'lidar'})[v]}`)")
rep("{k:'spd',type:'seg',label:'Moving agents',opts:","{k:'spd',type:'seg',label:'Response to agents',opts:")
rep("'Speed planning needs agent tracking: Perceive → Moving agents.'","'Speed planning needs agent tracking: Perceive → Agent tracking.'")
rep("logE(`Agents (path trackers) → ${","logE(`Response to agents → ${")
rep("<p><b>Moving agents.</b> The lidar tracker takes","<p><b>Agent tracking.</b> The lidar tracker takes")
rep("<p><b>Moving agents with a path tracker: speed planning.</b>","<p><b>Response to agents with a path tracker: speed planning.</b>")
rep("<p><b>Moving agents.</b> The global plan ignores them","<p><b>Agents and the global plan.</b> The global plan ignores them")
# spelling: American
for a,b in [("behaviour","behavior"),("Behaviour","Behavior"),("centre","center"),("Centre","Center"),("manoeuvre","maneuver"),("modelled","modeled"),("Modelled","Modeled"),("tyre","tire"),("colour","color")]:
    s=s.replace(a,b)
# Unicode subscripts → <sub> in HTML prose (not in .eq blocks, not in canvas strings)
SUB={'₀':'0','₁':'1','₂':'2','₃':'3','₄':'4','₅':'5','₆':'6','₇':'7','₈':'8','₉':'9','ₐ':'a','ₑ':'e','ₒ':'o','ₓ':'x','ₕ':'h','ₖ':'k','ₗ':'l','ₘ':'m','ₙ':'n','ₚ':'p','ₛ':'s','ₜ':'t'}
pat=re.compile('['+''.join(SUB)+']+')
def desub(txt):
    parts=re.split(r'(<div class="eq">.*?</div>)',txt,flags=re.S)
    out=[]
    for i,p in enumerate(parts):
        if i%2==1:out.append(p);continue
        out.append(pat.sub(lambda m:'<sub>'+''.join(SUB[c] for c in m.group(0))+'</sub>',p))
    return ''.join(out)
def region(start,end):
    global s
    a=s.index(start);b=s.index(end,a);s=s[:a]+desub(s[a:b])+s[b:]
region("const LEVELS=[","const DEFAULTS=")
region("const SCHEMA={","function buildLevels(){")
region("const LESSONS=[","function learnPane(){")
# chip and metric labels: no forced upper case, so symbols keep their case
rep(".chip span{font-size:.66rem;text-transform:uppercase;letter-spacing:.06em;color:var(--muted)}",".chip span{font-size:.72rem;letter-spacing:.02em;color:var(--muted)}")
rep(".metrics dt{font-size:.66rem;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);white-space:nowrap}",".metrics dt{font-size:.72rem;letter-spacing:.02em;color:var(--muted);white-space:nowrap}")
rep("['NEES (≈3 = consistent)',nees==null?'— (no covariance)':","['NEES (3 = consistent)',nees==null?'—':")

# ---------- parameter tooltips, changed-from-default marks, per-field reset ----------
rep("function fieldHTML(f){",
"""const TIPS={loc:'Which estimator produces the pose the planner and controller use.',assoc:'Whether beacon readings carry their ID. Unlabeled readings are matched by Mahalanobis distance.',npart:'More particles cost CPU and resolve the belief more finely.',inject:'Replace low-weight particles with poses sampled from beacon readings when the likelihood drops.',pfLidar:'Score particles against the prior map with 24 lidar beams.',filtK:'Motion noise the filter assumes, relative to the true noise. Too low makes it overconfident (NEES above 3).',
 per:'Prior map: the planner sees the true static map. Lidar mapping: an occupancy grid built from scans in the estimated frame.',unknownAs:'Whether unobserved cells block the planner.',infl:'Width of the soft cost band outside the lethal radius.',agents:'Off: people reach the stack only as lidar hits. Ground truth: perfect tracks. Lidar: clustering plus a Kalman filter per agent.',agPred:'Constant velocity extrapolates each track; Static freezes it where it is now.',agT:'How far ahead agents are predicted and the speed planner plans.',agGrow:'How fast the predicted radius grows per second of prediction.',agSigA:'White acceleration noise of the constant-velocity model. Higher follows turns faster but gives noisier velocity.',
 mis:'In order visits goals as numbered. Greedy picks the nearest next. Optimal solves the open-path TSP.',replan:'Replan on a timer in addition to the event-driven triggers.',lostGuard:'Stop when the position uncertainty exceeds 1 m.',
 plan:'Global planner on the costmap. Reeds–Shepp and Hybrid A* are car-only.',planPct:'Fraction of the steering limit the planner may use. The rest is margin for the tracker.',eps:'Heuristic weight. Above 1 the search is faster and the path up to ε times longer.',hybH:'Which heuristic guides Hybrid A*.',revOK:'Allow reverse legs with cusps.',revPen:'Cost multiplier on reverse distance.',gearPen:'Fixed cost for each change of direction.',rrtIt:'Samples per RRT* run.',smooth:'Shortcut the path with line-of-sight checks.',agPlan:'When the speed planner cannot avoid an agent, replan around its predicted positions.',
 ctl:'Path tracker that turns the plan into speed and steering.',vcruise:'Speed the reference profile aims for on straights.',spd:'How path trackers react to tracked agents. Ignore: not at all. Reactive stop: brake for hits in the corridor ahead. Speed planning: ST-graph speed profile against the predictions.',stMarg:'Clearance the speed planner keeps from predicted agents.',ppL0:'Lookahead distance at zero speed.',ppK:'Extra lookahead per m/s of speed.',alat:'Lateral acceleration cap that slows the robot in curves.',rwKth:'Heading-error gain of rear-wheel feedback. Higher damps more.',rwKe:'Lateral-error gain of rear-wheel feedback. Higher is stiffer.',stanK:'Stanley cross-track gain.',kp:'Proportional gain on heading error to the carrot.',ki:'Integral gain; removes steady error but adds phase lag.',kd:'Derivative gain on heading error.',dwaG:'DWA weight on distance and heading to the carrot.',dwaO:'DWA weight on clearance.',dwaV:'DWA weight on speed.',dwaT:'How far DWA rolls each candidate out.',
 mpcMode:'NMPC relinearizes every iteration; LTV linearizes once about the reference.',mpcNp:'Prediction horizon in steps of Δt.',mpcNc:'Free input moves; later moves are held at the last one.',mpcDt:'Prediction step.',mpcIt:'SQP iterations per 50 ms tick, within a 15 ms budget.',mpcQlat:'Penalty on lateral error.',mpcQlon:'Penalty on along-track error.',mpcQth:'Penalty on heading error.',mpcQv:'Penalty on speed error.',mpcQf:'Multiplier on the last step of the horizon.',mpcRa:'Penalty on acceleration input.',mpcRs:'Penalty on steering-rate or angular-acceleration input.',mpcRd:'Penalty on the change between consecutive moves.',mpcRho:'Augmented-Lagrangian penalty for the state constraints.',mpcObs:'Add clearance constraints against lidar points and predicted agents.',mpcMarg:'Extra clearance in the obstacle constraints.',mpcLag:'Model the first-order actuator lag with two more states.',
 model:'Unicycle turns in place; the bicycle model steers front wheels and needs motion to turn.',wheelbase:'Distance between axles.',steerMaxDeg:'Steering limit; sets the minimum turning radius.',steerRate:'How fast the steering angle can change.',vmax:'Speed limit.',wmax:'Turn-rate limit of the unicycle.',accel:'Enforce acceleration limits in the vehicle.',amax:'Linear acceleration limit.',alpha:'Angular acceleration limit.',lag:'First-order actuator time constant.',latency:'Ticks a command waits before reaching the actuators.',biasDeg:'Constant offset between commanded and actual steering angle.',biasW:'Constant offset in turn rate, as from one weak motor.',odoK:'Odometry noise scale.',odoB:'Odometry calibration bias the filters are not told about.',lmK:'Beacon range and bearing noise scale.',lmRange:'Beacon sensor range.',clutter:'False beacon detections per scan in unlabeled mode.',lidarSig:'Lidar range noise.',seed:'Seed of the world and sensor noise. Applied on Reset.'};
function lvlDefault(k){return k in (LV.cfg||{})?LV.cfg[k]:DEFAULTS[k];}
function chgMark(f){const d=lvlDefault(f.k);if(d===undefined||P[f.k]===d)return'';return`<button class="rst" data-reset="${f.k}" title="Back to this level's default (${fmtVal(f,d)})">↺</button>`;}
function fieldHTML(f){""")
rep("""  if(f.type==='seg')return`<div class="field"><span class="lbl">${f.label}</span><div class="seg" data-k="${f.k}">""",
    """  if(f.type==='seg')return`<div class="field${chgMark(f)?' chg':''}"><span class="lbl" title="${TIPS[f.k]||''}">${f.label}${chgMark(f)}</span><div class="seg" data-k="${f.k}">""")
rep("""  if(f.type==='bool')return`<label class="check"><input type="checkbox" id="p-${f.k}" data-k="${f.k}" ${P[f.k]?'checked':''}><span>${f.label}</span></label>`;""",
    """  if(f.type==='bool')return`<label class="check${chgMark(f)?' chg':''}" title="${TIPS[f.k]||''}"><input type="checkbox" id="p-${f.k}" data-k="${f.k}" ${P[f.k]?'checked':''}><span>${f.label}${chgMark(f)}</span></label>`;""")
rep("""  return`<div class="field"><div class="row"><label for="p-${f.k}">${f.label}</label><output id="o-${f.k}">${fmtVal(f,P[f.k])}</output></div>""",
    """  return`<div class="field${chgMark(f)?' chg':''}"><div class="row"><label for="p-${f.k}" title="${TIPS[f.k]||''}">${f.label}${chgMark(f)}</label><output id="o-${f.k}">${fmtVal(f,P[f.k])}</output></div>""")
rep("  pane.querySelectorAll('.seg[data-k]').forEach(sg=>",
    "  pane.querySelectorAll('[data-reset]').forEach(b=>b.onclick=e=>{e.preventDefault();e.stopPropagation();const k=b.dataset.reset;setParam(k,lvlDefault(k),false);renderAllPanes();});\n  pane.querySelectorAll('.seg[data-k]').forEach(sg=>")
rep(".field{display:flex;flex-direction:column;gap:5px}",
    ".field{display:flex;flex-direction:column;gap:5px}\n.rst{border:0;background:none;color:var(--accent);cursor:pointer;font-size:.9rem;padding:0 4px;line-height:1}\n.field.chg>.row label,.field.chg>.lbl,.check.chg span{color:var(--accent)}\n.hint{font-size:.85rem;color:var(--muted);background:var(--panel);border:1px dashed var(--line);border-radius:6px;padding:7px 10px;margin:0;display:flex;gap:10px;align-items:center;justify-content:space-between}\n.hint b{color:var(--ink)}\n.pill.ready{color:var(--accent)}")

# ---------- first-run cue + Ready pill ----------
rep("""      <div class="status" id="status"></div>""",
"""      <p class="hint" id="firstrun"><span><b>Press Run</b> to start the mission. Tap the map to add goals. Each level's <b>Try</b> list sets up an experiment with one click, and <b>Learn</b> has guided lessons.</span><button class="linkbtn" id="firstrun-x" type="button">Got it</button></p>
      <div class="status" id="status"></div>""")
rep("""  const st=F.state==='IDLE'&&WPS.length===0?'IDLE · tap the map to add goals':F.state.replace('_',' ');""",
    """  const ready=!running&&S.t===0&&(F.state==='DRIVE'||F.state==='PLAN');
  const st=F.state==='IDLE'&&WPS.length===0?'IDLE · tap the map to add goals':ready?'READY':F.state.replace('_',' ');""")
rep("""  $('#status').innerHTML=`<span class="pill ${STATE_CLS[F.state]}">${st}</span>""","""  $('#status').innerHTML=`<span class="pill ${ready?'ready':STATE_CLS[F.state]}">${st}</span>""")
rep("""$('#run').onclick=()=>{
  running=!running;""","""let firstRun=true;function firstRunDone(){if(!firstRun)return;firstRun=false;const h=$('#firstrun');if(h)h.hidden=true;}
$('#firstrun-x').onclick=firstRunDone;
$('#run').onclick=()=>{
  running=!running;if(running)firstRunDone();""")
# kidnap: button arms the tap mode; the select keeps the goal modes
rep("""$('#tapsel').onchange=e=>{tapMode=e.target.value;cv.style.touchAction=tapMode==='pose'?'none':'manipulation';};""",
"""$('#tapsel').onchange=e=>{tapMode=e.target.value;$('#kidnapb').setAttribute('aria-pressed','false');cv.style.touchAction=tapMode==='pose'?'none':'manipulation';};
$('#kidnapb').onclick=()=>{const on=tapMode!=='kidnap';tapMode=on?'kidnap':$('#tapsel').value;$('#kidnapb').setAttribute('aria-pressed',String(on));if(on)logE('Tap the map where the robot should be teleported','warn');};""")
rep("""    S.robot.x=x;S.robot.y=y;S.robot.v=0;S.robot.w=0;S.robot.d=0;S.robot.contact=false;S.trailT.push(null);
    logE(`Robot kidnapped to (${x.toFixed(1)}, ${y.toFixed(1)}). The estimate was not told.`,'bad');draw();refreshAll();return;""",
"""    kidnapTo([x,y]);tapMode=$('#tapsel').value;$('#kidnapb').setAttribute('aria-pressed','false');return;""")
rep("""seg($('#plotsel'),[['ex','x error'],['eth','θ error'],['cte','Cross-track'],['v','Speed'],['turn','Steering'],['st','ST graph']],()=>plotCh,v=>{plotCh=v;drawPlot();});""",
"""const PLOT_OPTS=[['pos','Position error'],['eth','θ error'],['cte','Cross-track'],['v','Speed'],['turn','Steering'],['st','ST graph']];
seg($('#plotsel'),PLOT_OPTS,()=>plotCh,v=>{plotCh=v;drawPlot();});""")
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
open('nav-stack-lab.html','w').write(s)
